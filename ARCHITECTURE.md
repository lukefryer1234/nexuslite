# Nexus Lite Architecture

## Overview

Nexus Lite is a full-stack application with a React frontend and Node.js/Express backend. It uses Foundry for blockchain interactions and manages wallet keystores securely.

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ FoundryPage  │  │AutomationPage│  │ OperationsPage│       │
│  │ - Wallets    │  │ - Scripts    │  │ - Batch Ops  │       │
│  │ - Transfer   │  │ - Logs       │  │ - Cooldowns  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                           │                                   │
│                    HTTP/WebSocket                            │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                     Backend (Express)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Routes     │  │   Services   │  │   Config     │       │
│  │ - keystore   │  │ - Scheduler  │  │ - Passwords  │       │
│  │ - wallet     │  │ - Scripts    │  │ - Contracts  │       │
│  │ - scripts    │  │              │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                           │                                   │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                     Foundry Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Keystores  │  │ cast commands│  │forge scripts │       │
│  │  (encrypted) │  │ (balance,    │  │(crime,travel,│       │
│  │              │  │  transfer)   │  │ nickcar,etc) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### Frontend (`/client`)

| Component | Purpose |
|-----------|---------|
| `App.jsx` | Main app with tabs and global password |
| `KeystoreManager.jsx` | Wallet creation/import/management |
| `QuickTransfer.jsx` | Native coin transfers between wallets |
| `AutomationPage.jsx` | Script start/stop controls |
| `CooldownTracker.jsx` | Displays action cooldowns |
| `LogViewer.jsx` | Real-time log display via WebSocket |

### Backend (`/server`)

| File | Purpose |
|------|---------|
| `index.js` | Express server, Socket.io setup |
| `routes/keystore.js` | Wallet CRUD operations |
| `routes/wallet.js` | Balance/transfer endpoints |
| `routes/scripts.js` | Script start/stop/status |
| `services/ScriptSchedulerService.js` | Script execution and scheduling |
| `config/GlobalPasswordManager.js` | Password encryption/storage |
| `config/gameContracts.js` | Smart contract addresses and ABIs |

### Foundry Scripts (`/server/scripts`)

| Script | Chain | Function |
|--------|-------|----------|
| `PLSCrime.s.sol` | PulseChain | Execute crimes |
| `BNBCrime.s.sol` | BNB Chain | Execute crimes |
| `PLSNickCar.s.sol` | PulseChain | Steal cars |
| `BNBNickCar.s.sol` | BNB Chain | Steal cars |
| `PLSKillSkill.s.sol` | PulseChain | Train skills |
| `BNBKillSkill.s.sol` | BNB Chain | Train skills |
| `PLSTravel.s.sol` | PulseChain | Travel between cities |
| `BNBTravel.s.sol` | BNB Chain | Travel between cities |

## Data Flow

### Wallet Creation
```
User Input → API /keystore/create → cast wallet import → Keystore File
```

### Script Execution
```
UI Start Button → API /crime/start → ScriptSchedulerService 
→ spawn forge script → Blockchain Transaction → WebSocket Log → UI
```

### Password Management
```
Global Password → PBKDF2 Key Derivation → AES-256-GCM Encryption
→ Store encrypted wallet passwords → Decrypt on demand
```

## Security Architecture

1. **Global Password**: Never stored - used for key derivation only
2. **Wallet Passwords**: Encrypted with AES-256-GCM at rest
3. **Private Keys**: Stored in Foundry keystores (encrypted JSON)
4. **Environment Variables**: Sensitive paths in `.env` (gitignored)

## API Endpoints

### Keystore Routes (`/api/keystore`)
- `POST /unlock` - Unlock with global password
- `POST /lock` - Lock all wallets
- `GET /list` - List available wallets
- `POST /create` - Create new wallet
- `DELETE /delete/:name` - Delete wallet
- `POST /test/:name` - Test wallet (get balance)

### Wallet Routes (`/api/wallet`)
- `GET /balance/:address` - Get native coin balance
- `POST /transfer` - Send native coins

### Script Routes (`/api/{scriptName}`)
- `POST /start` - Start script for wallet/chain
- `POST /stop` - Stop script for wallet/chain
- `GET /status` - Get running status
- `GET /logs` - Get recent logs

## Configuration

### Environment Variables
- `FOUNDRY_BIN` - Path to Foundry binaries
- `KEYSTORE_PATH` - Path to keystore directory
- `PORT` - Server port (default: 4001)
- `NEXUS_LITE_DATA` - Path for encrypted password storage

### Network Configuration
Defined in `gameContracts.js`:
- PulseChain RPC endpoints
- BNB Chain RPC endpoints
- Game contract addresses
