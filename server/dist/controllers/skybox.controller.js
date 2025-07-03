"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserSkyboxes = exports.generateSkyboxLegacy = exports.getSkyboxStylesLegacy = exports.clearCache = exports.healthCheck = exports.getGenerationStatus = exports.generateSkybox = exports.getSkyboxStyles = void 0;
const skyboxService_1 = require("../services/skyboxService");
/**
 * Get skybox styles with pagination
 * GET /api/skybox/styles
 */
const getSkyboxStyles = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        console.log(`Skybox API: GET /styles - page: ${page}, limit: ${limit}`);
        const result = await skyboxService_1.skyboxService.getSkyboxStyles(page, limit);
        const response = {
            success: true,
            data: {
                styles: result.styles
            },
            message: `Retrieved ${result.styles.length} skybox styles`,
            pagination: result.pagination
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Skybox API Error - getSkyboxStyles:', error);
        const response = {
            success: false,
            error: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch skybox styles'
        };
        res.status(400).json(response);
    }
};
exports.getSkyboxStyles = getSkyboxStyles;
/**
 * Generate a new skybox
 * POST /api/skybox/generate
 */
const generateSkybox = async (req, res) => {
    try {
        const { prompt, skybox_style_id, remix_imagine_id, webhook_url, negative_text } = req.body;
        console.log(`Skybox API: POST /generate - style_id: ${skybox_style_id}`);
        // Validate required fields
        if (!prompt || !skybox_style_id) {
            const response = {
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Missing required fields: prompt and skybox_style_id are required'
            };
            return res.status(400).json(response);
        }
        const request = {
            prompt: prompt.trim(),
            skybox_style_id: parseInt(skybox_style_id),
            remix_imagine_id,
            webhook_url,
            negative_text
        };
        const generation = await skyboxService_1.skyboxService.generateSkybox(request);
        const response = {
            success: true,
            data: {
                id: generation.id.toString(),
                status: generation.status
            },
            message: 'Skybox generation initiated successfully'
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Skybox API Error - generateSkybox:', error);
        const response = {
            success: false,
            error: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to generate skybox'
        };
        res.status(400).json(response);
    }
};
exports.generateSkybox = generateSkybox;
/**
 * Get generation status by ID
 * GET /api/skybox/status/:generationId
 */
const getGenerationStatus = async (req, res) => {
    try {
        const { generationId } = req.params;
        console.log(`Skybox API: GET /status/${generationId}`);
        if (!generationId) {
            const response = {
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Valid generation ID is required'
            };
            return res.status(400).json(response);
        }
        const status = await skyboxService_1.skyboxService.getGenerationStatus(generationId);
        const response = {
            success: true,
            data: status,
            message: `Generation status: ${status.status}`
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Skybox API Error - getGenerationStatus:', error);
        const response = {
            success: false,
            error: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get generation status'
        };
        res.status(400).json(response);
    }
};
exports.getGenerationStatus = getGenerationStatus;
/**
 * Health check endpoint
 * GET /api/skybox/health
 */
const healthCheck = async (req, res) => {
    try {
        console.log('Skybox API: GET /health');
        const health = await skyboxService_1.skyboxService.healthCheck();
        const response = {
            success: health.status === 'healthy',
            data: {
                status: health.status,
                message: health.message,
                details: health.details
            },
            message: health.message
        };
        res.status(health.status === 'healthy' ? 200 : 503).json(response);
    }
    catch (error) {
        console.error('Skybox API Error - healthCheck:', error);
        const response = {
            success: false,
            error: 'SERVICE_ERROR',
            message: 'Health check failed'
        };
        res.status(503).json(response);
    }
};
exports.healthCheck = healthCheck;
/**
 * Clear cache endpoint
 * DELETE /api/skybox/cache
 */
const clearCache = async (req, res) => {
    try {
        console.log('Skybox API: DELETE /cache');
        skyboxService_1.skyboxService.clearCache();
        const response = {
            success: true,
            message: 'Cache cleared successfully'
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Skybox API Error - clearCache:', error);
        const response = {
            success: false,
            error: 'SERVICE_ERROR',
            message: 'Failed to clear cache'
        };
        res.status(500).json(response);
    }
};
exports.clearCache = clearCache;
/**
 * Legacy endpoint for backward compatibility
 * GET /api/skybox/getSkyboxStyles
 */
const getSkyboxStylesLegacy = async (req, res) => {
    try {
        console.log('Skybox API: GET /getSkyboxStyles (legacy)');
        const result = await skyboxService_1.skyboxService.getSkyboxStyles(1, 100); // Get all styles for legacy compatibility
        const response = {
            success: true,
            data: {
                styles: result.styles
            },
            message: `Retrieved ${result.styles.length} skybox styles`
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Skybox API Error - getSkyboxStylesLegacy:', error);
        const response = {
            success: false,
            error: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch skybox styles'
        };
        res.status(400).json(response);
    }
};
exports.getSkyboxStylesLegacy = getSkyboxStylesLegacy;
/**
 * Legacy endpoint for backward compatibility
 * POST /api/skybox/generateSkybox
 */
const generateSkyboxLegacy = async (req, res) => {
    try {
        const { prompt, skybox_style_id, remix_imagine_id, webhook_url } = req.body;
        console.log(`Skybox API: POST /generateSkybox (legacy) - style_id: ${skybox_style_id}`);
        // Validate required fields
        if (!prompt || !skybox_style_id) {
            const response = {
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Missing required fields: prompt and skybox_style_id are required'
            };
            return res.status(400).json(response);
        }
        const request = {
            prompt: prompt.trim(),
            skybox_style_id: parseInt(skybox_style_id),
            remix_imagine_id,
            webhook_url
        };
        const generation = await skyboxService_1.skyboxService.generateSkybox(request);
        const response = {
            success: true,
            data: generation,
            message: 'Skybox generation initiated successfully'
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Skybox API Error - generateSkyboxLegacy:', error);
        const response = {
            success: false,
            error: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to generate skybox'
        };
        res.status(400).json(response);
    }
};
exports.generateSkyboxLegacy = generateSkyboxLegacy;
/**
 * Get user skyboxes with pagination
 * GET /api/skybox/user
 */
const getUserSkyboxes = async (req, res) => {
    try {
        // In a real implementation, you would fetch from your DB or service
        // For now, return an empty array and mock pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const data = [];
        const pagination = {
            page,
            limit,
            total: 0,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
        };
        res.status(200).json({ success: true, data: { data, pagination } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Failed to fetch user skyboxes' });
    }
};
exports.getUserSkyboxes = getUserSkyboxes;
