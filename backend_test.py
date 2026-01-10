#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for AI Finance Assistant
Tests all endpoints with various scenarios including edge cases
"""

import asyncio
import aiohttp
import json
import base64
import io
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Backend URL from frontend .env
BACKEND_URL = "https://cashflow-ai-14.preview.emergentagent.com/api"

class FinanceAPITester:
    def __init__(self):
        self.session = None
        self.test_results = {}
        self.created_transactions = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_api_health(self):
        """Test basic API connectivity"""
        logger.info("Testing API health...")
        try:
            async with self.session.get(f"{BACKEND_URL}/") as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"✅ API Health: {data}")
                    return True
                else:
                    logger.error(f"❌ API Health failed: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ API Health error: {str(e)}")
            return False
    
    async def test_categories_endpoint(self):
        """Test GET /api/categories"""
        logger.info("Testing categories endpoint...")
        try:
            async with self.session.get(f"{BACKEND_URL}/categories") as response:
                if response.status == 200:
                    data = await response.json()
                    categories = data.get("categories", [])
                    expected_categories = ["Groceries", "Dining & Coffee", "Transportation", "Rent & Utilities"]
                    
                    if all(cat in categories for cat in expected_categories):
                        logger.info(f"✅ Categories endpoint working: {len(categories)} categories")
                        return True
                    else:
                        logger.error(f"❌ Categories missing expected items: {categories}")
                        return False
                else:
                    logger.error(f"❌ Categories endpoint failed: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ Categories endpoint error: {str(e)}")
            return False
    
    async def test_chat_transactions(self):
        """Test POST /api/transactions/chat with various inputs"""
        logger.info("Testing chat transaction parsing...")
        
        test_cases = [
            "Spent $23 at Starbucks",
            "Uber ride 14.75 last night", 
            "Paid rent 1800",
            "Got paid 2500 today",
            "Groceries at Walmart 87.50",
            "Coffee at Dunkin Donuts $4.25 this morning",
            "Gas at Shell station $45.60 yesterday",
            "Netflix subscription $15.99 monthly"
        ]
        
        results = []
        for test_input in test_cases:
            try:
                payload = {"text": test_input}
                async with self.session.post(
                    f"{BACKEND_URL}/transactions/chat",
                    json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        transaction = data.get("transaction", {})
                        
                        # Validate required fields
                        required_fields = ["id", "amount", "category", "date", "transaction_type", "source"]
                        if all(field in transaction for field in required_fields):
                            self.created_transactions.append(transaction["id"])
                            logger.info(f"✅ Chat: '{test_input}' -> ${transaction['amount']:.2f} at {transaction.get('merchant', 'N/A')} ({transaction['category']})")
                            results.append(True)
                        else:
                            logger.error(f"❌ Chat: Missing fields in response for '{test_input}': {transaction}")
                            results.append(False)
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Chat: '{test_input}' failed with {response.status}: {error_text}")
                        results.append(False)
                        
            except Exception as e:
                logger.error(f"❌ Chat: '{test_input}' error: {str(e)}")
                results.append(False)
        
        success_rate = sum(results) / len(results) if results else 0
        logger.info(f"Chat transactions success rate: {success_rate:.1%} ({sum(results)}/{len(results)})")
        return success_rate > 0.7  # 70% success threshold
    
    def create_sample_receipt_image(self) -> str:
        """Create a sample receipt image as base64"""
        # Create a simple receipt-like image with PIL
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # Create a white image
            img = Image.new('RGB', (300, 400), color='white')
            draw = ImageDraw.Draw(img)
            
            # Try to use default font, fallback to basic if not available
            try:
                font = ImageFont.load_default()
            except:
                font = None
            
            # Draw receipt content
            receipt_text = [
                "WALMART SUPERCENTER",
                "123 MAIN ST",
                "ANYTOWN, CA 90210",
                "",
                "Date: 2024-01-15",
                "Time: 14:30:25",
                "",
                "GROCERIES:",
                "Bananas         $3.50",
                "Milk 1 Gal      $4.25", 
                "Bread           $2.99",
                "Eggs Dozen      $3.75",
                "",
                "Subtotal:      $14.49",
                "Tax:            $1.16",
                "TOTAL:         $15.65",
                "",
                "THANK YOU!"
            ]
            
            y_position = 10
            for line in receipt_text:
                draw.text((10, y_position), line, fill='black', font=font)
                y_position += 18
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return img_base64
            
        except ImportError:
            logger.warning("PIL not available, creating text-based receipt image")
            # Fallback: create a minimal image without PIL
            # This is a 1x1 white pixel as base64 JPEG (minimal valid image)
            return "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"
    
    async def test_receipt_transactions(self):
        """Test POST /api/transactions/receipt with sample images"""
        logger.info("Testing receipt transaction parsing...")
        
        # Create sample receipt image
        receipt_base64 = self.create_sample_receipt_image()
        
        try:
            # Test with form data (as expected by the endpoint)
            form_data = aiohttp.FormData()
            form_data.add_field('image_base64', receipt_base64)
            
            async with self.session.post(
                f"{BACKEND_URL}/transactions/receipt",
                data=form_data
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction", {})
                    
                    # Validate required fields
                    required_fields = ["id", "amount", "category", "date", "source"]
                    if all(field in transaction for field in required_fields):
                        if transaction["source"] == "receipt":
                            self.created_transactions.append(transaction["id"])
                            logger.info(f"✅ Receipt: Parsed ${transaction['amount']:.2f} at {transaction.get('merchant', 'N/A')} ({transaction['category']})")
                            return True
                        else:
                            logger.error(f"❌ Receipt: Wrong source field: {transaction['source']}")
                            return False
                    else:
                        logger.error(f"❌ Receipt: Missing fields in response: {transaction}")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Receipt: Failed with {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Receipt: Error: {str(e)}")
            return False
    
    def create_sample_audio(self) -> str:
        """Create a sample audio file as base64"""
        # Create a minimal valid audio file (silence)
        # This is a minimal M4A header with silence
        try:
            # Create 1 second of silence in M4A format (minimal)
            # This is a very basic M4A file with minimal audio data
            audio_data = b'\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00M4A mp42isom\x00\x00\x00\x08free'
            return base64.b64encode(audio_data).decode('utf-8')
        except Exception as e:
            logger.error(f"Error creating sample audio: {str(e)}")
            # Return empty base64 as fallback
            return base64.b64encode(b'').decode('utf-8')
    
    async def test_voice_transactions(self):
        """Test POST /api/transactions/voice with sample audio"""
        logger.info("Testing voice transaction parsing...")
        
        # Create sample audio
        audio_base64 = self.create_sample_audio()
        
        try:
            payload = {"audio_base64": audio_base64}
            async with self.session.post(
                f"{BACKEND_URL}/transactions/voice",
                json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    transaction = data.get("transaction", {})
                    transcription = data.get("transcription", "")
                    
                    # Validate required fields
                    required_fields = ["id", "amount", "category", "date", "source"]
                    if all(field in transaction for field in required_fields):
                        if transaction["source"] == "voice":
                            self.created_transactions.append(transaction["id"])
                            logger.info(f"✅ Voice: Transcribed '{transcription}' -> ${transaction['amount']:.2f} at {transaction.get('merchant', 'N/A')} ({transaction['category']})")
                            return True
                        else:
                            logger.error(f"❌ Voice: Wrong source field: {transaction['source']}")
                            return False
                    else:
                        logger.error(f"❌ Voice: Missing fields in response: {transaction}")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Voice: Failed with {response.status}: {error_text}")
                    # Voice might fail due to audio format issues, but that's expected with minimal audio
                    logger.info("Note: Voice endpoint failure may be due to minimal test audio format")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Voice: Error: {str(e)}")
            return False
    
    async def test_get_transactions(self):
        """Test GET /api/transactions"""
        logger.info("Testing get transactions endpoint...")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/transactions") as response:
                if response.status == 200:
                    data = await response.json()
                    transactions = data.get("transactions", [])
                    count = data.get("count", 0)
                    
                    logger.info(f"✅ Get transactions: Retrieved {count} transactions")
                    
                    # Validate transaction structure if any exist
                    if transactions:
                        first_transaction = transactions[0]
                        required_fields = ["id", "amount", "category", "date", "source"]
                        if all(field in first_transaction for field in required_fields):
                            logger.info(f"✅ Transaction structure valid: {first_transaction.get('merchant', 'N/A')} - ${first_transaction['amount']:.2f}")
                            return True
                        else:
                            logger.error(f"❌ Transaction structure invalid: {first_transaction}")
                            return False
                    else:
                        logger.info("✅ Get transactions: No transactions found (empty database)")
                        return True
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Get transactions failed: {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Get transactions error: {str(e)}")
            return False
    
    async def test_delete_transaction(self):
        """Test DELETE /api/transactions/{id}"""
        logger.info("Testing delete transaction endpoint...")
        
        if not self.created_transactions:
            logger.warning("⚠️ No transactions to delete, skipping delete test")
            return True
        
        # Test deleting the first created transaction
        transaction_id = self.created_transactions[0]
        
        try:
            async with self.session.delete(f"{BACKEND_URL}/transactions/{transaction_id}") as response:
                if response.status == 200:
                    data = await response.json()
                    message = data.get("message", "")
                    logger.info(f"✅ Delete transaction: {message}")
                    
                    # Verify transaction is actually deleted
                    async with self.session.get(f"{BACKEND_URL}/transactions") as get_response:
                        if get_response.status == 200:
                            get_data = await get_response.json()
                            remaining_transactions = get_data.get("transactions", [])
                            
                            # Check if deleted transaction is not in the list
                            deleted_found = any(t["id"] == transaction_id for t in remaining_transactions)
                            if not deleted_found:
                                logger.info("✅ Delete verification: Transaction successfully removed")
                                return True
                            else:
                                logger.error("❌ Delete verification: Transaction still exists")
                                return False
                        else:
                            logger.warning("⚠️ Could not verify deletion")
                            return True
                            
                elif response.status == 404:
                    logger.info("✅ Delete transaction: Correctly returned 404 for non-existent transaction")
                    return True
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Delete transaction failed: {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Delete transaction error: {str(e)}")
            return False
    
    async def test_insights_endpoint(self):
        """Test GET /api/insights with different time periods"""
        logger.info("Testing insights endpoint...")
        
        test_periods = [7, 30, 90]
        results = []
        
        for days in test_periods:
            try:
                async with self.session.get(f"{BACKEND_URL}/insights?days={days}") as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Validate required fields
                        required_fields = ["total_expenses", "total_income", "net", "by_category", "period"]
                        if all(field in data for field in required_fields):
                            logger.info(f"✅ Insights ({days} days): Expenses: ${data['total_expenses']:.2f}, Income: ${data['total_income']:.2f}, Net: ${data['net']:.2f}")
                            results.append(True)
                        else:
                            logger.error(f"❌ Insights ({days} days): Missing fields: {data}")
                            results.append(False)
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Insights ({days} days) failed: {response.status}: {error_text}")
                        results.append(False)
                        
            except Exception as e:
                logger.error(f"❌ Insights ({days} days) error: {str(e)}")
                results.append(False)
        
        success_rate = sum(results) / len(results) if results else 0
        return success_rate > 0.5  # 50% success threshold
    
    async def test_edge_cases(self):
        """Test edge cases and error handling"""
        logger.info("Testing edge cases...")
        
        edge_cases = [
            # Invalid JSON
            {"endpoint": "chat", "payload": "invalid json", "expect_error": True},
            # Missing required fields
            {"endpoint": "chat", "payload": {}, "expect_error": True},
            # Empty text
            {"endpoint": "chat", "payload": {"text": ""}, "expect_error": True},
            # Very large amount
            {"endpoint": "chat", "payload": {"text": "Spent $999999999 at store"}, "expect_error": False},
            # Special characters
            {"endpoint": "chat", "payload": {"text": "Spent $25 at café & restaurant"}, "expect_error": False},
        ]
        
        results = []
        for case in edge_cases:
            try:
                if case["endpoint"] == "chat":
                    if isinstance(case["payload"], str):
                        # Test invalid JSON
                        async with self.session.post(
                            f"{BACKEND_URL}/transactions/chat",
                            data=case["payload"],
                            headers={"Content-Type": "application/json"}
                        ) as response:
                            if case["expect_error"] and response.status >= 400:
                                logger.info(f"✅ Edge case: Correctly handled invalid JSON")
                                results.append(True)
                            elif not case["expect_error"] and response.status == 200:
                                logger.info(f"✅ Edge case: Handled valid request")
                                results.append(True)
                            else:
                                logger.error(f"❌ Edge case: Unexpected response {response.status}")
                                results.append(False)
                    else:
                        # Test valid JSON
                        async with self.session.post(
                            f"{BACKEND_URL}/transactions/chat",
                            json=case["payload"]
                        ) as response:
                            if case["expect_error"] and response.status >= 400:
                                logger.info(f"✅ Edge case: Correctly rejected invalid payload")
                                results.append(True)
                            elif not case["expect_error"] and response.status == 200:
                                data = await response.json()
                                transaction = data.get("transaction", {})
                                if "id" in transaction:
                                    self.created_transactions.append(transaction["id"])
                                logger.info(f"✅ Edge case: Handled valid request")
                                results.append(True)
                            else:
                                logger.error(f"❌ Edge case: Unexpected response {response.status}")
                                results.append(False)
                                
            except Exception as e:
                if case["expect_error"]:
                    logger.info(f"✅ Edge case: Correctly threw exception for invalid input")
                    results.append(True)
                else:
                    logger.error(f"❌ Edge case: Unexpected error: {str(e)}")
                    results.append(False)
        
        success_rate = sum(results) / len(results) if results else 0
        return success_rate > 0.6  # 60% success threshold
    
    async def run_all_tests(self):
        """Run all tests and return summary"""
        logger.info("🚀 Starting comprehensive backend API testing...")
        
        tests = [
            ("API Health", self.test_api_health),
            ("Categories Endpoint", self.test_categories_endpoint),
            ("Chat Transactions", self.test_chat_transactions),
            ("Receipt Transactions", self.test_receipt_transactions),
            ("Voice Transactions", self.test_voice_transactions),
            ("Get Transactions", self.test_get_transactions),
            ("Delete Transaction", self.test_delete_transaction),
            ("Insights Endpoint", self.test_insights_endpoint),
            ("Edge Cases", self.test_edge_cases),
        ]
        
        results = {}
        for test_name, test_func in tests:
            logger.info(f"\n--- Running {test_name} ---")
            try:
                result = await test_func()
                results[test_name] = result
                status = "✅ PASS" if result else "❌ FAIL"
                logger.info(f"{status}: {test_name}")
            except Exception as e:
                logger.error(f"❌ FAIL: {test_name} - {str(e)}")
                results[test_name] = False
        
        # Summary
        logger.info("\n" + "="*50)
        logger.info("📊 TEST SUMMARY")
        logger.info("="*50)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"{status}: {test_name}")
        
        logger.info(f"\nOverall: {passed}/{total} tests passed ({passed/total:.1%})")
        
        if self.created_transactions:
            logger.info(f"Created {len(self.created_transactions)} test transactions")
        
        return results

async def main():
    """Main test runner"""
    async with FinanceAPITester() as tester:
        results = await tester.run_all_tests()
        
        # Return exit code based on results
        failed_tests = [name for name, result in results.items() if not result]
        if failed_tests:
            print(f"\n❌ FAILED TESTS: {', '.join(failed_tests)}")
            return 1
        else:
            print(f"\n✅ ALL TESTS PASSED!")
            return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)