import { Tasks } from "@keylearn/lang";
import { PLAYER_KICKED } from "@keylearn/multiplayer-shared";
import { getPageData, loadActiveProfileId } from "@keylearn/pages-shared";
import { useEffect, useState } from "react";

export function useWebSocket() {
  const [state, setState] = useState({
    webSocket: null,
    readyState: WebSocket.CONNECTING,
    kicked: false,
  } as {
    webSocket: WebSocket | null;
    readyState: number;
    kicked: boolean;
  });

  useEffect(() => {
    const tasks = new Tasks();
    let webSocket: WebSocket | null = null;

    const connect = () => {
      const makeWebSocket = (webSocket = useWebSocket.makeWebSocket());

      makeWebSocket.addEventListener("open", () => {
        console.log("WebSocket connected");
        setState({
          webSocket: (webSocket = makeWebSocket),
          readyState: WebSocket.OPEN,
          kicked: false,
        });
      });

      makeWebSocket.addEventListener("close", (ev) => {
        console.log(`WebSocket closed; code=${ev.code}, reason='${ev.reason}'`);
        setState({
          webSocket: (webSocket = null),
          readyState: WebSocket.CLOSED,
          kicked: ev.code === PLAYER_KICKED,
        });
        switch (ev.code) {
          case 1006: // CLOSE_ABNORMAL
          case 1012: // Service Restart
          case 1013: // Try Again Later
            tasks.delayed(3000, () => {
              connect();
            });
            break;
        }
      });

      makeWebSocket.addEventListener("error", () => {
        console.error("WebSocket error");
        makeWebSocket.close();
      });
    };

    connect();

    return () => {
      if (webSocket != null) {
        webSocket.close();
        webSocket = null;
      }
      tasks.cancelAll();
    };
  }, []);

  return state;
}

useWebSocket.makeWebSocket = () => {
  return new WebSocket(webSocketUrl());
};

function webSocketUrl() {
  const { protocol, host } = window.location;
  let scheme = "";
  switch (protocol) {
    case "https:":
      scheme = "wss:";
      break;
    case "http:":
      scheme = "ws:";
      break;
    default:
      throw new Error();
  }
  // Production serves the game through the same origin, because nginx forwards
  // `/_/game/` to the game worker. Development has no proxy and the worker
  // listens on its own port, so it says where it is; without this the socket
  // dials the HTTP worker, which has no game routes, and every attempt fails
  // with a 1006 before the connection opens.
  const override = getPageData().gameUrl;
  if (override) {
    const base = new URL(override, `${scheme}//${host}`);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    base.pathname = "/_/game/server";
    const id = loadActiveProfileId();
    if (id != null) {
      base.searchParams.set("profile", String(id));
    }
    return String(base);
  }
  // Tell the server which learner is at the keyboard, so a household of several
  // grown-ups appears as several distinct players rather than one shared
  // account. The server verifies the profile belongs to the session before
  // trusting it, so a forged id gains nothing.
  const profileId = loadActiveProfileId();
  const query =
    profileId != null ? `?profile=${encodeURIComponent(profileId)}` : "";
  return `${scheme}//${host}/_/game/server${query}`;
}
