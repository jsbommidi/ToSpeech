from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class GenerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=100000, description="The input text to synthesize")
    model_name: str = Field(..., pattern=r"^[a-zA-Z0-9/\-_.]+$", description="Name of the model to use")
    speaker: str | None = Field(None, pattern=r"^[a-zA-Z0-9_\-.]+$", description="Optional speaker/voice ID")
    cfg_scale: float = Field(1.5, ge=0.1, le=20.0, description="Guidance scale for generation")
    inference_steps: int = Field(5, ge=1, le=50, description="Number of inference steps")

class DownloadModelRequest(BaseModel):
    url: str
    hf_token: str | None = None

class AudioHistoryBase(BaseModel):
    text_input: str
    file_path: str
    model_name: str
    speaker: str | None = None
    cfg_scale: float
    inference_steps: int
    duration: float | None = 0.0
    timestamp: datetime

    class Config:
        from_attributes = True

class AudioHistoryResponse(AudioHistoryBase):
    id: int

class UserCreate(BaseModel):
    email: EmailStr

class LoginRequest(BaseModel):
    email: EmailStr

class UserSettingsBase(BaseModel):
    sample_rate: int = 48000
    quality: str = "high"
    format: str = "uncompressed"
    auto_save: bool = True
    tts_model: str = "default"
    hf_token: str | None = None

class UserSettingsUpdate(UserSettingsBase):
    pass

class UserSettings(UserSettingsBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class User(BaseModel):
    id: int
    email: str
    is_active: bool = True 
    settings: UserSettings | None = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
