from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

class AudioHistory(Base):
    __tablename__ = "audio_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    text_input = Column(String, index=True)
    file_path = Column(String)
    model_name = Column(String)
    speaker = Column(String, nullable=True)
    cfg_scale = Column(Float, default=1.5)
    inference_steps = Column(Integer, default=20)
    duration = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="history")

class UserSetting(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Audio Settings
    sample_rate = Column(Integer, default=48000)
    quality = Column(String, default="high")
    format = Column(String, default="uncompressed")
    
    # App Settings
    auto_save = Column(Boolean, default=True)
    
    # TTS Settings
    tts_model = Column(String, default="default")
    hf_token = Column(String, nullable=True)

    owner = relationship("User", back_populates="settings")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    
    history = relationship("AudioHistory", back_populates="owner")
    settings = relationship("UserSetting", back_populates="owner", uselist=False)
