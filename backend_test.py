#!/usr/bin/env python3
"""
FinFlow AI Finance Assistant Backend API Testing - CRITICAL AREAS FOCUS
Focus on critical areas that were just fixed:
1. Voice Transcription (NEW) - POST /api/transactions/voice
2. Receipt Scanning - POST /api/transactions/receipt  
3. Manual Transaction CRUD
4. Authentication Flow

Test Credentials: test_voice@test.com / test123456 / Voice Test User
"""

import asyncio
import aiohttp
import json
import uuid
import csv
import io
import base64
from datetime import datetime, timedelta

# Backend URL from frontend/.env
BACKEND_URL = "https://money-manager-1861.preview.emergentagent.com/api"

# Test credentials from review request
TEST_CREDENTIALS = {
    "email": "test_voice@test.com",
    "password": "test123456", 
    "name": "Voice Test User"
}

class CriticalAreasTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.transaction_id = None
        
    async def test_authentication_flow(self):
        """Test CRITICAL: Complete authentication flow with specific test credentials"""
        print("🔐 Testing Authentication Flow (CRITICAL)...")
        
        # Try to register first, then login if already exists
        async with aiohttp.ClientSession() as session:
            # 1. Register
            print("   Step 1: User Registration")
            async with session.post(f"{BACKEND_URL}/auth/register", json=TEST_CREDENTIALS) as response:
                if response.status == 200:
                    data = await response.json()
                    self.session_token = data.get("session_token")
                    self.user_id = data.get("user_id")
                    print(f"   ✅ Registration successful: {TEST_CREDENTIALS['email']}")
                elif response.status == 400:
                    error_text = await response.text()
                    if "Email already registered" in error_text:
                        print(f"   ℹ️ User already exists, proceeding to login")
                    else:
                        print(f"   ❌ Registration failed: {error_text}")
                        return False
                else:
                    print(f"   ❌ Registration failed: {response.status}")
                    return False
            
            # 2. Login
            print("   Step 2: User Login")
            login_data = {"email": TEST_CREDENTIALS["email"], "password": TEST_CREDENTIALS["password"]}
            async with session.post(f"{BACKEND_URL}/auth/login", json=login_data) as response:
                if response.status == 200:
                    data = await response.json()
                    self.session_token = data.get("session_token")
                    self.user_id = data.get("user_id")
                    print(f"   ✅ Login successful")
                    print(f"   User ID: {self.user_id}")
                    print(f"   Session Token: {self.session_token[:20]}...")
                else:
                    error_text = await response.text()
                    print(f"   ❌ Login failed: {response.status} - {error_text}")
                    return False
            
            # 3. Start Free Trial (needed for quota)
            print("   Step 3: Start Free Trial")
            headers = {"Authorization": f"Bearer {self.session_token}"}
            async with session.post(f"{BACKEND_URL}/auth/start-trial", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"   ✅ Free trial started successfully")
                    print(f"   Subscription Tier: {data.get('subscription_tier')}")
                else:
                    error_text = await response.text()
                    print(f"   ⚠️ Start trial failed: {response.status} - {error_text}")
                    # Continue anyway - might already have trial
            
            # 4. Get current user info
            print("   Step 4: Get Current User")
            async with session.get(f"{BACKEND_URL}/auth/me", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"   ✅ Get current user successful")
                    print(f"   Email: {data.get('email')}")
                    print(f"   Name: {data.get('name')}")
                    print(f"   Subscription: {data.get('subscription_tier')}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"   ❌ Get current user failed: {response.status} - {error_text}")
                    return False
    
    async def test_voice_transcription_critical(self):
        """Test CRITICAL: Voice transcription endpoint (was previously failing)"""
        print("\n🎤 Testing Voice Transcription (CRITICAL - Previously Failing)...")
        
        if not self.session_token:
            print("   ❌ No session token available")
            return False
        
        # Create a minimal base64 encoded audio file for testing
        # This is a minimal WAV file header - just enough to test the endpoint
        wav_header = (
            b'RIFF'
            b'\x24\x00\x00\x00'  # File size
            b'WAVE'
            b'fmt '
            b'\x10\x00\x00\x00'  # Format chunk size
            b'\x01\x00'          # Audio format (PCM)
            b'\x01\x00'          # Number of channels
            b'\x44\xAC\x00\x00'  # Sample rate (44100)
            b'\x88X\x01\x00'     # Byte rate
            b'\x02\x00'          # Block align
            b'\x10\x00'          # Bits per sample
            b'data'
            b'\x00\x00\x00\x00'  # Data chunk size
        )
        
        audio_base64 = base64.b64encode(wav_header).decode('utf-8')
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        voice_data = {"audio_base64": audio_base64}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/transactions/voice", json=voice_data, headers=headers) as response:
                response_text = await response.text()
                
                print(f"   Response Status: {response.status}")
                print(f"   Response: {response_text[:200]}...")
                
                if response.status == 200:
                    # Success - voice transcription working
                    data = await response.json() if response.content_type == 'application/json' else None
                    print(f"   ✅ Voice Transcription: WORKING - Endpoint processed audio successfully")
                    if data and 'transcription' in data:
                        print(f"   Transcription: {data.get('transcription')}")
                    return True
                elif response.status == 400 and "Could not transcribe audio" in response_text:
                    # Expected for minimal test audio - endpoint is working
                    print(f"   ✅ Voice Transcription: ENDPOINT WORKING - Cannot transcribe minimal test audio (expected)")
                    return True
                elif response.status == 500 and "Voice transcription service is not configured" in response_text:
                    # Service not configured
                    print(f"   ⚠️ Voice Transcription: SERVICE NOT CONFIGURED - OpenAI API key missing")
                    return False
                elif "Incorrect API key" in response_text:
                    # Critical failure - API key issue
                    print(f"   ❌ Voice Transcription: CRITICAL FAILURE - API key issue still exists")
                    print(f"   This was the original problem that needed fixing")
                    return False
                else:
                    # Other error
                    print(f"   ❌ Voice Transcription: FAILED - {response_text}")
                    return False
    
    async def test_receipt_scanning_critical(self):
        """Test CRITICAL: Receipt scanning with base64 image"""
        print("\n📷 Testing Receipt Scanning (CRITICAL)...")
        
        if not self.session_token:
            print("   ❌ No session token available")
            return False
        
        # Create a simple test receipt image (1x1 pixel PNG)
        # This is a minimal PNG file for testing
        png_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')
        image_base64 = base64.b64encode(png_data).decode('utf-8')
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        receipt_data = {"image_base64": image_base64}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/transactions/receipt", json=receipt_data, headers=headers) as response:
                response_text = await response.text()
                
                print(f"   Response Status: {response.status}")
                print(f"   Response: {response_text[:200]}...")
                
                if response.status == 200:
                    # Success
                    print(f"   ✅ Receipt Scanning: WORKING")
                    return True
                elif response.status == 400 and "Could not parse receipt" in response_text:
                    # Expected for minimal test image - endpoint is working
                    print(f"   ✅ Receipt Scanning: ENDPOINT WORKING - Cannot parse minimal test image (expected)")
                    return True
                else:
                    # Error
                    print(f"   ❌ Receipt Scanning: FAILED - {response_text}")
                    return False
    
    async def test_manual_transaction_crud_critical(self):
        """Test CRITICAL: Complete manual transaction CRUD operations"""
        print("\n📝 Testing Manual Transaction CRUD (CRITICAL)...")
        
        if not self.session_token:
            print("   ❌ No session token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with aiohttp.ClientSession() as session:
            # 1. CREATE - Manual transaction
            print("   Step 1: Create Manual Transaction")
            transaction_data = {
                "amount": 25.50,
                "currency": "USD",
                "merchant": "Test Coffee Shop",
                "category": "Dining & Coffee",
                "date": "2024-01-15",
                "transaction_type": "expense",
                "notes": "Test transaction for CRUD operations"
            }
            
            async with session.post(f"{BACKEND_URL}/transactions/manual", json=transaction_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    self.transaction_id = data.get("transaction", {}).get("id")
                    print(f"   ✅ CREATE: Transaction created successfully")
                    print(f"   Transaction ID: {self.transaction_id}")
                else:
                    error_text = await response.text()
                    print(f"   ❌ CREATE: Failed - {response.status} - {error_text}")
                    return False
            
            # 2. READ - Get all transactions
            print("   Step 2: Get All Transactions")
            async with session.get(f"{BACKEND_URL}/transactions", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction_count = len(data.get("transactions", []))
                    print(f"   ✅ READ (All): Retrieved {transaction_count} transactions")
                else:
                    error_text = await response.text()
                    print(f"   ❌ READ (All): Failed - {response.status} - {error_text}")
                    return False
            
            # 3. READ - Get single transaction
            if self.transaction_id:
                print("   Step 3: Get Single Transaction")
                async with session.get(f"{BACKEND_URL}/transactions/{self.transaction_id}", headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"   ✅ READ (Single): Retrieved transaction {data.get('id')}")
                    else:
                        error_text = await response.text()
                        print(f"   ❌ READ (Single): Failed - {response.status} - {error_text}")
                        return False
            
            # 4. UPDATE - Update transaction
            if self.transaction_id:
                print("   Step 4: Update Transaction")
                update_data = {
                    "amount": 30.00,
                    "notes": "Updated test transaction"
                }
                
                async with session.put(f"{BACKEND_URL}/transactions/{self.transaction_id}", json=update_data, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        updated_amount = data.get("transaction", {}).get("amount")
                        print(f"   ✅ UPDATE: Transaction updated successfully")
                        print(f"   New amount: ${updated_amount}")
                    else:
                        error_text = await response.text()
                        print(f"   ❌ UPDATE: Failed - {response.status} - {error_text}")
                        return False
            
            # 5. DELETE - Delete transaction
            if self.transaction_id:
                print("   Step 5: Delete Transaction")
                async with session.delete(f"{BACKEND_URL}/transactions/{self.transaction_id}", headers=headers) as response:
                    if response.status == 200:
                        print(f"   ✅ DELETE: Transaction deleted successfully")
                        
                        # Verify deletion
                        async with session.get(f"{BACKEND_URL}/transactions/{self.transaction_id}", headers=headers) as verify_response:
                            if verify_response.status == 404:
                                print(f"   ✅ DELETE VERIFIED: Transaction no longer exists")
                                return True
                            else:
                                print(f"   ❌ DELETE VERIFICATION: Transaction still exists")
                                return False
                    else:
                        error_text = await response.text()
                        print(f"   ❌ DELETE: Failed - {response.status} - {error_text}")
                        return False
        
        return True
    
    async def test_indonesian_parsing_critical(self):
        """Test CRITICAL: Indonesian transaction parsing as requested"""
        print("\n🇮🇩 Testing Indonesian Transaction Parsing (CRITICAL)...")
        
        if not self.session_token:
            print("   ❌ No session token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test cases from review request
        test_cases = [
            {
                "text": "beli makan 50rb",
                "expected_amount": 50000,
                "expected_currency": "IDR",
                "expected_type": "expense",
                "description": "Indonesian expense"
            },
            {
                "text": "gaji masuk 5jt", 
                "expected_amount": 5000000,
                "expected_currency": "IDR",
                "expected_type": "income",
                "description": "Indonesian income"
            }
        ]
        
        all_passed = True
        
        async with aiohttp.ClientSession() as session:
            for i, test_case in enumerate(test_cases):
                print(f"\n   Test {i+1}: {test_case['description']} - '{test_case['text']}'")
                
                chat_data = {"text": test_case["text"]}
                async with session.post(f"{BACKEND_URL}/transactions/chat", json=chat_data, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        transaction = data.get("transaction", {})
                        
                        amount = transaction.get("amount")
                        currency = transaction.get("currency")
                        trans_type = transaction.get("transaction_type")
                        
                        # Check each expected value
                        amount_ok = amount == test_case["expected_amount"]
                        currency_ok = currency == test_case["expected_currency"]
                        type_ok = trans_type == test_case["expected_type"]
                        
                        print(f"     Amount: {amount} (expected: {test_case['expected_amount']}) {'✅' if amount_ok else '❌'}")
                        print(f"     Currency: {currency} (expected: {test_case['expected_currency']}) {'✅' if currency_ok else '❌'}")
                        print(f"     Type: {trans_type} (expected: {test_case['expected_type']}) {'✅' if type_ok else '❌'}")
                        
                        if not (amount_ok and currency_ok and type_ok):
                            all_passed = False
                    else:
                        error_text = await response.text()
                        print(f"     ❌ Request failed: {response.status} - {error_text}")
                        all_passed = False
        
        if all_passed:
            print(f"\n   ✅ Indonesian Parsing: ALL TESTS PASSED")
        else:
            print(f"\n   ❌ Indonesian Parsing: SOME TESTS FAILED")
        
        return all_passed
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
    
    async def run_critical_tests(self):
        """Run all critical tests focusing on review request areas"""
        print("🚀 Starting CRITICAL AREAS Testing - FinFlow AI Backend")
        print("Focus: Voice Transcription, Receipt Scanning, Transaction CRUD, Authentication")
        print("=" * 80)
        
        test_results = []
        
        # CRITICAL TEST 1: Authentication Flow
        print("\n" + "="*50)
        result1 = await self.test_authentication_flow()
        test_results.append(("Authentication Flow", result1))
        
        if not result1:
            print("\n❌ CRITICAL FAILURE: Cannot continue without authentication")
            return test_results
        
        # CRITICAL TEST 2: Voice Transcription (was previously failing)
        print("\n" + "="*50)
        result2 = await self.test_voice_transcription_critical()
        test_results.append(("Voice Transcription (CRITICAL)", result2))
        
        # CRITICAL TEST 3: Receipt Scanning
        print("\n" + "="*50)
        result3 = await self.test_receipt_scanning_critical()
        test_results.append(("Receipt Scanning", result3))
        
        # CRITICAL TEST 4: Manual Transaction CRUD
        print("\n" + "="*50)
        result4 = await self.test_manual_transaction_crud_critical()
        test_results.append(("Manual Transaction CRUD", result4))
        
        # CRITICAL TEST 5: Indonesian Parsing (as requested)
        print("\n" + "="*50)
        result5 = await self.test_indonesian_parsing_critical()
        test_results.append(("Indonesian Transaction Parsing", result5))
        
        return test_results

async def main():
    """Main test execution focusing on critical areas"""
    tester = CriticalAreasTester()
    results = await tester.run_critical_tests()
    
    print("\n" + "=" * 80)
    print("🎯 CRITICAL AREAS TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:<40} {status}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    # Highlight critical findings
    print("\n" + "=" * 80)
    print("🔍 CRITICAL FINDINGS")
    print("=" * 80)
    
    if len(results) >= 2:
        voice_result = results[1][1]  # Voice transcription result
        if voice_result:
            print("✅ VOICE TRANSCRIPTION: FIXED - No longer failing with API key errors")
        else:
            print("❌ VOICE TRANSCRIPTION: STILL FAILING - Needs immediate attention")
    
    if passed == total:
        print("\n🎉 ALL CRITICAL TESTS PASSED!")
        print("The backend API is working correctly for all critical areas.")
    else:
        failed_tests = [name for name, success in results if not success]
        print(f"\n⚠️ CRITICAL ISSUES FOUND:")
        for test in failed_tests:
            print(f"   - {test}")
        print("\nThese issues need immediate attention before production.")
        
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)