# ─── Stage 1: Build the React Frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend-build

# Copy package definition and install dependencies
COPY frontend/package*.json ./
RUN npm ci --silent

# Copy all frontend files and compile production assets
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Create the Python Backend Container ─────────────────────────────
FROM python:3.12-slim

# Prevent .pyc compilation and buffer stdout/stderr for immediate output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install OS-level build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire backend project structure
COPY backend/ /app/backend/
COPY attack_tools/ /app/attack_tools/
COPY target_ip_sniffer.py /app/target_ip_sniffer.py

# Copy built static frontend files from Stage 1 into backend/dist
COPY --from=frontend-builder /frontend-build/dist /app/backend/dist/

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

# Expose port 8080 (serves both API + Static React Frontend)
EXPOSE 8080

# Run uvicorn; override via env DATABASE_PATH for persistent volume
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
