
import sys
import os
import asyncio
from datetime import datetime, timezone
import unittest
from unittest.mock import MagicMock, patch, AsyncMock

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Mock dependencies that might be missing or cause side effects
sys.modules["emergentintegrations"] = MagicMock()
sys.modules["emergentintegrations.llm"] = MagicMock()
sys.modules["emergentintegrations.llm.chat"] = MagicMock()

# Mock Motor Client before importing server
with patch("motor.motor_asyncio.AsyncIOMotorClient") as MockClient:
    mock_db = MagicMock()
    MockClient.return_value.__getitem__.return_value = mock_db
    
    # Import server
    try:
        import server
        from server import (
            create_manual_transaction, 
            update_transaction, 
            delete_transaction, 
            get_transactions,
            ManualTransactionRequest,
            UpdateTransactionRequest,
            User
        )
    except ImportError as e:
        print(f"FAILED to import server.py: {e}")
        sys.exit(1)

class TestSyncLogic(unittest.IsolatedAsyncioTestCase):
    
    async def test_create_sets_sync_fields(self):
        """Test that creating a transaction sets updated_at and is_deleted=False"""
        # Setup
        server.db.transactions.insert_one = AsyncMock()
        server.db.transactions.find_one = AsyncMock(return_value={"id": "123", "amount": 100})
        server.notify_transaction_created = AsyncMock() # Mock notification
        
        user = User(user_id="user1", email="test@test.com", name="Test", created_at=datetime.now())
        req = ManualTransactionRequest(
            amount=100.0, 
            currency="USD", 
            category="Food", 
            date="2024-01-01", 
            transaction_type="expense",
            notes="test"
        )
        
        # Action
        await create_manual_transaction(req, user)
        
        # Verify
        call_args = server.db.transactions.insert_one.call_args[0][0]
        self.assertIn("updated_at", call_args)
        self.assertIn("is_deleted", call_args)
        self.assertFalse(call_args["is_deleted"])
        self.assertIsInstance(call_args["updated_at"], datetime)
        print("✅ Create Transaction: Sets updated_at and is_deleted=False")

    async def test_update_updates_timestamp(self):
        """Test that updating a transaction updates updated_at"""
        # Setup
        server.db.transactions.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        server.db.transactions.find_one = AsyncMock(return_value={"id": "123"})
        
        user = User(user_id="user1", email="test@test.com", name="Test", created_at=datetime.now())
        req = UpdateTransactionRequest(amount=200.0)
        
        # Action
        await update_transaction("tx1", req, user)
        
        # Verify
        call_args = server.db.transactions.update_one.call_args[0][1]
        self.assertIn("$set", call_args)
        self.assertIn("updated_at", call_args["$set"])
        self.assertIn("is_deleted", call_args["$set"])
        self.assertFalse(call_args["$set"]["is_deleted"]) # Should undelete
        print("✅ Update Transaction: Updates timestamp and ensures is_deleted=False")

    async def test_delete_is_soft(self):
        """Test that delete is a soft delete"""
        # Setup
        server.db.transactions.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        user = User(user_id="user1", email="test@test.com", name="Test", created_at=datetime.now())
        
        # Action
        await delete_transaction("tx1", user)
        
        # Verify
        # Should call update_one, NOT delete_one
        server.db.transactions.update_one.assert_called_once()
        call_args = server.db.transactions.update_one.call_args[0][1]
        self.assertTrue(call_args["$set"]["is_deleted"])
        self.assertIn("updated_at", call_args["$set"])
        print("✅ Delete Transaction: Performs soft delete (is_deleted=True)")

if __name__ == "__main__":
    unittest.main(verbosity=0)
