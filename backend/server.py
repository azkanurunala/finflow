from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Request, Response, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import base64
import io
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

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

# Subscription Tiers
SUBSCRIPTION_TIERS = {
    "free_trial": {
        "name": "Free Trial",
        "daily_actions": 10,
        "duration_days": 3,
        "price": 0
    },
    "basic": {
        "name": "Basic",
        "audio_minutes": 150,
        "ocr_images": 150,
        "chat_messages": 300,
        "price": 79000
    },
    "pro": {
        "name": "Pro",
        "audio_minutes": 300,
        "ocr_images": 300,
        "chat_messages": 600,
        "price": 129000
    },
    "power": {
        "name": "Power",
        "audio_minutes": 600,
        "ocr_images": 1000,
        "chat_messages": 1500,
        "price": 199000
    }
}

# Models
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    subscription_tier: str = "free_trial"
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

class VoiceTransactionRequest(BaseModel):
    audio_base64: str

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
        system_prompt = f"""You are a financial transaction parser for US users.
Your task is to extract transaction details from natural language.

Respond in this exact JSON format:
{{
    "amount": <number>,
    "merchant": "<merchant name or null>",
    "category": "<one of: {', '.join(US_CATEGORIES)}>",
    "date": "<YYYY-MM-DD>",
    "transaction_type": "expense" or "income",
    "notes": "<any additional context or null>"
}}

Rules:
- Default currency is USD
- Infer date from context (today, yesterday, last week, etc.)
- If no date mentioned, use today
- Recognize common US merchants
- Categorize intelligently based on merchant and context
- transaction_type should be "income" only if explicitly about earning/receiving money
- Extract any mentions of tip, tax, or split payments into notes"""

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

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(require_auth)):
    """Get current user info"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = await get_session_token(request)
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

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
            "chat_count": usage["chat_count"],
            "ocr_count": usage["ocr_count"],
            "voice_minutes": usage["voice_minutes"],
            "total_actions": usage["total_actions"]
        }
    )

@api_router.get("/subscription/tiers")
async def get_subscription_tiers():
    """Get available subscription tiers"""
    return SUBSCRIPTION_TIERS

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
    image_base64: str = Form(...),
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
        transaction_data = await parse_receipt_image(image_base64)
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = str(uuid.uuid4())
        transaction_data["created_at"] = datetime.now(timezone.utc)
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage
        await increment_usage(current_user.user_id, "ocr")
        
        transaction = Transaction(**transaction_data)
        
        tip_info = ""
        if transaction.metadata and transaction.metadata.get("tip"):
            tip_info = f" (includes ${transaction.metadata['tip']:.2f} tip)"
        
        return {
            "transaction": transaction,
            "message": f"Logged ${transaction.amount:.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}{tip_info}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating receipt transaction: {str(e)}")
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
