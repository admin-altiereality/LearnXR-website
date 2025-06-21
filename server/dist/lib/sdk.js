"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdk = void 0;
const sdk_1 = require("@blockadelabs/sdk");
const env_1 = require("../config/env");
exports.sdk = new sdk_1.BlockadeLabsSdk({ api_key: env_1.env.API_KEY });
