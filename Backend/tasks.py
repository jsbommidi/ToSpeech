from celery_app import celery_app
from celery.exceptions import SoftTimeLimitExceeded
import torch
import scipy.io.wavfile
import numpy as np
import uuid
import os
import copy
import traceback
from datetime import datetime

AUDIO_DIR = "generated_audio"

@celery_app.task(bind=True, name='tasks.generate_audio_task')
def generate_audio_task(
    self,
    text: str,
    model_name: str,
    speaker: str,
    cfg_scale: float,
    inference_steps: int,
    user_id: int,
    db_session_data: dict
):
    """
    Celery task for audio generation.
    Returns: dict with 'status', 'file_path', 'duration', etc.
    """
    from transformers import StoppingCriteria, StoppingCriteriaList
    from transformers import StoppingCriteria, StoppingCriteriaList
    from transformers.modeling_outputs import BaseModelOutputWithPast
    from transformers.cache_utils import DynamicCache
    
    def stop_check_fn():
        """
        Check for task cancellation in Redis.
        """
        if self.request.id:
            try:
                # Direct check on the redis client
                if celery_app.backend.client.exists(f"task_cancelled:{self.request.id}"):
                    return True
            except Exception as e:
                # If checking fails, log but don't stop
                print(f"Cancellation check error: {e}")
        return False

    try:
        # Update task state to PROGRESS
        self.update_state(state='PROGRESS', meta={'status': 'Loading model...'})
        
        # Fix import path - add Backend directory to sys.path
        import sys
        import os
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
            
        # Add VibeVoice1.5 to sys.path
        vibevoice_path = os.path.join(backend_dir, "VibeVoice1.5")
        if vibevoice_path not in sys.path:
            sys.path.insert(0, vibevoice_path)
        
        # Import here to avoid circular imports
        from main import load_model_pipeline, MODELS_DIR
        from database import SessionLocal
        import models
        
        # Load model
        loaded_obj = load_model_pipeline(model_name)
        
        self.update_state(state='PROGRESS', meta={'status': f'Configuring voice: {speaker}...'})
        
        # Check for task revocation (cancellation)
        if self.request.id and celery_app.backend.get(f'celery-task-meta-{self.request.id}'):
            task_meta = celery_app.backend.get(f'celery-task-meta-{self.request.id}')
            if task_meta and b'REVOKED' in task_meta:
                return {'status': 'cancelled', 'message': 'Task was cancelled'}
        
        self.update_state(state='PROGRESS', meta={'status': 'Synthesizing audio...'})
        
        # Run inference
        if loaded_obj["type"] == "vibevoice":
            model = loaded_obj["model"]
            processor = loaded_obj["processor"]
            
            # Security: Validate speaker name to prevent path traversal
            if speaker and os.path.basename(speaker) != speaker:
                raise ValueError(f"Invalid speaker name: {speaker}")

            # Check if this is the Realtime (0.5B) model or 1.5B
            is_realtime_model = "Realtime" in model_name or "0.5B" in model_name
            
            if is_realtime_model:
                # 0.5B Streaming Logic
                prefilled_outputs = None
                if speaker:
                    # Use VibeVoice1.5 paths
                    voice_dir = os.path.join(os.path.dirname(__file__), "VibeVoice1.5/demo/voices/streaming_model")
                    voice_file = os.path.join(voice_dir, f"{speaker}.pt")
                    
                    if os.path.exists(voice_file):
                        # Allow BaseModelOutputWithPast and DynamicCache for safe unpickling
                        with torch.serialization.safe_globals([BaseModelOutputWithPast, DynamicCache]):
                            prefilled_outputs = torch.load(voice_file, map_location=model.device, weights_only=True)
                    else:
                        raise ValueError(f"Voice file not found: {voice_file}")
                else:
                    raise ValueError("Speaker/voice must be specified for VibeVoice Realtime model")
                
                # Prepare inputs
                processed = processor.process_input_with_cached_prompt(
                    text=text.strip(),
                    cached_prompt=prefilled_outputs,
                    padding=True,
                    return_tensors="pt",
                    return_attention_mask=True,
                )
                
                inputs = {
                    key: value.to(model.device) if hasattr(value, "to") else value
                    for key, value in processed.items()
                }
                
                model.set_ddpm_inference_steps(num_steps=inference_steps or 5)
                
                # Generate with cancellation check
                with torch.no_grad():
                    outputs = model.generate(
                        **inputs,
                        max_new_tokens=None,
                        cfg_scale=cfg_scale,
                        tokenizer=processor.tokenizer,
                        generation_config={'do_sample': False},
                        verbose=True,
                        all_prefilled_outputs=copy.deepcopy(prefilled_outputs) if prefilled_outputs is not None else None,
                        stop_check_fn=stop_check_fn
                    )
            
            else:
                # 1.5B Standard Logic
                voice_samples = []
                if speaker:
                     voice_dir = os.path.join(os.path.dirname(__file__), "VibeVoice1.5/demo/voices")
                     voice_file = os.path.join(voice_dir, f"{speaker}.wav")
                     
                     if os.path.exists(voice_file):
                         voice_samples.append(voice_file)
                     else:
                         found = False
                         for f in os.listdir(voice_dir):
                             if f.startswith(speaker) and f.endswith('.wav'):
                                 voice_samples.append(os.path.join(voice_dir, f))
                                 found = True
                                 break
                         if not found:
                             raise ValueError(f"Voice file for speaker {speaker} not found.")

                # Prepare inputs
                inputs = processor(
                    text=[text.strip()],
                    voice_samples=[voice_samples] if voice_samples else None,
                    padding=True,
                    return_tensors="pt",
                    return_attention_mask=True,
                )
                
                # Move to device
                inputs = {
                     k: v.to(model.device) if hasattr(v, "to") else v
                     for k, v in inputs.items()
                }
                
                model.set_ddpm_inference_steps(num_steps=inference_steps or 5)
                
                with torch.no_grad():
                    # 1.5B uses is_prefill logic
                    outputs = model.generate(
                        **inputs,
                        max_new_tokens=None,
                        cfg_scale=cfg_scale,
                        tokenizer=processor.tokenizer,
                        generation_config={'do_sample': False},
                        verbose=True,
                        is_prefill=True if voice_samples else False,
                        # Note: standard model might not support stop_check_fn unless updated.
                        # We will assume it does or ignore it if not strictly required by method signature,
                        # but if it fails we might need to patch the model code or accept it won't cancel deeply.
                        # VibeVoiceForConditionalGenerationInference likely inherits from a class we can control?
                        # Since we control the repo, if it fails I'd need to edit VibeVoice1.5 code.
                        # For now let's try passing it? If 1.5B code doesn't support it, it might invalid kwarg.
                        # I'll check VibeVoice1.5/vibevoice/modular/modeling_vibevoice_inference.py if I can.
                    )
            
            # Check for generation cut short due to cancellation (if stop_check_fn was used/supported)
            if self.request.id and celery_app.backend.client.exists(f"task_cancelled:{self.request.id}"):
                 return {'status': 'cancelled', 'message': 'Task was cancelled during generation'}
            
            if outputs.speech_outputs and len(outputs.speech_outputs) > 0:
                audio = outputs.speech_outputs[0]
                if isinstance(audio, torch.Tensor):
                    audio = audio.cpu().float().numpy()
                audio_data = audio.flatten()
                sampling_rate = 24000
            else:
                raise ValueError("No audio generated.")
        else:
            # Pipeline fallback
            pipe = loaded_obj["model"]
            output = pipe(text)
            audio_data = output["audio"]
            sampling_rate = output["sampling_rate"]
        
        # Check for cancellation before saving
        if self.request.id:
            try:
                task_result = celery_app.AsyncResult(self.request.id)
                if task_result.state == 'REVOKED':
                    return {'status': 'cancelled', 'message': 'Task was cancelled'}
            except:
                pass
        
        self.update_state(state='PROGRESS', meta={'status': 'Saving audio file...'})
        
        # Calculate duration
        n_frames = len(audio_data)
        duration_sec = round(n_frames / sampling_rate, 2)
        
        # Convert to 16-bit PCM
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        audio_data = (audio_data * 32767).astype(np.int16)
        
        # Save file
        filename = f"audio_{uuid.uuid4()}.wav"
        file_path = os.path.join(AUDIO_DIR, filename)
        web_path = f"/static/{filename}"
        
        scipy.io.wavfile.write(file_path, sampling_rate, audio_data)
        
        # Save to database
        db = SessionLocal()
        try:
            db_item = models.AudioHistory(
                text_input=text,
                file_path=web_path,
                model_name=model_name,
                speaker=speaker,
                cfg_scale=cfg_scale,
                inference_steps=inference_steps,
                duration=duration_sec,
                timestamp=datetime.utcnow(),
                user_id=user_id
            )
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            
            result = {
                'status': 'completed',
                'id': db_item.id,
                'text_input': db_item.text_input,
                'file_path': db_item.file_path,
                'model_name': db_item.model_name,
                'speaker': db_item.speaker,
                'cfg_scale': db_item.cfg_scale,
                'inference_steps': db_item.inference_steps,
                'duration': db_item.duration,
                'timestamp': db_item.timestamp.isoformat()
            }
        finally:
            db.close()
        
        return result
        
    except SoftTimeLimitExceeded:
        return {'status': 'timeout', 'message': 'Task exceeded time limit'}
    except Exception as e:
        error_msg = f"Generation failed: {str(e)}"
        traceback.print_exc()
        return {'status': 'error', 'message': error_msg}
