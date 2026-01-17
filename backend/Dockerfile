FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for some python packages)
# RUN apt-get update && apt-get install -y gcc

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Environment variables should be passed at runtime
# ENV MONGO_URL=...
# ENV OPENAI_API_KEY=...

# Run the application
# We use shell form to allow expansion of $PORT if needed, defaulting to 8000
CMD sh -c "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"
