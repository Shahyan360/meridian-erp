import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { request } from "../services/api";

const Context = createContext(null);
export function WorkspaceProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({
    currency: "PKR",
    workspace: "Meridian",
  });
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("meridian-theme") || "light",
  );
  const toast = useCallback((message, tone = "success") => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items.slice(-3), { id, message, tone }]);
    setTimeout(
      () => setToasts((items) => items.filter((t) => t.id !== id)),
      5000,
    );
  }, []);
  const refreshConfig = useCallback(
    () => request("/config").then(setConfig),
    [],
  );
  useEffect(() => {
    let alive = true;
    Promise.all([request("/auth/me"), request("/config")])
      .then(([session, data]) => {
        if (alive) {
          setUser(session.user);
          setConfig(data);
        }
      })
      .catch(() => {
        if (alive)
          setConnectionError(
            "We couldn’t connect to your workspace. Check that the server is running.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => {
      alive = false;
      window.removeEventListener("session-expired", expired);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("meridian-theme", theme);
  }, [theme]);
  const login = async (email, password) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setUser(data.user);
    setConnectionError("");
    return data.user;
  };
  const logout = async () => {
    await request("/auth/logout", { method: "POST", body: {} });
    setUser(null);
  };
  const money = useCallback(
    (value, compact = false) =>
      new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: config.currency,
        maximumFractionDigits: compact ? 1 : 0,
        ...(compact ? { notation: "compact" } : {}),
      }).format(Number(value || 0)),
    [config.currency],
  );
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        config,
        loading,
        connectionError,
        refreshConfig,
        login,
        logout,
        theme,
        toggleTheme: () => setTheme((v) => (v === "dark" ? "light" : "dark")),
        toast,
        money,
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div role="status" className={`toast ${item.tone}`} key={item.id}>
            <span>{item.tone === "error" ? "!" : "✓"}</span>
            {item.message}
            <button
              aria-label="Dismiss notification"
              onClick={() =>
                setToasts((items) => items.filter((t) => t.id !== item.id))
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
// Context and hook intentionally share a module.
export function useWorkspace() {
  return useContext(Context);
}
