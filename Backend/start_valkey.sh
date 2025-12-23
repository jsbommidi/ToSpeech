#!/bin/bash

# Start Valkey on port 1312 for ToSpeech
# This keeps it aligned with the app's port scheme (Frontend: 1310, Backend: 1311, Valkey: 1312)

echo "Starting Valkey on port 1312..."
echo ""

# Check if Valkey is already running on port 1312
if lsof -Pi :1312 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 1312 is already in use!"
    echo "To stop existing Valkey: brew services stop valkey"
    echo "Or kill the process: kill \$(lsof -t -i:1312)"
    exit 1
fi

# Start Valkey on custom port
valkey-server --port 1312 --daemonize no

# Note: Use --daemonize yes to run in background
# Or use: brew services start valkey (but this uses default port 6379)
