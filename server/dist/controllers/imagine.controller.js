"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImagine = exports.getGenerators = exports.deleteImagine = exports.cancelAllPedingImagines = exports.cancelImagine = exports.getImagineHistory = exports.getImagineByObfuscatedId = exports.getImagineById = void 0;
const sdk_1 = require("@/lib/sdk");
const getImagineById = async (req, res) => {
    try {
        const { id } = req.query;
        const imagine = await sdk_1.sdk.getImagineById({ id: String(id) });
        return res.status(200).json(imagine);
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error retrieving imagine" });
    }
};
exports.getImagineById = getImagineById;
const getImagineByObfuscatedId = async (req, res) => {
    try {
        const { obfuscated_id } = req.query;
        const imagine = await sdk_1.sdk.getImagineByObfuscatedId({
            obfuscated_id: String(obfuscated_id),
        });
        return res.status(200).json(imagine);
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error retrieving imagine" });
    }
};
exports.getImagineByObfuscatedId = getImagineByObfuscatedId;
const getImagineHistory = async (req, res) => {
    try {
        const { status, limit, offset, order, imagine_id, query, generator } = req.query;
        const imagineHistory = await sdk_1.sdk.getImagineHistory({
            status: status ? String(status) : undefined,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
            order: order ? String(order) : undefined,
            imagine_id: imagine_id ? Number(imagine_id) : undefined,
            query: query ? String(query) : undefined,
            generator: generator ? String(generator) : undefined,
        });
        return res.status(200).json(imagineHistory);
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error retrieving imagine history" });
    }
};
exports.getImagineHistory = getImagineHistory;
const cancelImagine = async (req, res) => {
    try {
        const { id } = req.query;
        await sdk_1.sdk.cancelImagine({
            id: String(id),
        });
        return res
            .status(200)
            .json({ message: `imagine: ${id} cancelled with success!` });
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error canceling imagine" });
    }
};
exports.cancelImagine = cancelImagine;
const cancelAllPedingImagines = async (req, res) => {
    try {
        await sdk_1.sdk.cancelAllPendingImagines();
        return res
            .status(200)
            .json({ message: "Pending imagines cancelled with success!" });
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error canceling pending imagines" });
    }
};
exports.cancelAllPedingImagines = cancelAllPedingImagines;
const deleteImagine = async (req, res) => {
    try {
        const { id } = req.query;
        await sdk_1.sdk.deleteImagine({ id: String(id) });
        return res
            .status(200)
            .json({ message: `imagine: ${id} deleted with success!` });
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res.status(400).json({ error: "Unexpected error deleting imagine" });
    }
};
exports.deleteImagine = deleteImagine;
const getGenerators = async (_req, res) => {
    try {
        const generators = await sdk_1.sdk.getSkyboxStyles();
        return res.status(200).json(generators);
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error retrieving generators" });
    }
};
exports.getGenerators = getGenerators;
const generateImagine = async (req, res) => {
    try {
        const { prompt, style_id, options, webhook_url } = req.body;
        const generation = await sdk_1.sdk.generateSkybox({
            prompt,
            skybox_style_id: style_id,
            webhook_url,
            ...options
        });
        return res.status(200).json(generation);
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error generating imagine" });
    }
};
exports.generateImagine = generateImagine;
