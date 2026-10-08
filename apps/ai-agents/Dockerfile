FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers for crawl4ai
RUN playwright install --with-deps chromium

# Copy source code
COPY . .

# Environment defaults
ENV PORT=8000
EXPOSE 8000

CMD ["python", "main.py"]
