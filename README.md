# 💸 Finflow

> **Development Period:** November 2025 – January 2026
> **Platform:** Cross-platform Mobile App (iOS & Android) + Python Backend

Finflow is an advanced, AI-driven financial mobile application designed to streamline personal finance and transaction management. Featuring voice and image recognition, real-time synchronization, and AI-powered insights, it provides a cutting-edge approach to tracking and managing finances seamlessly.

## ✨ Key Features
- **AI-Driven Interactions:** Leverages OpenAI, Google Generative AI, and LiteLLM to process voice commands and image recognition (e.g., receipt scanning).
- **Real-Time Processing:** Implements WebSockets and asynchronous Python (FastAPI) for instant data synchronization and transaction flows.
- **Cross-Platform Mobile App:** Built with React Native and Expo for a native feel on both iOS and Android devices.
- **Secure & Scalable Backend:** Powered by MongoDB (Motor), AWS S3 (Boto3) for media storage, and Stripe for seamless subscription or payment management.

## 🛠 Tech Stack

### Frontend (Mobile App)
- **Framework:** React Native, Expo, Expo Router
- **Language:** TypeScript
- **State Management:** Zustand
- **Capabilities:** Expo Camera, Expo Audio, React Native Purchases
- **Navigation:** React Navigation

### Backend
- **Framework:** FastAPI (Python 3), Uvicorn
- **Database:** MongoDB (Motor / PyMongo)
- **AI Integration:** OpenAI, Google GenAI, LiteLLM
- **Cloud & Storage:** AWS S3 (Boto3), Vercel/AWS (Deployment)
- **Security & Payments:** PyJWT, Bcrypt, Stripe API

## 🚀 Architecture Overview
The application is strictly divided into a high-performance React Native frontend and an asynchronous FastAPI backend. The mobile app interfaces with the backend via RESTful APIs and WebSockets. AI requests (voice transcription, image processing) are routed through the backend to abstract API keys and maintain strict security protocols.

## ⚙️ Getting Started

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows: venv\Scripts\activate
   # On macOS/Linux: source venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn server:app --reload
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```

## 🧪 Testing
The backend includes a comprehensive suite of automated tests focusing on authentication (`auth_test.py`), transaction flows (`transaction_flow_test.py`), and sophisticated voice model processing (`voice_test_specific.py`).

---
*Designed for the future of decentralized and AI-assisted personal finance.*
