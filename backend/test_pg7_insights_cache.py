"""PG7 — verify per-user 60s insights cache: hit/miss/invalidate, cross-
user isolation, TTL expiry, and that every mutation handler invalidates."""

import sys
import os
import unittest
from unittest.mock import MagicMock, patch, AsyncMock

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

sys.modules["emergentintegrations"] = MagicMock()
sys.modules["emergentintegrations.llm"] = MagicMock()
sys.modules["emergentintegrations.llm.chat"] = MagicMock()

with patch("motor.motor_asyncio.AsyncIOMotorClient") as MockClient:
    mock_db = MagicMock()
    MockClient.return_value.__getitem__.return_value = mock_db
    import server


def _flush_cache():
    server._insights_cache.clear()


class _FakeResponse:
    def __init__(self):
        self.headers: dict[str, str] = {}


class TestPG7InsightsCache(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        _flush_cache()

    async def test_cache_get_set_basic_roundtrip(self):
        server._insights_cache_set("u1", "insights", 30, {"foo": "bar"})
        got = server._insights_cache_get("u1", "insights", 30)
        self.assertEqual(got, {"foo": "bar"})

    async def test_cache_keys_segregate_by_user(self):
        server._insights_cache_set("u1", "insights", 30, {"u": 1})
        server._insights_cache_set("u2", "insights", 30, {"u": 2})
        self.assertEqual(server._insights_cache_get("u1", "insights", 30), {"u": 1})
        self.assertEqual(server._insights_cache_get("u2", "insights", 30), {"u": 2})

    async def test_cache_keys_segregate_by_endpoint(self):
        server._insights_cache_set("u1", "insights", 30, {"plain": True})
        server._insights_cache_set("u1", "insights_ai", 30, {"ai": True})
        self.assertEqual(server._insights_cache_get("u1", "insights", 30), {"plain": True})
        self.assertEqual(server._insights_cache_get("u1", "insights_ai", 30), {"ai": True})

    async def test_cache_keys_segregate_by_days(self):
        server._insights_cache_set("u1", "insights", 30, {"d": 30})
        server._insights_cache_set("u1", "insights", 7, {"d": 7})
        self.assertEqual(server._insights_cache_get("u1", "insights", 30), {"d": 30})
        self.assertEqual(server._insights_cache_get("u1", "insights", 7), {"d": 7})

    async def test_ttl_expires_entry(self):
        with patch.object(server._pg7_time, "monotonic", side_effect=[100.0, 100.0, 161.0]):
            server._insights_cache_set("u1", "insights", 30, {"v": 1})
            self.assertEqual(server._insights_cache_get("u1", "insights", 30), {"v": 1})
            # third call sees 161s elapsed → expired, returns None
            self.assertIsNone(server._insights_cache_get("u1", "insights", 30))

    async def test_invalidate_clears_only_named_user(self):
        server._insights_cache_set("u1", "insights", 30, {"u": 1})
        server._insights_cache_set("u1", "insights_ai", 30, {"u": 1})
        server._insights_cache_set("u2", "insights", 30, {"u": 2})
        server._invalidate_insights("u1")
        self.assertIsNone(server._insights_cache_get("u1", "insights", 30))
        self.assertIsNone(server._insights_cache_get("u1", "insights_ai", 30))
        self.assertEqual(server._insights_cache_get("u2", "insights", 30), {"u": 2})

    async def test_get_insights_handler_hit_miss(self):
        # First call: cache miss, queries Mongo, sets X-Cache: MISS
        server.db.transactions.find = MagicMock(
            return_value=MagicMock(to_list=AsyncMock(return_value=[
                {"transaction_type": "expense", "amount": 50.0, "category": "Food"},
                {"transaction_type": "income",  "amount": 100.0, "category": "Salary"},
            ]))
        )
        user = server.User(user_id="u1", email="e", name="n", created_at=server.datetime.now())
        resp1 = _FakeResponse()
        out1 = await server.get_insights(response=resp1, days=30, current_user=user)
        self.assertEqual(resp1.headers["X-Cache"], "MISS")
        self.assertAlmostEqual(out1["total_expenses"], 50.0)
        self.assertAlmostEqual(out1["total_income"], 100.0)

        # Second call within TTL: HIT, no Mongo call needed
        server.db.transactions.find.reset_mock()
        resp2 = _FakeResponse()
        out2 = await server.get_insights(response=resp2, days=30, current_user=user)
        self.assertEqual(resp2.headers["X-Cache"], "HIT")
        self.assertEqual(out1, out2)
        server.db.transactions.find.assert_not_called()

    async def test_invalidate_after_mutation_makes_next_call_miss(self):
        server.db.transactions.find = MagicMock(
            return_value=MagicMock(to_list=AsyncMock(return_value=[]))
        )
        user = server.User(user_id="u-mut", email="e", name="n", created_at=server.datetime.now())
        r1 = _FakeResponse()
        await server.get_insights(response=r1, days=30, current_user=user)
        self.assertEqual(r1.headers["X-Cache"], "MISS")

        # Hit
        r2 = _FakeResponse()
        await server.get_insights(response=r2, days=30, current_user=user)
        self.assertEqual(r2.headers["X-Cache"], "HIT")

        # Simulate a mutation handler invalidating the user
        server._invalidate_insights("u-mut")

        # Next call is a MISS again
        r3 = _FakeResponse()
        await server.get_insights(response=r3, days=30, current_user=user)
        self.assertEqual(r3.headers["X-Cache"], "MISS")

    async def test_cross_user_isolation_on_handler(self):
        server.db.transactions.find = MagicMock(
            return_value=MagicMock(to_list=AsyncMock(return_value=[
                {"transaction_type": "expense", "amount": 10.0, "category": "X"}
            ]))
        )
        u1 = server.User(user_id="u1", email="a", name="A", created_at=server.datetime.now())
        u2 = server.User(user_id="u2", email="b", name="B", created_at=server.datetime.now())

        r1 = _FakeResponse()
        await server.get_insights(response=r1, days=30, current_user=u1)
        self.assertEqual(r1.headers["X-Cache"], "MISS")
        # u2's first call must also be a MISS — they don't share u1's cache
        r2 = _FakeResponse()
        await server.get_insights(response=r2, days=30, current_user=u2)
        self.assertEqual(r2.headers["X-Cache"], "MISS")


if __name__ == "__main__":
    unittest.main(verbosity=2)
