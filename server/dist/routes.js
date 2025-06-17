"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express = __importStar(require("express"));
const multer_1 = __importDefault(require("multer"));
const skybox_controller_1 = require("@/controllers/skybox.controller");
const imagine_controller_1 = require("@/controllers/imagine.controller");
const router = express.Router();
exports.router = router;
router.get("/skybox/getSkyboxStyles", skybox_controller_1.getSkyboxStyles);
router.post("/skybox/generateSkybox", skybox_controller_1.generateSkybox);
router.get("/imagine/getGenerators", imagine_controller_1.getGenerators);
// Using multer here to proccess multipart files
router.post("/imagine/generateImagine", (0, multer_1.default)().any(), imagine_controller_1.generateImagine);
router.get("/imagine/getImagineById", imagine_controller_1.getImagineById);
router.get("/imagine/getImagineByObfuscatedId", imagine_controller_1.getImagineByObfuscatedId);
router.get("/imagine/getImagineHistory", imagine_controller_1.getImagineHistory);
router.post("/imagine/cancelImagine", imagine_controller_1.cancelImagine);
router.post("/imagine/cancelAllPedingImagines", imagine_controller_1.cancelAllPedingImagines);
router.delete("/imagine/deleteImagine", imagine_controller_1.deleteImagine);
