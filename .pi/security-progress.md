# Security Fix Progress — ToSpeech

Build ledger. Append-only. One entry per completed item.

---

*No items built yet.*

## sec-1-jwt-secret-env
- done: Moved JWT signing key from hardcoded string to `JWT_SECRET_KEY` env var with loud dev fallback
- files: `Backend/main.py` (line 67-70)
- snippet: `SECRET_KEY = os.environ.get("JWT_SECRET_KEY")` with fallback + warning print
- commit: pending
- notes: dev fallback prints warning on startup. No other files referenced the key.

## sec-2-password-hashing
- done: Added bcrypt password hashing. Register requires password (min 8 chars). Login verifies against hash. Consistent 401 error prevents user enumeration.
- files: `Backend/models.py`, `Backend/schemas.py`, `Backend/main.py`, `Frontend/src/lib/api.ts`, `Frontend/src/contexts/AuthContext.tsx`, `Frontend/src/pages/Login.tsx`
- snippet: `pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")` + `not user or not pwd_context.verify(password, user.password_hash)` → 401
- commit: pending
- notes: Existing 6 dev users have null password_hash and must re-register. passlib[bcrypt] already in requirements.txt.

## sec-3-hf-token-encrypt
- done: HF token encrypted at rest with Fernet (AES-128-CBC). Decrypted server-side for model downloads. Masked in API responses.
- files: `Backend/main.py`, `Frontend/src/lib/api.ts`, `Frontend/src/pages/Settings.tsx`
- snippet: `_fernet.encrypt(plain.encode()).decode()` on PATCH, `_fernet.decrypt()` + `mask_hf_token()` on GET, download reads from DB
- commit: pending
- notes: Requires `FERNET_KEY` env var. Generate with `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Download endpoint now reads token from DB instead of request body.

## sec-4-input-sanitization
- done: Added Pydantic field_validator to strip null bytes and control chars from text input. Added 50K char cap in Celery task.
- files: `Backend/schemas.py`, `Backend/tasks.py`
- snippet: `field_validator('text')` strips `\x00` and control chars except `\n`, `\t`; task truncates at 50K
- commit: pending
- notes: Non-behavioral. Control chars silently stripped, truncation logged server-side.

## sec-5-cors-restrict
- done: Removed hardcoded LAN IP from CORS origins. Added `ALLOWED_ORIGINS` env var for production override. Defaults to localhost only.
- files: `Backend/main.py`
- snippet: `origins = [o.strip() for o in _allowed_origins_env.split(",")]` with localhost fallback
- commit: pending
- notes: No hardcoded IPs. Set `ALLOWED_ORIGINS` for production deploy.

## sec-6-delete-regex
- done: Removed `/` from model_name path pattern. Only `[a-zA-Z0-9\-_.]` allowed.
- files: `Backend/main.py`
- snippet: `pattern=r"^[a-zA-Z0-9\-_.]+$"`
- commit: pending
- notes: commonpath check retained as defense-in-depth.

## sec-7-ffmpeg-path
- done: Removed `FFMPEG_PATH` env var. Uses `"ffmpeg"` from system PATH. Validates ffmpeg availability at startup.
- files: `Backend/main.py`
- snippet: `subprocess.run(["ffmpeg", "-version"], ...) at startup for validation
- commit: pending
- notes: Conversion endpoint returns 500 if ffmpeg not installed (validated early).

## sec-8-celery-cooperative
- done: Removed `terminate=True, signal='SIGTERM'` from task revocation. Cooperative cancellation only via Redis flag.
- files: `Backend/main.py`
- snippet: `celery_app.control.revoke(task_id, terminate=False)`
- commit: pending
- notes: `stop_check_fn` in tasks.py handles cooperative cancellation mid-generation. 10-min timeout recommended server-side.

## sec-9-rate-limiter-proxy
- done: Custom key_func checks `X-Forwarded-For` header before falling back to `request.client.host`.
- files: `Backend/main.py`
- snippet: `_proxy_aware_key_func` uses first entry in forwarded chain
- commit: pending
- notes: Rate limiting now works behind nginx/reverse-proxy.

## sec-11-error-sanitization
- done: Added global exception handler. Logs full traceback server-side, returns generic `{"detail": "Internal server error"}` to client.
- files: `Backend/main.py`
- snippet: `@app.exception_handler(Exception)` → JSONResponse(500, {"detail": "Internal server error"})
- commit: pending
- notes: Specific HTTPException responses (401, 403, 404, 422) pass through unchanged.

## sec-12-env-gitignore
- done: Added `.env` and `.env.local` to both `.gitignore` files. Renamed `.env.example` → `.env.example.template` with placeholder values only.
- files: `.gitignore`, `Frontend/.gitignore`, `Frontend/.env.example.template` (renamed from `.env.example`)
- snippet: `VITE_API_URL=` (blank placeholder)
- commit: pending
- notes: Old `.env.example` removed from repo. Template has no real port/url.

## sec-10-csrf-protection
- done: Double-submit cookie CSRF pattern. Login sets `csrf_token` cookie (HttpOnly=False). Middleware verifies `X-CSRF-Token` header matches cookie on all state-changing requests. Auth cookie changed to `SameSite=Strict`.
- files: `Backend/main.py`, `Frontend/src/lib/api.ts`
- snippet: `@app.middleware("http")` checks `hmac.compare_digest(cookie, header)`; frontend reads `Cookies.get('csrf_token')`
- commit: pending
- notes: Auth endpoints (`/auth/login`, `/register`, `/auth/logout`) excluded from CSRF check. Token uses `secrets.token_hex(32)`.
