from fastapi import FastAPI, Depends, HTTPException, status, Header, BackgroundTasks, Request, Path
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import datetime, timedelta
import models
import schemas
import database
import os
import uuid
import hmac
import hashlib
import wave
import random
import torch
import scipy.io.wavfile
import numpy as np
import sys
import copy
import traceback
from transformers import pipeline, AutoConfig, AutoModelForCausalLM

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
# Import and register VibeVoice models
current_dir = os.path.dirname(os.path.abspath(__file__))

# Add VibeVoice1.5 to sys.path
# We prioritize VibeVoice1.5 over the older VibeVoice folder
vibevoice_path = os.path.join(current_dir, "VibeVoice1.5")
if vibevoice_path not in sys.path:
    sys.path.insert(0, vibevoice_path)

try:
    # Import VibeVoice components
    from vibevoice.modular import (
        VibeVoiceStreamingForConditionalGenerationInference, 
        VibeVoiceStreamingConfig,
        VibeVoiceForConditionalGenerationInference,
        VibeVoiceConfig,
    )
    from vibevoice.processor import (
        VibeVoiceStreamingProcessor,
        VibeVoiceProcessor,
    )
    
    # Register architectures with transformers
    print("Registering VibeVoice architectures with transformers...")
    AutoConfig.register("vibevoice_streaming", VibeVoiceStreamingConfig)
    AutoModelForCausalLM.register(VibeVoiceStreamingConfig, VibeVoiceStreamingForConditionalGenerationInference)
    
    AutoConfig.register("vibevoice", VibeVoiceConfig)
    AutoModelForCausalLM.register(VibeVoiceConfig, VibeVoiceForConditionalGenerationInference)
    
    print("VibeVoice registration successful!")
    VIBEVOICE_AVAILABLE = True
except ImportError as e:
    print(f"VibeVoice import failed: {e}")
    traceback.print_exc()
    VIBEVOICE_AVAILABLE = False

# Secret key for JWT
SECRET_KEY = "SECRET_KEY_GOES_HERE_CHANGE_IN_PROD"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Create database tables
# In production, use Alembic for migrations. For dev, we might need to drop tables if models change drastically, 
# or just delete the sqlite file.
models.Base.metadata.create_all(bind=database.engine)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="ToSpeech API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
origins = [
    "http://localhost:1310",
    "http://127.0.0.1:1310",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allow_headers=["Content-Type", "Authorization"],
)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try cookie
    token = request.cookies.get("access_token")

    # 2. Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Directory for audio
AUDIO_DIR = "generated_audio"
os.makedirs(AUDIO_DIR, exist_ok=True)

# Mount static files to serve audio
# app.mount("/static", StaticFiles(directory=AUDIO_DIR), name="static")

def create_access_signature(filename: str, expires_timestamp: int) -> str:
    """Create a localized signature for a file access"""
    data = f"{filename}:{expires_timestamp}"
    return hmac.new(SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()

def sign_path(path: str) -> str:
    """Add signature to a static path"""
    # Assumes path is "/static/filename"
    if not path or not path.startswith("/static/"):
        return path
        
    filename = path.split("/")[-1]
    # URL valid for 60 minutes
    expires = int((datetime.utcnow() + timedelta(minutes=60)).timestamp())
    signature = create_access_signature(filename, expires)
    
    return f"{path}?expires={expires}&signature={signature}"

@app.get("/static/{filename}")
def get_audio_file(filename: str, expires: int = 0, signature: str = ""):
    """Securely serve audio files with a signed link"""
    # Basic validation
    if not expires or not signature:
         raise HTTPException(status_code=403, detail="Missing signature or expiry")

    # Verify expiry
    if datetime.utcnow().timestamp() > expires:
        raise HTTPException(status_code=403, detail="Link expired")
    
    # Verify signature
    expected_signature = create_access_signature(filename, expires)
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    file_path = os.path.join(AUDIO_DIR, filename)
    # Prevent path traversal (redundant with os.path.join but good practice)
    if os.path.commonpath([os.path.abspath(file_path), os.path.abspath(AUDIO_DIR)]) != os.path.abspath(AUDIO_DIR):
         raise HTTPException(status_code=403, detail="Invalid path")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(file_path)

@app.post("/register", response_model=schemas.User)
@limiter.limit("5/minute")
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Email-only auth: No password hashing
    db_user = models.User(email=user.email)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create default settings
    default_settings = models.UserSetting(user_id=db_user.id)
    db.add(default_settings)
    db.commit()
    
    return db_user



@app.post("/auth/login")
@limiter.limit("10/minute")
def login(request: Request, login_req: schemas.LoginRequest, db: Session = Depends(get_db)):
    # Passwordless login: Trust the email exists
    user = db.query(models.User).filter(models.User.email == login_req.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id}, expires_delta=access_token_expires
    )
    
    response = JSONResponse(content={"message": "Login successful", "email": user.email})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        # Secure must be False for local HTTP (unless strictly localhost)
        # We'll default to False for this dev environment fix
        secure=False, 
        samesite="lax",
        max_age=int(access_token_expires.total_seconds())
    )
    return response

@app.post("/auth/logout")
def logout():
    response = JSONResponse(content={"message": "Logout successful"})
    response.delete_cookie(key="access_token")
    return response

@app.get("/api/v1/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/api/v1/settings", response_model=schemas.UserSettings)
def get_settings(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(models.UserSetting).filter(models.UserSetting.user_id == current_user.id).first()
    if not settings:
        # Create if missing (migration/backward compat)
        settings = models.UserSetting(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

# Directory for local models
MODELS_DIR = "local_models"
os.makedirs(MODELS_DIR, exist_ok=True)

from huggingface_hub import snapshot_download
from tqdm.auto import tqdm

# Global progress tracker
# { "repo_id": { "status": "pending"|"downloading"|"completed"|"error", "progress": 0, "filename": "...", "detail": "..." } }
download_progress = {}

def get_tqdm_class(repo_id: str):
    class CustomTqdm(tqdm):
        def update(self, n=1):
            super().update(n)
            if self.total and self.total > 0:
                progress = (self.n / self.total) * 100
                download_progress[repo_id] = {
                    "status": "downloading",
                    "progress": progress,
                    "filename": self.desc or "Downloading...",
                    "downloaded": self.n,
                    "total": self.total
                }
    return CustomTqdm

def download_model_task(repo_id: str, token: str | None):
    try:
        print(f"Starting download for {repo_id}...")
        download_progress[repo_id] = {"status": "starting", "progress": 0, "filename": "Initializing..."}
        
        # Download to a specific folder in MODELS_DIR
        local_dir = os.path.join(MODELS_DIR, repo_id.replace("/", "_"))
        
        snapshot_download(
            repo_id=repo_id, 
            local_dir=local_dir, 
            token=token,
            tqdm_class=get_tqdm_class(repo_id)
        )
        print(f"Successfully downloaded {repo_id} to {local_dir}")
        download_progress[repo_id] = {"status": "completed", "progress": 100, "filename": "Done"}
    except Exception as e:
        print(f"Failed to download {repo_id}: {e}")
        download_progress[repo_id] = {"status": "error", "progress": 0, "filename": "Error", "detail": str(e)}

ALLOWED_MODELS = {
    "microsoft/VibeVoice-1.5B",
    "microsoft/VibeVoice-Realtime-0.5B",
    #"vibevoice-community/VibeVoice", # Including the community one mentioned in history
}

@app.post("/api/v1/models/download")
@limiter.limit("5/minute")
def download_model(request: Request, download_req: schemas.DownloadModelRequest, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user)):
    # extract repo_id from URL if needed
    repo_id = download_req.url.strip()
    if "huggingface.co/" in repo_id:
        repo_id = repo_id.split("huggingface.co/")[-1].strip("/")
    
    # Validate format: org/repo
    if not repo_id or repo_id.count("/") != 1:
         raise HTTPException(status_code=400, detail="Invalid model identifier. Must be in 'owner/repo' format.")
    
    # Enforce Whitelist
    if repo_id not in ALLOWED_MODELS:
        raise HTTPException(
            status_code=400, 
            detail=f"Model '{repo_id}' is not allowed. Only official VibeVoice models are currently supported."
        )

    # Check for duplicate active downloads
    if repo_id in download_progress and download_progress[repo_id]["status"] in ["pending", "downloading", "starting"]:
         raise HTTPException(status_code=400, detail=f"Download for {repo_id} is already in progress.")

    background_tasks.add_task(download_model_task, repo_id, download_req.hf_token)
    return {"message": f"Download started for {repo_id}. Check logs or refresh models list later."}

@app.get("/api/v1/models/status")
def get_model_download_status(repo_id: str, current_user: models.User = Depends(get_current_user)):
    # repo_id might come in as "user/repo"
    status = download_progress.get(repo_id)
    if not status:
        return {"status": "not_found", "progress": 0}
    return status

@app.get("/api/v1/models/available")
def get_available_models(current_user: models.User = Depends(get_current_user)):
    """
    Scans the local_models directory and returns a list of available model names.
    It checks for subdirectories (assuming each model is in its own folder) 
    or standalone model files (like .pth, .bin, .pt, .safetensors).
    """
    models_list = []
    if os.path.exists(MODELS_DIR):
        for entry in os.listdir(MODELS_DIR):
            full_path = os.path.join(MODELS_DIR, entry)
            # If it's a directory, assume it's a model repo
            if os.path.isdir(full_path):
                models_list.append(entry)
            # If it's a model file
            elif os.path.isfile(full_path) and entry.lower().endswith(('.pth', '.bin', '.pt', '.safetensors', '.ckpt')):
                models_list.append(entry)
    
    # Sort alphabetically
    models_list.sort()
    return {"models": models_list}

@app.delete("/api/v1/models/{model_name}")
def delete_model(model_name: str = Path(..., pattern=r"^[a-zA-Z0-9/\-_.]+$"), current_user: models.User = Depends(get_current_user)):
    """
    Delete a model from the local_models directory.
    """
    import shutil
    
    # Prevent deletion of currently loaded models
    if model_name in LOADED_MODELS:
        raise HTTPException(status_code=400, detail="Cannot delete a currently loaded model. Please restart the server first.")
    
    # Security check: Prevent path traversal
    model_path = os.path.abspath(os.path.join(MODELS_DIR, model_name))
    models_dir_abs = os.path.abspath(MODELS_DIR)
    
    # Use commonpath to properly handle path boundaries
    if os.path.commonpath([model_path, models_dir_abs]) != models_dir_abs:
        raise HTTPException(status_code=400, detail="Invalid model path")
    
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model not found")
    
    try:
        if os.path.isdir(model_path):
            shutil.rmtree(model_path)
        else:
            os.remove(model_path)
        return {"message": f"Model {model_name} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")

# Voice mapping - dynamically scanned from available voice files
# Voice mapping - dynamically scanned from available voice files
def get_available_voices(model_type="streaming"):
    """
    Scan the voice directory and return available voice files.
    model_type: "streaming" (0.5B) or "standard" (1.5B/7B)
    """
    voices = []
    
    if model_type == "streaming":
        # For VibeVoice 0.5B (Realtime), we use .pt files in VibeVoice1.5/demo/voices/streaming_model/
        voice_dir = os.path.join(os.path.dirname(__file__), "VibeVoice1.5/demo/voices/streaming_model")
        if os.path.exists(voice_dir):
            for file in os.listdir(voice_dir):
                if file.endswith('.pt'):
                    # Remove .pt extension
                    voices.append(file[:-3])
    else:
        # For VibeVoice 1.5B, we use .wav files in VibeVoice1.5/demo/voices/
        voice_dir = os.path.join(os.path.dirname(__file__), "VibeVoice1.5/demo/voices")
        if os.path.exists(voice_dir):
            for file in os.listdir(voice_dir):
                if file.endswith('.wav') and os.path.isfile(os.path.join(voice_dir, file)):
                    # Remove .wav extension
                    voices.append(file[:-4])
    
    # Sort voices: English first, then alphabetically
    voices.sort(key=lambda x: (not x.startswith('en-'), x))
    return voices

# Cache available voices
AVAILABLE_VOICES_STREAMING = get_available_voices("streaming")
AVAILABLE_VOICES_STANDARD = get_available_voices("standard")

MODEL_VOICES = {
    "default": []
}

@app.get("/api/v1/models/{model_name}/speakers")
def get_model_speakers(model_name: str = Path(..., pattern=r"^[a-zA-Z0-9/\-_.]+$"), current_user: models.User = Depends(get_current_user)):
    """Get available speakers/voices for a specific model"""
    # Refresh available voices in case new ones were added
    # Refresh available voices in case new ones were added
    global AVAILABLE_VOICES_STREAMING, AVAILABLE_VOICES_STANDARD
    AVAILABLE_VOICES_STREAMING = get_available_voices("streaming")
    AVAILABLE_VOICES_STANDARD = get_available_voices("standard")
    
    # Decide which pool to use based on model
    is_realtime = "Realtime" in model_name or "0.5B" in model_name
    available_pool = AVAILABLE_VOICES_STREAMING if is_realtime else AVAILABLE_VOICES_STANDARD
    speakers = MODEL_VOICES.get(model_name)

    # If keys don't exist, default to empty list effectively
    if speakers is None:
        speakers = MODEL_VOICES["default"]
    
    # Filter out any speakers that don't have corresponding voice files
    # Only do this if we actually have a specific list to filter
    # Filter out any speakers that don't have corresponding voice files
    # Only do this if we actually have a specific list to filter
    if speakers:
        if is_realtime:
            voice_dir = os.path.join(os.path.dirname(__file__), "VibeVoice1.5/demo/voices/streaming_model")
            ext = '.pt'
        else:
            voice_dir = os.path.join(os.path.dirname(__file__), "VibeVoice1.5/demo/voices")
            ext = '.wav'
            
        if os.path.exists(voice_dir):
            available_files = {f[: -len(ext)] for f in os.listdir(voice_dir) if f.endswith(ext)}
            speakers = [s for s in speakers if s in available_files]
    
    # If the list is empty (either was empty to start, or filtered to nothing), use fallback
    if not speakers:
        speakers = available_pool
    
    return {"speakers": speakers}

# --- ML Model Management ---
LOADED_MODELS = {}

def get_compute_device():
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"

def load_model_pipeline(model_name: str):
    if model_name in LOADED_MODELS:
        return LOADED_MODELS[model_name]

    # Clean up other models to save RAM (Simple 1-model cache rule)
    if len(LOADED_MODELS) > 0:
        print("Unloading previous models...")
        LOADED_MODELS.clear()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        elif torch.backends.mps.is_available():
            torch.mps.empty_cache()

    model_path = os.path.join(MODELS_DIR, model_name)
    # Check if directory exists
    if not os.path.exists(model_path):
         # Try absolute path
         model_path = os.path.join(current_dir, MODELS_DIR, model_name)
         if not os.path.exists(model_path):
             print(f"Model path not found: {model_path}")

    device = get_compute_device()
    print(f"Loading model {model_name} on {device}...")
    print(f"VIBEVOICE_AVAILABLE: {VIBEVOICE_AVAILABLE}")
    
    # Custom load for VibeVoice
    if "VibeVoice" in model_name and VIBEVOICE_AVAILABLE:
        print("Using custom VibeVoice loader...")
        try:
             # Decide dtype & attention based on device
             if device == "mps":
                 load_dtype = torch.float32
                 device_map = None
                 attn_impl = "sdpa"
             elif device == "cuda":
                 load_dtype = torch.bfloat16
                 device_map = 'cuda'
                 attn_impl = "flash_attention_2"
             else:
                 load_dtype = torch.float32
                 device_map = 'cpu'
                 attn_impl = "sdpa"
             
             print(f"Loading VibeVoice with device_map={device_map}, dtype={load_dtype}, attn={attn_impl}")
             
             is_realtime = "Realtime" in model_name or "0.5B" in model_name
             
             if is_realtime:
                 # Load processor (includes tokenizer)
                 processor = VibeVoiceStreamingProcessor.from_pretrained(model_path)
                 
                 # Load model with proper settings
                 try:
                     model = VibeVoiceStreamingForConditionalGenerationInference.from_pretrained(
                         model_path,
                         torch_dtype=load_dtype,
                         device_map=device_map,
                         attn_implementation=attn_impl,
                     )
                     if device == "mps":
                         model.to("mps")
                 except Exception as e:
                     if attn_impl == 'flash_attention_2':
                         print("Flash attention failed, falling back to SDPA")
                         model = VibeVoiceStreamingForConditionalGenerationInference.from_pretrained(
                             model_path,
                             torch_dtype=load_dtype,
                             device_map=device if device != "mps" else None,
                             attn_implementation='sdpa',
                         )
                         if device == "mps":
                             model.to("mps")
                     else:
                         raise e
                 
                 model_type_tag = "vibevoice_streaming"
                 
             else:
                 # 1.5B / Standard model
                 processor = VibeVoiceProcessor.from_pretrained(model_path)
                 
                 try:
                     model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                         model_path,
                         torch_dtype=load_dtype,
                         device_map=device_map,
                         attn_implementation=attn_impl,
                     )
                     if device == "mps":
                         model.to("mps")
                 except Exception as e:
                     if attn_impl == 'flash_attention_2':
                         print("Flash attention failed, falling back to SDPA")
                         model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                             model_path,
                             torch_dtype=load_dtype,
                             device_map=device if device != "mps" else None,
                             attn_implementation='sdpa',
                         )
                         if device == "mps":
                             model.to("mps")
                     else:
                         raise e
                 
                 model_type_tag = "vibevoice_standard"

             model.eval()
             
             LOADED_MODELS[model_name] = {
                 "model": model, 
                 "processor": processor, 
                 "type": "vibevoice",
                 "subtype": model_type_tag
             }
             print(f"Successfully loaded {model_name} (Custom VibeVoice - {model_type_tag})")
             return LOADED_MODELS[model_name]
        except Exception as e:
             err_msg = traceback.format_exc()
             print(f"!!! CRITICAL: Custom VibeVoice load failed !!!")
             print(f"Error: {e}")
             print("Full traceback:")
             print(err_msg)
             # Don't fallback to pipeline for VibeVoice models - they won't work
             raise Exception(f"Failed to load VibeVoice model: {e}")

    # Fallback to standard pipeline (only for non-VibeVoice models)
    try:
        pipe = pipeline("text-to-speech", model=model_path, device=device)
        LOADED_MODELS[model_name] = {"model": pipe, "type": "pipeline"}
        print(f"Successfully loaded {model_name} (Pipeline)")
        return LOADED_MODELS[model_name]
    except Exception as e:
        print(f"Failed to load on {device}, falling back to CPU. Error: {e}")
        pipe = pipeline("text-to-speech", model=model_path, device="cpu")
        LOADED_MODELS[model_name] = {"model": pipe, "type": "pipeline"}
        return LOADED_MODELS[model_name]

@app.patch("/api/v1/settings", response_model=schemas.UserSettings)
def update_settings(settings_update: schemas.UserSettingsUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_settings = db.query(models.UserSetting).filter(models.UserSetting.user_id == current_user.id).first()
    if not db_settings:
        db_settings = models.UserSetting(user_id=current_user.id)
        db.add(db_settings)
    
    update_data = settings_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_settings, key, value)
    
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

from celery_app import celery_app
from celery.result import AsyncResult

@app.post("/api/v1/generate/celery")
@limiter.limit("20/minute")
async def generate_audio_celery(request: Request, gen_request: schemas.GenerateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Start audio generation as a Celery background task.
    Returns task_id for tracking and cancellation.
    """
    from tasks import generate_audio_task
    
    # Start the Celery task
    task = generate_audio_task.apply_async(
        args=[
            gen_request.text,
            gen_request.model_name,
            gen_request.speaker,
            gen_request.cfg_scale,
            gen_request.inference_steps,
            current_user.id,
            {}  # db_session_data placeholder
        ]
    )
    
    return {
        "task_id": task.id,
        "status": "started",
        "message": "Audio generation task started"
    }

@app.get("/api/v1/generate/celery/{task_id}")
async def get_task_status(task_id: str, current_user: models.User = Depends(get_current_user)):
    """
    Get the status of a Celery task.
    """
    task_result = AsyncResult(task_id, app=celery_app)
    
    if task_result.state == 'PENDING':
        response = {
            'task_id': task_id,
            'state': task_result.state,
            'status': 'Task is waiting to start...'
        }
    elif task_result.state == 'PROGRESS':
        response = {
            'task_id': task_id,
            'state': task_result.state,
            'status': task_result.info.get('status', ''),
        }
    elif task_result.state == 'SUCCESS':
        result = task_result.result
        # Sign the file path if present
        if isinstance(result, dict) and 'file_path' in result:
             result['file_path'] = sign_path(result['file_path'])
        
        response = {
            'task_id': task_id,
            'state': task_result.state,
            'result': result
        }
    elif task_result.state == 'FAILURE':
        response = {
            'task_id': task_id,
            'state': task_result.state,
            'status': str(task_result.info),
        }
    elif task_result.state == 'REVOKED':
        response = {
            'task_id': task_id,
            'state': task_result.state,
            'status': 'Task was cancelled'
        }
    else:
        response = {
            'task_id': task_id,
            'state': task_result.state,
            'status': str(task_result.info)
        }
    
    return response

@app.post("/api/v1/generate/celery/{task_id}/cancel")
async def cancel_task(task_id: str, current_user: models.User = Depends(get_current_user)):
    """
    Cancel a running Celery task.
    """
    task_result = AsyncResult(task_id, app=celery_app)
    
    # We allow cancellation in any state except final success/failure, 
    # capturing PENDING, STARTED, RETRY etc.
    if task_result.state not in ['SUCCESS', 'FAILURE', 'REVOKED']:
        # Set cancellation flag in Redis for cooperative cancellation
        # This allows the task to stop itself cleanly during generation loop
        try:
             celery_app.backend.client.setex(f"task_cancelled:{task_id}", 3600, "1")
        except Exception as e:
             print(f"Error setting cancellation flag: {e}")

        # Revoke the task (terminate=True will kill the worker process if needed)
        celery_app.control.revoke(task_id, terminate=True, signal='SIGTERM')
        return {
            "task_id": task_id,
            "status": "cancelled",
            "message": "Task cancellation requested"
        }
    else:
        return {
            "task_id": task_id,
            "status": task_result.state,
            "message": f"Task is in {task_result.state} state and cannot be cancelled"
        }

@app.get("/api/v1/history", response_model=list[schemas.AudioHistoryResponse])
def get_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Filter by current user
    history = db.query(models.AudioHistory).filter(models.AudioHistory.user_id == current_user.id).order_by(models.AudioHistory.timestamp.desc()).offset(skip).limit(limit).all()
    
    # Process history to sign URLs
    results = []
    for item in history:
        # Convert to Pydantic model
        item_data = schemas.AudioHistoryResponse.from_orm(item)
        # Sign the path
        item_data.file_path = sign_path(item_data.file_path)
        results.append(item_data)
        
    return results
