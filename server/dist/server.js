"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/config/env.ts
var dotenv = __toESM(require("dotenv"));
var import_envsafe = require("envsafe");
dotenv.config();
var env = (0, import_envsafe.envsafe)({
  NODE_ENV: (0, import_envsafe.str)({
    devDefault: "development",
    choices: ["development", "test", "production"]
  }),
  SERVER_PORT: (0, import_envsafe.port)({
    devDefault: 5002,
    desc: "The port the app is running on"
  }),
  API_KEY: (0, import_envsafe.str)({
    desc: "BlockadeLabs API KEY"
  })
});

// src/server.ts
var import_cors = __toESM(require("cors"));
var import_express = __toESM(require("express"));

// src/routes.ts
var express = __toESM(require("express"));
var import_multer = __toESM(require("multer"));

// src/lib/sdk.ts
var import_sdk = require("@blockadelabs/sdk");
var sdk = new import_sdk.BlockadeLabsSdk({ api_key: env.API_KEY });

// src/controllers/skybox.controller.ts
var getSkyboxStyles = async (_req, res) => {
  try {
    const skyboxStyles = await sdk.getSkyboxStyles();
    return res.status(200).json(skyboxStyles);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error retrieving skybox styles" });
  }
};
var generateSkybox = async (req, res) => {
  try {
    const { prompt, skybox_style_id, remix_imagine_id, webhook_url } = req.body;
    const generation = await sdk.generateSkybox({
      prompt,
      skybox_style_id,
      remix_id: remix_imagine_id,
      webhook_url
    });
    return res.status(200).json(generation);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error generating new skybox" });
  }
};

// src/controllers/imagine.controller.ts
var getImagineById = async (req, res) => {
  try {
    const { id } = req.query;
    const imagine = await sdk.getImagineById({ id: String(id) });
    return res.status(200).json(imagine);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error retrieving imagine" });
  }
};
var getImagineByObfuscatedId = async (req, res) => {
  try {
    const { obfuscated_id } = req.query;
    const imagine = await sdk.getImagineByObfuscatedId({
      obfuscated_id: String(obfuscated_id)
    });
    return res.status(200).json(imagine);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error retrieving imagine" });
  }
};
var getImagineHistory = async (req, res) => {
  try {
    const { status, limit, offset, order, imagine_id, query, generator } = req.query;
    const imagineHistory = await sdk.getImagineHistory({
      status: status ? String(status) : void 0,
      limit: limit ? Number(limit) : void 0,
      offset: offset ? Number(offset) : void 0,
      order: order ? String(order) : void 0,
      imagine_id: imagine_id ? Number(imagine_id) : void 0,
      query: query ? String(query) : void 0,
      generator: generator ? String(generator) : void 0
    });
    return res.status(200).json(imagineHistory);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error retrieving imagine history" });
  }
};
var cancelImagine = async (req, res) => {
  try {
    const { id } = req.query;
    await sdk.cancelImagine({
      id: String(id)
    });
    return res.status(200).json({ message: `imagine: ${id} cancelled with success!` });
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error canceling imagine" });
  }
};
var cancelAllPedingImagines = async (req, res) => {
  try {
    await sdk.cancelAllPendingImagines();
    return res.status(200).json({ message: "Pending imagines cancelled with success!" });
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error canceling pending imagines" });
  }
};
var deleteImagine = async (req, res) => {
  try {
    const { id } = req.query;
    await sdk.deleteImagine({ id: String(id) });
    return res.status(200).json({ message: `imagine: ${id} deleted with success!` });
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error deleting imagine" });
  }
};
var getGenerators = async (_req, res) => {
  try {
    const generators = await sdk.getGenerators();
    return res.status(200).json(generators);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error retrieving generators" });
  }
};
var generateImagine = async (req, res) => {
  try {
    const { prompt, style_id, options, webhook_url } = req.body;
    const generation = await sdk.generateImagine({
      generator: style_id,
      generator_data: {
        prompt,
        options,
        webhook_url
      }
    });
    return res.status(200).json(generation);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err)
      return res.status(400).json({ error: err.message });
    return res.status(400).json({ error: "Unexpected error generating imagine" });
  }
};

// src/routes.ts
var router = express.Router();
router.get("/skybox/getSkyboxStyles", getSkyboxStyles);
router.post("/skybox/generateSkybox", generateSkybox);
router.get("/imagine/getGenerators", getGenerators);
router.post("/imagine/generateImagine", (0, import_multer.default)().any(), generateImagine);
router.get("/imagine/getImagineById", getImagineById);
router.get("/imagine/getImagineByObfuscatedId", getImagineByObfuscatedId);
router.get("/imagine/getImagineHistory", getImagineHistory);
router.post("/imagine/cancelImagine", cancelImagine);
router.post("/imagine/cancelAllPedingImagines", cancelAllPedingImagines);
router.delete("/imagine/deleteImagine", deleteImagine);

// src/server.ts
var import_path = __toESM(require("path"));
var server = (0, import_express.default)();
server.use((0, import_express.json)());
var buildPath = import_path.default.resolve(process.cwd(), "client/dist");
server.use(import_express.default.static(buildPath, {
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
  }
}));
var corsOptions = {
  origin: [
    "https://in3d.evoneural.ai",
    "http://localhost:3000",
    "http://localhost:5173",
    "${apiUrl}"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};
server.use((0, import_cors.default)(corsOptions));
server.use("/api", router);
server.get("*", function(req, res) {
  const indexPath = import_path.default.join(buildPath, "index.html");
  console.log("Attempting to serve:", indexPath);
  res.sendFile(indexPath, function(err) {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(500).send(err);
    }
  });
});
server.listen(env.SERVER_PORT, async () => {
  console.log(`Server is running at port ${env.SERVER_PORT}`);
  console.log("Build path:", buildPath);
});
//# sourceMappingURL=server.js.map