import * as dotenv from "dotenv";

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  SERVER_PORT: parseInt(process.env.SERVER_PORT || "5002", 10),
  API_KEY: process.env.API_KEY || "",
};
