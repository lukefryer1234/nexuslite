/**
 * Nexus Lite - Standalone Automation Scripts Application
 * Extracted from Bot Nexus for focused script automation with wallet management
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const Logger = require('./config/Logger');
const ScriptSchedulerService = require('./services/ScriptSchedulerService');
const KeystoreSyncService = require('./services/KeystoreSyncService');
const globalLogService = require('./services/GlobalLogService');
const globalPasswordManager = require('./config/GlobalPasswordManager');
const keystoreRoutes = require('./routes/keystore');
const walletRoutes = require('./routes/wallet');
const settingsRoutes = require('./routes/settings');
const gasBalanceRoutes = require('./routes/gasBalanceApi');
const yieldRoutes = require('./routes/yieldApi');
const gameRoutes = require('./routes/gameApi');
const { createScriptRoutes } = require('./routes/scripts');
const { createLegacyRoutes } = require('./routes/legacy');

const logger = new Logger('Server');

// Create Express app
const app = express();
const server = http.createServer(app);

// Socket.io for real-time logs
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

// Initialize Global Log Service with Socket.io
globalLogService.init(io);

// Initialize Script Scheduler Service
const schedulerService = new ScriptSchedulerService({
    io,
    logger,
    metricsCollector: null,
    registry: null
});

// Initialize Keystore Sync Service (auto-syncs from Foundry, watches for new wallets, auto-starts scripts)
const keystoreSyncService = new KeystoreSyncService({
    schedulerService,
    globalPasswordManager,
    logger,
    io
});

// API Routes
app.use('/api/keystore', keystoreRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/gas-balance', gasBalanceRoutes);
app.use('/api/yield', yieldRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/scripts', createScriptRoutes(schedulerService));
app.use('/api', createLegacyRoutes(schedulerService));

// Serve static files from client build
const path = require('path');
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// Fallback to index.html for SPA routes (must be after API routes)
app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Logs API endpoint
app.get('/api/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level || null;
    const logs = globalLogService.getLogs(limit, level);
    res.json({ success: true, logs, count: logs.length });
});

app.delete('/api/logs', (req, res) => {
    globalLogService.clear();
    res.json({ success: true, message: 'Logs cleared' });
});

// Restart endpoint - gracefully shutdown, systemd will restart
app.post('/api/restart', (req, res) => {
    logger.info('Restart requested via API');
    res.json({ success: true, message: 'Server restarting...' });
    
    // Give response time to send, then gracefully shutdown
    setTimeout(() => {
        schedulerService.stopAll();
        server.close(() => {
            process.exit(0);
        });
        // Force exit if close hangs
        setTimeout(() => process.exit(0), 2000);
    }, 500);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    socket.on('disconnect', () => {
        logger.info('Client disconnected', { socketId: socket.id });
    });

    // Subscribe to script logs
    socket.on('subscribe', (data) => {
        const { scriptType, chain, walletId } = data;
        const room = `${scriptType}-${chain}-${walletId || 'default'}`;
        socket.join(room);
        logger.debug('Subscribed to room', { room });
    });

    socket.on('unsubscribe', (data) => {
        const { scriptType, chain, walletId } = data;
        const room = `${scriptType}-${chain}-${walletId || 'default'}`;
        socket.leave(room);
    });
});

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    keystoreSyncService.stop();
    schedulerService.stopAll();
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    keystoreSyncService.stop();
    schedulerService.stopAll();
    server.close(() => {
        process.exit(0);
    });
});

// Start server
const PORT = process.env.PORT || 4001;
server.listen(PORT, async () => {
    logger.info(`Nexus Lite server running on port ${PORT}`);
    logger.info(`Foundry bin: ${process.env.FOUNDRY_BIN}`);
    logger.info(`Keystore path: ${process.env.KEYSTORE_PATH}`);
    
    // Initialize keystore sync - syncs from Foundry, watches for new wallets, auto-starts scripts
    logger.info('Initializing keystore sync service...');
    
    // Wait a bit for password unlock, then initialize
    setTimeout(async () => {
        try {
            await keystoreSyncService.initialize();
            
            // Start all scripts for all known keystores after initialization
            if (globalPasswordManager.isUnlocked) {
                const keystores = keystoreSyncService.getKeystores();
                for (const keystore of keystores) {
                    await keystoreSyncService.startScriptsForWallet(keystore);
                }
                logger.info('All scripts started for all keystores', { count: keystores.length });
            } else {
                logger.warn('Password not unlocked - scripts will start when new keystores are detected');
            }
        } catch (err) {
            logger.error('Error initializing keystore sync', { error: err.message });
        }
    }, 5000);
});
