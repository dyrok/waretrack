import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { setToken } from "./api.js";
import { signOutOfGoogle } from "./firebase.js";
import AuthScreen from "./components/AuthScreen.jsx";
import AlertsView from "./views/AlertsView.jsx";
import BinsView from "./views/BinsView.jsx";
import Dashboard from "./views/Dashboard.jsx";
import InventoryView from "./views/InventoryView.jsx";
import ItemsView from "./views/ItemsView.jsx";
import NotifyView from "./views/NotifyView.jsx";
import ReportsView from "./views/ReportsView.jsx";
import StockView from "./views/StockView.jsx";
import TeamView from "./views/TeamView.jsx";

// Journey map (docs/user-journeys.md). managerOnly screens are hidden from staff.
const VIEWS = [
  { id: "dashboard", label: "Dashboard", Component: Dashboard },
  { id: "stock", label: "Stock", Component: StockView },
  { id: "items", label: "Items", Component: ItemsView },
  { id: "inventory", label: "Inventory", Component: InventoryView },
  { id: "alerts", label: "Alerts", Component: AlertsView },
  { id: "bins", label: "Bins", Component: BinsView },
  { id: "reports", label: "Reports", managerOnly: true, Component: ReportsView },
  { id: "notify", label: "Notify", managerOnly: true, Component: NotifyView },
  { id: "team", label: "Team", managerOnly: true, Component: TeamView },
];

const SOCKET_EVENTS = ["stock:changed", "transaction:created", "alert:low-stock", "alert:resolved"];

const feedEntry = (event, payload) => ({
  key: crypto.randomUUID(),
  time: new Date().toLocaleTimeString(),
  event,
  // Drop database ids: people read SKUs, not ObjectIds.
  payload: Object.fromEntries(Object.entries(payload).filter(([k]) => !/id$/i.test(k))),
});

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("dashboard");
  const [feed, setFeed] = useState([]);
  const [connected, setConnected] = useState(false);
  // Bumped by every live event; screens refetch when it changes.
  const [tick, setTick] = useState(0);
  const socket = useRef(null);

  useEffect(() => () => socket.current?.close(), []);

  const signedIn = (body) => {
    setToken(body.token);
    setSession(body.user);
    setView("dashboard");
    setFeed([]);
    socket.current?.close();
    // transports: websocket only. Socket.io starts with HTTP long-polling by
    // default, and polling needs every request of a session to reach the same
    // process -- which is not true once this is deployed as a function.
    const next = io({ auth: { token: body.token }, transports: ["websocket"] });
    socket.current = next;
    next.on("connect", () => setConnected(true));
    next.on("disconnect", () => setConnected(false));
    SOCKET_EVENTS.forEach((event) =>
      next.on(event, (payload) => {
        setFeed((f) => [feedEntry(event, payload), ...f].slice(0, 50));
        setTick((t) => t + 1);
      }),
    );
  };

  // J3: sign out drops the token, closes the socket and returns to sign-in.
  const signOut = () => {
    // Also end the Firebase session, or the next Google popup silently
    // reuses the account that just signed out.
    signOutOfGoogle();
    socket.current?.close();
    socket.current = null;
    setToken(null);
    setSession(null);
    setFeed([]);
    setConnected(false);
    setView("dashboard");
  };

  if (!session) return <AuthScreen onSignedIn={signedIn} />;

  const isManager = session.role === "manager";
  const screens = VIEWS.filter((s) => !s.managerOnly || isManager);
  const current = screens.find((s) => s.id === view) || screens[0];
  const Screen = current.Component;

  return (
    <>
      <header>
        <h1>
          WareTrack <small>live console</small>
        </h1>
        <span className={`live ${connected ? "on" : ""}`}>
          {session.name} · {session.role}
        </span>
        <button type="button" className="ghost" onClick={signOut}>
          Sign out
        </button>
      </header>
      <nav>
        {screens.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === current.id ? "tab on" : "tab"}
            onClick={() => setView(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <main>
        <Screen user={session} tick={tick} feed={feed} />
      </main>
    </>
  );
}
