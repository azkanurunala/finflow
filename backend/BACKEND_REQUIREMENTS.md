# Backend Requirements & Implementation Examples

This document tracks backend changes and provides implementation examples using **Python (FastAPI)** and **MongoDB (Motor)**.

---

## 1. Global Currency & Formatting (Issue 1.1)
### Description
Backend responses must use locale-aware formatting for amounts, and all Voice/OCR results must be saved to Chat History.

### Implementation Example
```python
# Save OCR/Voice result to Chat History
async def save_to_chat_history(user_id: str, message_type: str, text: str, data: dict):
    message = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": message_type, # 'ocr' or 'voice'
        "text": text,
        "parsed_data": data,
        "timestamp": datetime.now(timezone.utc)
    }
    await db.chat_messages.insert_one(message)

# Locale-aware formatting helper
def format_currency(amount: float, currency: str):
    if currency == "IDR":
        return f"Rp {amount:,.0f}".replace(",", ".")
    return f"${amount:,.2f}"
```

---

## 2. Currency Persistence (Issue 3.1)
### Description
User's currency preference must be saved in the database and returned on login/me.

### Implementation Example
```python
@api_router.put("/user/settings")
async def update_settings(settings: dict, current_user: User = Depends(require_auth)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"currency": settings.get("currency"), "language": settings.get("language")}}
    )
    return {"success": True}
```

---

## 3. Chat Persistence (Issue 6.1)
### Description
Store full chat history for persistent "WhatsApp-like" behavior.

### Implementation Example
```python
@api_router.get("/chat/history")
async def get_history(current_user: User = Depends(require_auth)):
    messages = await db.chat_messages.find({"user_id": current_user.user_id}).to_list(100)
    return {"messages": messages}

@api_router.post("/chat/message")
async def save_msg(msg: ChatMessage, current_user: User = Depends(require_auth)):
    msg_doc = msg.dict()
    msg_doc["user_id"] = current_user.user_id
    await db.chat_messages.insert_one(msg_doc)
```

---

## 4. Initial Onboarding Balance (Issue 9.1)
### Description
Store the user's starting balance as a specialized transaction.

### Implementation Example
```python
@api_router.post("/auth/onboarding-balance")
async def set_initial_balance(data: dict, current_user: User = Depends(require_auth)):
    initial_tx = {
        "user_id": current_user.user_id,
        "amount": data["balance"],
        "category": "Income",
        "notes": "Initial Balance",
        "transaction_type": "income",
        "date": datetime.now(timezone.utc)
    }
    await db.transactions.insert_one(initial_tx)
```

---

## 5. Apple IAP Verification (Issue 11)
### Description
Verify Apple receipts server-side and update subscription tier.

### Implementation Example
```python
@api_router.post("/subscription/verify-apple")
async def verify_apple(receipt: dict, current_user: User = Depends(require_auth)):
    # 1. Verify receipt with Apple Verification API
    # 2. Extract product_id and duration
    # 3. Update user doc
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"subscription_tier": "pro", "is_active": True}}
    )
    return {"status": "success"}
```

---

## 6. Authentication Token Lifecycle (Issue 18)
### Description
Extend session to 30 days and return 401 for expired tokens.

### Implementation Example
```python
# Session Creation (30 Days)
session_expires = datetime.now(timezone.utc) + timedelta(days=30)
response.set_cookie(
    key="session_token",
    value=token,
    max_age=2592000, # 30 days in seconds
    httponly=True
)

# Auth Middleware (401 Handling)
async def require_auth(request: Request):
    session = await db.user_sessions.find_one({"token": token})
    if not session or session["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    return session["user_id"]
```

---

## 7. Notification System (Issue 12)
### Description
Support in-app notifications and user preference persistence for push/email.

### Implementation Example
```python
@api_router.post("/notifications/read-all")
async def read_all(current_user: User = Depends(require_auth)):
    await db.notifications.update_many(
        {"user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

async def send_system_notification(user_id: str, title: str, body: str):
    await db.notifications.insert_one({
        "user_id": user_id,
        "title": title,
        "body": body,
        "created_at": datetime.now(timezone.utc)
    })
```
