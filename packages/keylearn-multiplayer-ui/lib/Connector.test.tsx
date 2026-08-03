import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { PLAYER_KICKED } from "@keylearn/multiplayer-shared";
import { FakeSettingsContext } from "@keylearn/settings";
import { act, render } from "@testing-library/react";
import { includes } from "rich-assert";
import { Connector } from "./Connector.tsx";
import { FakeWebSocket } from "./websocket.fake.ts";
import { useWebSocket } from "./websocket-hooks.ts";

test("handle websocket ready state changes", () => {
  const webSocket = new FakeWebSocket("wss://www.keylearn.com/game");

  useWebSocket.makeWebSocket = () => webSocket;

  const r = render(
    <FakeIntlProvider>
      <FakeSettingsContext>
        <Connector />
      </FakeSettingsContext>
    </FakeIntlProvider>,
  );

  includes(r.getByRole("heading").textContent!, "Finding you a room");

  act(() => {
    webSocket.serverConnect();
  });
  act(() => {
    webSocket.serverClose(PLAYER_KICKED);
  });

  includes(r.getByRole("heading").textContent!, "You were away too long");

  r.unmount();
});
