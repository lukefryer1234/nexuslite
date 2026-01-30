/**
 * Script Routes for Nexus Lite
 * Handles automation script start/stop/status/logs
 */

const express = require('express');
const globalPasswordManager = require('../config/GlobalPasswordManager');
const CrimeAnalyticsService = require('../services/CrimeAnalyticsService');

// Create shared analytics instance
const crimeAnalytics = new CrimeAnalyticsService();

function createScriptRoutes(schedulerService) {
    const router = express.Router();
    
    // Inject analytics into scheduler for tracking
    schedulerService.crimeAnalytics = crimeAnalytics;
    
    // Helper to get effective password (from request or global unlock)
    const getEffectivePassword = (password) => {
        return password || globalPasswordManager.masterPassword;
    };

    // Get available scripts
    router.get('/available', (req, res) => {
        res.json({
            scripts: [
                { name: 'crime', displayName: 'Crime Loop', icon: '🔫', cooldownMinutes: 16 },
                { name: 'nickcar', displayName: 'Nick Car', icon: '🚗', cooldownMinutes: 31 },
                { name: 'killskill', displayName: 'Kill Skill', icon: '🎯', cooldownMinutes: 46 },
                { name: 'travel', displayName: 'Travel', icon: '✈️', cooldownMinutes: 65 }
            ]
        });
    });

    // ===== CRIME ENDPOINTS =====
    router.post('/crime/start', (req, res) => {
        const { chain, keystore, password, walletId, crimeType = 0 } = req.body;
        const effectivePassword = getEffectivePassword(password);
        const result = schedulerService.start('crime', chain, { walletId, keystore, password: effectivePassword, crimeType });
        if (result.success) {
            res.json({ success: true, chain, walletId: result.walletId, cooldownMinutes: result.cooldownMinutes });
        } else {
            res.status(400).json({ error: result.error });
        }
    });

    router.post('/crime/stop', (req, res) => {
        const { chain, walletId } = req.body;
        res.json(schedulerService.stop('crime', chain, walletId));
    });

    router.get('/crime/status', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getStatus('crime', chain, walletId));
    });

    router.get('/crime/logs', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getLogs('crime', chain, walletId));
    });

    // Crime Analytics endpoints
    router.get('/crime/analytics', (req, res) => {
        res.json(crimeAnalytics.getAnalytics());
    });

    router.get('/crime/recommendation', (req, res) => {
        res.json(crimeAnalytics.getRecommendation());
    });

    // Record crime attempt from external scripts (PM2)
    router.post('/crime/record', (req, res) => {
        const { wallet, chain, crimeType = 0, success, jailed, cooldown, output, error } = req.body;
        
        // Build log text for the analytics service
        let logText = '';
        if (success) {
            logText = `${chain} makeCrime (crimeType: ${crimeType}) executed successfully for ${wallet}`;
        } else if (jailed) {
            logText = `${chain} makeCrime failed for ${wallet}: jail`;
        } else if (cooldown) {
            logText = `${chain} makeCrime failed for ${wallet}: cooldown`;
        } else {
            logText = `${chain} makeCrime failed for ${wallet}: ${error || 'unknown'}`;
        }
        
        crimeAnalytics.recordCrimeAttempt({ text: logText }, crimeType);
        res.json({ success: true, recorded: { wallet, chain, crimeType, success: !!success } });
    });

    router.post('/crime/analytics/reset', (req, res) => {
        crimeAnalytics.reset();
        res.json({ success: true, message: 'Crime analytics reset' });
    });

    // ===== NICKCAR ENDPOINTS =====
    router.post('/nickcar/start', (req, res) => {
        const { chain, keystore, password, walletId } = req.body;
        const effectivePassword = getEffectivePassword(password);
        const result = schedulerService.start('nickcar', chain, { walletId, keystore, password: effectivePassword });
        if (result.success) {
            res.json({ success: true, chain, walletId: result.walletId, cooldownMinutes: result.cooldownMinutes });
        } else {
            res.status(400).json({ error: result.error });
        }
    });

    router.post('/nickcar/stop', (req, res) => {
        const { chain, walletId } = req.body;
        res.json(schedulerService.stop('nickcar', chain, walletId));
    });

    router.get('/nickcar/status', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getStatus('nickcar', chain, walletId));
    });

    router.get('/nickcar/logs', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getLogs('nickcar', chain, walletId));
    });

    // ===== KILLSKILL ENDPOINTS =====
    router.post('/killskill/start', (req, res) => {
        const { chain, keystore, password, walletId, trainType = 0 } = req.body;
        const effectivePassword = getEffectivePassword(password);
        const result = schedulerService.start('killskill', chain, { walletId, keystore, password: effectivePassword, trainType });
        if (result.success) {
            res.json({ success: true, chain, walletId: result.walletId, cooldownMinutes: result.cooldownMinutes });
        } else {
            res.status(400).json({ error: result.error });
        }
    });

    router.post('/killskill/stop', (req, res) => {
        const { chain, walletId } = req.body;
        res.json(schedulerService.stop('killskill', chain, walletId));
    });

    router.get('/killskill/status', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getStatus('killskill', chain, walletId));
    });

    router.get('/killskill/logs', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getLogs('killskill', chain, walletId));
    });

    // ===== TRAVEL ENDPOINTS =====
    router.post('/travel/start', (req, res) => {
        const { chain, keystore, password, walletId, startCity, endCity, travelType } = req.body;
        const effectivePassword = getEffectivePassword(password);
        const result = schedulerService.start('travel', chain, { walletId, keystore, password: effectivePassword, startCity, endCity, travelType });
        if (result.success) {
            res.json({ success: true, chain, walletId: result.walletId, cooldownMinutes: result.cooldownMinutes });
        } else {
            res.status(400).json({ error: result.error });
        }
    });

    router.post('/travel/stop', (req, res) => {
        const { chain, walletId } = req.body;
        res.json(schedulerService.stop('travel', chain, walletId));
    });

    router.get('/travel/status', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getStatus('travel', chain, walletId));
    });

    router.get('/travel/logs', (req, res) => {
        const { chain, walletId } = req.query;
        res.json(schedulerService.getLogs('travel', chain, walletId));
    });

    // ===== COMBINED ENDPOINTS =====
    router.get('/all/status', (req, res) => {
        res.json(schedulerService.getAllStatus());
    });

    return router;
}

module.exports = { createScriptRoutes };
