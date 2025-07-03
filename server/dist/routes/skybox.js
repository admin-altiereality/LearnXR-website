"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const skybox_controller_1 = require("../controllers/skybox.controller");
const router = (0, express_1.Router)();
// Modern API endpoints
router.get('/styles', skybox_controller_1.getSkyboxStyles);
router.post('/generate', skybox_controller_1.generateSkybox);
router.get('/status/:generationId', skybox_controller_1.getGenerationStatus);
router.get('/health', skybox_controller_1.healthCheck);
router.delete('/cache', skybox_controller_1.clearCache);
// Legacy endpoints for backward compatibility
router.get('/getSkyboxStyles', skybox_controller_1.getSkyboxStylesLegacy);
router.post('/generateSkybox', skybox_controller_1.generateSkyboxLegacy);
exports.default = router;
