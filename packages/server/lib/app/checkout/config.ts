import { injectable } from "@fastr/invert";
import { Env } from "@keylearn/config";
import { Environment, LogLevel, Paddle } from "@paddle/paddle-node-sdk";

@injectable({ singleton: true })
export class PaddleConfig {
  // Empty when payments are not set up; the webhook then answers 404 rather
  // than failing to construct and answering every call with a 500.
  readonly apiKey = Env.getString("PADDLE_API_KEY", "");
  readonly secretKey = Env.getString("PADDLE_SECRET_KEY", "");

  get configured(): boolean {
    return this.apiKey !== "" && this.secretKey !== "";
  }

  makePaddle() {
    return new Paddle(this.apiKey, {
      environment: Environment.production,
      logLevel: LogLevel.verbose,
    });
  }
}
