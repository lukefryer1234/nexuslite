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
const keystoreRoutes = require('./routes/keystore');
const walletRoutes = require('./routes/wallet');
const settingsRoutes = require('./routes/settings');
const gasBalanceRoutes = require('./routes/gasBalanceApi');
const yieldRoutes = require('./routes/yieldApi');
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

// Initialize Script Scheduler Service
const schedulerService = new ScriptSchedulerService({
    io,
    logger,
    metricsCollector: null,
    registry: null
});

// API Routes
app.use('/api/keystore', keystoreRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/gas-balance', gasBalanceRoutes);
app.use('/api/yield', yieldRoutes);
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
    schedulerService.stopAll();
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    schedulerService.stopAll();
    server.close(() => {
        process.exit(0);
    });
});

// Start server
const PORT = process.env.PORT || 4001;
server.listen(PORT, () => {
    logger.info(`Nexus Lite server running on port ${PORT}`);
    logger.info(`Foundry bin: ${process.env.FOUNDRY_BIN}`);
    logger.info(`Keystore path: ${process.env.KEYSTORE_PATH}`);
});
