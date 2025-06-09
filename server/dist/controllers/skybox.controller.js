"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSkybox = exports.getSkyboxStyles = void 0;
const sdk_1 = require("@/lib/sdk");
const getSkyboxStyles = async (_req, res) => {
    try {
        const skyboxStyles = await sdk_1.sdk.getSkyboxStyles();
        return res.status(200).json(skyboxStyles);
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error retrieving skybox styles" });
    }
};
exports.getSkyboxStyles = getSkyboxStyles;
const generateSkybox = async (req, res) => {
    try {
        const { prompt, skybox_style_id, remix_imagine_id, webhook_url } = req.body;
        const generation = await sdk_1.sdk.generateSkybox({
            prompt,
            skybox_style_id,
            remix_id: remix_imagine_id,
            webhook_url,
        });
        return res.status(200).json(generation);
    }
    catch (err) {
        if (err && typeof err === "object" && "message" in err)
            return res.status(400).json({ error: err.message });
        return res
            .status(400)
            .json({ error: "Unexpected error generating new skybox" });
    }
};
exports.generateSkybox = generateSkybox;
