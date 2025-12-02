import * as express from "express";
import multer from "multer";
import skyboxRouter from "./routes/skybox";

import {
    cancelAllPedingImagines,
    cancelImagine,
    deleteImagine,
    generateImagine,
    getGenerators,
    getImagineById,
    getImagineByObfuscatedId,
    getImagineHistory,
} from "./controllers/imagine.controller";



const router = express.Router();

// Mount skybox routes
router.use("/skybox", skyboxRouter);


// Imagine routes
router.get("/imagine/getGenerators", getGenerators);
router.post("/imagine/generateImagine", multer().any(), generateImagine);
router.get("/imagine/getImagineById", getImagineById);
router.get("/imagine/getImagineByObfuscatedId", getImagineByObfuscatedId);
router.get("/imagine/getImagineHistory", getImagineHistory);
router.post("/imagine/cancelImagine", cancelImagine);
router.post("/imagine/cancelAllPedingImagines", cancelAllPedingImagines);
router.delete("/imagine/deleteImagine", deleteImagine);

export { router };
