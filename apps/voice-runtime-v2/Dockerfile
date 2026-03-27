# Dockerfile for Voice Runtime V2

FROM python:3.11-slim as base

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY apps/voice-runtime-v2/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY apps/voice-runtime-v2 ./

RUN useradd -m -u 1000 wardline && chown -R wardline:wardline /app
USER wardline

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:3003/health')"

CMD ["python", "server.py"]
