#!/usr/bin/env python3
"""
Backend API Testing for Email/Password Authentication and Onboarding Flow
Tests the new authentication endpoints as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://money-manager-1863.preview.emergentagent.com/api"

class AuthTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        # Use timestamp to make email unique
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.test_email = f"testuser_{timestamp}@example.com"
        self.test_password = "password123"
        self.test_name = "Test User"
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_register(self):
        """Test POST /api/auth/register - Register a new user with email/password"""
        self.log("Testing user registration...")
        
        payload = {
            "name": self.test_name,
            "email": self.test_email,
            "password": self.test_password
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register", json=payload)
            self.log(f"Register response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Register response: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                required_fields = ["user_id", "email", "name", "session_token", "onboarding_completed"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"❌ FAIL: Missing fields in response: {missing_fields}", "ERROR")
                    return False
                
                # Validate values
                if data["email"] != self.test_email.lower():
                    self.log(f"❌ FAIL: Email mismatch. Expected: {self.test_email.lower()}, Got: {data['email']}", "ERROR")
                    return False
                    
                if data["name"] != self.test_name:
                    self.log(f"❌ FAIL: Name mismatch. Expected: {self.test_name}, Got: {data['name']}", "ERROR")
                    return False
                    
                if data["onboarding_completed"] != False:
                    self.log(f"❌ FAIL: onboarding_completed should be False for new user, got: {data['onboarding_completed']}", "ERROR")
                    return False
                
                # Store for subsequent tests
                self.session_token = data["session_token"]
                self.user_id = data["user_id"]
                
                self.log("✅ PASS: User registration successful", "SUCCESS")
                return True
            else:
                self.log(f"❌ FAIL: Registration failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ FAIL: Registration request failed: {str(e)}", "ERROR")
            return False
    
    def test_login(self):
        """Test POST /api/auth/login - Login with the registered user"""
        self.log("Testing user login...")
        
        payload = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json=payload)
            self.log(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Login response: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                required_fields = ["user_id", "email", "name", "session_token", "onboarding_completed"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"❌ FAIL: Missing fields in response: {missing_fields}", "ERROR")
                    return False
                
                # Validate values match registration
                if data["user_id"] != self.user_id:
                    self.log(f"❌ FAIL: User ID mismatch. Expected: {self.user_id}, Got: {data['user_id']}", "ERROR")
                    return False
                    
                if data["email"] != self.test_email.lower():
                    self.log(f"❌ FAIL: Email mismatch. Expected: {self.test_email.lower()}, Got: {data['email']}", "ERROR")
                    return False
                
                # Update session token
                self.session_token = data["session_token"]
                
                self.log("✅ PASS: User login successful", "SUCCESS")
                return True
            else:
                self.log(f"❌ FAIL: Login failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ FAIL: Login request failed: {str(e)}", "ERROR")
            return False
    
    def test_get_me(self):
        """Test GET /api/auth/me - Get current user info"""
        self.log("Testing get current user info...")
        
        if not self.session_token:
            self.log("❌ FAIL: No session token available for /me test", "ERROR")
            return False
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        try:
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
            self.log(f"Get me response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Get me response: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                required_fields = ["user_id", "email", "name", "onboarding_completed"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"❌ FAIL: Missing fields in response: {missing_fields}", "ERROR")
                    return False
                
                # Validate values
                if data["user_id"] != self.user_id:
                    self.log(f"❌ FAIL: User ID mismatch. Expected: {self.user_id}, Got: {data['user_id']}", "ERROR")
                    return False
                
                # Check subscription status fields are present
                if "subscription_tier" not in data:
                    self.log("❌ FAIL: Missing subscription_tier in response", "ERROR")
                    return False
                
                self.log("✅ PASS: Get current user info successful", "SUCCESS")
                return True
            else:
                self.log(f"❌ FAIL: Get me failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ FAIL: Get me request failed: {str(e)}", "ERROR")
            return False
    
    def test_update_onboarding(self):
        """Test PUT /api/auth/onboarding - Update user onboarding preferences"""
        self.log("Testing update onboarding preferences...")
        
        if not self.session_token:
            self.log("❌ FAIL: No session token available for onboarding test", "ERROR")
            return False
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        payload = {
            "language": "en",
            "currency": "USD"
        }
        
        try:
            response = requests.put(f"{BACKEND_URL}/auth/onboarding", json=payload, headers=headers)
            self.log(f"Update onboarding response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Update onboarding response: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                if "success" not in data:
                    self.log("❌ FAIL: Missing 'success' field in response", "ERROR")
                    return False
                
                if data["success"] != True:
                    self.log(f"❌ FAIL: Expected success=true, got: {data['success']}", "ERROR")
                    return False
                
                self.log("✅ PASS: Update onboarding preferences successful", "SUCCESS")
                return True
            else:
                self.log(f"❌ FAIL: Update onboarding failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ FAIL: Update onboarding request failed: {str(e)}", "ERROR")
            return False
    
    def test_start_trial(self):
        """Test POST /api/auth/start-trial - Start free trial for user"""
        self.log("Testing start free trial...")
        
        if not self.session_token:
            self.log("❌ FAIL: No session token available for start trial test", "ERROR")
            return False
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/start-trial", headers=headers)
            self.log(f"Start trial response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Start trial response: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                required_fields = ["success", "subscription_tier", "expires_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"❌ FAIL: Missing fields in response: {missing_fields}", "ERROR")
                    return False
                
                if data["success"] != True:
                    self.log(f"❌ FAIL: Expected success=true, got: {data['success']}", "ERROR")
                    return False
                
                if data["subscription_tier"] != "free_trial":
                    self.log(f"❌ FAIL: Expected subscription_tier=free_trial, got: {data['subscription_tier']}", "ERROR")
                    return False
                
                self.log("✅ PASS: Start free trial successful", "SUCCESS")
                return True
            else:
                self.log(f"❌ FAIL: Start trial failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ FAIL: Start trial request failed: {str(e)}", "ERROR")
            return False
    
    def test_login_failures(self):
        """Test login failure scenarios - wrong password and non-existent email"""
        self.log("Testing login failure scenarios...")
        
        # Test 1: Wrong password
        self.log("Testing login with wrong password...")
        payload = {
            "email": self.test_email,
            "password": "wrongpassword"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json=payload)
            self.log(f"Wrong password response status: {response.status_code}")
            
            if response.status_code == 401:
                self.log("✅ PASS: Wrong password correctly rejected with 401", "SUCCESS")
            else:
                self.log(f"❌ FAIL: Wrong password should return 401, got {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ FAIL: Wrong password test failed: {str(e)}", "ERROR")
            return False
        
        # Test 2: Non-existent email
        self.log("Testing login with non-existent email...")
        payload = {
            "email": "nonexistent@example.com",
            "password": "anypassword"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json=payload)
            self.log(f"Non-existent email response status: {response.status_code}")
            
            if response.status_code == 401:
                self.log("✅ PASS: Non-existent email correctly rejected with 401", "SUCCESS")
                return True
            else:
                self.log(f"❌ FAIL: Non-existent email should return 401, got {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ FAIL: Non-existent email test failed: {str(e)}", "ERROR")
            return False
    
    def cleanup_test_user(self):
        """Clean up test user if needed"""
        self.log("Test user cleanup not implemented - manual cleanup may be needed")
    
    def run_all_tests(self):
        """Run all authentication tests"""
        self.log("=" * 60)
        self.log("STARTING EMAIL/PASSWORD AUTHENTICATION TESTS")
        self.log("=" * 60)
        
        tests = [
            ("User Registration", self.test_register),
            ("User Login", self.test_login),
            ("Get Current User", self.test_get_me),
            ("Update Onboarding", self.test_update_onboarding),
            ("Start Free Trial", self.test_start_trial),
            ("Login Failure Scenarios", self.test_login_failures)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            self.log(f"\n--- Running: {test_name} ---")
            try:
                if test_func():
                    passed += 1
                else:
                    self.log(f"❌ {test_name} FAILED", "ERROR")
            except Exception as e:
                self.log(f"❌ {test_name} FAILED with exception: {str(e)}", "ERROR")
        
        self.log("\n" + "=" * 60)
        self.log(f"TEST SUMMARY: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        self.log("=" * 60)
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!", "SUCCESS")
            return True
        else:
            self.log(f"⚠️  {total - passed} tests failed", "ERROR")
            return False

if __name__ == "__main__":
    tester = AuthTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)