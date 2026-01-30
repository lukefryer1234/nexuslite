#!/bin/bash
#
# Nexus Lite Setup Script
# Run this script to configure PM2 automation
#

echo "============================================"
echo "   Nexus Lite - Automation Setup"
echo "============================================"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing..."
    npm install -g pm2
fi

# Check for ecosystem config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/server/scripts/ecosystem.config.js"
EXAMPLE_FILE="$SCRIPT_DIR/server/scripts/ecosystem.config.example.js"

if [ ! -f "$CONFIG_FILE" ]; then
    if [ -f "$EXAMPLE_FILE" ]; then
        echo "📋 Creating ecosystem.config.js from example..."
        cp "$EXAMPLE_FILE" "$CONFIG_FILE"
    else
        echo "❌ ecosystem.config.example.js not found!"
        exit 1
    fi
fi

# Create keystores directory
KEYSTORE_DIR="$SCRIPT_DIR/server/keystores"
mkdir -p "$KEYSTORE_DIR"

# Ask for password
echo ""
read -sp "🔐 Enter your keystore password: " PASSWORD
echo ""

if [ -z "$PASSWORD" ]; then
    echo "❌ Password cannot be empty!"
    exit 1
fi

# Update the config file with the password
sed -i "s/YOUR_KEYSTORE_PASSWORD_HERE/$PASSWORD/g" "$CONFIG_FILE"
sed -i "s|/path/to/your/keystores|$KEYSTORE_DIR|g" "$CONFIG_FILE"

echo ""
echo "✅ Configuration updated!"
echo ""

# Check for keystores
if [ -z "$(ls -A $KEYSTORE_DIR 2>/dev/null)" ]; then
    echo "⚠️  No keystores found in $KEYSTORE_DIR"
    echo ""
    
    # Check if Foundry keystores exist
    FOUNDRY_KEYSTORES="$HOME/.foundry/keystores"
    if [ -d "$FOUNDRY_KEYSTORES" ] && [ -n "$(ls -A $FOUNDRY_KEYSTORES 2>/dev/null)" ]; then
        echo "Found keystores in $FOUNDRY_KEYSTORES:"
        ls -1 "$FOUNDRY_KEYSTORES"
        echo ""
        read -p "Copy these keystores to Nexus Lite? (y/n): " COPY_KEYSTORES
        
        if [ "$COPY_KEYSTORES" = "y" ] || [ "$COPY_KEYSTORES" = "Y" ]; then
            cp "$FOUNDRY_KEYSTORES"/* "$KEYSTORE_DIR/"
            echo "✅ Keystores copied!"
        fi
    else
        echo "Create keystores using Foundry or the web UI first."
    fi
fi

echo ""
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo ""
echo "Start automation with:"
echo "  cd server/scripts && pm2 start ecosystem.config.js"
echo ""
echo "Monitor with:"
echo "  pm2 list"
echo "  pm2 logs"
echo ""
