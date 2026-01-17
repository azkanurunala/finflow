from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Request, Response, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import base64
import io
import httpx
import hashlib
import secrets
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Root endpoint for health check
@app.get("/")
async def root():
    return {"status": "healthy", "app": "FinFlow API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# API health endpoint for deployment checks
@api_router.get("/health")
async def api_health_check():
    return {"status": "healthy", "app": "FinFlow API", "version": "1.0.0"}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# US-specific categories
US_CATEGORIES = [
    "Groceries",
    "Dining & Coffee",
    "Transportation",
    "Rent & Utilities",
    "Subscriptions",
    "Healthcare",
    "Insurance",
    "Entertainment",
    "Shopping",
    "Travel",
    "Income",
    "Other"
]

# Subscription Tiers (USD pricing)
SUBSCRIPTION_TIERS = {
    "free_trial": {
        "name": "Free Trial",
        "daily_actions": 10,
        "duration_days": 3,
        "price": 0,
        "price_yearly": 0
    },
    "basic": {
        "name": "Basic",
        "chat_messages": 30,
        "uploads": 20,  # Combined OCR + voice recordings per month
        "price": 1.99,
        "price_yearly": 19.99
    },
    "pro": {
        "name": "Pro",
        "chat_messages": 100,
        "uploads": 100,
        "price": 4.99,
        "price_yearly": 49.99
    },
    "power": {
        "name": "Power",
        "chat_messages": -1,  # Unlimited
        "uploads": -1,  # Unlimited
        "price": 9.99,
        "price_yearly": 99.99
    }
}

# Models
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    subscription_tier: Optional[str] = None
    subscription_expires_at: Optional[datetime] = None
    subscription_started_at: Optional[datetime] = None
    created_at: datetime

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class SessionDataRequest(BaseModel):
    session_id: str

class SessionDataResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    currency: str = "USD"
    merchant: Optional[str] = None
    category: str
    date: datetime
    transaction_type: str = "expense"
    notes: Optional[str] = None
    source: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatTransactionRequest(BaseModel):
    text: str

class ReceiptTransactionRequest(BaseModel):
    image_base64: str
    currency: str = "USD"  # User's preferred currency

class ManualTransactionRequest(BaseModel):
    amount: float
    currency: str = "USD"
    merchant: Optional[str] = None
    category: str
    date: str  # YYYY-MM-DD
    transaction_type: str = "expense"
    notes: Optional[str] = None

class UpdateTransactionRequest(BaseModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    merchant: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    transaction_type: Optional[str] = None
    notes: Optional[str] = None

class VoiceTransactionRequest(BaseModel):
    audio_base64: str
    currency: str = "USD"  # User's preferred currency

# Chat Message Models for Persistence
class ChatMessage(BaseModel):
    id: str
    user_id: str
    type: str  # 'user', 'assistant', 'voice', 'ocr'
    text: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # For voice messages
    audio_url: Optional[str] = None
    transcription: Optional[str] = None
    # For OCR messages
    image_base64: Optional[str] = None
    parsed_data: Optional[Dict[str, Any]] = None
    # For transaction results
    transaction_id: Optional[str] = None
    transaction_data: Optional[Dict[str, Any]] = None

class SaveChatMessageRequest(BaseModel):
    type: str
    text: Optional[str] = None
    audio_url: Optional[str] = None
    transcription: Optional[str] = None
    image_base64: Optional[str] = None
    parsed_data: Optional[Dict[str, Any]] = None
    transaction_id: Optional[str] = None
    transaction_data: Optional[Dict[str, Any]] = None

class UsageStats(BaseModel):
    user_id: str
    date: str  # YYYY-MM-DD format
    chat_count: int = 0
    ocr_count: int = 0
    voice_minutes: float = 0.0
    total_actions: int = 0

class SubscriptionInfo(BaseModel):
    tier: str
    tier_name: str
    is_active: bool
    expires_at: Optional[datetime] = None
    days_remaining: Optional[int] = None
    limits: Dict[str, Any]
    usage: Dict[str, Any]

# Email/Password Auth Models
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateOnboardingRequest(BaseModel):
    language: Optional[str] = None
    currency: Optional[str] = None
    onboarding_completed: Optional[bool] = None

# Helper function to hash password
def hash_password(password: str) -> str:
    """Hash password with salt using SHA256"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{password_hash}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, hash_value = stored_hash.split(":")
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest() == hash_value
    except:
        return False

# Auth Helper Functions
async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        return session_token
    
    # Try Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "")
    
    return None

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token"""
    session_token = await get_session_token(request)
    if not session_token:
        return None
    
    # Get session from database
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check if session is expired
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        # Delete expired session
        await db.user_sessions.delete_one({"session_token": session_token})
        return None
    
    # Get user from database
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    return User(**user_doc)

async def require_auth(request: Request) -> User:
    """Dependency to require authentication"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def check_quota(user: User, action_type: str) -> bool:
    """Check if user has quota for the action"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get today's usage
    usage = await db.usage_stats.find_one(
        {"user_id": user.user_id, "date": today},
        {"_id": 0}
    )
    
    if not usage:
        usage = {
            "user_id": user.user_id,
            "date": today,
            "chat_count": 0,
            "ocr_count": 0,
            "voice_minutes": 0.0,
            "total_actions": 0
        }
    
    tier = user.subscription_tier
    tier_limits = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free_trial"])
    
    # Check subscription expiry
    if user.subscription_expires_at:
        expires_at = user.subscription_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            # Subscription expired, revert to free trial
            tier = "free_trial"
            tier_limits = SUBSCRIPTION_TIERS["free_trial"]
    
    # For free trial, check daily total actions
    if tier == "free_trial":
        if usage["total_actions"] >= tier_limits["daily_actions"]:
            return False
        return True
    
    # For paid tiers, check monthly limits
    # For now, we'll use daily limits as placeholder
    if action_type == "chat":
        # Rough daily limit = monthly / 30
        daily_limit = tier_limits.get("chat_messages", 0) / 30
        return usage["chat_count"] < daily_limit
    elif action_type == "ocr":
        daily_limit = tier_limits.get("ocr_images", 0) / 30
        return usage["ocr_count"] < daily_limit
    elif action_type == "voice":
        daily_limit = tier_limits.get("audio_minutes", 0) / 30
        return usage["voice_minutes"] < daily_limit
    
    return True

async def increment_usage(user_id: str, action_type: str, amount: float = 1.0):
    """Increment user's usage stats"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    update_fields = {
        "$inc": {
            "total_actions": 1
        },
        "$setOnInsert": {
            "user_id": user_id,
            "date": today
        }
    }
    
    if action_type == "chat":
        update_fields["$inc"]["chat_count"] = 1
    elif action_type == "ocr":
        update_fields["$inc"]["ocr_count"] = 1
    elif action_type == "voice":
        update_fields["$inc"]["voice_minutes"] = amount
    
    await db.usage_stats.update_one(
        {"user_id": user_id, "date": today},
        update_fields,
        upsert=True
    )

# Helper function to parse transaction via GPT
async def parse_transaction_text(text: str, source: str = "chat") -> Transaction:
    """Use GPT to parse natural language transaction input"""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        system_prompt = f"""You are a multilingual financial transaction parser that understands both English and Indonesian (Bahasa Indonesia).
Your task is to extract transaction details from natural language input.

TODAY'S DATE: {today}

Respond ONLY with this exact JSON format (no other text):
{{
    "amount": <number in original currency>,
    "currency": "USD" or "IDR",
    "merchant": "<merchant name or null>",
    "category": "<one of: {', '.join(US_CATEGORIES)}>",
    "date": "<YYYY-MM-DD>",
    "transaction_type": "expense" or "income",
    "notes": "<any additional context or null>"
}}

CRITICAL RULES FOR INCOME vs EXPENSE:
- "income" = receiving money: salary (gaji), bonus, overtime pay (lembur), freelance payment, selling something, refund, dividend, gift received
- "expense" = spending money: buying, paying, purchasing, subscription, bills

INDONESIAN AMOUNT PARSING (VERY IMPORTANT):
- "jt" or "juta" = million (1.000.000). Example: "5jt" = 5000000, "2,5jt" = 2500000
- "rb" or "ribu" = thousand (1.000). Example: "50rb" = 50000, "150rb" = 150000  
- "k" = thousand. Example: "50k" = 50000
- Indonesian uses comma for decimals: "2,5jt" = 2.5 million = 2500000
- If amount seems Indonesian (jt, rb, ribu, juta, or context is Indonesian), use currency: "IDR"

INDONESIAN CONTEXT EXAMPLES:
- "lembur dapat 5jt" → amount: 5000000, currency: "IDR", transaction_type: "income", category: "Income"
- "beli makan 50rb" → amount: 50000, currency: "IDR", transaction_type: "expense", category: "Dining & Coffee"
- "gaji masuk 10jt" → amount: 10000000, currency: "IDR", transaction_type: "income", category: "Income"
- "bayar listrik 500rb" → amount: 500000, currency: "IDR", transaction_type: "expense", category: "Rent & Utilities"

ENGLISH EXAMPLES:
- "earned $500 from freelance" → amount: 500, currency: "USD", transaction_type: "income"
- "spent $25 on lunch" → amount: 25, currency: "USD", transaction_type: "expense"

DATE PARSING:
- "hari ini" / "today" = {today}
- "kemarin" / "yesterday" = yesterday's date
- "minggu lalu" / "last week" = 7 days ago
- If no date mentioned, use today: {today}"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"transaction_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")

        user_message = UserMessage(text=f"Parse this transaction: {text}")
        response = await chat.send_message(user_message)
        
        # Parse GPT response
        import json
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        data = json.loads(response_text)
        
        # Create transaction (without user_id, will be added by caller)
        transaction_data = {
            "amount": float(data["amount"]),
            "currency": data.get("currency", "USD"),
            "merchant": data.get("merchant"),
            "category": data["category"],
            "date": datetime.fromisoformat(data["date"]),
            "transaction_type": data.get("transaction_type", "expense"),
            "notes": data.get("notes"),
            "source": source
        }
        
        return transaction_data
        
    except Exception as e:
        logger.error(f"Error parsing transaction: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Could not parse transaction: {str(e)}")

# Helper function to parse receipt image
async def parse_receipt_image(image_base64: str) -> dict:
    """Use GPT Vision to parse receipt image"""
    try:
        system_prompt = f"""You are a receipt scanner for US transactions.
Extract transaction details from the receipt image.

Respond in this exact JSON format:
{{
    "amount": <total amount as number>,
    "merchant": "<merchant name>",
    "category": "<one of: {', '.join(US_CATEGORIES)}>",
    "date": "<YYYY-MM-DD from receipt>",
    "tax": <tax amount or null>,
    "tip": <tip amount or null>,
    "notes": "<any notable items or null>"
}}

Rules:
- Extract the TOTAL amount (after tax and tip)
- Identify merchant name from logo or text
- Infer category from merchant type
- Extract date from receipt
- Note any tip or tax separately
- If receipt shows multiple items, mention key items in notes"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"receipt_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")

        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text="Extract transaction details from this receipt.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse response
        import json
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        data = json.loads(response_text)
        
        # Build metadata
        metadata = {}
        if data.get("tax"):
            metadata["tax"] = data["tax"]
        if data.get("tip"):
            metadata["tip"] = data["tip"]
        
        # Create transaction data
        transaction_data = {
            "amount": float(data["amount"]),
            "merchant": data.get("merchant"),
            "category": data["category"],
            "date": datetime.fromisoformat(data["date"]),
            "transaction_type": "expense",
            "notes": data.get("notes"),
            "source": "receipt",
            "metadata": metadata if metadata else None
        }
        
        return transaction_data
        
    except Exception as e:
        logger.error(f"Error parsing receipt: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Could not parse receipt: {str(e)}")

# Auth Routes
@api_router.post("/auth/session")
async def create_session(request: SessionDataRequest, response: Response):
    """Exchange session_id for user data and session_token"""
    try:
        # Call Emergent Auth API
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session ID")
        
        user_data = auth_response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one(
            {"email": user_data["email"]},
            {"_id": 0}
        )
        
        if existing_user:
            user_id = existing_user["user_id"]
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            
            # Free trial expires in 3 days
            trial_expires = datetime.now(timezone.utc) + timedelta(days=3)
            
            new_user = {
                "user_id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture"),
                "subscription_tier": "free_trial",
                "subscription_started_at": datetime.now(timezone.utc),
                "subscription_expires_at": trial_expires,
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.users.insert_one(new_user)
        
        # Create session
        session_token = user_data["session_token"]
        session_expires = datetime.now(timezone.utc) + timedelta(days=7)
        
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": session_expires,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.user_sessions.insert_one(session_doc)
        
        # Set httpOnly cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,  # 7 days
            path="/"
        )
        
        return SessionDataResponse(
            user_id=user_id,
            email=user_data["email"],
            name=user_data["name"],
            picture=user_data.get("picture"),
            session_token=session_token
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Apple Authentication Endpoint
class AppleAuthRequest(BaseModel):
    identity_token: str
    authorization_code: str
    user_id: str
    email: Optional[str] = None
    full_name: Optional[str] = None

@api_router.post("/auth/apple")
async def apple_auth(request: AppleAuthRequest, response: Response):
    """Handle Apple Sign In authentication"""
    try:
        import jwt
        
        # Decode the identity token (without verification for now - in production, verify with Apple's public keys)
        try:
            # Decode without verification to get claims
            decoded = jwt.decode(request.identity_token, options={"verify_signature": False})
            apple_user_id = decoded.get("sub")
            token_email = decoded.get("email")
        except Exception as decode_error:
            logger.warning(f"Token decode warning: {decode_error}")
            apple_user_id = request.user_id
            token_email = request.email
        
        # Use email from token or from request
        email = token_email or request.email
        
        if not email:
            # Generate a placeholder email using Apple user ID
            email = f"{request.user_id}@privaterelay.appleid.com"
        
        # Check if user exists by Apple ID or email
        existing_user = await db.users.find_one(
            {"$or": [
                {"apple_user_id": request.user_id},
                {"email": email}
            ]},
            {"_id": 0}
        )
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update Apple user ID if not set
            if not existing_user.get("apple_user_id"):
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"apple_user_id": request.user_id}}
                )
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            
            # Free trial expires in 3 days
            trial_expires = datetime.now(timezone.utc) + timedelta(days=3)
            
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": request.full_name or "Apple User",
                "apple_user_id": request.user_id,
                "subscription_tier": "free_trial",
                "subscription_started_at": datetime.now(timezone.utc),
                "subscription_expires_at": trial_expires,
                "created_at": datetime.now(timezone.utc),
                "auth_provider": "apple"
            }
            
            await db.users.insert_one(new_user)
        
        # Create session token
        session_token = secrets.token_urlsafe(32)
        session_expires = datetime.now(timezone.utc) + timedelta(days=7)
        
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": session_expires,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.user_sessions.insert_one(session_doc)
        
        # Get user data
        user_doc = await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0, "password_hash": 0}
        )
        
        # Check subscription status
        is_subscription_active = True
        if user_doc.get("subscription_expires_at"):
            expires_at = user_doc["subscription_expires_at"]
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            is_subscription_active = expires_at > datetime.now(timezone.utc)
        
        # Set httpOnly cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,  # 7 days
            path="/"
        )
        
        return {
            "session_token": session_token,
            "user": {
                "user_id": user_doc["user_id"],
                "email": user_doc["email"],
                "name": user_doc["name"],
                "subscription_tier": user_doc.get("subscription_tier"),
                "subscription_expires_at": user_doc.get("subscription_expires_at"),
                "is_subscription_active": is_subscription_active,
                "onboarding_completed": user_doc.get("onboarding_completed", False),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in Apple auth: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user info"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get additional user data from DB
    user_doc = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check subscription status
    is_subscription_active = True
    if user_doc.get("subscription_expires_at"):
        expires_at = user_doc["subscription_expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        is_subscription_active = expires_at > datetime.now(timezone.utc)
    else:
        is_subscription_active = False
    
    return {
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "picture": user_doc.get("picture"),
        "subscription_tier": user_doc.get("subscription_tier"),
        "subscription_expires_at": user_doc.get("subscription_expires_at"),
        "is_subscription_active": is_subscription_active,
        "onboarding_completed": user_doc.get("onboarding_completed", True),
        "language": user_doc.get("language"),
        "currency": user_doc.get("currency"),
        "created_at": user_doc.get("created_at")
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = await get_session_token(request)
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    """Register new user with email/password"""
    try:
        # Check if email already exists
        existing_user = await db.users.find_one({"email": request.email.lower()})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Validate email format
        if "@" not in request.email or "." not in request.email:
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Validate password
        if len(request.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Create user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        password_hash = hash_password(request.password)
        
        new_user = {
            "user_id": user_id,
            "email": request.email.lower(),
            "name": request.name,
            "picture": None,
            "password_hash": password_hash,
            "auth_provider": "email",
            "subscription_tier": None,  # Will be set after onboarding
            "subscription_started_at": None,
            "subscription_expires_at": None,
            "onboarding_completed": False,
            "language": None,
            "currency": None,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.users.insert_one(new_user)
        
        # Create session
        session_token = secrets.token_urlsafe(32)
        session_expires = datetime.now(timezone.utc) + timedelta(days=7)
        
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": session_expires,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.user_sessions.insert_one(session_doc)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": request.email.lower(),
            "name": request.name,
            "session_token": session_token,
            "onboarding_completed": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    """Login with email/password"""
    try:
        # Find user
        user = await db.users.find_one({"email": request.email.lower()})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verify password
        if "password_hash" not in user:
            raise HTTPException(status_code=401, detail="Please login with Google")
        
        if not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Create session
        session_token = secrets.token_urlsafe(32)
        session_expires = datetime.now(timezone.utc) + timedelta(days=7)
        
        session_doc = {
            "user_id": user["user_id"],
            "session_token": session_token,
            "expires_at": session_expires,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.user_sessions.insert_one(session_doc)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "session_token": session_token,
            "onboarding_completed": user.get("onboarding_completed", True),
            "subscription_tier": user.get("subscription_tier")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging in: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/auth/onboarding")
async def update_onboarding(request: UpdateOnboardingRequest, current_user: User = Depends(require_auth)):
    """Update user's onboarding preferences"""
    try:
        update_fields = {}
        
        if request.language:
            update_fields["language"] = request.language
        if request.currency:
            update_fields["currency"] = request.currency
        if request.onboarding_completed is not None:
            update_fields["onboarding_completed"] = request.onboarding_completed
        
        if update_fields:
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$set": update_fields}
            )
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error updating onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/start-trial")
async def start_trial(current_user: User = Depends(require_auth)):
    """Start free trial for user"""
    try:
        trial_expires = datetime.now(timezone.utc) + timedelta(days=3)
        
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {
                "subscription_tier": "free_trial",
                "subscription_started_at": datetime.now(timezone.utc),
                "subscription_expires_at": trial_expires,
                "onboarding_completed": True
            }}
        )
        
        return {
            "success": True,
            "subscription_tier": "free_trial",
            "expires_at": trial_expires.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error starting trial: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Subscription Routes
@api_router.get("/subscription")
async def get_subscription(current_user: User = Depends(require_auth)):
    """Get user's subscription info"""
    tier = current_user.subscription_tier
    tier_data = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free_trial"])
    
    # Check if subscription is active
    is_active = True
    days_remaining = None
    
    if current_user.subscription_expires_at:
        expires_at = current_user.subscription_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        is_active = expires_at > datetime.now(timezone.utc)
        if is_active:
            days_remaining = (expires_at - datetime.now(timezone.utc)).days
    
    # Get today's usage
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    usage = await db.usage_stats.find_one(
        {"user_id": current_user.user_id, "date": today},
        {"_id": 0}
    )
    
    if not usage:
        usage = {
            "chat_count": 0,
            "ocr_count": 0,
            "voice_minutes": 0.0,
            "total_actions": 0
        }
    
    return SubscriptionInfo(
        tier=tier,
        tier_name=tier_data["name"],
        is_active=is_active,
        expires_at=current_user.subscription_expires_at,
        days_remaining=days_remaining,
        limits=tier_data,
        usage={
            "chat_count": usage.get("chat_count", 0),
            "ocr_count": usage.get("ocr_count", 0),
            "voice_minutes": usage.get("voice_minutes", 0.0),
            "total_actions": usage.get("total_actions", 0)
        }
    )

@api_router.get("/subscription/tiers")
async def get_subscription_tiers():
    """Get available subscription tiers"""
    return SUBSCRIPTION_TIERS

# Apple In-App Purchase Verification
class AppleIAPVerifyRequest(BaseModel):
    receipt_data: str
    product_id: str
    transaction_id: str

@api_router.post("/subscription/verify-apple")
async def verify_apple_purchase(
    request: AppleIAPVerifyRequest,
    current_user: User = Depends(require_auth)
):
    """Verify Apple In-App Purchase receipt and activate subscription"""
    try:
        # Map product IDs to subscription tiers
        product_tier_map = {
            "com.finflow.subscription.basic": {
                "tier": "basic",
                "tier_name": "Basic Package",
                "duration_days": 30,
                "limits": {
                    "chat_messages": -1,  # Unlimited
                    "voice_minutes": 30,
                    "ocr_count": 30,
                }
            },
            "com.finflow.subscription.premium": {
                "tier": "premium",
                "tier_name": "Premium Package",
                "duration_days": 30,
                "limits": {
                    "chat_messages": -1,
                    "voice_minutes": -1,
                    "ocr_count": -1,
                }
            },
            "com.finflow.subscription.yearly": {
                "tier": "yearly",
                "tier_name": "Annual Plan",
                "duration_days": 365,
                "limits": {
                    "chat_messages": -1,
                    "voice_minutes": -1,
                    "ocr_count": -1,
                }
            },
            "com.finflow.subscription.monthly": {
                "tier": "monthly_full",
                "tier_name": "Monthly Full Access",
                "duration_days": 30,
                "limits": {
                    "chat_messages": -1,
                    "voice_minutes": -1,
                    "ocr_count": -1,
                }
            },
        }
        
        tier_info = product_tier_map.get(request.product_id)
        if not tier_info:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        # In production, verify receipt with Apple's servers
        # https://developer.apple.com/documentation/appstorereceipts/verifyreceipt
        # For now, we trust the client (implement server-side verification in production)
        
        # Calculate expiration date
        expires_at = datetime.now(timezone.utc) + timedelta(days=tier_info["duration_days"])
        
        # Update user subscription
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$set": {
                    "subscription_tier": tier_info["tier"],
                    "subscription_tier_name": tier_info["tier_name"],
                    "subscription_started_at": datetime.now(timezone.utc),
                    "subscription_expires_at": expires_at,
                    "subscription_limits": tier_info["limits"],
                    "apple_transaction_id": request.transaction_id,
                    "apple_product_id": request.product_id,
                }
            }
        )
        
        # Record purchase
        purchase_record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.user_id,
            "product_id": request.product_id,
            "transaction_id": request.transaction_id,
            "tier": tier_info["tier"],
            "amount": get_product_price(request.product_id),
            "currency": "USD",
            "status": "completed",
            "created_at": datetime.now(timezone.utc),
        }
        await db.purchases.insert_one(purchase_record)
        
        # Create subscription activated notification
        await create_notification(
            current_user.user_id,
            "subscription_activated",
            "Subscription Activated! 🎉",
            f"Your {tier_info['tier_name']} subscription is now active. Enjoy all the features!",
            {"tier": tier_info["tier"], "expires_at": expires_at.isoformat()}
        )
        
        return {
            "success": True,
            "message": "Subscription activated successfully",
            "tier": tier_info["tier"],
            "expires_at": expires_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying Apple purchase: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def get_product_price(product_id: str) -> float:
    prices = {
        "com.finflow.subscription.basic": 2.99,
        "com.finflow.subscription.premium": 9.99,
        "com.finflow.subscription.yearly": 99.00,
        "com.finflow.subscription.monthly": 29.00,
    }
    return prices.get(product_id, 0)

@api_router.post("/subscription/start-trial")
async def start_subscription_trial(
    current_user: User = Depends(require_auth)
):
    """Start a 14-day free trial"""
    try:
        # Check if user already had a trial
        user_doc = await db.users.find_one({"user_id": current_user.user_id})
        if user_doc and user_doc.get("had_trial"):
            raise HTTPException(status_code=400, detail="You have already used your free trial")
        
        trial_expires = datetime.now(timezone.utc) + timedelta(days=14)
        
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$set": {
                    "subscription_tier": "trial",
                    "subscription_tier_name": "14-Day Free Trial",
                    "subscription_started_at": datetime.now(timezone.utc),
                    "subscription_expires_at": trial_expires,
                    "subscription_limits": {
                        "chat_messages": -1,
                        "voice_minutes": 30,
                        "ocr_count": 30,
                    },
                    "had_trial": True,
                    "is_subscription_active": True,
                    "onboarding_completed": True,
                }
            }
        )
        
        # Create trial started notification
        await create_notification(
            current_user.user_id,
            "trial_started",
            "Welcome to FinFlow! 🚀",
            "Your 14-day free trial has started. Explore all features and track your finances with AI!",
            {"trial_expires": trial_expires.isoformat()}
        )
        
        return {
            "success": True,
            "message": "14-day trial started",
            "expires_at": trial_expires.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting trial: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== NOTIFICATION SYSTEM ====================

class NotificationRequest(BaseModel):
    title: str
    message: str
    type: str = "general"
    data: Optional[Dict[str, Any]] = None

async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None
):
    """Create an in-app notification"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.notifications.insert_one(notification)
    return notification

@api_router.get("/notifications")
async def get_notifications(
    limit: int = 20,
    unread_only: bool = False,
    current_user: User = Depends(require_auth)
):
    """Get user notifications"""
    try:
        query = {"user_id": current_user.user_id}
        if unread_only:
            query["read"] = False
        
        notifications = await db.notifications.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        unread_count = await db.notifications.count_documents({
            "user_id": current_user.user_id,
            "read": False
        })
        
        return {
            "notifications": notifications,
            "unread_count": unread_count
        }
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== CHAT PERSISTENCE ENDPOINTS ====================

@api_router.get("/chat/history")
async def get_chat_history(
    limit: int = 100,
    current_user: User = Depends(require_auth)
):
    """Get user's chat history - persisted like WhatsApp"""
    try:
        messages = await db.chat_messages.find(
            {"user_id": current_user.user_id},
            {"_id": 0}
        ).sort("timestamp", 1).limit(limit).to_list(limit)
        
        # Serialize datetime objects
        for msg in messages:
            if "timestamp" in msg and hasattr(msg["timestamp"], "isoformat"):
                msg["timestamp"] = msg["timestamp"].isoformat()
        
        return {
            "messages": messages,
            "count": len(messages)
        }
    except Exception as e:
        logger.error(f"Error fetching chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/chat/message")
async def save_chat_message(
    request: SaveChatMessageRequest,
    current_user: User = Depends(require_auth)
):
    """Save a chat message to history"""
    try:
        message = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.user_id,
            "type": request.type,  # 'user', 'assistant', 'voice', 'ocr'
            "text": request.text,
            "timestamp": datetime.now(timezone.utc),
            "audio_url": request.audio_url,
            "transcription": request.transcription,
            "image_base64": request.image_base64[:100] if request.image_base64 else None,  # Store thumbnail only
            "parsed_data": request.parsed_data,
            "transaction_id": request.transaction_id,
            "transaction_data": request.transaction_data,
        }
        
        await db.chat_messages.insert_one(message)
        
        # Serialize for response
        message["timestamp"] = message["timestamp"].isoformat()
        
        return {"message": message, "success": True}
    except Exception as e:
        logger.error(f"Error saving chat message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/chat/history")
async def clear_chat_history(
    current_user: User = Depends(require_auth)
):
    """Clear all chat history - explicit reset like WhatsApp clear chat"""
    try:
        result = await db.chat_messages.delete_many(
            {"user_id": current_user.user_id}
        )
        
        return {
            "success": True,
            "deleted_count": result.deleted_count,
            "message": "Chat history cleared successfully"
        }
    except Exception as e:
        logger.error(f"Error clearing chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(require_auth)
):
    """Mark a notification as read"""
    try:
        result = await db.notifications.update_one(
            {"id": notification_id, "user_id": current_user.user_id},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification read: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(require_auth)
):
    """Mark all notifications as read"""
    try:
        await db.notifications.update_many(
            {"user_id": current_user.user_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error marking all notifications read: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Email notification helper (integrate with email service like SendGrid, SES, etc.)
async def send_email_notification(
    email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None
):
    """Send email notification - placeholder for email service integration"""
    # In production, integrate with email service provider
    # Example: SendGrid, AWS SES, Mailgun, etc.
    try:
        # Log email for now (replace with actual email service)
        logger.info(f"Email notification to {email}: {subject}")
        
        # Record email in database
        email_record = {
            "id": str(uuid.uuid4()),
            "to_email": email,
            "subject": subject,
            "body": body,
            "html_body": html_body,
            "status": "queued",  # In production: pending, sent, failed
            "created_at": datetime.now(timezone.utc),
        }
        await db.email_notifications.insert_one(email_record)
        
        return True
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        return False

# Transaction notification triggers
async def notify_transaction_created(user_id: str, transaction: dict):
    """Send notification when transaction is created"""
    amount = transaction.get("amount", 0)
    category = transaction.get("category", "Other")
    tx_type = transaction.get("transaction_type", "expense")
    
    if tx_type == "expense":
        title = f"Expense Logged: {category}"
        message = f"${amount:,.2f} expense recorded under {category}"
    else:
        title = f"Income Logged: {category}"
        message = f"${amount:,.2f} income recorded"
    
    await create_notification(
        user_id,
        "transaction_created",
        title,
        message,
        {"transaction_id": transaction.get("id")}
    )

async def notify_budget_alert(user_id: str, category: str, percentage: float):
    """Send notification when budget threshold is reached"""
    if percentage >= 100:
        title = f"⚠️ Budget Exceeded: {category}"
        message = f"You've exceeded your {category} budget by {percentage - 100:.0f}%"
    elif percentage >= 80:
        title = f"Budget Alert: {category}"
        message = f"You've used {percentage:.0f}% of your {category} budget"
    else:
        return
    
    await create_notification(
        user_id,
        "budget_alert",
        title,
        message,
        {"category": category, "percentage": percentage}
    )

async def notify_subscription_expiring(user_id: str, email: str, days_remaining: int):
    """Send notification when subscription is about to expire"""
    title = f"Subscription Expiring Soon"
    message = f"Your subscription expires in {days_remaining} days. Renew now to continue enjoying all features!"
    
    # In-app notification
    await create_notification(
        user_id,
        "subscription_expiring",
        title,
        message,
        {"days_remaining": days_remaining}
    )
    
    # Email notification
    await send_email_notification(
        email,
        f"FinFlow: Your subscription expires in {days_remaining} days",
        message
    )

# Transaction Routes
@api_router.get("/")
async def root():
    return {"message": "AI Finance Assistant API", "version": "2.0.0"}

@api_router.get("/categories")
async def get_categories():
    """Get list of transaction categories"""
    return {"categories": US_CATEGORIES}

@api_router.post("/transactions/chat")
async def create_chat_transaction(
    request: ChatTransactionRequest,
    current_user: User = Depends(require_auth)
):
    """Process text chat input and create transaction"""
    try:
        # Check quota
        if not await check_quota(current_user, "chat"):
            raise HTTPException(
                status_code=403,
                detail="Quota exceeded. Please upgrade your subscription."
            )
        
        # Parse transaction using GPT
        transaction_data = await parse_transaction_text(request.text, source="chat")
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = str(uuid.uuid4())
        transaction_data["created_at"] = datetime.now(timezone.utc)
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage
        await increment_usage(current_user.user_id, "chat")
        
        transaction = Transaction(**transaction_data)
        
        return {
            "transaction": transaction,
            "message": f"Logged ${transaction.amount:.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/transactions/receipt")
async def create_receipt_transaction(
    request: ReceiptTransactionRequest,
    current_user: User = Depends(require_auth)
):
    """Process receipt image and create transaction"""
    try:
        # Check quota
        if not await check_quota(current_user, "ocr"):
            raise HTTPException(
                status_code=403,
                detail="Quota exceeded. Please upgrade your subscription."
            )
        
        # Parse receipt using GPT Vision
        transaction_data = await parse_receipt_image(request.image_base64)
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = str(uuid.uuid4())
        transaction_data["created_at"] = datetime.now(timezone.utc)
        transaction_data["currency"] = request.currency  # Use user's preferred currency
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage
        await increment_usage(current_user.user_id, "ocr")
        
        transaction = Transaction(**transaction_data)
        
        tip_info = ""
        if transaction.metadata and transaction.metadata.get("tip"):
            tip_info = f" (includes {transaction.metadata['tip']:.2f} tip)"
        
        # Get currency symbol for display
        currency_symbols = {"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "IDR": "Rp", "SGD": "S$"}
        symbol = currency_symbols.get(request.currency, request.currency)
        
        return {
            "transaction": transaction,
            "message": f"Logged {symbol}{transaction.amount:,.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}{tip_info}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating receipt transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/transactions/voice")
async def create_voice_transaction(
    request: VoiceTransactionRequest,
    current_user: User = Depends(require_auth)
):
    """Process voice audio and create transaction using Whisper API"""
    try:
        # Check quota (voice)
        if not await check_quota(current_user, "voice"):
            raise HTTPException(
                status_code=403,
                detail="Quota exceeded. Please upgrade your subscription."
            )
        
        # Check if OpenAI API key is available
        if not OPENAI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Voice transcription service is not configured. Please contact support."
            )
        
        # Decode base64 audio
        audio_data = base64.b64decode(request.audio_base64)
        
        # Detect audio format from magic bytes
        audio_format = "m4a"
        mime_type = "audio/m4a"
        
        # Check for common audio format signatures
        if audio_data[:4] == b'RIFF':
            audio_format = "wav"
            mime_type = "audio/wav"
        elif audio_data[:3] == b'ID3' or audio_data[:2] == b'\xff\xfb':
            audio_format = "mp3"
            mime_type = "audio/mpeg"
        elif audio_data[:4] == b'OggS':
            audio_format = "ogg"
            mime_type = "audio/ogg"
        elif audio_data[:4] == b'fLaC':
            audio_format = "flac"
            mime_type = "audio/flac"
        elif b'ftyp' in audio_data[:12]:
            # M4A/MP4 format
            audio_format = "m4a"
            mime_type = "audio/mp4"
        
        logger.info(f"Detected audio format: {audio_format}, mime: {mime_type}, size: {len(audio_data)} bytes")
        
        # Call OpenAI Whisper API
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}"
                },
                files={
                    "file": (f"audio.{audio_format}", audio_data, mime_type)
                },
                data={
                    "model": "whisper-1",
                    "language": "id"  # Indonesian
                }
            )
        
        if response.status_code != 200:
            logger.error(f"Whisper API error: {response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to transcribe audio: {response.text}"
            )
        
        transcription_result = response.json()
        transcribed_text = transcription_result.get("text", "")
        
        if not transcribed_text:
            raise HTTPException(
                status_code=400,
                detail="Could not transcribe audio. Please try again."
            )
        
        # Parse transaction using GPT
        transaction_data = await parse_transaction_text(transcribed_text, source="voice")
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = str(uuid.uuid4())
        transaction_data["created_at"] = datetime.now(timezone.utc)
        transaction_data["currency"] = request.currency  # Use user's preferred currency
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage (estimate 0.5 minute per voice note)
        await increment_usage(current_user.user_id, "voice", 0.5)
        
        transaction = Transaction(**transaction_data)
        
        # Get currency symbol for display
        currency_symbols = {"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "IDR": "Rp", "SGD": "S$"}
        symbol = currency_symbols.get(request.currency, request.currency)
        
        return {
            "transaction": transaction,
            "transcription": transcribed_text,
            "message": f"Logged {symbol}{transaction.amount:,.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating voice transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/transactions/voice-text")
async def create_voice_text_transaction(
    request: ChatTransactionRequest,
    current_user: User = Depends(require_auth)
):
    """Process pre-transcribed voice text and create transaction"""
    try:
        # Check quota (voice)
        if not await check_quota(current_user, "voice"):
            raise HTTPException(
                status_code=403,
                detail="Quota exceeded. Please upgrade your subscription."
            )
        
        # Parse transaction using GPT
        transaction_data = await parse_transaction_text(request.text, source="voice")
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = str(uuid.uuid4())
        transaction_data["created_at"] = datetime.now(timezone.utc)
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage (estimate 0.5 minute per voice note)
        await increment_usage(current_user.user_id, "voice", 0.5)
        
        transaction = Transaction(**transaction_data)
        
        return {
            "transaction": transaction,
            "transcription": request.text,
            "message": f"Logged ${transaction.amount:.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating voice-text transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/transactions")
async def get_transactions(
    limit: int = 100,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get all transactions for current user"""
    try:
        transactions = await db.transactions.find(
            {"user_id": current_user.user_id},
            {"_id": 0}
        ).sort("date", -1).skip(skip).limit(limit).to_list(limit)
        
        return {"transactions": transactions, "count": len(transactions)}
    except Exception as e:
        logger.error(f"Error fetching transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    current_user: User = Depends(require_auth)
):
    """Delete a transaction"""
    try:
        result = await db.transactions.delete_one({
            "id": transaction_id,
            "user_id": current_user.user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return {"message": "Transaction deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/transactions/manual")
async def create_manual_transaction(
    request: ManualTransactionRequest,
    current_user: User = Depends(require_auth)
):
    """Create a transaction manually"""
    try:
        transaction_data = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.user_id,
            "amount": request.amount,
            "currency": request.currency,
            "merchant": request.merchant,
            "category": request.category,
            "date": datetime.fromisoformat(request.date),
            "transaction_type": request.transaction_type,
            "notes": request.notes,
            "source": "manual",
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.transactions.insert_one(transaction_data)
        
        # Fetch the created transaction to ensure proper serialization
        created_transaction = await db.transactions.find_one(
            {"id": transaction_data["id"]},
            {"_id": 0}
        )
        
        return {
            "transaction": created_transaction,
            "message": f"Transaction logged successfully"
        }
    except Exception as e:
        logger.error(f"Error creating manual transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: str,
    request: UpdateTransactionRequest,
    current_user: User = Depends(require_auth)
):
    """Update a transaction"""
    try:
        # Build update fields
        update_fields = {}
        if request.amount is not None:
            update_fields["amount"] = request.amount
        if request.currency is not None:
            update_fields["currency"] = request.currency
        if request.merchant is not None:
            update_fields["merchant"] = request.merchant
        if request.category is not None:
            update_fields["category"] = request.category
        if request.date is not None:
            update_fields["date"] = datetime.fromisoformat(request.date)
        if request.transaction_type is not None:
            update_fields["transaction_type"] = request.transaction_type
        if request.notes is not None:
            update_fields["notes"] = request.notes
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = await db.transactions.update_one(
            {"id": transaction_id, "user_id": current_user.user_id},
            {"$set": update_fields}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Fetch updated transaction
        transaction = await db.transactions.find_one(
            {"id": transaction_id},
            {"_id": 0}
        )
        
        return {
            "transaction": transaction,
            "message": "Transaction updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    current_user: User = Depends(require_auth)
):
    """Get a single transaction"""
    try:
        transaction = await db.transactions.find_one(
            {"id": transaction_id, "user_id": current_user.user_id},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return transaction
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/insights")
async def get_insights(
    days: int = 30,
    current_user: User = Depends(require_auth)
):
    """Get spending insights for current user"""
    try:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        transactions = await db.transactions.find({
            "user_id": current_user.user_id,
            "date": {"$gte": start_date}
        }, {"_id": 0}).to_list(1000)
        
        total_expenses = 0
        total_income = 0
        by_category = {}
        
        for t in transactions:
            if t["transaction_type"] == "expense":
                total_expenses += t["amount"]
                category = t["category"]
                by_category[category] = by_category.get(category, 0) + t["amount"]
            else:
                total_income += t["amount"]
        
        return {
            "total_expenses": round(total_expenses, 2),
            "total_income": round(total_income, 2),
            "net": round(total_income - total_expenses, 2),
            "by_category": {k: round(v, 2) for k, v in by_category.items()},
            "period": f"Last {days} days"
        }
    except Exception as e:
        logger.error(f"Error calculating insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include router
@api_router.get("/export/transactions")
async def export_transactions(
    format: str = "csv",
    days: int = 30,
    current_user: User = Depends(require_auth)
):
    """Export transactions as CSV, JSON, or for Excel"""
    try:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Get all transactions for the user first
        all_transactions = await db.transactions.find(
            {"user_id": current_user.user_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
        
        # Filter by date manually to handle both string and datetime formats
        transactions = []
        for t in all_transactions:
            try:
                # Try to parse date from various formats
                tx_date = t.get("date") or t.get("created_at")
                if tx_date:
                    if isinstance(tx_date, str):
                        # Parse string date
                        if 'T' in tx_date:
                            tx_date = datetime.fromisoformat(tx_date.replace('Z', '+00:00'))
                        else:
                            tx_date = datetime.strptime(tx_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    
                    if tx_date.tzinfo is None:
                        tx_date = tx_date.replace(tzinfo=timezone.utc)
                    
                    if tx_date >= start_date:
                        transactions.append(t)
                else:
                    # If no date, include it
                    transactions.append(t)
            except Exception as date_error:
                logger.warning(f"Date parsing error for transaction: {date_error}")
                transactions.append(t)  # Include anyway
        
        if format == "json":
            # Serialize transactions properly
            serialized = []
            for t in transactions:
                tx = dict(t)
                # Convert datetime objects to strings
                for key, value in tx.items():
                    if isinstance(value, datetime):
                        tx[key] = value.isoformat()
                serialized.append(tx)
            
            return {
                "transactions": serialized,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "total_count": len(serialized)
            }
        
        # Default CSV format
        import io
        import csv
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Date", "Merchant", "Category", "Amount", "Currency", 
            "Type", "Notes", "Source"
        ])
        
        # Data rows
        for t in transactions:
            try:
                tx_date = t.get("date") or t.get("created_at")
                if tx_date:
                    if hasattr(tx_date, "strftime"):
                        date_str = tx_date.strftime("%Y-%m-%d")
                    elif isinstance(tx_date, str):
                        date_str = tx_date[:10]
                    else:
                        date_str = str(tx_date)[:10]
                else:
                    date_str = ""
                    
                writer.writerow([
                    date_str,
                    t.get("merchant", ""),
                    t.get("category", ""),
                    t.get("amount", 0),
                    t.get("currency", "USD"),
                    t.get("transaction_type", "expense"),
                    t.get("notes", ""),
                    t.get("source", "")
                ])
            except Exception as row_error:
                logger.warning(f"Error writing row: {row_error}")
                continue
        
        csv_content = output.getvalue()
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=transactions_{datetime.now().strftime('%Y%m%d')}.csv"
            }
        )
        
    except Exception as e:
        logger.error(f"Error exporting transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@api_router.get("/insights/ai")
async def get_ai_insights(
    days: int = 30,
    current_user: User = Depends(require_auth)
):
    """Get AI-powered financial insights and recommendations"""
    try:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Get transactions
        transactions = await db.transactions.find(
            {
                "user_id": current_user.user_id,
                "date": {"$gte": start_date}
            },
            {"_id": 0}
        ).to_list(500)
        
        if not transactions:
            return {
                "summary": "No transactions found for this period.",
                "insights": [],
                "recommendations": ["Start logging your expenses to get personalized insights!"],
                "spending_trend": "neutral"
            }
        
        # Calculate basic stats
        total_income = sum(t["amount"] for t in transactions if t.get("transaction_type") == "income")
        total_expenses = sum(t["amount"] for t in transactions if t.get("transaction_type") == "expense")
        net = total_income - total_expenses
        
        # Get spending by category
        category_spending = {}
        for t in transactions:
            if t.get("transaction_type") == "expense":
                cat = t.get("category", "Other")
                category_spending[cat] = category_spending.get(cat, 0) + t["amount"]
        
        # Sort categories by spending
        sorted_categories = sorted(category_spending.items(), key=lambda x: x[1], reverse=True)
        top_category = sorted_categories[0] if sorted_categories else ("None", 0)
        
        # Get currency (most common)
        currencies = [t.get("currency", "USD") for t in transactions]
        main_currency = max(set(currencies), key=currencies.count) if currencies else "USD"
        
        # Build context for GPT
        context = f"""
User's financial data for the last {days} days:
- Total Income: {main_currency} {total_income:,.2f}
- Total Expenses: {main_currency} {total_expenses:,.2f}
- Net: {main_currency} {net:,.2f}
- Top spending category: {top_category[0]} ({main_currency} {top_category[1]:,.2f})
- Spending by category: {', '.join([f'{cat}: {main_currency} {amt:,.2f}' for cat, amt in sorted_categories[:5]])}
- Number of transactions: {len(transactions)}
"""
        
        system_prompt = """You are a friendly personal finance advisor. Analyze the user's spending data and provide:
1. A brief summary (2-3 sentences)
2. 3 specific insights about their spending patterns
3. 3 actionable recommendations to improve their finances
4. An overall spending trend assessment (good/needs_attention/concerning)

Respond in JSON format:
{
    "summary": "brief summary",
    "insights": ["insight1", "insight2", "insight3"],
    "recommendations": ["rec1", "rec2", "rec3"],
    "spending_trend": "good|needs_attention|concerning"
}"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"insights_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")

        user_message = UserMessage(text=f"Analyze this financial data and provide insights:\n{context}")
        response = await chat.send_message(user_message)
        
        # Parse response
        import json
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        ai_insights = json.loads(response_text)
        
        # Add chart data
        ai_insights["chart_data"] = {
            "by_category": [{"category": cat, "amount": amt} for cat, amt in sorted_categories],
            "income_vs_expenses": {
                "income": total_income,
                "expenses": total_expenses,
                "net": net
            }
        }
        ai_insights["period_days"] = days
        ai_insights["currency"] = main_currency
        
        return ai_insights
        
    except Exception as e:
        logger.error(f"Error getting AI insights: {str(e)}")
        # Return fallback insights
        return {
            "summary": "Unable to generate detailed insights at this time.",
            "insights": ["Keep tracking your expenses", "Review your spending regularly", "Set budget goals"],
            "recommendations": ["Continue logging transactions", "Review your largest expense categories", "Consider setting savings goals"],
            "spending_trend": "neutral",
            "chart_data": {"by_category": [], "income_vs_expenses": {"income": 0, "expenses": 0, "net": 0}},
            "period_days": days,
            "currency": "USD"
        }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
