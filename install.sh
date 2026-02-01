#!/bin/bash
# Nexus Lite - One-Line Installer
# Usage: curl -sSL https://raw.githubusercontent.com/lukefryer1234/nexuslite/main/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              NEXUS LITE INSTALLER                         ║"
echo "║     Automation Hub for Blockchain Game Actions            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for required commands
check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        OS_ID=$ID
    elif [ -f /etc/debian_version ]; then
        OS="Debian"
        OS_ID="debian"
    else
        OS=$(uname -s)
        OS_ID="unknown"
    fi
    echo -e "${BLUE}Detected OS: ${OS}${NC}"
}

# Install Node.js
install_nodejs() {
    echo -e "${YELLOW}Installing Node.js v20...${NC}"
    
    if [[ "$OS_ID" == "ubuntu" ]] || [[ "$OS_ID" == "debian" ]]; then
        # Use NodeSource for Ubuntu/Debian
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS_ID" == "fedora" ]] || [[ "$OS_ID" == "rhel" ]] || [[ "$OS_ID" == "centos" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    elif [[ "$OS_ID" == "arch" ]]; then
        sudo pacman -Sy --noconfirm nodejs npm
    else
        echo -e "${YELLOW}Using nvm to install Node.js...${NC}"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install 20
        nvm use 20
    fi
    
    echo -e "${GREEN}✓ Node.js $(node --version) installed${NC}"
}

# Install Foundry
install_foundry() {
    echo -e "${YELLOW}Installing Foundry (forge, cast)...${NC}"
    
    curl -L https://foundry.paradigm.xyz | bash
    
    # Source foundryup
    export PATH="$HOME/.foundry/bin:$PATH"
    
    # Run foundryup to install
    ~/.foundry/bin/foundryup
    
    echo -e "${GREEN}✓ Foundry installed${NC}"
    echo -e "  forge: $(~/.foundry/bin/forge --version | head -1)"
}

# Install git if needed
install_git() {
    echo -e "${YELLOW}Installing git...${NC}"
    
    if [[ "$OS_ID" == "ubuntu" ]] || [[ "$OS_ID" == "debian" ]]; then
        sudo apt-get update
        sudo apt-get install -y git curl
    elif [[ "$OS_ID" == "fedora" ]] || [[ "$OS_ID" == "rhel" ]] || [[ "$OS_ID" == "centos" ]]; then
        sudo dnf install -y git curl
    elif [[ "$OS_ID" == "arch" ]]; then
        sudo pacman -Sy --noconfirm git curl
    fi
    
    echo -e "${GREEN}✓ Git installed${NC}"
}

# Main installation
main() {
    detect_os
    
    # Check and install git
    if ! check_command git; then
        install_git
    else
        echo -e "${GREEN}✓ Git already installed${NC}"
    fi
    
    # Check and install Node.js
    if ! check_command node; then
        install_nodejs
    else
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            echo -e "${YELLOW}Node.js version too old, upgrading...${NC}"
            install_nodejs
        else
            echo -e "${GREEN}✓ Node.js $(node --version) already installed${NC}"
        fi
    fi
    
    # Check and install Foundry
    if ! check_command forge && [ ! -f "$HOME/.foundry/bin/forge" ]; then
        install_foundry
    else
        echo -e "${GREEN}✓ Foundry already installed${NC}"
    fi
    
    # Add foundry to PATH for this session
    export PATH="$HOME/.foundry/bin:$PATH"
    
    # Clone the repository
    INSTALL_DIR="$HOME/nexus-lite"
    
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Directory $INSTALL_DIR already exists.${NC}"
        read -p "Remove and reinstall? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            echo -e "${RED}Installation cancelled.${NC}"
            exit 1
        fi
    fi
    
    echo -e "${YELLOW}Cloning Nexus Lite...${NC}"
    git clone https://github.com/lukefryer1234/nexuslite.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Install server dependencies
    echo -e "${YELLOW}Installing server dependencies...${NC}"
    cd server
    npm install
    
    # Install client dependencies
    echo -e "${YELLOW}Installing client dependencies...${NC}"
    cd ../client
    npm install
    
    # Build client
    echo -e "${YELLOW}Building client...${NC}"
    npm run build
    
    # Create .env file
    cd ../server
    if [ ! -f .env ]; then
        cp .env.example .env
        # Update paths in .env
        sed -i "s|/home/YOUR_USER|$HOME|g" .env
        echo -e "${GREEN}✓ Created .env file${NC}"
    fi
    
    # Create keystores directory
    mkdir -p "$HOME/.foundry/keystores"
    
    # Create data directory
    mkdir -p "$INSTALL_DIR/server/data"
    
    # Add foundry to bashrc if not already there
    if ! grep -q "foundry/bin" "$HOME/.bashrc" 2>/dev/null; then
        echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> "$HOME/.bashrc"
    fi
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              INSTALLATION COMPLETE!                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Nexus Lite installed to: ${BLUE}$INSTALL_DIR${NC}"
    echo ""
    echo -e "${YELLOW}To start Nexus Lite:${NC}"
    echo -e "  cd $INSTALL_DIR/server"
    echo -e "  npm start"
    echo ""
    echo -e "Then open: ${BLUE}http://localhost:4001${NC}"
    echo ""
    echo -e "${YELLOW}Quick Start:${NC}"
    echo -e "  1. Open http://localhost:4001 in your browser"
    echo -e "  2. Set a master password (this encrypts your wallets)"
    echo -e "  3. Create or import wallets in the 'Foundry' tab"
    echo -e "  4. Start automation scripts in the 'Automation' tab"
    echo ""
    echo -e "${YELLOW}Optional - Run as background service:${NC}"
    echo -e "  npm install -g pm2"
    echo -e "  pm2 start npm --name nexus-lite -- start"
    echo -e "  pm2 save"
    echo ""
}

# Run main function
main "$@"
