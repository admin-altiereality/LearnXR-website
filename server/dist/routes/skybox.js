"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdk_1 = require("@blockadelabs/sdk");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
const sdk = new sdk_1.BlockadeLabsSdk({ api_key: env_1.env.API_KEY });
// Get skybox styles with pagination
router.get('/getSkyboxStyles', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skyboxStyles = await sdk.getSkyboxStyles();
        // Calculate pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedStyles = skyboxStyles.slice(startIndex, endIndex);
        const hasMore = endIndex < skyboxStyles.length;
        res.json({
            styles: paginatedStyles,
            hasMore,
            total: skyboxStyles.length
        });
    }
    catch (error) {
        console.error('Error fetching skybox styles:', error);
        res.status(500).json({ error: 'Failed to fetch skybox styles' });
    }
});
// Generate skybox
router.post('/generateSkybox', async (req, res) => {
    try {
        const { prompt, skybox_style_id, remix_imagine_id, webhook_url } = req.body;
        const generation = await sdk.generateSkybox({
            prompt,
            skybox_style_id,
            remix_id: remix_imagine_id,
            webhook_url,
        });
        return res.status(200).json(generation);
    }
    catch (error) {
        console.error('Error generating skybox:', error);
        return res.status(500).json({ error: 'Failed to generate skybox' });
    }
});
exports.default = router;
