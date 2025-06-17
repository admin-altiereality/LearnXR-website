import * as dotenv from "dotenv";
import { envsafe, port, str } from "envsafe";

dotenv.config();

export const env = envsafe({
  NODE_ENV: str({
    devDefault: "development",
    choices: ["development", "test", "production"],
  }),
  SERVER_PORT: port({
    devDefault: 5002,
    desc: "The port the app is running on",
  }),
  API_KEY: str({
    desc: "BlockadeLabs API KEY",
  }),
  RAZORPAY_KEY_ID: str({
    desc: "Razorpay Key ID",
  }),
  RAZORPAY_KEY_SECRET: str({
    desc: "Razorpay Key Secret",
  }),
});
