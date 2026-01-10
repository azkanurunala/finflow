#!/usr/bin/env python3
"""
Backend API Testing Script for AI Personal Finance Assistant
Tests complete transaction flow including Indonesian language parsing, exports, and AI insights
"""

import asyncio
import aiohttp
import json
import uuid
import csv
import io
from datetime import datetime, timedelta

# Backend URL from frontend/.env
BACKEND_URL = "https://cashflow-ai-14.preview.emergentagent.com/api"

class ComprehensiveBackendTester:
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
    
    async def test_export_csv(self):
        """Test 9: Export transactions as CSV"""
        print("\n📊 Testing CSV Export...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/export/transactions?format=csv&days=30", headers=headers) as response:
                if response.status == 200:
                    # Check content type
                    content_type = response.headers.get("content-type", "")
                    if "text/csv" in content_type:
                        csv_content = await response.text()
                        
                        # Parse CSV to verify structure
                        csv_reader = csv.reader(io.StringIO(csv_content))
                        headers_row = next(csv_reader)
                        rows = list(csv_reader)
                        
                        expected_headers = ["Date", "Merchant", "Category", "Amount", "Currency", "Type", "Notes", "Source"]
                        
                        if headers_row == expected_headers:
                            print(f"✅ CSV export successful")
                            print(f"   Headers: {headers_row}")
                            print(f"   Rows: {len(rows)}")
                            if len(rows) > 0:
                                print(f"   Sample row: {rows[0]}")
                            return True
                        else:
                            print(f"❌ CSV headers incorrect. Expected: {expected_headers}, Got: {headers_row}")
                            return False
                    else:
                        print(f"❌ Wrong content type. Expected text/csv, got: {content_type}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ CSV export failed: {response.status} - {error_text}")
                    return False
    
    async def test_export_json(self):
        """Test 10: Export transactions as JSON"""
        print("\n📊 Testing JSON Export...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/export/transactions?format=json&days=30", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check required fields
                    required_fields = ["transactions", "exported_at", "total_count"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        print(f"✅ JSON export successful")
                        print(f"   Fields: {list(data.keys())}")
                        print(f"   Total count: {data['total_count']}")
                        print(f"   Transactions array length: {len(data['transactions'])}")
                        
                        # Check transactions array structure
                        if len(data["transactions"]) > 0:
                            sample_tx = data["transactions"][0]
                            tx_fields = ["id", "amount", "currency", "category", "date", "transaction_type"]
                            has_required = all(field in sample_tx for field in tx_fields)
                            
                            if has_required:
                                print(f"   Sample transaction fields verified")
                                return True
                            else:
                                missing_tx_fields = [f for f in tx_fields if f not in sample_tx]
                                print(f"❌ Sample transaction missing fields: {missing_tx_fields}")
                                return False
                        else:
                            print("   No transactions in export (empty array)")
                            return True  # Still valid response
                    else:
                        print(f"❌ JSON missing required fields: {missing_fields}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ JSON export failed: {response.status} - {error_text}")
                    return False
    
    async def test_ai_insights(self):
        """Test 11: AI-powered insights"""
        print("\n🤖 Testing AI Insights...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/insights/ai?days=30", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check required fields
                    required_fields = ["summary", "insights", "recommendations", "spending_trend", "chart_data"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        print(f"✅ AI insights successful")
                        print(f"   Summary: {data['summary'][:100]}...")
                        print(f"   Insights count: {len(data['insights'])}")
                        print(f"   Recommendations count: {len(data['recommendations'])}")
                        print(f"   Spending trend: {data['spending_trend']}")
                        
                        # Check chart_data structure
                        chart_data = data.get("chart_data", {})
                        if "by_category" in chart_data and "income_vs_expenses" in chart_data:
                            income_vs_exp = chart_data["income_vs_expenses"]
                            if all(key in income_vs_exp for key in ["income", "expenses", "net"]):
                                print(f"   Chart data verified: Income={income_vs_exp['income']}, Expenses={income_vs_exp['expenses']}, Net={income_vs_exp['net']}")
                                return True
                            else:
                                print(f"❌ Income vs expenses missing fields")
                                return False
                        else:
                            print(f"❌ Chart data missing required fields")
                            return False
                    else:
                        print(f"❌ AI insights missing required fields: {missing_fields}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ AI insights failed: {response.status} - {error_text}")
                    return False
    
    async def test_specific_indonesian_parsing(self):
        """Test 12: Specific Indonesian parsing from review request - 'gaji masuk 15jt'"""
        print("\n🇮🇩 Testing Specific Indonesian Parsing (Review Request)...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        test_data = {"text": "gaji masuk 15jt"}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/transactions/chat", json=test_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction", {})
                    
                    # Check expected values from review request
                    expected_amount = 15000000  # 15 million IDR
                    expected_currency = "IDR"
                    expected_type = "income"
                    expected_category = "Income"
                    
                    amount = transaction.get("amount")
                    currency = transaction.get("currency")
                    trans_type = transaction.get("transaction_type")
                    category = transaction.get("category")
                    
                    print(f"✅ Specific Indonesian parsing test")
                    print(f"   Input: 'gaji masuk 15jt'")
                    print(f"   Amount: {amount} (expected: {expected_amount}) {'✅' if amount == expected_amount else '❌'}")
                    print(f"   Currency: {currency} (expected: {expected_currency}) {'✅' if currency == expected_currency else '❌'}")
                    print(f"   Type: {trans_type} (expected: {expected_type}) {'✅' if trans_type == expected_type else '❌'}")
                    print(f"   Category: {category} (expected: {expected_category}) {'✅' if category == expected_category else '❌'}")
                    
                    # All checks must pass
                    success = (amount == expected_amount and 
                             currency == expected_currency and 
                             trans_type == expected_type and 
                             category == expected_category)
                    
                    return success
                else:
                    error_text = await response.text()
                    print(f"❌ Specific Indonesian parsing failed: {response.status} - {error_text}")
                    return False
    
    async def test_currency_preservation(self):
        """Test 13: Currency preservation (IDR not converted to USD)"""
        print("\n💱 Testing Currency Preservation...")
        
        if not self.session_token:
            print("❌ No session token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test cases for currency preservation
        test_cases = [
            {"text": "beli kopi 25rb", "expected_currency": "IDR", "expected_amount": 25000},
            {"text": "spent $50 on groceries", "expected_currency": "USD", "expected_amount": 50.0}
        ]
        
        all_passed = True
        
        async with aiohttp.ClientSession() as session:
            for i, test_case in enumerate(test_cases):
                print(f"\n   Test {i+1}: {test_case['text']}")
                
                async with session.post(f"{BACKEND_URL}/transactions/chat", json={"text": test_case["text"]}, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        transaction = data.get("transaction", {})
                        
                        currency = transaction.get("currency")
                        amount = transaction.get("amount")
                        
                        # Check currency preservation
                        if currency == test_case["expected_currency"]:
                            print(f"     ✅ Currency preserved: {currency}")
                        else:
                            print(f"     ❌ Currency not preserved: expected {test_case['expected_currency']}, got {currency}")
                            all_passed = False
                        
                        # Check amount
                        if amount == test_case["expected_amount"]:
                            print(f"     ✅ Amount correct: {amount}")
                        else:
                            print(f"     ❌ Amount wrong: expected {test_case['expected_amount']}, got {amount}")
                            all_passed = False
                    else:
                        print(f"     ❌ Request failed: {response.status}")
                        all_passed = False
        
        if all_passed:
            print(f"\n✅ Currency preservation test PASSED")
        else:
            print(f"\n❌ Currency preservation test FAILED")
        
        return all_passed
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Comprehensive Backend Testing (Indonesian + Export + AI Features)")
        print("=" * 80)
        
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
        
        # NEW TESTS FROM REVIEW REQUEST
        
        # Test 9: CSV Export
        result9 = await self.test_export_csv()
        test_results.append(("Export CSV", result9))
        
        # Test 10: JSON Export
        result10 = await self.test_export_json()
        test_results.append(("Export JSON", result10))
        
        # Test 11: AI Insights
        result11 = await self.test_ai_insights()
        test_results.append(("AI Insights", result11))
        
        # Test 12: Specific Indonesian Parsing (Review Request)
        result12 = await self.test_specific_indonesian_parsing()
        test_results.append(("Specific Indonesian Parsing (gaji masuk 15jt)", result12))
        
        # Test 13: Currency Preservation
        result13 = await self.test_currency_preservation()
        test_results.append(("Currency Preservation", result13))
        
        return test_results

async def main():
    """Main test execution"""
    tester = ComprehensiveBackendTester()
    results = await tester.run_all_tests()
    
    print("\n" + "=" * 80)
    print("📊 COMPREHENSIVE TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:<40} {status}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend features are fully functional!")
    else:
        print("⚠️ Some tests failed - check individual test results above")
        
    # Highlight new features from review request
    print("\n" + "=" * 80)
    print("🔍 REVIEW REQUEST FEATURES STATUS")
    print("=" * 80)
    
    review_features = [
        ("Export CSV", results[-5][1] if len(results) >= 5 else False),
        ("Export JSON", results[-4][1] if len(results) >= 4 else False),
        ("AI Insights", results[-3][1] if len(results) >= 3 else False),
        ("Indonesian Parsing (gaji masuk 15jt)", results[-2][1] if len(results) >= 2 else False),
        ("Currency Preservation", results[-1][1] if len(results) >= 1 else False)
    ]
    
    for feature, status in review_features:
        status_text = "✅ WORKING" if status else "❌ FAILED"
        print(f"{feature:<35} {status_text}")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)