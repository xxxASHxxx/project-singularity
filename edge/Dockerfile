FROM python:3.11-slim

WORKDIR /app

# OpenCV needs libGL
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY edge/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY edge/ ./edge/
COPY config/ ./config/

# Default: mock mode so docker compose works without a physical camera
CMD ["python", "edge/main.py", "--mock", "--headless"]
