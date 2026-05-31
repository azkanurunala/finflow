from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Request, Response, Cookie, Header
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
from openai import AsyncOpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# LLM config — chat parsing, receipt OCR, and insights run directly on the
# OpenAI API (no Emergent proxy). Model is overridable via OPENAI_MODEL.
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
# Chat parsing + receipt OCR (vision). Use a cheaper model (e.g. gpt-4o-mini /
# gpt-5-mini) to save tokens — both support vision for OCR.
LLM_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-5.2')
# Voice transcription. whisper-1 or the cheaper gpt-4o-mini-transcribe.
TRANSCRIBE_MODEL = os.environ.get('OPENAI_TRANSCRIBE_MODEL', 'whisper-1')
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# USD price per token (input/output). Verify against https://openai.com/api/pricing/
# and add models as needed. Unknown models cost 0 (still logged with token counts).
MODEL_PRICING = {
    "gpt-4o-mini":            {"in": 0.15 / 1e6,  "out": 0.60 / 1e6},
    "gpt-4o-mini-transcribe": {"in": 1.25 / 1e6,  "out": 5.00 / 1e6},
    "gpt-4o":                 {"in": 2.50 / 1e6,  "out": 10.00 / 1e6},
    "gpt-5-mini":             {"in": 0.25 / 1e6,  "out": 2.00 / 1e6},
    "gpt-5.2":                {"in": 1.25 / 1e6,  "out": 10.00 / 1e6},
    "whisper-1":              {"in": 0.0,         "out": 0.0},  # billed per minute, not tokens
}

def cost_of(model: str, prompt_tokens: int = 0, completion_tokens: int = 0) -> float:
    """USD cost for a completion given its token counts."""
    p = MODEL_PRICING.get(model)
    if not p:
        return 0.0
    return prompt_tokens * p["in"] + completion_tokens * p["out"]


async def llm_complete(system_prompt: str, user_text: str,
                       image_base64: Optional[str] = None,
                       user_id: Optional[str] = None,
                       action: str = "other",
                       transaction_id: Optional[str] = None) -> str:
    """Single-turn OpenAI chat completion. Pass image_base64 for vision
    (receipt scanning). Returns the assistant's text. When user_id is given,
    the call's token usage + cost is logged via record_token_usage."""
    content: List[Dict[str, Any]] = [{"type": "text", "text": user_text}]
    if image_base64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
        })
    resp = await openai_client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
    )
    if user_id and getattr(resp, "usage", None):
        await record_token_usage(
            user_id, action, LLM_MODEL,
            resp.usage.prompt_tokens, resp.usage.completion_tokens,
            transaction_id=transaction_id,
        )
    return resp.choices[0].message.content or ""

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
    currency: Optional[str] = None
    language: Optional[str] = None
    created_at: datetime

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime


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
    currency: Optional[str] = None

class ReceiptTransactionRequest(BaseModel):
    image_base64: str
    currency: Optional[str] = None

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
    currency: Optional[str] = None

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
    """Check if the user has quota for the action.

    AUTO-HEAL: the whole check is fail-open — any unexpected error logs and
    returns True. A quota check must never be the reason an action crashes or a
    paying user is wrongly blocked.
    """
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        usage = await db.usage_stats.find_one(
            {"user_id": user.user_id, "date": today},
            {"_id": 0}
        ) or {}

        tier = user.subscription_tier
        tier_limits = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free_trial"])

        # Expired subscription → revert to free trial limits.
        if user.subscription_expires_at:
            expires_at = user.subscription_expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                tier = "free_trial"
                tier_limits = SUBSCRIPTION_TIERS["free_trial"]

        # Free trial: combined daily action cap.
        if tier == "free_trial":
            return usage.get("total_actions", 0) < tier_limits.get("daily_actions", 0)

        # Paid tiers. A limit of -1 means unlimited (Power). "uploads" is the
        # combined OCR + voice allowance. Keys match SUBSCRIPTION_TIERS, and all
        # usage fields are read with .get() so a partial usage_stats doc never
        # raises KeyError.
        if action_type == "chat":
            limit = tier_limits.get("chat_messages", 0)
            return limit == -1 or usage.get("chat_count", 0) < limit
        elif action_type == "ocr":
            limit = tier_limits.get("uploads", 0)
            return limit == -1 or usage.get("ocr_count", 0) < limit
        elif action_type == "voice":
            limit = tier_limits.get("uploads", 0)
            return limit == -1 or usage.get("voice_minutes", 0) < limit

        return True
    except Exception as e:
        logger.error(f"check_quota error (failing open, allowing action): {e}")
        return True

async def increment_usage(user_id: str, action_type: str, amount: float = 1.0):
    """Increment user's usage stats. AUTO-HEAL: never raises — usage accounting
    must not fail a request whose transaction was already saved."""
    try:
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
    except Exception as e:
        logger.error(f"increment_usage failed (ignored): {e}")

async def record_token_usage(user_id: str, action: str, model: str,
                             prompt_tokens: int = 0, completion_tokens: int = 0,
                             transaction_id: Optional[str] = None):
    """Log one AI call's token usage + cost, and roll it up into usage_stats.

    action: chat | voice | ocr | insights | transcribe
    """
    try:
        total = (prompt_tokens or 0) + (completion_tokens or 0)
        cost = round(cost_of(model, prompt_tokens or 0, completion_tokens or 0), 6)
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        await db.token_usage.insert_one({
            "user_id": user_id,
            "action": action,
            "model": model,
            "prompt_tokens": prompt_tokens or 0,
            "completion_tokens": completion_tokens or 0,
            "total_tokens": total,
            "cost_usd": cost,
            "transaction_id": transaction_id,
            "date": today,
            "created_at": now,
        })
        await db.usage_stats.update_one(
            {"user_id": user_id, "date": today},
            {"$inc": {"total_tokens": total, "cost_usd": cost},
             "$setOnInsert": {"user_id": user_id, "date": today}},
            upsert=True,
        )
    except Exception as e:
        # Never let usage logging break the main request.
        logger.error(f"Failed to record token usage: {str(e)}")

# Helper function to parse transaction via GPT
async def parse_transaction_text(text: str, source: str = "chat", user_currency: str = "USD", user_id: Optional[str] = None, transaction_id: Optional[str] = None) -> Transaction:
    """Use GPT to parse natural language transaction input"""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        system_prompt = f"""You are a multilingual financial transaction parser that understands both English and Indonesian (Bahasa Indonesia).
Your task is to extract transaction details from natural language input.

TODAY'S DATE: {today}
THE USER'S ACCOUNT CURRENCY IS: {user_currency}

Respond ONLY with this exact JSON format (no other text):
{{
    "amount": <numeric amount as a plain number>,
    "currency": "{user_currency}",
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

CURRENCY (VERY IMPORTANT):
- The notation above (jt/rb/k) only tells you the NUMERIC amount, NOT the currency.
- ALWAYS set "currency" to "{user_currency}" — the user's account currency — no matter what language or notation the input uses. Never infer a different currency.
- Strip any currency symbol from the amount and return only the number.

INDONESIAN CONTEXT EXAMPLES (currency is always {user_currency}):
- "lembur dapat 5jt" → amount: 5000000, transaction_type: "income", category: "Income"
- "beli makan 50rb" → amount: 50000, transaction_type: "expense", category: "Dining & Coffee"
- "gaji masuk 10jt" → amount: 10000000, transaction_type: "income", category: "Income"
- "bayar listrik 500rb" → amount: 500000, transaction_type: "expense", category: "Rent & Utilities"

ENGLISH EXAMPLES:
- "earned $500 from freelance" → amount: 500, currency: "USD", transaction_type: "income"
- "spent $25 on lunch" → amount: 25, currency: "USD", transaction_type: "expense"

DATE PARSING:
- "hari ini" / "today" = {today}
- "kemarin" / "yesterday" = yesterday's date
- "minggu lalu" / "last week" = 7 days ago
- If no date mentioned, use today: {today}"""

        response = await llm_complete(system_prompt, f"Parse this transaction: {text}", user_id=user_id, action=source, transaction_id=transaction_id)
        
        # Parse GPT response
        import json
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        data = json.loads(response_text)
        
        # Create transaction (without user_id, will be added by caller).
        # Force the user's account currency — the model only extracts the amount.
        transaction_data = {
            "amount": float(data["amount"]),
            "currency": user_currency,
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
async def parse_receipt_image(image_base64: str, user_currency: str = "USD", user_id: Optional[str] = None, transaction_id: Optional[str] = None) -> dict:
    """Use GPT Vision to parse receipt image"""
    try:
        system_prompt = f"""You are a receipt scanner.
Extract transaction details from the receipt image.
The user's account currency is {user_currency}; return the amount as a plain number.

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

        response = await llm_complete(
            system_prompt,
            "Extract transaction details from this receipt.",
            image_base64=image_base64,
            user_id=user_id,
            action="ocr",
            transaction_id=transaction_id,
        )
        
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
        
        # Create transaction data (force the user's account currency)
        transaction_data = {
            "amount": float(data["amount"]),
            "currency": user_currency,
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
# ---------------------------------------------------------------------------
# OAuth (Sign in with Google / Apple). Replaces the old Emergent auth proxy.
# The client obtains an ID token from the native SDK and posts it here; we
# verify it server-side, then create/link a user and issue our session token.
# ---------------------------------------------------------------------------
GOOGLE_CLIENT_IDS = [c.strip() for c in os.environ.get("GOOGLE_CLIENT_IDS", "").split(",") if c.strip()]
APPLE_BUNDLE_ID = os.environ.get("APPLE_BUNDLE_ID", "com.azkanura.finflow")
APPLE_SERVICES_ID = os.environ.get("APPLE_SERVICES_ID", "")
APPLE_VALID_AUDS = [a for a in [APPLE_BUNDLE_ID, APPLE_SERVICES_ID] if a]


class OAuthRequest(BaseModel):
    id_token: str
    full_name: Optional[str] = None


async def _issue_session(user_id: str, response: Response) -> str:
    """Create a 7-day session token (DB + httpOnly cookie) and return it."""
    session_token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(
        key="session_token", value=session_token, httponly=True,
        secure=True, samesite="none", max_age=7 * 24 * 60 * 60, path="/",
    )
    return session_token


async def _upsert_oauth_user(provider: str, sub: str, email: str, name: str,
                             picture: Optional[str]) -> dict:
    """Find the user by email and link the provider, or create a new one
    (new users get the same 3-day auto free trial as before)."""
    email = (email or "").lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0}) if email else None
    if existing:
        providers = existing.get("auth_providers", [])
        if not any(p.get("provider") == provider for p in providers):
            providers.append({"provider": provider, "sub": sub,
                              "linked_at": datetime.now(timezone.utc)})
            await db.users.update_one(
                {"user_id": existing["user_id"]},
                {"$set": {"auth_providers": providers, "email_verified": True}},
            )
            existing["auth_providers"] = providers
        return existing

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {
        "user_id": user_id,
        "email": email,
        "name": name or (email.split("@")[0] if email else "User"),
        "picture": picture,
        "auth_provider": provider,
        "auth_providers": [{"provider": provider, "sub": sub,
                            "linked_at": datetime.now(timezone.utc)}],
        "email_verified": True,
        "subscription_tier": "free_trial",
        "subscription_started_at": datetime.now(timezone.utc),
        "subscription_expires_at": datetime.now(timezone.utc) + timedelta(days=3),
        "subscription_source": "auto_trial",
        "onboarding_completed": False,
        "language": None,
        "currency": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(new_user)
    return new_user


def _auth_response(user: dict, session_token: str) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "session_token": session_token,
        "onboarding_completed": user.get("onboarding_completed", False),
        "subscription_tier": user.get("subscription_tier"),
        "is_subscription_active": user.get("subscription_tier") not in (None, "free"),
        "language": user.get("language"),
        "currency": user.get("currency"),
    }


@api_router.post("/auth/oauth/google")
async def oauth_google(req: OAuthRequest, response: Response):
    """Verify a Google ID token and sign the user in."""
    try:
        from google.oauth2 import id_token as g_id_token
        from google.auth.transport import requests as g_requests

        info = g_id_token.verify_oauth2_token(req.id_token, g_requests.Request())
        if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise HTTPException(status_code=401, detail="Invalid Google token issuer")
        if GOOGLE_CLIENT_IDS and info.get("aud") not in GOOGLE_CLIENT_IDS:
            raise HTTPException(status_code=401, detail="Google token audience mismatch")
        if not info.get("email") or not info.get("email_verified", False):
            raise HTTPException(status_code=401, detail="Google email not verified")

        user = await _upsert_oauth_user(
            "google", info["sub"], info["email"],
            info.get("name") or req.full_name or "", info.get("picture"),
        )
        token = await _issue_session(user["user_id"], response)
        return _auth_response(user, token)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")
    except Exception as e:
        logger.error(f"Google OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/auth/oauth/apple")
async def oauth_apple(req: OAuthRequest, response: Response):
    """Verify an Apple identity token (JWT) and sign the user in."""
    try:
        import jwt
        from jwt import PyJWKClient

        signing_key = PyJWKClient("https://appleid.apple.com/auth/keys").get_signing_key_from_jwt(req.id_token)
        claims = jwt.decode(
            req.id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=APPLE_VALID_AUDS or None,
            issuer="https://appleid.apple.com",
            options={"require": ["exp", "iss", "sub"]},
        )

        sub = claims["sub"]
        email = (claims.get("email") or "").lower()

        # Apple omits email after the first sign-in: match by provider sub.
        if not email:
            existing = await db.users.find_one(
                {"auth_providers": {"$elemMatch": {"provider": "apple", "sub": sub}}},
                {"_id": 0},
            )
            if existing:
                token = await _issue_session(existing["user_id"], response)
                return _auth_response(existing, token)
            email = f"{sub}@privaterelay.appleid.local"

        user = await _upsert_oauth_user(
            "apple", sub, email, req.full_name or email.split("@")[0], None,
        )
        token = await _issue_session(user["user_id"], response)
        return _auth_response(user, token)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Apple OAuth error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid Apple token: {str(e)}")


# ---------------------------------------------------------------------------
# Redeem codes — internal promo codes that grant a free trial (default: Pro,
# 3 days). Separate from App Store/Play promo codes (those are for IAP).
# ---------------------------------------------------------------------------
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


def _aware(dt):
    """Ensure a datetime is timezone-aware (UTC)."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


class RedeemRequest(BaseModel):
    code: str


class GenerateCodesRequest(BaseModel):
    count: int = 1
    prefix: str = "FINFLOW"
    grant_tier: str = "pro"
    duration_days: int = 3
    max_uses: int = 1
    per_user_once: bool = True
    valid_days: Optional[int] = None  # how long the code itself stays valid


@api_router.post("/codes/redeem")
async def redeem_code(req: RedeemRequest, current_user: User = Depends(require_auth)):
    """Redeem a trial code → grant the configured tier for N days."""
    code = req.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")

    doc = await db.redeem_codes.find_one({"code": code})
    if not doc or not doc.get("active", True):
        raise HTTPException(status_code=404, detail="Invalid or inactive code")

    now = datetime.now(timezone.utc)
    if _aware(doc.get("valid_from")) and now < _aware(doc["valid_from"]):
        raise HTTPException(status_code=400, detail="Code is not active yet")
    if _aware(doc.get("valid_until")) and now > _aware(doc["valid_until"]):
        raise HTTPException(status_code=400, detail="Code has expired")
    if doc.get("max_uses") is not None and doc.get("used_count", 0) >= doc["max_uses"]:
        raise HTTPException(status_code=409, detail="Code has reached its usage limit")

    if doc.get("per_user_once", True):
        used = await db.redemptions.find_one({"code": code, "user_id": current_user.user_id})
        if used:
            raise HTTPException(status_code=409, detail="You have already used this code")

    # Don't downgrade an active PAID subscription.
    exp = _aware(current_user.subscription_expires_at)
    if current_user.subscription_tier in ("basic", "pro", "power") and exp and exp > now:
        raise HTTPException(status_code=409, detail="You already have an active subscription")

    grant_tier = doc.get("grant_tier", "pro")
    duration_days = int(doc.get("duration_days", 3))
    new_expiry = now + timedelta(days=duration_days)

    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "subscription_tier": grant_tier,
            "subscription_started_at": now,
            "subscription_expires_at": new_expiry,
            "subscription_source": "trial_code",
        }},
    )
    await db.redeem_codes.update_one({"code": code}, {"$inc": {"used_count": 1}})
    await db.redemptions.insert_one({
        "code": code,
        "user_id": current_user.user_id,
        "redeemed_at": now,
        "expires_at": new_expiry,
    })

    return {
        "success": True,
        "subscription_tier": grant_tier,
        "subscription_expires_at": new_expiry.isoformat(),
        "days": duration_days,
    }


@api_router.post("/admin/codes")
async def generate_codes(req: GenerateCodesRequest, x_admin_token: Optional[str] = Header(None)):
    """Generate a batch of redeem codes (admin only, via X-Admin-Token header)."""
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(days=req.valid_days) if req.valid_days else None
    codes = []
    for _ in range(max(1, min(req.count, 1000))):
        code = f"{req.prefix.upper()}-{secrets.token_hex(3).upper()}"
        await db.redeem_codes.insert_one({
            "code": code,
            "type": "trial",
            "grant_tier": req.grant_tier,
            "duration_days": req.duration_days,
            "max_uses": req.max_uses,
            "used_count": 0,
            "per_user_once": req.per_user_once,
            "active": True,
            "valid_from": now,
            "valid_until": valid_until,
            "created_at": now,
        })
        codes.append(code)
    return {"codes": codes, "count": len(codes)}


# ---------------------------------------------------------------------------
# Account management — update profile name + change password (email accounts).
# ---------------------------------------------------------------------------
class UpdateProfileRequest(BaseModel):
    name: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@api_router.put("/auth/profile")
async def update_profile(req: UpdateProfileRequest, current_user: User = Depends(require_auth)):
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    await db.users.update_one(
        {"user_id": current_user.user_id}, {"$set": {"name": name}}
    )
    return {"success": True, "name": name}


@api_router.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest, current_user: User = Depends(require_auth)):
    user = await db.users.find_one({"user_id": current_user.user_id})
    if not user or "password_hash" not in user:
        raise HTTPException(status_code=400, detail="Password change is only available for email accounts")
    if not verify_password(req.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"password_hash": hash_password(req.new_password)}},
    )
    return {"success": True}


# ---------------------------------------------------------------------------
# Billing / paywall — RevenueCat is the source of IAP truth. We mirror the
# active entitlement onto the user (subscription_tier/expires) so the paywall
# and quota checks stay server-authoritative.
# ---------------------------------------------------------------------------
REVENUECAT_SECRET_KEY = os.environ.get("REVENUECAT_SECRET_KEY", "")
REVENUECAT_WEBHOOK_AUTH = os.environ.get("REVENUECAT_WEBHOOK_AUTH", "")

# Map store product identifiers → our subscription tier.
PRODUCT_TIER_MAP = {
    "basic_monthly": "basic", "basic_yearly": "basic",
    "pro_monthly": "pro", "pro_yearly": "pro",
    "power_monthly": "power", "power_yearly": "power",
}


def _parse_rc_date(s: Optional[str]):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


async def _sync_user_entitlement(user_id: str) -> dict:
    """Query RevenueCat for a user's active entitlements and mirror the best one
    onto our user record. Returns the resulting entitlement summary."""
    if not REVENUECAT_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing not configured")

    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(
            f"https://api.revenuecat.com/v1/subscribers/{user_id}",
            headers={"Authorization": f"Bearer {REVENUECAT_SECRET_KEY}"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not reach billing provider")

    entitlements = (r.json().get("subscriber", {}) or {}).get("entitlements", {}) or {}
    now = datetime.now(timezone.utc)
    far = datetime.max.replace(tzinfo=timezone.utc)
    best = None  # (effective_expiry, real_expiry, tier)
    for ent in entitlements.values():
        exp = _parse_rc_date(ent.get("expires_date"))
        if not (exp is None or exp > now):
            continue  # expired
        eff = exp or far  # null expires_date = lifetime/non-expiring
        tier = PRODUCT_TIER_MAP.get(ent.get("product_identifier", ""), "pro")
        if best is None or eff > best[0]:
            best = (eff, exp, tier)

    if best:
        _, real_exp, tier = best
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "subscription_tier": tier,
            "subscription_expires_at": real_exp,
            "subscription_source": "iap",
        }})
        return {"tier": tier, "expires_at": real_exp.isoformat() if real_exp else None, "active": True}

    # No active paid entitlement — if the user was on IAP, drop to free.
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if user and user.get("subscription_source") == "iap":
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "subscription_tier": "free",
            "subscription_source": "none",
        }})
    return {"tier": "free", "active": False}


@api_router.post("/billing/sync")
async def billing_sync(current_user: User = Depends(require_auth)):
    """Client calls this after a purchase/restore to refresh entitlement."""
    return await _sync_user_entitlement(current_user.user_id)


@api_router.post("/billing/webhook")
async def billing_webhook(request: Request, authorization: Optional[str] = Header(None)):
    """RevenueCat webhook — re-syncs the affected user on any subscription event."""
    if REVENUECAT_WEBHOOK_AUTH and authorization != REVENUECAT_WEBHOOK_AUTH:
        raise HTTPException(status_code=401, detail="Unauthorized")
    body = await request.json()
    app_user_id = (body.get("event", {}) or {}).get("app_user_id")
    if app_user_id:
        try:
            await _sync_user_entitlement(app_user_id)
        except Exception as e:
            logger.error(f"Webhook sync error for {app_user_id}: {str(e)}")
    return {"received": True}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user info"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get additional user data from DB (password_hash fetched only to derive
    # has_password — it is never echoed back in the response below).
    user_doc = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
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
        "created_at": user_doc.get("created_at"),
        "has_password": bool(user_doc.get("password_hash")),
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
            "onboarding_completed": False,
            "language": None,
            "currency": None
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
            "subscription_tier": user.get("subscription_tier"),
            "language": user.get("language"),
            "currency": user.get("currency")
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
        
        # Parse transaction using GPT (id generated up front so the token-usage
        # log can be linked to this transaction)
        txn_id = str(uuid.uuid4())
        transaction_data = await parse_transaction_text(
            request.text, source="chat",
            user_currency=(request.currency or current_user.currency or "USD"),
            user_id=current_user.user_id,
            transaction_id=txn_id,
        )
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = txn_id
        transaction_data["created_at"] = datetime.now(timezone.utc)
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage
        await increment_usage(current_user.user_id, "chat")
        
        transaction = Transaction(**transaction_data)
        
        return {
            "transaction": transaction,
            "message": f"Logged {transaction.currency} {transaction.amount:,.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
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
        
        # Parse receipt using GPT Vision (id up front to link token-usage log)
        txn_id = str(uuid.uuid4())
        transaction_data = await parse_receipt_image(
            request.image_base64,
            user_currency=(request.currency or current_user.currency or "USD"),
            user_id=current_user.user_id,
            transaction_id=txn_id,
        )
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = txn_id
        transaction_data["created_at"] = datetime.now(timezone.utc)
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage
        await increment_usage(current_user.user_id, "ocr")
        
        transaction = Transaction(**transaction_data)
        
        tip_info = ""
        if transaction.metadata and transaction.metadata.get("tip"):
            tip_info = f" (includes {transaction.currency} {transaction.metadata['tip']:,.2f} tip)"

        return {
            "transaction": transaction,
            "message": f"Logged {transaction.currency} {transaction.amount:,.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}{tip_info}."
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
                    "model": TRANSCRIBE_MODEL,
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

        # Generate the transaction id up front so transcription + parse token
        # usage can both be linked to this transaction.
        txn_id = str(uuid.uuid4())

        # Log transcription token usage when the model reports it
        # (gpt-4o-mini-transcribe returns `usage`; whisper-1 does not).
        tu = transcription_result.get("usage") or {}
        if tu.get("input_tokens") or tu.get("output_tokens"):
            await record_token_usage(
                current_user.user_id, "transcribe", TRANSCRIBE_MODEL,
                tu.get("input_tokens", 0), tu.get("output_tokens", 0),
                transaction_id=txn_id,
            )

        if not transcribed_text:
            raise HTTPException(
                status_code=400,
                detail="Could not transcribe audio. Please try again."
            )
        
        # Parse transaction using GPT
        transaction_data = await parse_transaction_text(
            transcribed_text, source="voice",
            user_currency=(request.currency or current_user.currency or "USD"),
            user_id=current_user.user_id,
            transaction_id=txn_id,
        )
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = txn_id
        transaction_data["created_at"] = datetime.now(timezone.utc)
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage (estimate 0.5 minute per voice note)
        await increment_usage(current_user.user_id, "voice", 0.5)
        
        transaction = Transaction(**transaction_data)
        
        return {
            "transaction": transaction,
            "transcription": transcribed_text,
            "message": f"Logged {transaction.currency} {transaction.amount:,.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
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
        
        # Parse transaction using GPT (id up front to link token-usage log)
        txn_id = str(uuid.uuid4())
        transaction_data = await parse_transaction_text(
            request.text, source="voice",
            user_currency=(request.currency or current_user.currency or "USD"),
            user_id=current_user.user_id,
            transaction_id=txn_id,
        )
        transaction_data["user_id"] = current_user.user_id
        transaction_data["id"] = txn_id
        transaction_data["created_at"] = datetime.now(timezone.utc)
        
        # Save to database
        await db.transactions.insert_one(transaction_data)
        
        # Increment usage (estimate 0.5 minute per voice note)
        await increment_usage(current_user.user_id, "voice", 0.5)
        
        transaction = Transaction(**transaction_data)
        
        return {
            "transaction": transaction,
            "transcription": request.text,
            "message": f"Logged {transaction.currency} {transaction.amount:,.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
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
        # Per-currency breakdowns so the client can convert each currency group
        # to the user's display currency (live conversion).
        income_by_currency = {}
        expense_by_currency = {}
        category_by_currency = {}

        for t in transactions:
            amount = t["amount"]
            cur = t.get("currency") or "USD"
            if t["transaction_type"] == "expense":
                total_expenses += amount
                category = t["category"]
                by_category[category] = by_category.get(category, 0) + amount
                expense_by_currency[cur] = expense_by_currency.get(cur, 0) + amount
                cc = category_by_currency.setdefault(category, {})
                cc[cur] = cc.get(cur, 0) + amount
            else:
                total_income += amount
                income_by_currency[cur] = income_by_currency.get(cur, 0) + amount

        return {
            "total_expenses": round(total_expenses, 2),
            "total_income": round(total_income, 2),
            "net": round(total_income - total_expenses, 2),
            "by_category": {k: round(v, 2) for k, v in by_category.items()},
            "income_by_currency": {k: round(v, 2) for k, v in income_by_currency.items()},
            "expense_by_currency": {k: round(v, 2) for k, v in expense_by_currency.items()},
            "category_by_currency": {
                cat: {c: round(v, 2) for c, v in cur_map.items()}
                for cat, cur_map in category_by_currency.items()
            },
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
        
        transactions = await db.transactions.find(
            {
                "user_id": current_user.user_id,
                "date": {"$gte": start_date}
            },
            {"_id": 0}
        ).sort("date", -1).to_list(1000)
        
        if format == "json":
            # Return as JSON for Excel/Google Sheets import
            return {
                "transactions": transactions,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "total_count": len(transactions)
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
            date_str = t["date"].strftime("%Y-%m-%d") if hasattr(t["date"], "strftime") else str(t["date"])[:10]
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
        raise HTTPException(status_code=500, detail=str(e))

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
        
        # Get spending by category + per-currency breakdowns (for client conversion)
        category_spending = {}
        income_by_currency = {}
        expense_by_currency = {}
        category_by_currency = {}
        for t in transactions:
            cur = t.get("currency") or "USD"
            amt = t["amount"]
            if t.get("transaction_type") == "expense":
                cat = t.get("category", "Other")
                category_spending[cat] = category_spending.get(cat, 0) + amt
                expense_by_currency[cur] = expense_by_currency.get(cur, 0) + amt
                cc = category_by_currency.setdefault(cat, {})
                cc[cur] = cc.get(cur, 0) + amt
            else:
                income_by_currency[cur] = income_by_currency.get(cur, 0) + amt

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

        response = await llm_complete(
            system_prompt,
            f"Analyze this financial data and provide insights:\n{context}",
            user_id=current_user.user_id,
            action="insights",
        )
        
        # Parse response
        import json
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        ai_insights = json.loads(response_text)
        
        # Add chart data (with per-currency breakdowns so the client can convert)
        ai_insights["chart_data"] = {
            "by_category": [
                {"category": cat, "amount": amt, "by_currency": category_by_currency.get(cat, {})}
                for cat, amt in sorted_categories
            ],
            "income_vs_expenses": {
                "income": total_income,
                "expenses": total_expenses,
                "net": net,
                "income_by_currency": income_by_currency,
                "expense_by_currency": expense_by_currency
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


@api_router.get("/usage/cost")
async def get_usage_cost(days: int = 30, current_user: User = Depends(require_auth)):
    """Token usage + estimated cost for the current user over the last `days`,
    broken down by action (chat/voice/ocr/insights/transcribe) and by day."""
    try:
        start = datetime.now(timezone.utc) - timedelta(days=days)
        events = await db.token_usage.find(
            {"user_id": current_user.user_id, "created_at": {"$gte": start}},
            {"_id": 0},
        ).to_list(20000)

        total_cost = 0.0
        total_tokens = 0
        by_action: Dict[str, Any] = {}
        by_day: Dict[str, Any] = {}
        by_model: Dict[str, Any] = {}
        for e in events:
            cost = e.get("cost_usd", 0) or 0
            tokens = e.get("total_tokens", 0) or 0
            total_cost += cost
            total_tokens += tokens
            for bucket, key in ((by_action, e.get("action", "other")),
                                (by_day, e.get("date")),
                                (by_model, e.get("model", "?"))):
                b = bucket.setdefault(key, {"calls": 0, "tokens": 0, "cost_usd": 0.0})
                b["calls"] += 1
                b["tokens"] += tokens
                b["cost_usd"] = round(b["cost_usd"] + cost, 6)

        return {
            "period_days": days,
            "calls": len(events),
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost, 6),
            "avg_cost_per_call_usd": round(total_cost / len(events), 6) if events else 0,
            "by_action": by_action,
            "by_model": by_model,
            "by_day": dict(sorted(by_day.items())),
        }
    except Exception as e:
        logger.error(f"Error computing usage cost: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


app.include_router(api_router)

# Admin web dashboard (GET /admin) + aggregate endpoint (GET /api/admin/overview),
# both guarded by ADMIN_TOKEN. Defined in admin.py to keep server.py tidy.
from admin import register_admin
register_admin(app, db, ADMIN_TOKEN)

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
