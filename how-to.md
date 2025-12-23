# How to Use ToSpeech

This guide provides instructions on how to set up, run, and use the ToSpeech application.

## 1. How to Start the App Locally

To run the full stack, you need **4 separate terminal windows**.

### Step 1: Start Valkey (Message Broker)
**Terminal 1:**
```bash
cd Backend
./start_valkey.sh
```

### Step 2: Start Celery (Background Worker)
**Terminal 2:**
*Choose your python environment:*

**Option A: Conda**
```bash
cd Backend
conda activate tospeech
./start_celery.sh
```

**Option B: Standard Python (venv)**
```bash
cd Backend
source venv/bin/activate
./start_celery.sh
```

### Step 3: Start Backend API
**Terminal 3:**
*Use the same environment as Step 2.*

**Option A: Conda**
```bash
cd Backend
conda activate tospeech
uvicorn main:app --reload --port 1311
```

**Option B: Standard Python (venv)**
```bash
cd Backend
source venv/bin/activate
uvicorn main:app --reload --port 1311
```

### Step 4: Start Frontend
**Terminal 4:**
```bash
cd Frontend
npm run dev
```

Once running, open **http://localhost:1310** in your browser.

---

## 2. How to Download Models

Model management is located in the **Settings** page.

1.  Navigate to **Settings** (Gear icon in the sidebar).
2.  Scroll down to the **"Model Settings"** section.
3.  Find the **"Download New Model"** input field.
4.  Paste one of the following official Hugging Face links:
    *   **Standard (High Quality):** `https://huggingface.co/microsoft/VibeVoice-1.5B`
    *   **Streaming (Realtime):** `https://huggingface.co/microsoft/VibeVoice-Realtime-0.5B`
5.  Click the **Download** button.
6.  Wait for the progress bar to complete (Models are several GBs).

---

## 3. How to Generate Audio

Navigate to the **Generate** page.

1.  **Select Model:** Choose your loaded model.
    *   *Note: Switching models takes a few seconds.*

2.  **Select Speaker:**
    *   **Standards (1.5B):** Pick a voice like `Alice` (cloning reference).
    *   **Realtime (0.5B):** Pick a preset like `Emma` or `Mike` (no cloning).

3.  **Enter Text (CRITICAL):**
    The text formatting depends on the model.

    *   **For Standard (1.5B): Use "Speaker 1:" syntax.**
        You must prefix your text with a speaker label.
        ```
        Speaker 1: Hello, this is a test.
        ```
        Or for multiple turns (though the UI mostly handles single blocks):
        ```
        Speaker 1: Hello!
        Speaker 1: How are you today?
        ```
    
    *   **For Realtime (0.5B): Plain text.**
        Just type normally.
        ```
        Hello, this is a streaming test.
        ```

4.  **Tweak Settings:**
    *   **CFG Scale:** Default `1.5`. Controls expressiveness.
    *   **Inference Steps:** 
        *   **Realtime 0.5B:** Keep low (5-10).
        *   **Standard 1.5B:** Increase for quality (12-20).

---

## 4. Specific Model Usage Guide & Official Guidelines

### **Microsoft VibeVoice 1.5B (Standard)**
*   **Prompt Format:** MUST start with `Speaker 1: [Text]`
*   **Best For:** Podcasts, long-form narration, multi-speaker dialogue.
*   **Key Features:**
    *   **Voice Cloning:** Supports cloning from reference audio files (`.wav`).
    *   **Multi-Speaker:** Can handle up to 4 distinct speakers in one session.
    *   **Emergent Abilities:** Can sometimes generate background music or sound effects if implied by the text (e.g., "Welcome to the show!").
*   **Usage Rule:** Use this when quality is more important than generation time.

### **Microsoft VibeVoice Realtime 0.5B (Streaming)**
*   **Prompt Format:** Plain text (No `Speaker 1:` prefix needed).
*   **Best For:** Live interaction, testing, low-latency responses.
*   **Key Features:**
    *   **Single Speaker Only:** Limited to single-speaker generation.
    *   **No Voice Cloning:** Use the provided voice presets (`.pt` files in `demo/voices/streaming_model/`).
*   **Usage Rule:** Use this for fast iterations. If you see warnings about "weights not initialized", it is expected (voice cloning parts are removed for speed).

**Troubleshooting:**
*   **Speed:** If the voice speaks too fast, try breaking your text into smaller chunks.
*   **Stability:** Random background music is a known behavior of the model based on text context.
