from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from bson import ObjectId
import base64
import io
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

# Common US merchants
US_MERCHANTS = [
    "Walmart", "Target", "Costco", "Whole Foods", "Trader Joe's",
    "Starbucks", "McDonald's", "Chipotle", "Subway",
    "Uber", "Lyft", "Shell", "Chevron",
    "Amazon", "Netflix", "Spotify", "Apple"
]

# Models
class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float
    currency: str = "USD"
    merchant: Optional[str] = None
    category: str
    date: datetime
    transaction_type: str = "expense"  # expense or income
    notes: Optional[str] = None
    source: str  # chat, receipt, voice
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TransactionCreate(BaseModel):
    text: Optional[str] = None

class ChatTransactionRequest(BaseModel):
    text: str

class VoiceTransactionRequest(BaseModel):
    audio_base64: str

class TransactionResponse(BaseModel):
    transaction: Transaction
    message: str

class InsightsResponse(BaseModel):
    total_expenses: float
    total_income: float
    net: float
    by_category: Dict[str, float]
    period: str

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
- Recognize common US merchants: {', '.join(US_MERCHANTS[:10])}
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
        # Extract JSON from response
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        data = json.loads(response_text)
        
        # Create transaction
        transaction = Transaction(
            amount=float(data["amount"]),
            merchant=data.get("merchant"),
            category=data["category"],
            date=datetime.fromisoformat(data["date"]),
            transaction_type=data.get("transaction_type", "expense"),
            notes=data.get("notes"),
            source=source
        )
        
        return transaction
        
    except Exception as e:
        logger.error(f"Error parsing transaction: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Could not parse transaction: {str(e)}")

# Helper function to parse receipt image
async def parse_receipt_image(image_base64: str) -> Transaction:
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

        # Create image content
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
        
        # Create transaction
        transaction = Transaction(
            amount=float(data["amount"]),
            merchant=data.get("merchant"),
            category=data["category"],
            date=datetime.fromisoformat(data["date"]),
            transaction_type="expense",
            notes=data.get("notes"),
            source="receipt",
            metadata=metadata if metadata else None
        )
        
        return transaction
        
    except Exception as e:
        logger.error(f"Error parsing receipt: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Could not parse receipt: {str(e)}")

# Routes
@api_router.get("/")
async def root():
    return {"message": "AI Finance Assistant API", "version": "1.0.0"}

@api_router.get("/categories")
async def get_categories():
    """Get list of transaction categories"""
    return {"categories": US_CATEGORIES}

@api_router.post("/transactions/chat")
async def create_chat_transaction(request: ChatTransactionRequest):
    """Process text chat input and create transaction"""
    try:
        # Parse transaction using GPT
        transaction = await parse_transaction_text(request.text, source="chat")
        
        # Save to database
        transaction_dict = transaction.dict()
        await db.transactions.insert_one(transaction_dict)
        
        return {
            "transaction": transaction,
            "message": f"Logged ${transaction.amount:.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
        }
    except Exception as e:
        logger.error(f"Error creating chat transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/transactions/receipt")
async def create_receipt_transaction(image_base64: str = Form(...)):
    """Process receipt image and create transaction"""
    try:
        # Parse receipt using GPT Vision
        transaction = await parse_receipt_image(image_base64)
        
        # Save to database
        transaction_dict = transaction.dict()
        await db.transactions.insert_one(transaction_dict)
        
        tip_info = ""
        if transaction.metadata and transaction.metadata.get("tip"):
            tip_info = f" (includes ${transaction.metadata['tip']:.2f} tip)"
        
        return {
            "transaction": transaction,
            "message": f"Logged ${transaction.amount:.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}{tip_info}."
        }
    except Exception as e:
        logger.error(f"Error creating receipt transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/transactions/voice")
async def create_voice_transaction(request: VoiceTransactionRequest):
    """Process voice note and create transaction
    
    NOTE: This endpoint requires OpenAI Whisper API which is NOT supported by Emergent LLM key.
    Use the /transactions/voice-text endpoint instead if you don't have a separate OpenAI key.
    """
    try:
        # Check if we have a real OpenAI key (not Emergent key)
        if EMERGENT_LLM_KEY.startswith("sk-emergent"):
            raise HTTPException(
                status_code=501,
                detail="Voice transcription requires a separate OpenAI API key. Emergent LLM key does not support Whisper API. Please use text input or provide an OpenAI API key."
            )
        
        # Transcribe audio using Whisper
        from openai import AsyncOpenAI
        
        openai_client = AsyncOpenAI(api_key=EMERGENT_LLM_KEY)
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio_base64)
        
        # Create a file-like object
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.m4a"
        
        # Transcribe with Whisper
        transcription = await openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )
        
        transcribed_text = transcription.text
        logger.info(f"Transcribed: {transcribed_text}")
        
        # Parse transaction using GPT
        transaction = await parse_transaction_text(transcribed_text, source="voice")
        
        # Save to database
        transaction_dict = transaction.dict()
        await db.transactions.insert_one(transaction_dict)
        
        return {
            "transaction": transaction,
            "transcription": transcribed_text,
            "message": f"Logged ${transaction.amount:.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating voice transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/transactions/voice-text")
async def create_voice_text_transaction(request: ChatTransactionRequest):
    """Process pre-transcribed voice text and create transaction
    
    Use this endpoint if you're doing speech-to-text on the client side.
    This works with the Emergent LLM key since it only uses GPT for parsing.
    """
    try:
        # Parse transaction using GPT
        transaction = await parse_transaction_text(request.text, source="voice")
        
        # Save to database
        transaction_dict = transaction.dict()
        await db.transactions.insert_one(transaction_dict)
        
        return {
            "transaction": transaction,
            "transcription": request.text,
            "message": f"Logged ${transaction.amount:.2f} at {transaction.merchant or 'unknown merchant'} under {transaction.category}."
        }
    except Exception as e:
        logger.error(f"Error creating voice-text transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/transactions")
async def get_transactions(limit: int = 100, skip: int = 0):
    """Get all transactions"""
    try:
        transactions = await db.transactions.find().sort("date", -1).skip(skip).limit(limit).to_list(limit)
        
        # Convert ObjectId to string and format response
        for t in transactions:
            if "_id" in t:
                del t["_id"]
        
        return {"transactions": transactions, "count": len(transactions)}
    except Exception as e:
        logger.error(f"Error fetching transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    """Delete a transaction"""
    try:
        result = await db.transactions.delete_one({"id": transaction_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return {"message": "Transaction deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/insights")
async def get_insights(days: int = 30):
    """Get spending insights"""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        transactions = await db.transactions.find({
            "date": {"$gte": start_date}
        }).to_list(1000)
        
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
