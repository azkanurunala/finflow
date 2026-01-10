#!/usr/bin/env python3
"""
Complete Transaction Flow Test for AI Personal Finance Assistant
Tests the exact flow requested in the review request
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://income-expense-view.preview.emergentagent.com/api"

async def test_complete_transaction_flow():
    """Test the complete transaction flow as requested"""
    print("🚀 Starting Complete Transaction Flow Test")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    session_token = None
    user_id = None
    
    async with aiohttp.ClientSession() as session:
        
        # Step 1: Register a new test user
        print("1. 📝 Testing User Registration...")
        try:
            unique_id = str(uuid.uuid4())[:8]
            user_data = {
                "name": f"Sarah Johnson {unique_id}",
                "email": f"sarah.johnson.{unique_id}@example.com", 
                "password": "SecurePass123!"
            }
            
            async with session.post(f"{BACKEND_URL}/auth/register", json=user_data) as response:
                if response.status == 200:
                    data = await response.json()
                    session_token = data.get("session_token")
                    user_id = data.get("user_id")
                    print(f"   ✅ SUCCESS: User created - {data['name']} ({data['email']})")
                    print(f"   📋 Session Token: {session_token[:20]}...")
                else:
                    error_text = await response.text()
                    print(f"   ❌ FAILED: {response.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
            return False
        
        # Step 2: Start free trial
        print("\n2. 🎯 Testing Start Free Trial...")
        try:
            headers = {"Authorization": f"Bearer {session_token}"}
            
            async with session.post(f"{BACKEND_URL}/auth/start-trial", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"   ✅ SUCCESS: Free trial started")
                    print(f"   📅 Expires: {data.get('expires_at')}")
                else:
                    error_text = await response.text()
                    print(f"   ❌ FAILED: {response.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
            return False
        
        # Step 3: Test chat transaction
        print("\n3. 💬 Testing Chat Transaction...")
        try:
            headers = {"Authorization": f"Bearer {session_token}"}
            transaction_text = {"text": "Spent $25 on lunch at McDonalds"}
            
            async with session.post(f"{BACKEND_URL}/transactions/chat", 
                                  json=transaction_text, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction")
                    print(f"   ✅ SUCCESS: Transaction created")
                    print(f"   💰 Amount: ${transaction['amount']}")
                    print(f"   🏪 Merchant: {transaction.get('merchant', 'N/A')}")
                    print(f"   📂 Category: {transaction.get('category', 'N/A')}")
                    print(f"   📝 Message: {data.get('message', 'N/A')}")
                else:
                    error_text = await response.text()
                    print(f"   ❌ FAILED: {response.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
            return False
        
        # Step 4: Test get transactions
        print("\n4. 📋 Testing Get Transactions...")
        try:
            headers = {"Authorization": f"Bearer {session_token}"}
            
            async with session.get(f"{BACKEND_URL}/transactions", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transactions = data.get("transactions", [])
                    count = data.get("count", 0)
                    
                    print(f"   ✅ SUCCESS: Retrieved {count} transactions")
                    
                    if transactions:
                        # Show the McDonald's transaction
                        mcdonalds_tx = next((t for t in transactions 
                                           if t.get("merchant", "").lower() == "mcdonalds"), None)
                        if mcdonalds_tx:
                            print(f"   🍟 McDonald's transaction found: ${mcdonalds_tx['amount']} - {mcdonalds_tx['category']}")
                        else:
                            print(f"   ⚠️  McDonald's transaction not found in list")
                else:
                    error_text = await response.text()
                    print(f"   ❌ FAILED: {response.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
            return False
        
        # Step 5: Test get insights
        print("\n5. 📊 Testing Get Insights...")
        try:
            headers = {"Authorization": f"Bearer {session_token}"}
            
            async with session.get(f"{BACKEND_URL}/insights?days=30", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"   ✅ SUCCESS: Financial insights retrieved")
                    print(f"   💸 Total Expenses: ${data['total_expenses']}")
                    print(f"   💰 Total Income: ${data['total_income']}")
                    print(f"   📈 Net Balance: ${data['net']}")
                    print(f"   📅 Period: {data['period']}")
                    
                    if data.get('by_category'):
                        print(f"   📂 Categories: {list(data['by_category'].keys())}")
                else:
                    error_text = await response.text()
                    print(f"   ❌ FAILED: {response.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
            return False
        
        # Step 6: Test subscription status
        print("\n6. 🎫 Testing Subscription Status...")
        try:
            headers = {"Authorization": f"Bearer {session_token}"}
            
            async with session.get(f"{BACKEND_URL}/subscription", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"   ✅ SUCCESS: Subscription status retrieved")
                    print(f"   🎯 Tier: {data['tier']} ({data['tier_name']})")
                    print(f"   ✅ Active: {data['is_active']}")
                    print(f"   📅 Days Remaining: {data.get('days_remaining', 'N/A')}")
                    
                    # Show usage stats
                    usage = data.get('usage', {})
                    print(f"   📊 Usage: {usage.get('total_actions', 0)} total actions today")
                else:
                    error_text = await response.text()
                    print(f"   ❌ FAILED: {response.status} - {error_text}")
                    return False
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
            return False
    
    print("\n" + "=" * 60)
    print("🎉 COMPLETE TRANSACTION FLOW TEST: ALL STEPS PASSED!")
    print("=" * 60)
    print("✅ 1. User Registration")
    print("✅ 2. Start Free Trial")
    print("✅ 3. Chat Transaction Processing")
    print("✅ 4. Get Transactions List")
    print("✅ 5. Get Financial Insights")
    print("✅ 6. Get Subscription Status")
    print("\n🚀 The complete transaction flow is working correctly!")
    
    return True

async def main():
    """Main test execution"""
    try:
        success = await test_complete_transaction_flow()
        
        if success:
            print("\n✅ TEST RESULT: PASSED")
            return 0
        else:
            print("\n❌ TEST RESULT: FAILED")
            return 1
            
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)