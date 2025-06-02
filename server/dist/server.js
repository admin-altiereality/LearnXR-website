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
var import_express2 = __toESM(require("express"));

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
var import_path2 = __toESM(require("path"));

// src/config/firebase-admin.ts
var admin = __toESM(require("firebase-admin"));
var import_firestore = require("firebase-admin/firestore");
var import_dotenv = __toESM(require("dotenv"));
var import_path = __toESM(require("path"));
var envPath = import_path.default.resolve(process.cwd(), ".env");
console.log("Loading .env file from:", envPath);
import_dotenv.default.config({ path: envPath });
console.log("Environment variables check:");
console.log("FIREBASE_PROJECT_ID exists:", !!process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_CLIENT_EMAIL exists:", !!process.env.FIREBASE_CLIENT_EMAIL);
console.log("FIREBASE_PRIVATE_KEY exists:", !!process.env.FIREBASE_PRIVATE_KEY);
var requiredEnvVars = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Contents of ${envPath}:`, require("fs").readFileSync(envPath, "utf8"));
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
var _a;
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (_a = process.env.FIREBASE_PRIVATE_KEY) == null ? void 0 : _a.replace(/\\n/g, "\n")
      })
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw error;
  }
}
var db = (0, import_firestore.getFirestore)();

// src/routes/payment.ts
var import_express = require("express");
var import_crypto = __toESM(require("crypto"));
var admin2 = __toESM(require("firebase-admin"));
var import_razorpay = __toESM(require("razorpay"));
var router2 = (0, import_express.Router)();
var initializeRazorpay = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be provided in environment variables");
  }
  return new import_razorpay.default({
    key_id,
    key_secret
  });
};
var razorpay;
try {
  razorpay = initializeRazorpay();
  console.log("Razorpay initialized successfully");
} catch (error) {
  console.error("Failed to initialize Razorpay:", error);
  throw error;
}
router2.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", planId } = req.body;
    if (!amount || !planId) {
      return res.status(400).json({
        status: "error",
        message: "Amount and plan ID are required"
      });
    }
    const options = {
      amount,
      currency,
      receipt: `order_${Date.now()}`,
      notes: {
        planId
      }
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to create order"
    });
  }
});
router2.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      userId,
      planId
    } = req.body;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      throw new Error("Razorpay key secret not configured");
    }
    const generated_signature = import_crypto.default.createHmac("sha256", key_secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (generated_signature === razorpay_signature) {
      const subscriptionRef = db.collection("subscriptions").doc(userId);
      const subscriptionDoc = await subscriptionRef.get();
      const subscriptionData = {
        planId,
        status: "active",
        updatedAt: admin2.firestore.FieldValue.serverTimestamp(),
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      };
      if (subscriptionDoc.exists) {
        await subscriptionRef.update(subscriptionData);
      } else {
        await subscriptionRef.set({
          ...subscriptionData,
          createdAt: admin2.firestore.FieldValue.serverTimestamp(),
          userId
        });
      }
      res.json({
        status: "success",
        message: "Payment verified successfully"
      });
    } else {
      res.status(400).json({
        status: "error",
        message: "Invalid payment signature"
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Payment verification failed"
    });
  }
});
var payment_default = router2;

// src/server.ts
var server = (0, import_express2.default)();
server.use((0, import_express2.json)());
var buildPath = import_path2.default.resolve(process.cwd(), "client/dist");
server.use(import_express2.default.static(buildPath, {
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
server.use("/api", payment_default);
server.get("*", function(req, res) {
  const indexPath = import_path2.default.join(buildPath, "index.html");
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