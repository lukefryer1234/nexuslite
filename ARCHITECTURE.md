# Nexus Lite Architecture

## Overview

Nexus Lite is a full-stack web application for automating blockchain game interactions. It uses a Node.js backend with Express for the API, Foundry for smart contract interactions, and a React frontend with Vite.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)               │
│   http://localhost:4001                                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ AutomationPage│ │ FoundryPage  │ │ SettingsPage         │ │
│  │ - YieldPanel  │ │ - CreateWallet│ │ - Script Config     │ │
│  │ - CooldownTrkr│ │ - ImportWallet│ │ - Gas Settings      │ │
│  │ - GasBalancer │ │ - QuickTransfer│ │                    │ │
│  │ - ScriptPanels│ │ - HDDerivation│ │                     │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express + Node.js)              │
│   Port 4001                                                 │
├─────────────────────────────────────────────────────────────┤
│  Routes                  │  Services                        │
│  ──────────────────────  │  ────────────────────────────── │
│  /api/keystore/*         │  GlobalPasswordManager           │
│  /api/wallet/*           │  ScriptSchedulerService          │
│  /api/scripts/*          │  GasBalanceManager               │
│  /api/yield/*            │  YieldClaimManager               │
│  /api/gas-balance/*      │                                  │
│  /api/settings/*         │                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ child_process.spawn
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Foundry CLI (forge, cast)                │
│   ~/.foundry/bin                                            │
├─────────────────────────────────────────────────────────────┤
│  forge script            │  cast send                       │
│  - PLSCrime.s.sol        │  - claimFromProperty()          │
│  - BNBCrime.s.sol        │  - transfer()                    │
│  - PLSKillSkill.s.sol    │                                  │
│  - PLSTravel.s.sol       │                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ RPC Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Blockchain Networks                      │
├─────────────────────────┬───────────────────────────────────┤
│    PulseChain (369)     │      BNB Chain (56)               │
│                         │                                   │
│  Game Contracts:        │  Game Contracts:                  │
│  - ACTION: 0xf077...    │  - ACTION: 0xd877...             │
│  - MAP: 0xE571...       │  - MAP: 0x1c88...                │
│  - TRAIN: 0x3c25...     │  - TRAIN: 0x87F8...              │
└─────────────────────────┴───────────────────────────────────┘
```

## Directory Structure

```
nexus-lite/
├── client/                      # React Frontend
│   ├── src/
│   │   ├── App.jsx             # Main app with auth state
│   │   ├── components/         # Reusable UI components
│   │   │   ├── YieldPanel.jsx  # Property yield tracking
│   │   │   ├── GasBalancerPanel.jsx
│   │   │   ├── CooldownTracker.jsx
│   │   │   ├── WalletSelector.jsx
│   │   │   └── LogViewer.jsx
│   │   ├── pages/              # Page components
│   │   │   ├── AutomationPage.jsx
│   │   │   ├── FoundryPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useWallets.js
│   │   │   └── usePersistentState.js
│   │   └── config/
│   │       └── api.js          # API base URL config
│   └── package.json
│
├── server/                      # Node.js Backend
│   ├── index.js                # Express app entry point
│   ├── routes/
│   │   ├── keystore.js         # Wallet management API
│   │   ├── wallet.js           # Balance/transfer API
│   │   ├── scripts.js          # Script control API
│   │   ├── yieldApi.js         # Yield claiming API
│   │   ├── gasBalanceApi.js    # Gas balancer API
│   │   └── settings.js         # Config API
│   ├── services/
│   │   ├── ScriptSchedulerService.js  # Script process manager
│   │   ├── GasBalanceManager.js       # Auto gas balancing
│   │   └── YieldClaimManager.js       # Property yield claiming
│   ├── config/
│   │   ├── GlobalPasswordManager.js   # Password encryption
│   │   └── Logger.js                  # Logging utility
│   ├── scripts/
│   │   ├── run-crime-scriptV1.js      # Crime automation
│   │   ├── run-travel-script.js       # Travel automation
│   │   ├── run-killskill-scheduler.js # Training automation
│   │   └── foundry-crime-scripts/     # Solidity scripts
│   │       ├── script/
│   │       │   ├── PLSCrime.s.sol
│   │       │   ├── BNBCrime.s.sol
│   │       │   ├── PLSKillSkill.s.sol
│   │       │   └── PLSTravel.s.sol
│   │       └── foundry.toml
│   ├── data/                    # Local state (git-ignored)
│   │   └── yield_claims.json
│   └── package.json
│
├── .gitignore
├── README.md
└── ARCHITECTURE.md
```

## Core Components

### 1. GlobalPasswordManager
Handles password-based encryption for wallet access.

```javascript
// Singleton pattern
class GlobalPasswordManager {
  masterPassword = null;   // In-memory only, never persisted
  
  unlock(password) {
    this.masterPassword = password;
  }
  
  lock() {
    this.masterPassword = null;
  }
}
```

### 2. ScriptSchedulerService
Manages script processes using Node.js child_process.

```javascript
class ScriptSchedulerService {
  processes = new Map();  // keystoreName:chain:scriptType -> Process
  
  startScript(scriptType, keystoreName, chain, options) {
    const proc = spawn('node', [...args]);
    this.processes.set(key, proc);
    proc.stdout.on('data', this.handleLog);
  }
  
  stopScript(scriptType, keystoreName, chain) {
    const proc = this.processes.get(key);
    proc.kill('SIGTERM');
  }
}
```

### 3. YieldClaimManager
Tracks property yields and handles claiming.

```javascript
class YieldClaimManager {
  // Fetches properties from game API
  async fetchPropertiesForAddress(address, chain)
  
  // Gets properties with claim status
  async getPropertiesWithStatus(address, chain)
  
  // Claims using cast CLI
  async claimProperty(keystoreName, password, cityId, tileId, chain)
  
  // Time-based auto claim
  async claimAllReady(keystoreName, password, address, chain)
  
  // Manual override
  async claimAllForce(keystoreName, password, address, chain)
}
```

### 4. GasBalanceManager
Automatic gas balance maintenance.

```javascript
class GasBalanceManager {
  config = {
    enabled: false,
    minBalance: 0.1,      // Minimum PLS/BNB
    targetBalance: 0.5,   // Amount to top up to
    sourceWallet: null    // Wallet to pull from
  };
  
  async checkAndBalance() {
    // Called periodically
    // Transfers from source to low wallets
  }
}
```

## Data Flow

### 1. Script Execution Flow

```
User clicks "Start Crime"
        │
        ▼
Frontend: POST /api/scripts/start
        │
        ▼
ScriptSchedulerService.startScript()
        │
        ├─► spawn('node', ['run-crime-scriptV1.js', ...])
        │         │
        │         ▼
        │   run-crime-scriptV1.js
        │         │
        │         ▼
        │   spawn('forge', ['script', 'PLSCrime.s.sol', ...])
        │         │
        │         ▼
        │   Blockchain Transaction
        │
        └─► stdout/stderr ──► Socket.io ──► Frontend Logs
```

### 2. Yield Claim Flow

```
User clicks "Claim" on Yield Panel
        │
        ▼
Frontend: POST /api/yield/claim-all
        │
        ▼
YieldClaimManager.claimAllForce()
        │
        ├─► Fetch properties from Game API
        │         (https://backendpls.playmafia.io/map/owned/{cityId})
        │
        ├─► For each yielding property:
        │         │
        │         ▼
        │   spawn('cast', ['send', mapContract, 'claimFromProperty(...)', ...])
        │
        └─► Update yield_claims.json with claim timestamps
```

### 3. Authentication Flow

```
User enters password
        │
        ▼
Frontend: POST /api/keystore/unlock-all
        │
        ▼
GlobalPasswordManager.unlock(password)
        │
        ├─► Test password by decrypting first keystore
        │
        └─► Return { success: true, addresses: {...} }
        
All subsequent requests use GlobalPasswordManager.masterPassword
```

## API Reference

### Keystore Routes (`/api/keystore/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/list` | GET | List all keystores with unlock status |
| `/unlock-all` | POST | Unlock with master password |
| `/lock-all` | POST | Lock (clear password from memory) |
| `/create` | POST | Create new wallet |
| `/test/:name` | POST | Test wallet, return address/balance |

### Script Routes (`/api/scripts/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/available` | GET | List available script types |
| `/start` | POST | Start a script process |
| `/stop` | POST | Stop a script process |
| `/status` | GET | Get running script statuses |

### Yield Routes (`/api/yield/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status/:address` | GET | Get properties with yield status |
| `/config` | GET/POST | Get/update claim interval |
| `/claim` | POST | Claim ready properties (time-based) |
| `/claim-all` | POST | Force claim all (manual override) |
| `/history` | GET | Get recent claim history |

### Gas Balance Routes (`/api/gas-balance/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Get gas balancer status |
| `/config` | POST | Update balancer settings |
| `/balance` | POST | Trigger manual balance check |

## Security Considerations

1. **Password Storage**: Master password stored only in memory, never written to disk
2. **Keystore Encryption**: Foundry keystores use scrypt key derivation
3. **Temp Files**: Password temp files (`/tmp/pw-*`) deleted immediately after use
4. **Git Ignored**: All sensitive directories excluded from version control:
   - `server/data/` (claim history)
   - `server/keystores/` (wallet files)
   - `.env` files
   - `broadcast/` folders (transaction receipts)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4001 | Server port |
| `FOUNDRY_BIN` | `~/.foundry/bin` | Path to forge/cast |
| `KEYSTORE_PATH` | `~/.foundry/keystores` | Path to wallet files |
| `PLS_RPC_URL` | Public RPC | PulseChain RPC endpoint |
| `BNB_RPC_URL` | Public RPC | BNB Chain RPC endpoint |

## Game Contracts

### PulseChain (Chain ID: 369)

| Contract | Address | Purpose |
|----------|---------|---------|
| ACTION | `0xf077d4d0508505c5a80249afc10bc6ead90e47f1` | Crime, travel actions |
| MAP | `0xE571Aa670EDeEBd88887eb5687576199652A714F` | Property management |
| TRAIN | `0x3c25b9d6c8ad015Dd0afb7B79AA18795A7c10C00` | Skill training |

### BNB Chain (Chain ID: 56)

| Contract | Address | Purpose |
|----------|---------|---------|
| ACTION | `0xd8772249912A201D872F00fE2A09C0C3AE1f4f21` | Crime, travel actions |
| MAP | `0x1c88060e4509c59b4064A7a9818f64AeC41ef19E` | Property management |
| TRAIN | `0x87F851f970Cd1aA4B0C09F3CDBD69fE75c0cEF48` | Skill training |

## Extending the System

### Adding a New Script Type

1. Create Solidity script in `server/scripts/foundry-crime-scripts/script/`
2. Create Node.js runner in `server/scripts/run-{name}.js`
3. Add to `scriptConfigs` in `ScriptSchedulerService.js`
4. Frontend will auto-discover via `/api/scripts/available`

### Adding a New API Route

1. Create route file in `server/routes/{name}.js`
2. Import and register in `server/index.js`:
   ```javascript
   const newRoutes = require('./routes/{name}');
   app.use('/api/{name}', newRoutes);
   ```
