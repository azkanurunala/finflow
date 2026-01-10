#!/usr/bin/env python3
"""
Backend API Testing Script for Indonesian Transaction Flow
Tests complete transaction flow including Indonesian language parsing and manual transactions
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timedelta

# Backend URL from frontend/.env
BACKEND_URL = "https://cashflow-ai-14.preview.emergentagent.com/api"

class IndonesianTransactionTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.transaction_id = None
        
    async def test_user_registration(self):
        """Test 1: Register a new test user"""
        print("🔐 Testing User Registration...")
        
        # Generate unique test user
        test_email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
        test_data = {
            "email": test_email,
            "password": "testpass123",
            "name": "Test User Indonesian"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/auth/register", json=test_data) as response:
                if response.status == 200:
                    data = await response.json()
                    self.session_token = data.get("session_token")
                    self.user_id = data.get("user_id")
                    print(f"✅ Registration successful: {test_email}")
                    print(f"   User ID: {self.user_id}")
                    print(f"   Session Token: {self.session_token[:20]}...")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Registration failed: {response.status} - {error_text}")
                    return False
    
    async def test_start_trial(self):
        """Test 2: Start free trial"""
        print("\n🎯 Testing Start Free Trial...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/auth/start-trial", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Free trial started successfully")
                    print(f"   Subscription Tier: {data.get('subscription_tier')}")
                    print(f"   Expires At: {data.get('expires_at')}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Start trial failed: {response.status} - {error_text}")
                    return False
    
    async def test_indonesian_income_parsing(self):
        """Test 3: Indonesian income parsing - 'lembur dapat 5jt'"""
        print("\n🇮🇩 Testing Indonesian Income Parsing...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        test_data = {"text": "lembur dapat 5jt"}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/transactions/chat", json=test_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction", {})
                    
                    # Verify expected values
                    expected_amount = 5000000
                    expected_currency = "IDR"
                    expected_type = "income"
                    expected_category = "Income"
                    
                    amount = transaction.get("amount")
                    currency = transaction.get("currency")
                    trans_type = transaction.get("transaction_type")
                    category = transaction.get("category")
                    
                    print(f"✅ Indonesian income parsing successful")
                    print(f"   Text: 'lembur dapat 5jt'")
                    print(f"   Amount: {amount} (expected: {expected_amount}) {'✅' if amount == expected_amount else '❌'}")
                    print(f"   Currency: {currency} (expected: {expected_currency}) {'✅' if currency == expected_currency else '❌'}")
                    print(f"   Type: {trans_type} (expected: {expected_type}) {'✅' if trans_type == expected_type else '❌'}")
                    print(f"   Category: {category} (expected: {expected_category}) {'✅' if category == expected_category else '❌'}")
                    
                    # Store transaction ID for later tests
                    self.transaction_id = transaction.get("id")
                    
                    # Check if all expected values match
                    success = (amount == expected_amount and 
                             currency == expected_currency and 
                             trans_type == expected_type and 
                             category == expected_category)
                    
                    return success
                else:
                    error_text = await response.text()
                    print(f"❌ Indonesian income parsing failed: {response.status} - {error_text}")
                    return False
    
    async def test_indonesian_expense_parsing(self):
        """Test 4: Indonesian expense parsing - 'beli makan 50rb'"""
        print("\n🇮🇩 Testing Indonesian Expense Parsing...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        test_data = {"text": "beli makan 50rb"}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/transactions/chat", json=test_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction", {})
                    
                    # Verify expected values
                    expected_amount = 50000
                    expected_currency = "IDR"
                    expected_type = "expense"
                    
                    amount = transaction.get("amount")
                    currency = transaction.get("currency")
                    trans_type = transaction.get("transaction_type")
                    category = transaction.get("category")
                    
                    print(f"✅ Indonesian expense parsing successful")
                    print(f"   Text: 'beli makan 50rb'")
                    print(f"   Amount: {amount} (expected: {expected_amount}) {'✅' if amount == expected_amount else '❌'}")
                    print(f"   Currency: {currency} (expected: {expected_currency}) {'✅' if currency == expected_currency else '❌'}")
                    print(f"   Type: {trans_type} (expected: {expected_type}) {'✅' if trans_type == expected_type else '❌'}")
                    print(f"   Category: {category}")
                    
                    # Check if critical values match
                    success = (amount == expected_amount and 
                             currency == expected_currency and 
                             trans_type == expected_type)
                    
                    return success
                else:
                    error_text = await response.text()
                    print(f"❌ Indonesian expense parsing failed: {response.status} - {error_text}")
                    return False
    
    async def test_manual_transaction(self):
        """Test 5: Manual transaction creation"""
        print("\n📝 Testing Manual Transaction Creation...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        test_data = {
            "amount": 1500000,
            "currency": "IDR",
            "merchant": "Gaji",
            "category": "Income",
            "date": "2026-01-10",
            "transaction_type": "income"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/transactions/manual", json=test_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction", {})
                    
                    print(f"✅ Manual transaction created successfully")
                    print(f"   Amount: {transaction.get('amount')}")
                    print(f"   Currency: {transaction.get('currency')}")
                    print(f"   Merchant: {transaction.get('merchant')}")
                    print(f"   Category: {transaction.get('category')}")
                    print(f"   Type: {transaction.get('transaction_type')}")
                    
                    # Store this transaction ID for update/get/delete tests
                    self.transaction_id = transaction.get("id")
                    print(f"   Transaction ID: {self.transaction_id}")
                    
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Manual transaction creation failed: {response.status} - {error_text}")
                    return False
    
    async def test_update_transaction(self):
        """Test 6: Update transaction amount to 2000000"""
        print("\n✏️ Testing Transaction Update...")
        
        if not self.session_token or not self.transaction_id:
            print("❌ No session token or transaction ID available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        update_data = {"amount": 2000000}
        
        async with aiohttp.ClientSession() as session:
            async with session.put(f"{BACKEND_URL}/transactions/{self.transaction_id}", json=update_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction", {})
                    
                    updated_amount = transaction.get("amount")
                    print(f"✅ Transaction updated successfully")
                    print(f"   New Amount: {updated_amount} (expected: 2000000) {'✅' if updated_amount == 2000000 else '❌'}")
                    
                    return updated_amount == 2000000
                else:
                    error_text = await response.text()
                    print(f"❌ Transaction update failed: {response.status} - {error_text}")
                    return False
    
    async def test_get_single_transaction(self):
        """Test 7: Get single transaction"""
        print("\n🔍 Testing Get Single Transaction...")
        
        if not self.session_token or not self.transaction_id:
            print("❌ No session token or transaction ID available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/transactions/{self.transaction_id}", headers=headers) as response:
                if response.status == 200:
                    transaction = await response.json()
                    
                    print(f"✅ Single transaction retrieved successfully")
                    print(f"   ID: {transaction.get('id')}")
                    print(f"   Amount: {transaction.get('amount')}")
                    print(f"   Currency: {transaction.get('currency')}")
                    print(f"   Merchant: {transaction.get('merchant')}")
                    print(f"   Category: {transaction.get('category')}")
                    
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Get single transaction failed: {response.status} - {error_text}")
                    return False
    
    async def test_delete_transaction(self):
        """Test 8: Delete transaction"""
        print("\n🗑️ Testing Transaction Deletion...")
        
        if not self.session_token or not self.transaction_id:
            print("❌ No session token or transaction ID available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.delete(f"{BACKEND_URL}/transactions/{self.transaction_id}", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Transaction deleted successfully")
                    print(f"   Message: {data.get('message')}")
                    
                    # Verify deletion by trying to get the transaction
                    async with session.get(f"{BACKEND_URL}/transactions/{self.transaction_id}", headers=headers) as verify_response:
                        if verify_response.status == 404:
                            print(f"✅ Deletion verified - transaction not found")
                            return True
                        else:
                            print(f"❌ Deletion verification failed - transaction still exists")
                            return False
                else:
                    error_text = await response.text()
                    print(f"❌ Transaction deletion failed: {response.status} - {error_text}")
                    return False
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Complete Indonesian Transaction Flow Testing")
        print("=" * 60)
        
        test_results = []
        
        # Test 1: User Registration
        result1 = await self.test_user_registration()
        test_results.append(("User Registration", result1))
        
        if not result1:
            print("\n❌ Cannot continue without successful registration")
            return test_results
        
        # Test 2: Start Free Trial
        result2 = await self.test_start_trial()
        test_results.append(("Start Free Trial", result2))
        
        # Test 3: Indonesian Income Parsing
        result3 = await self.test_indonesian_income_parsing()
        test_results.append(("Indonesian Income Parsing", result3))
        
        # Test 4: Indonesian Expense Parsing
        result4 = await self.test_indonesian_expense_parsing()
        test_results.append(("Indonesian Expense Parsing", result4))
        
        # Test 5: Manual Transaction
        result5 = await self.test_manual_transaction()
        test_results.append(("Manual Transaction", result5))
        
        if not result5:
            print("\n❌ Cannot continue transaction CRUD tests without manual transaction")
            return test_results
        
        # Test 6: Update Transaction
        result6 = await self.test_update_transaction()
        test_results.append(("Update Transaction", result6))
        
        # Test 7: Get Single Transaction
        result7 = await self.test_get_single_transaction()
        test_results.append(("Get Single Transaction", result7))
        
        # Test 8: Delete Transaction
        result8 = await self.test_delete_transaction()
        test_results.append(("Delete Transaction", result8))
        
        return test_results

async def main():
    """Main test execution"""
    tester = IndonesianTransactionTester()
    results = await tester.run_all_tests()
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:<30} {status}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Indonesian transaction flow is fully functional!")
    else:
        print("⚠️ Some tests failed - check individual test results above")

if __name__ == "__main__":
    asyncio.run(main())