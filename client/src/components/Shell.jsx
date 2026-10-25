import { useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { groups, catalog } from "../../../shared/catalog";
import { useWorkspace } from "../lib/context";
import { request } from "../services/api";
import { Brand, Icon, Modal } from "./ui";

export default function Shell() {
  const { user, config, theme, toggleTheme, logout, toast } = useWorkspace();
  const [mobile, setMobile] = useState(false),
    [command, setCommand] = useState(false),
    [notifications, setNotifications] = useState(false),
    [summary, setSummary] = useState(null);
  const location = useLocation(),
    navigate = useNavigate();
  const reduce = useReducedMotion();
  const resource = location.pathname.split("/")[2];
  const label =
    resource === "dashboard"
      ? "Overview"
      : resource === "reports"
        ? "Accounting & reports"
        : resource === "settings"
          ? "Settings"
          : catalog[resource]?.title || "Workspace";
  useEffect(() => {
    document.title = `${label} | Meridian ERP`;
  }, [label]);
  const permitted = (key) =>
    user.role === "ADMIN" ||
    (user.role === "MANAGER"
      ? !["settings", "inbox"].includes(key)
      : !["settings", "inbox", "employees", "reports", "expenses"].includes(
          key,
        ));
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
      if (e.key === "Escape") {
        setMobile(false);
        setNotifications(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    let alive = true;
    const load = () =>
      request("/dashboard")
        .then((data) => {
          if (alive) setSummary(data);
        })
        .catch(() => {});
    load();
    window.addEventListener("app-data-changed", load);
    return () => {
      alive = false;
      window.removeEventListener("app-data-changed", load);
    };
  }, []);
  const signOut = async () => {
    try {
      await logout();
      navigate("/");
    } catch (e) {
      toast(e.message, "error");
    }
  };
  return (
    <div className="workspace-app">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${mobile ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <Link
          className="brand-link"
          to="/app/dashboard"
          aria-label="Meridian overview"
        >
          <Brand />
        </Link>
        <button
          className="icon-button mobile-sidebar-close"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <Icon name="X" />
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            <Icon name="Building2" size={18} />
          </span>
          <div>
            <b>{config.workspace}</b>
            <small>
              {config.demo ? "Demo workspace" : "Business workspace"}
            </small>
          </div>
          <span className="online-dot" title="Connected" />
        </div>
        <nav>
          {groups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p>{group.title}</p>
              {group.items
                .filter(([key]) => permitted(key))
                .map(([key, name, icon]) => (
                  <NavLink
                    key={key}
                    to={`/app/${key}`}
                    onClick={() => setMobile(false)}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""}`
                    }
                  >
                    <Icon name={icon} size={19} />
                    <span>{name}</span>
                    {key === "inbox" && summary?.inboxCount > 0 && (
                      <span className="nav-count">{summary.inboxCount}</span>
                    )}
                    {key === "dashboard" && <span className="nav-active-dot" />}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Icon name="Sparkles" size={17} />
            </span>
            <b>A little help, a lot less work.</b>
            <p>Your assistant knows its way around.</p>
            <button
              onClick={() => window.dispatchEvent(new Event("open-assistant"))}
            >
              Meet your assistant <Icon name="ArrowUpRight" size={14} />
            </button>
          </div>
          <button className="nav-item" onClick={toggleTheme}>
            <Icon name={theme === "dark" ? "Sun" : "Moon"} size={18} />
            <span>
              {theme === "dark" ? "Light appearance" : "Dark appearance"}
            </span>
          </button>
          <div className="user-profile">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{user.role.toLowerCase()}</small>
            </div>
            <button
              className="icon-button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="LogOut" size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Icon name="Menu" />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <b>{label}</b>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setCommand(true)}>
              <Icon name="Search" size={16} />
              <span>Search anything…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-divider" />
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => setNotifications((v) => !v)}
              >
                <Icon name="Bell" />
                {(summary?.lowStock.length > 0 || summary?.inboxCount > 0) && (
                  <i />
                )}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <div className="panel-title">
                    <b>Notifications</b>
                    <button
                      className="icon-button"
                      aria-label="Close notifications"
                      onClick={() => setNotifications(false)}
                    >
                      <Icon name="X" size={16} />
                    </button>
                  </div>
                  {summary?.lowStock.length > 0 && (
                    <Link
                      to="/app/inventory"
                      onClick={() => setNotifications(false)}
                    >
                      <span className="notice-icon">
                        <Icon name="Boxes" />
                      </span>
                      <div>
                        <b>{summary.lowStock.length} items need a restock</b>
                        <p>Stay one step ahead of demand.</p>
                      </div>
                      <Icon name="ChevronRight" size={16} />
                    </Link>
                  )}
                  {summary?.inboxCount > 0 && (
                    <Link
                      to="/app/inbox"
                      onClick={() => setNotifications(false)}
                    >
                      <span className="notice-icon blue">
                        <Icon name="Mail" />
                      </span>
                      <div>
                        <b>{summary.inboxCount} unread messages</b>
                        <p>Your next conversation is waiting.</p>
                      </div>
                    </Link>
                  )}
                  {summary &&
                    !summary.lowStock.length &&
                    !summary.inboxCount && (
                      <p className="muted panel-padding">
                        You’re all caught up.
                      </p>
                    )}
                </div>
              )}
            </div>
            <span className="small-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main id="main-content" className="workspace-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={reduce ? false : { opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
          <footer className="workspace-footer">
            <span>
              Thoughtfully connected. <b>Meridian.</b>
            </span>
            <div>
              <span className="online-dot" />
              Workspace connected
              <Link to="/about">
                About Meridian <Icon name="ArrowUpRight" size={13} />
              </Link>
            </div>
          </footer>
        </main>
      </div>
      {command && (
        <CommandPalette
          onClose={() => setCommand(false)}
          permitted={permitted}
        />
      )}
    </div>
  );
}
function CommandPalette({ onClose, permitted }) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const close = useCallback(onClose, [onClose]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      setBusy(true);
      Promise.allSettled(
        ["products", "customers", "sales"].map(async (resource) => {
          const data = await request(
            `/${resource}?q=${encodeURIComponent(query)}&pageSize=3`,
          );
          return data.data.map((row) => ({
            title: row.name || row.invoiceNo,
            subtitle: catalog[resource].title,
            url: `/app/${resource}?q=${encodeURIComponent(row.name || row.invoiceNo)}`,
          }));
        }),
      )
        .then((data) => {
          if (alive)
            setResults(
              data.flatMap((v) => (v.status === "fulfilled" ? v.value : [])),
            );
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);
  const modules = groups
    .flatMap((g) => g.items)
    .filter(
      ([key, name]) =>
        permitted(key) && name.toLowerCase().includes(query.toLowerCase()),
    );
  const go = (url) => {
    navigate(url);
    close();
  };
  return (
    <Modal title="Your workspace, a keystroke away" onClose={close}>
      <div className="command-search">
        <Icon name="Search" />
        <input
          aria-label="Search workspace"
          autoFocus
          placeholder="Find a page, product, customer, or invoice…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>esc</kbd>
      </div>
      <div
        className="command-results"
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            const buttons = [...e.currentTarget.querySelectorAll("button")];
            const i = buttons.indexOf(document.activeElement);
            buttons[
              (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                buttons.length
            ]?.focus();
          }
        }}
      >
        <small>PAGES & ACTIONS</small>
        {modules.map(([key, name, icon]) => (
          <button key={key} onClick={() => go(`/app/${key}`)}>
            <Icon name={icon} />
            <span>{name}</span>
            <Icon name="ArrowUpRight" size={15} />
          </button>
        ))}
        {query.length >= 2 && (
          <>
            <small>{busy ? "SEARCHING…" : "RECORDS"}</small>
            {results.map((r, i) => (
              <button key={i} onClick={() => go(r.url)}>
                <Icon name="FileText" />
                <span>
                  {r.title}
                  <small>{r.subtitle}</small>
                </span>
                <Icon name="ArrowUpRight" size={15} />
              </button>
            ))}
            {!busy && !results.length && (
              <p className="muted">
                No matching records. Try a product name or invoice number.
              </p>
            )}
          </>
        )}
      </div>
      <div className="command-footer">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> to move
        </span>
        <span>
          <kbd>↵</kbd> to open
        </span>
      </div>
    </Modal>
  );
}
