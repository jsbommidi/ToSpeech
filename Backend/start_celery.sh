#!/bin/bash

# Start Celery Worker for ToSpeech
# This script starts the Celery worker for background audio generation tasks

echo "Starting Celery worker for ToSpeech..."
echo "Make sure Valkey is running (docker-compose up -d or valkey-server)"
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected macOS - using --pool=solo flag"
    celery -A celery_app worker --loglevel=info --pool=solo --include=tasks
else
    echo "Starting Celery worker with default settings"
    celery -A celery_app worker --loglevel=info --include=tasks
fi
