# ToSpeech

ToSpeech is a local web application for audio generation, featuring a React frontend and a FastAPI backend with Celery/Valkey for asynchronous task processing.

## Prerequisites

- **Python Environment** (Choose one):
  - **Conda** (Anaconda or Miniconda)
  - **Python 3.9+** (Standard installation)
- **Node.js 18+**
- **Valkey** (Redis alternative)
  - macOS: `brew install valkey`
  - Windows: [Memurai](https://www.memurai.com/) or WSL
  - Linux: `sudo apt install valkey`

## Installation

### 1. Backend Setup

Navigate to the `Backend` directory and choose your preferred environment manager.

#### Option A: Using Conda

```bash
cd Backend
conda create -n tospeech python=3.10
conda activate tospeech
pip install -r requirements.txt
```

#### Option B: Using venv (Standard Python)

```bash
cd Backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend Setup

Navigate to the `Frontend` directory and install dependencies.

```bash
cd ../Frontend
npm install
```

## Running the Application

You will need **4 terminal windows** to run the full stack locally.

### Terminal 1: Valkey (Message Broker)

Start the Valkey server on port 1312.

```bash
cd Backend
./start_valkey.sh
```

### Terminal 2: Celery (Task Worker)

Start the background worker. Ensure your environment is activated.

**Conda:**
```bash
cd Backend
conda activate tospeech
./start_celery.sh
```

**venv:**
```bash
cd Backend
source venv/bin/activate
./start_celery.sh
```

### Terminal 3: Backend API

Start the FastAPI server on port 1311. Ensure your environment is activated.

**Conda:**
```bash
cd Backend
conda activate tospeech
uvicorn main:app --reload --port 1311
```

**venv:**
```bash
cd Backend
source venv/bin/activate
uvicorn main:app --reload --port 1311
```

### Terminal 4: Frontend

Start the React development server.

```bash
cd Frontend
npm run dev
```

The application will be available at **http://localhost:1310**.

## Architecture & Ports

- **Frontend**: `http://localhost:1310` (Vite)
- **Backend API**: `http://localhost:1311` (FastAPI)
- **Valkey**: `localhost:1312` (Broker)

## Acknowledgements & License

This project utilizes code from **[VibeVoice](https://github.com/microsoft/VibeVoice)** by Microsoft (and its **[community fork](https://github.com/vibevoice-community/VibeVoice)**), which is licensed under the [MIT License](Backend/VibeVoice1.5/LICENSE). We gratefully acknowledge their open-source contribution.

The VibeVoice code is located in `Backend/VibeVoice1.5/` and retains its original MIT license. Please refer to `Backend/VibeVoice1.5/LICENSE` for full terms regarding that component.

ToSpeech's original code is licensed under the GNU General Public License v3.0 (GPLv3). See the main [LICENSE](LICENSE) file for details.
