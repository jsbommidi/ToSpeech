from celery import Celery
import os

# Configure Celery with Valkey (Redis-compatible)
# Valkey uses the same protocol as Redis, so we use redis:// URL scheme
_valkey_password = os.getenv("VALKEY_PASSWORD", "")
_auth = f":{_valkey_password}@" if _valkey_password else ""
_broker_url = os.getenv("CELERY_BROKER_URL", f"redis://{_auth}localhost:1312/0")
_backend_url = os.getenv("CELERY_RESULT_BACKEND", f"redis://{_auth}localhost:1312/0")

celery_app = Celery(
    "tospeech",
    broker=_broker_url,
    backend=_backend_url
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
