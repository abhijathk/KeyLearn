import { Server } from "node:http";
import { type Binder, type Module } from "@fastr/invert";
import { WebSocketServer } from "ws";

export class ServerModule implements Module {
  configure({ bind }: Binder) {
    bind(Server).toValue(new Server());
    bind(WebSocketServer).toValue(
      new WebSocketServer({
        noServer: true,
        // Game messages are a few hundred bytes; anything approaching this is
        // abuse. Without a cap a client can make the server buffer arbitrarily
        // large frames.
        maxPayload: 64 * 1024,
        // Never negotiate permessage-deflate: it lets a small frame expand into
        // a large allocation, and the traffic here is too small to benefit.
        perMessageDeflate: false,
      }),
    );
  }
}
