# Security Fix Plan — ToSpeech

Based on audit dated 2025-07-16. 17 vulnerabilities identified.
4 critical, 5 high, 6 medium, 2 low.

---

## Item 1: Move JWT secret to environment variable (C-1)
- **id:** `sec-1-jwt-secret-env`
- **intent:** Replace hardcoded `SECRET_KEY` in `main.py` with `os.environ.get("JWT_SECRET_KEY")`. Add fallback for dev only. Update all scripts/docs that reference it.
- **files:** `Backend/main.py`, `Backend/start_celery.sh`, `how-to.md`
- **acceptance:** `SECRET_KEY` string no longer appears in source. `JWT_SECRET_KEY` env var required for startup in non-dev mode. Existing tokens invalidated (acceptable — dev app).
- **type:** non-behavioral

## Item 2: Add bcrypt password hashing to auth (C-2)
- **id:** `sec-2-password-hashing`
- **intent:** Add `password_hash` column to `Users` table. Require password on register/login. Hash with bcrypt via `passlib`. Return consistent error on wrong password (no user enumeration). Migrate existing users (no passwords — force re-register in dev).
- **files:** `Backend/models.py`, `Backend/schemas.py`, `Backend/main.py` (register + login endpoints), `Frontend/src/pages/Login.tsx`, `Frontend/src/lib/api.ts`
- **acceptance:** Login requires email + password. Wrong password returns same error as missing user. Existing tokens from email-only auth no longer work.
- **type:** behavioral

## Item 3: Encrypt HF token at rest (C-3)
- **id:** `sec-3-hf-token-encrypt`
- **intent:** Encrypt `hf_token` before writing to DB using `cryptography.fernet`. Decrypt on read for server-side use only. Return masked token (`hf_********abcd`) in API responses. Fernet key from env var `FERNET_KEY`.
- **files:** `Backend/models.py`, `Backend/main.py` (settings endpoints, download endpoint), `Backend/schemas.py`
- **acceptance:** Token stored as encrypted bytes in DB. API returns masked value. Model download still works. No plaintext token in logs or API responses.
- **type:** behavioral

## Item 4: Add input sanitization for text generation (C-4)
- **id:** `sec-4-input-sanitization`
- **intent:** Validate `text` field in `GenerateRequest` — reject null bytes, control chars (except newlines/tabs), and excessive Unicode homoglyphs. Add max reasonable length guard in the task itself (cap at 50K chars with truncation warning). Add content-type check.
- **files:** `Backend/schemas.py`, `Backend/tasks.py`
- **acceptance:** Null bytes in text input rejected. Control characters (except \n, \t) stripped. Text >50K chars truncated with user notification.
- **type:** non-behavioral

## Item 5: Restrict CORS origins to localhost only (H-1)
- **id:** `sec-5-cors-restrict`
- **intent:** Remove hardcoded LAN IP `192.168.0.175:1310` from CORS origins. Add `ALLOWED_ORIGINS` env var for production override. Default to `localhost:1310, localhost:5173, 127.0.0.1:1310` only.
- **files:** `Backend/main.py`
- **acceptance:** No hardcoded IP in CORS config. LAN access blocked unless explicitly configured.
- **type:** non-behavioral

## Item 6: Tighten model delete path regex (H-2)
- **id:** `sec-6-delete-regex`
- **intent:** Change `model_name` path pattern from `^[a-zA-Z0-9/\-_.]+$` to `^[a-zA-Z0-9\-_.]+$` (remove `/`). `commonpath` check stays as defense-in-depth.
- **files:** `Backend/main.py` (delete_model endpoint)
- **acceptance:** Model names containing `/` rejected at FastAPI path validation layer.
- **type:** non-behavioral

## Item 7: Fix FFmpeg path resolution (H-3)
- **id:** `sec-7-ffmpeg-path`
- **intent:** Remove `FFMPEG_PATH` env var reading. Use absolute path `/usr/bin/env ffmpeg` with subprocess validation — resolve the binary once at startup, cache it, reject if not found or if it's not the expected binary. No arbitrary env var execution.
- **files:** `Backend/main.py` (convert_audio endpoint)
- **acceptance:** `FFMPEG_PATH` env var ignored. Known-good ffmpeg path resolved at startup. Conversion fails gracefully if ffmpeg not installed.
- **type:** non-behavioral

## Item 8: Remove force-terminate from Celery cancellation (H-4)
- **id:** `sec-8-celery-cooperative`
- **intent:** Remove `terminate=True` from `celery_app.control.revoke()`. Keep only cooperative cancellation via Redis flag (`stop_check_fn`). Add timeout-based fallback (task auto-revoked after 10 min of no progress).
- **files:** `Backend/main.py` (cancel_task endpoint), `Backend/tasks.py`
- **acceptance:** `terminate=True` removed. Tasks cancelled cooperatively only. No SIGTERM sent to worker processes.
- **type:** non-behavioral

## Item 9: Fix rate limiter for proxy deployments (M-1)
- **id:** `sec-9-rate-limiter-proxy`
- **intent:** Add custom `key_func` that checks `X-Forwarded-For` header before falling back to `request.client.host`. Trust first entry in forwarded chain.
- **files:** `Backend/main.py`
- **acceptance:** Rate limiting per-client-IP works behind nginx/reverse-proxy.
- **type:** non-behavioral

## Item 10: Add CSRF protection (M-4)
- **id:** `sec-10-csrf-protection`
- **intent:** Add `fastapi-csrf-protect` or implement double-submit cookie pattern. Set `SameSite=Strict` on auth cookie. Add CSRF token to state-changing endpoints (POST/PATCH/DELETE). Frontend reads token from cookie and sends in `X-CSRF-Token` header.
- **files:** `Backend/main.py`, `Frontend/src/lib/api.ts`
- **acceptance:** State-changing requests without CSRF token rejected. Auth cookie has `SameSite=Strict`. Frontend includes token automatically.
- **type:** behavioral

## Item 11: Sanitize error messages in responses (L-2)
- **id:** `sec-11-error-sanitization`
- **intent:** Add global exception handler that catches unhandled exceptions, logs full traceback server-side, returns generic `{"detail": "Internal server error"}` to client. Keep validation errors (422) informative, server errors (500) generic.
- **files:** `Backend/main.py`
- **acceptance:** Internal errors return generic message. Tracebacks logged server-side only. Existing specific errors (401, 403, 404, 400) unchanged.
- **type:** non-behavioral

## Item 12: Gitignore .env.example and add .env.example.template (L-1)
- **id:** `sec-12-env-gitignore`
- **intent:** Add `.env` and `.env.local` to `.gitignore` (already there?). Rename `.env.example` to `.env.example.template` with placeholder values only. Remove real port numbers.
- **files:** `Frontend/.env.example`, `.gitignore`, `Frontend/.gitignore`
- **acceptance:** No `.env` file with real config in git history. Template has only placeholder values.
- **type:** non-behavioral

---

## Dependency order

```
sec-1 (JWT env) ─────────────────────────────────────────┐
sec-2 (password hash) ────────────────────────────────────┤
sec-3 (HF encrypt) ───────────────────────────────────────┤
sec-4 (input sanitize) ───────────────────────────────────┤
sec-5 (CORS restrict) ────────────────────────────────────┤  All independent,
sec-6 (delete regex) ─────────────────────────────────────┤  can be built
sec-7 (ffmpeg path) ──────────────────────────────────────┤  in parallel
sec-8 (celery cooperative) ───────────────────────────────┤
sec-9 (rate limiter proxy) ───────────────────────────────┤
sec-10 (CSRF) ─────────── depends on sec-2 (touches auth)─┤
sec-11 (error sanitize) ──────────────────────────────────┤
sec-12 (env gitignore) ───────────────────────────────────┘
```

Item 10 (CSRF) touches the same auth endpoints as item 2 — build after item 2 is done.
All others are independent. Build in ID order for safety.
