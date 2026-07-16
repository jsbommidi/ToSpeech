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
- judge-notes: First pass falsely claimed terminate=False was applied — code still had terminate=True,SIGTERM. Fixed now. Also fixed syntax error (orphaned `)`) and duplicate imports in tasks.py from first pass.

## sec-9-rate-limiter-proxy
- done: Custom key_func checks `X-Forwarded-For` header before falling back to `request.client.host`.
- files: `Backend/main.py`
- snippet: `_proxy_aware_key_func` uses first entry in forwarded chain
- commit: pending
- notes: Rate limiting now works behind nginx/reverse-proxy.

## sec-13-valkey-auth
- done: Valkey broker/backend URLs now include password from `VALKEY_PASSWORD` env var. `start_valkey.sh` passes `--requirepass` when set.
- files: `Backend/celery_app.py`, `Backend/start_valkey.sh`
- snippet: `f"redis://:{password}@localhost:1312/0"`; `valkey-server --requirepass "$VALKEY_PASSWORD"`
- commit: pending
- notes: Warns if VALKEY_PASSWORD unset. CELERY_BROKER_URL / CELERY_RESULT_BACKEND env vars still override.

## sec-14-vite-localhost
- done: Vite dev server binds to `localhost` only (not `0.0.0.0`).
- files: `Frontend/vite.config.ts`
- snippet: `host: 'localhost'`
- commit: pending
- notes: LAN exposure eliminated. No more network access to the app + proxy.

## sec-15-rate-limit-more
- done: Added rate limits to remaining mutating endpoints: settings 20/min, convert 10/min, delete model 10/min, cancel 20/min, history 30/min. Fixed duplicate `@app.get` decorator on convert endpoint.
- files: `Backend/main.py`
- snippet: `@limiter.limit("10/minute")` on convert, `20/minute` on settings/cancel, `30/minute` on history
- commit: pending
- notes: All state-changing endpoints now have rate limits.

## sec-16-thread-safe-download
- done: Added `threading.Lock` around all `download_progress` reads and writes.
- files: `Backend/main.py`
- snippet: `with _download_lock:` wraps every dict access
- commit: pending
- notes: Eliminates TOCTOU race on duplicate-download check and status reads.

## sec-17-fernet-failfast
- done: FERNET_KEY missing at startup now raises RuntimeError immediately (matching JWT_SECRET_KEY pattern). No late crash.
- files: `Backend/main.py`
- snippet: `raise RuntimeError("FERNET_KEY environment variable is required")`
- commit: pending
- notes: `_fernet` is now always a valid Fernet instance. Dead `if not _fernet:` guards in encrypt/decrypt are harmless.

## sec-18-dead-code
- done: Removed unused imports (`wave`, `random`, `StaticFiles`), dead `_FFMPEG_PATH` variable, duplicate `@app.get` decorator, commented mount line. Kept `AutoConfig`, `AutoModelForCausalLM` (used for VibeVoice).
- files: `Backend/main.py`
- snippet: Cleaned imports, no dead code
- commit: pending
- notes: `pipeline` import not removed (still used in load_model_pipeline fallback path).

## sec-19-utcnow
- done: Replaced all `datetime.utcnow()` with `datetime.now(UTC)` across main.py, models.py, tasks.py.
- files: `Backend/main.py`, `Backend/models.py`, `Backend/tasks.py`
- snippet: `from datetime import datetime, UTC`; `datetime.now(UTC)`
- commit: pending
- notes: Zero utcnow() calls remaining. models.py uses lambda for SQLAlchemy default.

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
- judge-notes: Root .gitignore was missing .env entries — false-positive from first pass. Fixed now. Frontend .gitignore was correct. `Backend/VibeVoice1.5/.gitignore` missing .env.local (vendored dir, low risk).

## sec-10-csrf-protection
- done: Double-submit cookie CSRF pattern. Login sets `csrf_token` cookie (HttpOnly=False). Middleware verifies `X-CSRF-Token` header matches cookie on all state-changing requests. Auth cookie `SameSite=Lax`.
- files: `Backend/main.py`, `Frontend/src/lib/api.ts`, `Frontend/src/contexts/SettingsContext.tsx`
- snippet: `@app.middleware("http")` checks `hmac.compare_digest(cookie, header)`; frontend reads `Cookies.get('csrf_token')`
- commit: pending
- notes: Auth endpoints (`/auth/login`, `/register`, `/auth/logout`) excluded from CSRF check. Token uses `secrets.token_hex(32)`.
- judge-notes: First pass had cookie name mismatch (`auth_token` vs `access_token`) — SettingsContext and 401 interceptor never worked. Also progress falsely claimed SameSite=Strict; code is SameSite=Lax per user review. Both fixed.
