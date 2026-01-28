/**
 * Script Routes for Nexus Lite
 * Handles automation script start/stop/status/logs
 */

const express = require('express');
const globalPasswordManager = require('../config/GlobalPasswordManager');

function createScriptRoutes(schedulerService) {
    const router = express.Router();
    
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
