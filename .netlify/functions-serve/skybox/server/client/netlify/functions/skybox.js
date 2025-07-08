"use strict";

// server/client/netlify/functions/skybox.js
var { BlockadeLabsSdk } = require("@blockadelabs/sdk");
exports.handler = async (event, context) => {
  console.log("=== SKYBOX FUNCTION CALLED ===");
  console.log("Event path:", event.path);
  console.log("Event httpMethod:", event.httpMethod);
  console.log("Event headers:", event.headers);
  console.log("Event queryStringParameters:", event.queryStringParameters);
  console.log("Event body:", event.body);
  console.log("Context:", context);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-API-Key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true"
  };
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }
  try {
    const apiKey = process.env.BLOCKADELABS_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      console.error("No BlockadeLabs API key configured");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "API key not configured",
          message: "BLOCKADELABS_API_KEY or API_KEY environment variable is not set"
        })
      };
    }
    const sdk = new BlockadeLabsSdk({ api_key: apiKey });
    if (event.path.includes("/styles") || event.path.includes("/getSkyboxStyles")) {
      console.log("Handling styles request");
      return await handleGetStyles(headers, sdk);
    } else if (event.path.includes("/generate")) {
      console.log("Handling generation request");
      return await handleGenerate(headers, sdk, event);
    } else if (event.path.includes("/status/")) {
      console.log("Handling status request");
      return await handleGetStatus(headers, sdk, event);
    } else if (event.path.includes("/test")) {
      console.log("Handling test request");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "Skybox function is working!",
          path: event.path,
          method: event.httpMethod,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      };
    } else {
      console.log("Unknown endpoint:", event.path);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: "Endpoint not found",
          message: `Unknown endpoint: ${event.path}`,
          availableEndpoints: ["/styles", "/generate", "/status/:id", "/test"]
        })
      };
    }
  } catch (error) {
    console.error("Skybox function error:", error);
    console.error("Error stack:", error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
        details: process.env.NODE_ENV === "development" ? error.stack : void 0
      })
    };
  }
};
async function handleGetStyles(headers, sdk) {
  try {
    console.log("Fetching skybox styles from BlockadeLabs API using SDK");
    const styles = await sdk.getSkyboxStyles();
    console.log("Successfully fetched skybox styles:", styles);
    const formattedResponse = {
      success: true,
      data: {
        styles
      },
      message: `Retrieved ${styles.length} skybox styles`,
      pagination: {
        page: 1,
        limit: styles.length,
        total: styles.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    };
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formattedResponse)
    };
  } catch (error) {
    console.error("Error fetching styles:", error);
    throw error;
  }
}
async function handleGenerate(headers, sdk, event) {
  try {
    console.log("Generating skybox with BlockadeLabs API");
    const requestBody = JSON.parse(event.body || "{}");
    console.log("Generation request body:", requestBody);
    const generation = await sdk.generateSkybox({
      prompt: requestBody.prompt,
      skybox_style_id: requestBody.skybox_style_id,
      webhook_url: requestBody.webhook_url
    });
    console.log("Generation started:", generation);
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        data: generation,
        message: "Skybox generation started successfully"
      })
    };
  } catch (error) {
    console.error("Error generating skybox:", error);
    throw error;
  }
}
async function handleGetStatus(headers, sdk, event) {
  try {
    console.log("Getting generation status");
    const pathParts = event.path.split("/");
    const generationId = pathParts[pathParts.length - 1];
    if (!generationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Generation ID is required",
          message: "Please provide a valid generation ID in the URL"
        })
      };
    }
    const status = await sdk.getSkyboxGeneration(generationId);
    console.log("Generation status:", status);
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        data: status,
        message: "Generation status retrieved successfully"
      })
    };
  } catch (error) {
    console.error("Error getting generation status:", error);
    throw error;
  }
}
//# sourceMappingURL=skybox.js.map
