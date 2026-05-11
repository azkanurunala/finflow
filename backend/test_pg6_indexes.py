"""PG6 — verify ensure_mongo_indexes calls create_index for every planned
spec and survives per-spec failures without crashing."""

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


class TestPG6Indexes(unittest.IsolatedAsyncioTestCase):

    async def test_ensures_all_seven_planned_indexes(self):
        """ensure_mongo_indexes calls create_index on every collection in the plan."""
        collections = ["transactions", "user_sessions", "notifications", "coupons"]
        for name in collections:
            setattr(server.db, name, MagicMock())
            getattr(server.db, name).create_index = AsyncMock()

        # The function also accesses via db[name] subscript — wire that up too.
        def fake_getitem(name):
            return getattr(server.db, name)
        server.db.__getitem__ = MagicMock(side_effect=fake_getitem)

        await server.ensure_mongo_indexes()

        # transactions: 3 indexes
        self.assertEqual(server.db.transactions.create_index.await_count, 3)
        # user_sessions: 2 indexes (token + TTL)
        self.assertEqual(server.db.user_sessions.create_index.await_count, 2)
        # notifications: 1 index
        self.assertEqual(server.db.notifications.create_index.await_count, 1)
        # coupons: 1 index
        self.assertEqual(server.db.coupons.create_index.await_count, 1)

    async def test_unique_flags_are_passed_through(self):
        for name in ["transactions", "user_sessions", "notifications", "coupons"]:
            setattr(server.db, name, MagicMock())
            getattr(server.db, name).create_index = AsyncMock()
        server.db.__getitem__ = MagicMock(side_effect=lambda n: getattr(server.db, n))

        await server.ensure_mongo_indexes()

        # Session token index must be unique
        session_calls = server.db.user_sessions.create_index.await_args_list
        session_kwargs = [c.kwargs for c in session_calls]
        self.assertTrue(any(k.get("unique") is True and k.get("name") == "idx_session_token" for k in session_kwargs))
        # Session TTL index must carry expireAfterSeconds
        self.assertTrue(any(k.get("expireAfterSeconds") == 0 and k.get("name") == "idx_session_ttl" for k in session_kwargs))
        # Coupon code index must be unique
        coupon_kwargs = [c.kwargs for c in server.db.coupons.create_index.await_args_list]
        self.assertTrue(any(k.get("unique") is True for k in coupon_kwargs))

    async def test_one_failing_spec_does_not_abort_others(self):
        """If a single create_index raises, remaining specs still run and no
        exception escapes ensure_mongo_indexes."""
        for name in ["transactions", "user_sessions", "notifications", "coupons"]:
            setattr(server.db, name, MagicMock())
            getattr(server.db, name).create_index = AsyncMock()
        server.db.__getitem__ = MagicMock(side_effect=lambda n: getattr(server.db, n))

        # Make the first transactions index raise; others succeed.
        server.db.transactions.create_index = AsyncMock(
            side_effect=[Exception("stale spec"), None, None]
        )

        # Must not raise.
        await server.ensure_mongo_indexes()

        # All three transactions attempts still made.
        self.assertEqual(server.db.transactions.create_index.await_count, 3)
        # Subsequent collections still ran.
        self.assertEqual(server.db.user_sessions.create_index.await_count, 2)
        self.assertEqual(server.db.coupons.create_index.await_count, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
