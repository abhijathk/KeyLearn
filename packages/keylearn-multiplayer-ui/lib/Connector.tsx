import { ClientCodec } from "@keylearn/multiplayer-shared";
import { Para } from "@keylearn/widget";
import { useMemo } from "react";
import { FormattedMessage } from "react-intl";
import { Game } from "./Game.tsx";
import { Connecting, Kicked, Offline } from "./Status.tsx";
import { WebSocketTransport } from "./transport.websocket.ts";
import { useWebSocket } from "./websocket-hooks.ts";

export function Connector() {
  const { transport, readyState, kicked } = useTransport();
  switch (readyState) {
    case WebSocket.CONNECTING:
      return <Connecting />;
    case WebSocket.OPEN:
      return (
        <>
          <Banner />
          <Game transport={transport!} />
        </>
      );
    default:
      if (kicked) {
        return <Kicked />;
      } else {
        return <Offline />;
      }
  }
}

function useTransport() {
  const { webSocket, readyState, kicked } = useWebSocket();
  const transport = useMemo(() => {
    return webSocket != null
      ? new WebSocketTransport(webSocket, new ClientCodec())
      : null;
  }, [webSocket]);
  return { transport, readyState, kicked };
}

function Banner() {
  return (
    <Para align="center">
      <FormattedMessage
        id="multiplayer.intro.description"
        defaultMessage="Practise alongside other people, all typing the same passage at the same time. Your progress runs along your own rail — the further along you are, the further the light travels."
      />
    </Para>
  );
}
