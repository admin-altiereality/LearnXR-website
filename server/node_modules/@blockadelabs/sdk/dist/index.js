"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  BlockadeLabsSdk: () => BlockadeLabsSdk
});
module.exports = __toCommonJS(src_exports);
var import_axios2 = require("axios");
var import_form_data = __toESM(require("form-data"));

// src/services/api.ts
var import_axios = __toESM(require("axios"));
var prodApi = import_axios.default.create({
  baseURL: "https://backend.blockadelabs.com/api/v1"
});
var stagingApi = import_axios.default.create({
  baseURL: "https://backend-staging.blockadelabs.com/api/v1"
});

// src/schemas/skybox.ts
var import_zod = require("zod");
var getSkyboxStylesResponse = import_zod.z.array(
  import_zod.z.object({
    id: import_zod.z.number(),
    name: import_zod.z.string(),
    "max-char": import_zod.z.string(),
    image: import_zod.z.string().or(import_zod.z.null()),
    sort_order: import_zod.z.number()
  })
);
var generateSkyboxRequest = import_zod.z.object({
  prompt: import_zod.z.string(),
  negative_text: import_zod.z.string().optional(),
  enhance_prompt: import_zod.z.boolean().optional(),
  seed: import_zod.z.number().optional(),
  skybox_style_id: import_zod.z.number().optional(),
  remix_id: import_zod.z.number().optional(),
  remix_obfuscated_id: import_zod.z.string().optional(),
  control_image: import_zod.z.any().optional(),
  control_model: import_zod.z.string().optional(),
  return_depth: import_zod.z.boolean().optional(),
  webhook_url: import_zod.z.string().optional()
});
var generateSkyboxResponse = import_zod.z.object({
  id: import_zod.z.number(),
  skybox_style_id: import_zod.z.number(),
  skybox_style_name: import_zod.z.string(),
  status: import_zod.z.string(),
  type: import_zod.z.string(),
  queue_position: import_zod.z.number(),
  file_url: import_zod.z.string(),
  thumb_url: import_zod.z.string(),
  title: import_zod.z.string(),
  user_id: import_zod.z.number(),
  username: import_zod.z.string(),
  // TODO: find this type here
  error_message: import_zod.z.null().or(import_zod.z.any()),
  obfuscated_id: import_zod.z.string(),
  pusher_channel: import_zod.z.string(),
  pusher_event: import_zod.z.string(),
  created_at: import_zod.z.string().or(import_zod.z.date()),
  updated_at: import_zod.z.string().or(import_zod.z.date()),
  // Non documented data
  skybox_id: import_zod.z.number().optional(),
  skybox_name: import_zod.z.string().optional(),
  prompt: import_zod.z.string().optional(),
  seed: import_zod.z.number().optional(),
  negative_text: import_zod.z.string().optional(),
  depth_map_url: import_zod.z.string().optional(),
  remix_imagine_id: import_zod.z.string().or(import_zod.z.number()).nullish()
});

// src/schemas/imagine.ts
var import_zod2 = require("zod");
var getImagineByIdRequest = import_zod2.z.object({
  id: import_zod2.z.string().or(import_zod2.z.number())
});
var getImagineByIdResponse = import_zod2.z.object({
  id: import_zod2.z.number(),
  obfuscated_id: import_zod2.z.string(),
  user_id: import_zod2.z.number(),
  username: import_zod2.z.string(),
  status: import_zod2.z.string(),
  queue_position: import_zod2.z.number(),
  pusher_channel: import_zod2.z.string(),
  pusher_event: import_zod2.z.string(),
  // TODO: find this type here
  error_message: import_zod2.z.null().or(import_zod2.z.any()),
  type: import_zod2.z.string(),
  title: import_zod2.z.string(),
  prompt: import_zod2.z.string().optional(),
  seed: import_zod2.z.number().optional(),
  skybox_style_id: import_zod2.z.number().optional(),
  skybox_style_name: import_zod2.z.string().optional(),
  file_url: import_zod2.z.string(),
  thumb_url: import_zod2.z.string(),
  depth_map_url: import_zod2.z.string().optional(),
  created_at: import_zod2.z.string().or(import_zod2.z.date()),
  updated_at: import_zod2.z.string().or(import_zod2.z.date()),
  dispatched_at: import_zod2.z.string().or(import_zod2.z.date()),
  processing_at: import_zod2.z.string().or(import_zod2.z.date()),
  completed_at: import_zod2.z.string().or(import_zod2.z.date())
});
var getImagineByObfuscatedIdRequest = import_zod2.z.object({
  obfuscated_id: import_zod2.z.string().or(import_zod2.z.number())
});
var getImagineByObfuscatedIdResponse = import_zod2.z.object({
  id: import_zod2.z.number(),
  obfuscated_id: import_zod2.z.string(),
  user_id: import_zod2.z.number(),
  username: import_zod2.z.string(),
  status: import_zod2.z.string(),
  queue_position: import_zod2.z.number(),
  pusher_channel: import_zod2.z.string(),
  pusher_event: import_zod2.z.string(),
  // TODO: find this type here
  error_message: import_zod2.z.null().or(import_zod2.z.any()),
  type: import_zod2.z.string(),
  title: import_zod2.z.string(),
  prompt: import_zod2.z.string().optional(),
  seed: import_zod2.z.number().optional(),
  skybox_style_id: import_zod2.z.number().optional(),
  skybox_style_name: import_zod2.z.string().optional(),
  file_url: import_zod2.z.string(),
  thumb_url: import_zod2.z.string(),
  depth_map_url: import_zod2.z.string().optional(),
  created_at: import_zod2.z.string().or(import_zod2.z.date()),
  updated_at: import_zod2.z.string().or(import_zod2.z.date()),
  dispatched_at: import_zod2.z.string().or(import_zod2.z.date()),
  processing_at: import_zod2.z.string().or(import_zod2.z.date()),
  completed_at: import_zod2.z.string().or(import_zod2.z.date())
});
var getImagineHistoryRequest = import_zod2.z.object({
  status: import_zod2.z.string(),
  limit: import_zod2.z.number(),
  offset: import_zod2.z.number(),
  order: import_zod2.z.literal("ASC").or(import_zod2.z.literal("DESC")),
  imagine_id: import_zod2.z.number(),
  query: import_zod2.z.string(),
  generator: import_zod2.z.string()
}).partial().optional();
var getImagineHistoryResponse = import_zod2.z.object({
  data: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.number(),
      obfuscated_id: import_zod2.z.string(),
      user_id: import_zod2.z.number(),
      username: import_zod2.z.string(),
      status: import_zod2.z.string(),
      queue_position: import_zod2.z.number(),
      pusher_channel: import_zod2.z.string(),
      pusher_event: import_zod2.z.string(),
      error_message: import_zod2.z.null().or(import_zod2.z.any()),
      type: import_zod2.z.string(),
      title: import_zod2.z.string(),
      prompt: import_zod2.z.string().optional(),
      seed: import_zod2.z.number().optional(),
      skybox_style_id: import_zod2.z.number().optional(),
      skybox_style_name: import_zod2.z.string().optional(),
      file_url: import_zod2.z.string(),
      thumb_url: import_zod2.z.string(),
      depth_map_url: import_zod2.z.string().optional(),
      created_at: import_zod2.z.string().or(import_zod2.z.date()),
      updated_at: import_zod2.z.string().or(import_zod2.z.date()),
      dispatched_at: import_zod2.z.string().or(import_zod2.z.date()),
      processing_at: import_zod2.z.string().or(import_zod2.z.date()),
      completed_at: import_zod2.z.string().or(import_zod2.z.date())
    })
  ),
  totalCount: import_zod2.z.number(),
  has_more: import_zod2.z.boolean()
});
var cancelImagineRequest = import_zod2.z.object({
  id: import_zod2.z.string().or(import_zod2.z.number())
});
var cancelImagineResponse = import_zod2.z.object({ success: import_zod2.z.boolean() });
var cancelAllPendingImaginesResponse = import_zod2.z.object({ success: import_zod2.z.boolean() });
var deleteImagineRequest = import_zod2.z.object({
  id: import_zod2.z.string().or(import_zod2.z.number())
});
var deleteImagineResponse = import_zod2.z.object({ success: import_zod2.z.string(), id: import_zod2.z.string() });

// src/utils/error.ts
var InternalError = class {
  constructor(message) {
    this.message = message;
  }
};

// src/index.ts
var BlockadeLabsSdk = class {
  constructor({ api_key }) {
    this.api = prodApi;
    this.api_key = api_key;
  }
  async getSkyboxStyles() {
    try {
      const { data } = await this.api.get(`/skybox/styles?api_key=${this.api_key}`);
      return data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError("Unexpected error retrieving skybox styles");
    }
  }
  async generateSkybox(input) {
    try {
      const inputData = generateSkyboxRequest.passthrough().parse(input);
      const {
        prompt,
        negative_text,
        enhance_prompt,
        seed,
        skybox_style_id,
        remix_id,
        remix_obfuscated_id,
        control_image,
        control_model,
        return_depth,
        webhook_url,
        ...rest
      } = inputData;
      const restData = Object.entries({ ...rest });
      const formData = new import_form_data.default();
      formData.append("api_key", this.api_key);
      formData.append("prompt", prompt);
      if (skybox_style_id)
        formData.append("skybox_style_id", skybox_style_id);
      if (negative_text)
        formData.append("negative_text", negative_text);
      if (enhance_prompt)
        formData.append("enhance_prompt", String(enhance_prompt));
      if (seed)
        formData.append("seed", seed);
      if (remix_id)
        formData.append("remix_imagine_id", remix_id);
      if (remix_obfuscated_id)
        formData.append("remix_imagine_obfuscated_id", remix_obfuscated_id);
      if (control_image) {
        if (typeof control_image === "string") {
          formData.append("control_image", control_image);
        }
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(control_image)) {
          formData.append("control_image", control_image, {
            filename: "control_image",
            contentType: "application/octet-stream"
          });
        }
        if (control_image instanceof Uint8Array) {
          if (typeof window !== "undefined") {
            const blob = new Blob([control_image], { type: "application/octet-stream" });
            formData.append("control_image", blob, "control_image");
          } else {
            const buffer = Buffer.from(control_image);
            formData.append("control_image", buffer, {
              filename: "control_image",
              contentType: "application/octet-stream"
            });
          }
        }
        if (typeof window !== "undefined" && control_image instanceof Blob) {
          formData.append("control_image", control_image, "control_image");
        }
      }
      if (control_model)
        formData.append("control_model", control_model);
      if (return_depth)
        formData.append("return_depth", return_depth);
      if (webhook_url)
        formData.append("webhook_url", webhook_url);
      restData.map(([key, value]) => {
        formData.append(key, String(value));
      });
      const { data } = await this.api.post("/skybox", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (data.error) {
        throw new InternalError(`${data.error}`);
      }
      return data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError("Unexpected error generating new skybox");
    }
  }
  async getImagineById(input) {
    try {
      const requestValidator = getImagineByIdRequest.safeParse(input);
      if (requestValidator.success === false) {
        throw new InternalError(requestValidator.error.message);
      }
      const { id } = requestValidator.data;
      const { data } = await this.api.get(`/imagine/requests/${id}?api_key=${this.api_key}`);
      if (data.error) {
        throw new InternalError(`${data.error}`);
      }
      return data.request ? data.request : data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError(`Unexpected error retrieving imagine: ${input.id}`);
    }
  }
  async getImagineByObfuscatedId(input) {
    try {
      const requestValidator = getImagineByObfuscatedIdRequest.safeParse(input);
      if (requestValidator.success === false) {
        throw new InternalError(requestValidator.error.message);
      }
      const { obfuscated_id } = requestValidator.data;
      const { data } = await this.api.get(`/imagine/requests/obfuscated-id/${obfuscated_id}?api_key=${this.api_key}`);
      if (data.error) {
        throw new InternalError(`${data.error}`);
      }
      return data.request ? data.request : data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError(`Unexpected error retrieving imagine: ${input.obfuscated_id}`);
    }
  }
  async getImagineHistory(input) {
    try {
      const requestValidator = getImagineHistoryRequest.safeParse(input);
      if (requestValidator.success === false) {
        throw new InternalError(requestValidator.error.message);
      }
      const url = (() => {
        if (requestValidator.data) {
          const searchParams = new URLSearchParams();
          Object.entries(requestValidator.data).map(([key, value]) => {
            if (value) {
              searchParams.append(key, String(value));
            }
          });
          return `/imagine/myRequests?api_key=${this.api_key}&${searchParams.toString()}`;
        }
        return `/imagine/myRequests?api_key=${this.api_key}`;
      })();
      const { data } = await this.api.get(url);
      return data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError("Unexpected error retrieving imagine history");
    }
  }
  async cancelImagine(input) {
    try {
      const requestValidator = cancelImagineRequest.safeParse(input);
      if (requestValidator.success === false) {
        throw new InternalError(requestValidator.error.message);
      }
      const { id } = requestValidator.data;
      const { data } = await this.api.delete(`/imagine/requests/${id}?api_key=${this.api_key}`);
      if (data.error) {
        throw new InternalError(`${data.error}`);
      }
      return data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError("Unexpected error retrieving imagine history");
    }
  }
  async cancelAllPendingImagines() {
    try {
      const { data } = await this.api.delete(`/imagine/requests/pending?api_key=${this.api_key}`);
      return data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError("Unexpected error retrieving imagine history");
    }
  }
  async deleteImagine(input) {
    try {
      const requestValidator = deleteImagineRequest.safeParse(input);
      if (requestValidator.success === false) {
        throw new InternalError(requestValidator.error.message);
      }
      const { id } = requestValidator.data;
      const { data } = await this.api.delete(`/imagine/deleteImagine/${id}?api_key=${this.api_key}`);
      if (data.error) {
        throw new InternalError(`${data.error}`);
      }
      return data;
    } catch (err) {
      if (err instanceof InternalError)
        throw new InternalError(err.message);
      if (err instanceof import_axios2.AxiosError)
        throw new InternalError(err.message);
      throw new InternalError("Unexpected error retrieving imagine history");
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BlockadeLabsSdk
});
//# sourceMappingURL=index.js.map