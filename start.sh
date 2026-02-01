#!/bin/bash
# Nexus Lite - Start Script
# Starts the server and opens the browser

cd "$(dirname "$0")"

# Add foundry to path
export PATH="$HOME/.foundry/bin:$PATH"

# Check if node_modules exist
if [ ! -d "server/node_modules" ]; then
    echo "Installing dependencies..."
    cd server && npm install && cd ..
fi

if [ ! -d "client/node_modules" ]; then
    cd client && npm install && cd ..
fi

# Build client if dist doesn't exist
if [ ! -d "client/dist" ]; then
    echo "Building client..."
    cd client && npm run build && cd ..
fi

# Start server
echo "Starting Nexus Lite..."
echo "Access at: http://localhost:4001"
echo ""
cd server
node index.js
