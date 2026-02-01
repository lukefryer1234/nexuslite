# Nexus Lite

**Automation Hub for Blockchain Game Actions**

Nexus Lite is a web-based automation tool for managing multiple wallets and running game action scripts on PulseChain and BNB Chain. It provides a clean UI for starting, stopping, and monitoring automation scripts for the Mafia game.

![Demo](screenshots/demo.png)

## Features

### 🔐 Wallet Management
- **Create Wallets** - Generate new wallets with BIP-39 mnemonic recovery
- **Import Wallets** - Import existing wallets via private key
- **HD Derivation** - Derive multiple accounts from a seed phrase
- **Balance Display** - Real-time PLS and BNB balance checking
- **Character Status** - Show which wallets have game characters registered

### 💰 Quick Transfer
- Transfer native coins (PLS/BNB) between your wallets
- One-click max amount selection
- Chain toggle for PulseChain or BNB Chain

### 🎮 Automation Scripts
Run automated game actions across multiple wallets simultaneously:

| Script | Cooldown | Description |
|--------|----------|-------------|
| 🔫 Crime | 16 min | Commit crimes for money/XP rewards |
| 🚗 Nick Car | 31 min | Steal vehicles (requires unlocked ability) |
| 🎯 Kill Skill | 46 min | Train fighting skills using free bottles |
| ✈️ Travel | 65 min | Auto-travel between cities |

### 📊 Real-Time Monitoring
- **Live Logs** - WebSocket streaming of all script activity
- **Dual-Chain View** - Side-by-side PulseChain and BNB Chain panels
- **Per-Chain Controls** - Start/Stop All buttons for each chain
- **Global Controls** - Start All, Stop All, Restart All across both chains

### 🎛️ Script Configuration
- **Crime Type** - Select specific crime type or randomize
- **Training Type** - Choose training method (free bottles recommended)
- **City Selection** - Configure travel start/end cities

### 🏠 Property Yields
- **Yield Tracking** - View all owned properties and estimated yields
- **Time-Based Claiming** - Auto-claim when interval exceeded (configurable: 12h/24h/48h/72h)
- **Manual Override** - Force claim all yielding properties instantly
- **Chain Support** - Track PulseChain and BNB Chain properties

### ⛽ Gas Balancer
- **Auto-Balance** - Automatically maintain minimum gas across all wallets
- **Manual Transfer** - Quick transfer between wallets
- **Balance Monitoring** - Real-time balance display

### 🔒 Session Security
- **Lock Timeout** - Auto-lock session after 1h/2h/4h/8h/12h/24h or Never
- **Quick Lock** - Manual lock button in header
- **Encrypted Passwords** - AES-256-GCM encryption

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Foundry** - Smart contract development toolkit
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```
3. **Game Character** - Your wallet must have a registered character in the Mafia game

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/lukefryer1234/nexus-lite.git
cd nexus-lite
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `.env` with your paths:

```env
FOUNDRY_BIN=/home/YOUR_USER/.foundry/bin
KEYSTORE_PATH=/home/YOUR_USER/.foundry/keystores
PORT=4001
NEXUS_LITE_DATA=/home/YOUR_USER/.nexus-lite
```

### 4. Create Required Directories

```bash
mkdir -p ~/.foundry/keystores
mkdir -p ~/.nexus-lite
```

## Running the Application

### Start the Backend

```bash
cd server
npm start
```

### Start the Frontend

In a new terminal:

```bash
cd client
npm run dev
```

Access the application at: **http://localhost:4001**

## Background Automation (PM2)

To run automation scripts 24/7 in the background, use PM2:

### 1. Install PM2

```bash
npm install -g pm2
```

### 2. Setup Keystores

Copy your Foundry keystores to the project:

```bash
mkdir -p server/keystores
cp ~/.foundry/keystores/* server/keystores/
```

### 3. Configure PM2

```bash
cd server/scripts
cp ecosystem.config.example.js ecosystem.config.js
```

Edit `ecosystem.config.js` and set your password:

```javascript
env: {
  CHAIN_CHOICE: '0',  // 0=PLS, 1=BNB, 2=BOTH
  GLOBAL_PASSWORD: 'YOUR_KEYSTORE_PASSWORD',
  KEYSTORE_PATH: '/full/path/to/nexus-lite/server/keystores'
}
```

> **⚠️ Password Requirement**: All your Foundry keystores must use the **same password** for `GLOBAL_PASSWORD` to work. When creating wallets, use a consistent password.
>
> If you have wallets with different passwords, you can set individual passwords:
> ```javascript
> env: {
>   GLOBAL_PASSWORD: 'default_password',
>   MUM_PASSWORD: 'different_password',      // For wallet named "Mum"
>   WALLET2_PASSWORD: 'another_password'     // For wallet named "wallet2"
> }
> ```

### 4. Start Automation

```bash
cd server/scripts
pm2 start ecosystem.config.js
pm2 save  # Persist processes across reboots
```

### 5. Monitor Scripts

```bash
pm2 list                    # View running processes
pm2 logs lite-crime         # View crime script logs
pm2 logs lite-killskill     # View kill skill logs
pm2 stop lite-crime         # Stop a specific script
pm2 restart all             # Restart all scripts
```

### PM2 Commands Reference

| Command | Description |
|---------|-------------|
| `pm2 list` | Show all running processes |
| `pm2 logs` | Stream all logs |
| `pm2 logs <name>` | Stream specific script logs |
| `pm2 stop <name>` | Stop a script |
| `pm2 restart <name>` | Restart a script |
| `pm2 delete all` | Stop and remove all scripts |

## Usage Guide

### First-Time Setup

1. **Set Global Password**
   - On first launch, set a master password
   - This encrypts all wallet passwords locally using AES-256-GCM

2. **Create/Import Wallets**
   - Go to **Foundry** tab
   - Click "Create New Wallet" or use "Import from Private Key"
   - All wallets are encrypted with your global password

3. **Test Wallet Connection**
   - Click "Test" button on each wallet
   - This verifies the wallet works and shows balance/address
   - Also checks if wallet has a registered game character

### Starting Automation

1. Go to **Automation** tab
2. Select wallets using checkboxes at the top
3. Click ▶ to start individual scripts, or use "Start All"
4. Monitor progress in the real-time log panels

### Using Quick Transfer

1. Go to **Foundry** tab
2. Find "Quick Transfer" panel at the top
3. Select source and destination wallets
4. Choose chain (PLS or BNB)
5. Enter amount or click "Max"
6. Click "Send"

## UI Overview

### Pages

| Tab | Purpose |
|-----|---------|
| **Automation** | Main dashboard - start/stop scripts, view logs |
| **Foundry** | Wallet management - create, import, test, transfer |
| **Operations** | Batch operations panel (heal, bust, etc.) |

### Automation Page Layout

```
┌─────────────────────────────────────────────────────┐
│  [✓] Wallet1  [✓] Wallet2  [✓] Wallet3  (Select)    │
├─────────────────────────────────────────────────────┤
│  [▶ Start All]  [■ Stop All]  [⟳ Restart All]       │
├─────────────────────┬───────────────────────────────┤
│  PulseChain (PLS)   │     BNB Chain (BNB)           │
│  ─────────────────  │     ─────────────────         │
│  🔫 Crime    [▶]    │     🔫 Crime    [▶]           │
│  🚗 Nick Car [▶]    │     🚗 Nick Car [▶]           │
│  🎯 Kill Skill [▶]  │     🎯 Kill Skill [▶]         │
│  ✈️ Travel   [▶]    │     ✈️ Travel   [▶]           │
├─────────────────────┴───────────────────────────────┤
│  📊 Logs (real-time with chain tags)                │
└─────────────────────────────────────────────────────┘
```

## Security

- **Encryption**: All wallet passwords encrypted with AES-256-GCM
- **Key Storage**: Private keys in Foundry keystores (encrypted JSON)
- **Local Only**: No data sent to external servers
- **Password Required**: Global password needed each session

**Never share:**
- Your `.env` file
- Your `~/.nexus-lite` directory
- Your `~/.foundry/keystores` directory

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Foundry not found" | Set `FOUNDRY_BIN` correctly in `.env` |
| "Failed to decrypt wallet" | Verify global password is correct |
| "crime cooldown" | Normal - wait for cooldown to expire |
| "user is in jail" | Your character is jailed - wait or bust out |
| "not valid item" | Missing required item (travel tickets, etc.) |
| "the same city" | Already at destination - change city config |
| "empty revert data" | Cooldown not met or ability not unlocked |

## Game Requirements

For scripts to work, your character needs:

| Script | Requirements |
|--------|-------------|
| Crime | Character registered |
| Nick Car | Character registered + ability unlocked |
| Kill Skill | Character registered |
| Travel | Travel tickets in inventory |

## Project Structure

```
nexus-lite/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   └── hooks/          # Custom React hooks
│   └── package.json
├── server/                  # Node.js backend (Express)
│   ├── routes/             # API endpoints
│   ├── services/           # Script scheduler service
│   ├── config/             # Password manager, contracts
│   ├── scripts/            # Foundry Solidity scripts
│   └── package.json
├── .gitignore
├── README.md
└── ARCHITECTURE.md         # Technical documentation
```

## API Reference

### Script Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/{script}/start` | POST | Start a script |
| `/api/{script}/stop` | POST | Stop a script |
| `/api/{script}/status` | GET | Get running status |
| `/api/{script}/logs` | GET | Get recent logs |

Where `{script}` is: `crime`, `nickcar`, `killskill`, or `travel`

### Wallet Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/keystore/list` | GET | List all wallets |
| `/api/keystore/create` | POST | Create new wallet |
| `/api/keystore/test/:name` | POST | Test wallet connection |
| `/api/wallet/balance/:address` | GET | Get balance |
| `/api/wallet/transfer` | POST | Transfer coins |

## License

MIT

## Disclaimer

This software is provided for educational purposes. Use at your own risk. The authors are not responsible for any losses or damages resulting from the use of this software.
