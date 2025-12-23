from celery import Celery
import os

# Configure Celery with Valkey (Redis-compatible)
# Valkey uses the same protocol as Redis, so we use redis:// URL scheme
celery_app = Celery(
    "tospeech",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:1312/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:1312/0")
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Don't import tasks here - let Celery discover them
# Tasks will be imported when the worker starts
