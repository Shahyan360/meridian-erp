import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useWorkspace } from "../lib/context";
import { request, download } from "../services/api";
import { Icon } from "./ui";

const actionLabels = {
  add_product: "Add a product",
  create_invoice: "Create a draft invoice",
  update_product: "Update a product",
  delete_product: "Delete a product",
  contact_owner: "Send a message to the owner inbox",
};
export default function ChatWidget() {
  const { config, user, toast } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("work"),
    [messages, setMessages] = useState([]),
    [proposals, setProposals] = useState([]),
    [actions, setActions] = useState([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [historyLoading, setHistoryLoading] = useState(false),
    [error, setError] = useState(""),
    [confirming, setConfirming] = useState(""),
    [configured, setConfigured] = useState(config.chatConfigured),
    [contactBusy, setContactBusy] = useState(false);
  const end = useRef(null),
    abort = useRef(null),
    toggle = useRef(null),
    chatInput = useRef(null),
    panel = useRef(null);
  const close = useCallback(() => {
    setOpen(false);
    toggle.current?.focus();
  }, []);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("open-assistant", show);
    return () => {
      window.removeEventListener("open-assistant", show);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    abort.current?.abort();
    setBusy(false);
    setMessages([]);
    setProposals([]);
    setActions([]);
  }, [user?.id]);
  useEffect(() => {
    if (!open || busy) return;
    let alive = true;
    setHistoryLoading(true);
    request("/chat/history")
      .then((data) => {
        if (alive) {
          setMessages(data.messages);
          setProposals(data.proposals);
          setConfigured(data.configured);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });
    const keydown = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", keydown);
    return () => {
      alive = false;
      window.removeEventListener("keydown", keydown);
    };
    // History is refreshed when opening or changing identity, never during a stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, close]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, proposals, busy, actions]);
  const append = (role, content) =>
    setMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), role, content },
    ]);
  const handleAction = (action) => {
    if (action.type === "navigate" && /^\/app\/[a-z-]+$/.test(action.path)) {
      navigate(action.path);
      toast("Opened the requested workspace.");
    } else if (
      action.type === "download" &&
      action.path.startsWith("/export/reports?")
    )
      setActions((items) => [...items, action]);
  };
  const send = async (text = input) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setError("");
    setBusy(true);
    append("user", message);
    const id = crypto.randomUUID();
    setMessages((items) => [...items, { id, role: "assistant", content: "" }]);
    abort.current = new AbortController();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "Meridian",
        },
        credentials: "same-origin",
        body: JSON.stringify({ message, mode }),
        signal: abort.current.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error ||
            "The assistant is temporarily unavailable. Try again shortly.",
        );
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = block
            .split("\n")
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim();
          const payload = block
            .split("\n")
            .find((line) => line.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!payload) continue;
          const data = JSON.parse(payload);
          if (event === "text")
            setMessages((items) =>
              items.map((m) =>
                m.id === id ? { ...m, content: m.content + data.text } : m,
              ),
            );
          if (event === "proposal")
            setProposals((items) => [
              ...items.filter((p) => p.id !== data.id),
              data,
            ]);
          if (event === "action") handleAction(data);
          if (event === "error") setError(data.error);
        }
        if (done) break;
      }
      reader.releaseLock();
    } catch (reason) {
      if (reason.name !== "AbortError")
        setError(
          reason.message || "The connection was interrupted. Please try again.",
        );
    } finally {
      setBusy(false);
      setMessages((items) => items.filter((m) => m.content || m.id !== id));
      chatInput.current?.focus();
    }
  };
  const confirm = async (proposal, approved) => {
    setConfirming(proposal.id);
    setError("");
    try {
      const result = await request("/chat/confirm", {
        method: "POST",
        body: { actionId: proposal.id, approved },
      });
      setProposals((items) => items.filter((p) => p.id !== proposal.id));
      append("assistant", result.message);
      if (approved) {
        window.dispatchEvent(new Event("app-data-changed"));
        window.dispatchEvent(new Event("erp-tool-completed"));
        toast(result.message);
      }
    } catch (reason) {
      setError(reason.message);
      setProposals((items) => items.filter((p) => p.id !== proposal.id));
    } finally {
      setConfirming("");
    }
  };
  const clear = async () => {
    try {
      await request("/chat/history", { method: "DELETE" });
      setMessages([]);
      setProposals([]);
      setActions([]);
      setError("");
    } catch (reason) {
      setError(reason.message);
    }
  };
  const prepareContact = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setContactBusy(true);
    setError("");
    try {
      const result = await request("/chat/contact", {
        method: "POST",
        body: data,
      });
      setProposals((items) => [...items, result]);
      append(
        "assistant",
        "Please review your message below. It will be saved to the owner’s inbox only after you confirm.",
      );
    } catch (reason) {
      setError(
        reason.fields ? Object.values(reason.fields).join(" ") : reason.message,
      );
    } finally {
      setContactBusy(false);
    }
  };
  const suggestions =
    mode === "help"
      ? [
          "How do I create and post an invoice?",
          "How do partial payments work?",
          "How do I adjust inventory?",
        ]
      : user
        ? [
            "Show today’s sales",
            "Which items are low on stock?",
            "Open the HR page",
          ]
        : [
            "What can Meridian do?",
            "How do I get started?",
            "How does team access work?",
          ];
  return (
    <div className="assistant-root">
      {open && (
        <section
          id="meridian-chat"
          ref={panel}
          className="chat-panel"
          role="region"
          aria-label="Meridian assistant"
        >
          <div className="chat-header">
            <Icon name="Sparkles" size={23} />
            <div>
              <b>A little help from Meridian</b>
              <small>
                {configured
                  ? "Connected to Gemini · You stay in control"
                  : "Live AI not configured · Workspace ready"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Close assistant"
              onClick={close}
            >
              <Icon name="X" size={18} />
            </button>
          </div>
          <div className="chat-mode-tabs" aria-label="Assistant mode">
            {[
              ["work", "Workspace"],
              ["help", "How-to help"],
              ["contact", "Contact owner"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={mode === key ? "active" : ""}
                onClick={() => setMode(key)}
                disabled={busy}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="chat-messages">
            <h3>
              {mode === "contact"
                ? "Good things start with a conversation."
                : mode === "help"
                  ? "Let’s find your way."
                  : "What can we make easier?"}
            </h3>
            {historyLoading && (
              <p className="muted">Finding your conversation…</p>
            )}
            {!configured && mode !== "contact" && (
              <div className="chat-notice">
                Live AI isn’t configured yet. Your administrator can add a
                Gemini key on the server. Every ERP feature works without it.
                <br />
                <br />
                To create an invoice: open Sales → Add sales order → save draft
                → Post → Pay. Stock adjustments live in Inventory. Contact owner
                works here without an AI key.
              </div>
            )}
            {!messages.length && mode !== "contact" && (
              <div className="chat-suggestions">
                {suggestions.map((s) => (
                  <button key={s} disabled={busy} onClick={() => send(s)}>
                    {s} <Icon name="ArrowUpRight" size={12} />
                  </button>
                ))}
              </div>
            )}
            {messages.map(
              (message) =>
                message.content && (
                  <article
                    className={`chat-bubble ${message.role}`}
                    key={message.id}
                  >
                    <small>
                      {message.role === "user" ? "YOU" : "MERIDIAN"}
                    </small>
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                        img: ({ alt }) => <span>{alt || "Image omitted"}</span>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </article>
                ),
            )}
            {busy && (
              <div
                className="chat-typing"
                role="status"
                aria-label="Meridian is thinking"
              >
                <i />
                <i />
                <i />
              </div>
            )}
            {proposals.map((proposal) => (
              <div className="chat-proposal" key={proposal.id}>
                <h4>
                  <Icon name="ShieldCheck" size={15} /> Review before we
                  continue
                </h4>
                <b>{actionLabels[proposal.name] || "Review action"}</b>
                <ActionSummary proposal={proposal} />
                <small>
                  Nothing has changed. Expires at{" "}
                  {new Date(proposal.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  .
                </small>
                <div>
                  <button
                    className="btn primary"
                    disabled={Boolean(confirming) || busy}
                    onClick={() => confirm(proposal, true)}
                  >
                    {confirming === proposal.id ? "Working…" : "Confirm action"}
                  </button>
                  <button
                    className="btn"
                    disabled={Boolean(confirming) || busy}
                    onClick={() => confirm(proposal, false)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
            {actions.map((a, i) => (
              <button
                className="btn"
                key={i}
                onClick={async () => {
                  try {
                    await download(a.path, a.filename);
                    toast("Your report is ready.");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                <Icon name="Download" size={15} />
                Download report
              </button>
            ))}
            {mode === "contact" &&
              !proposals.some((p) => p.name === "contact_owner") && (
                <form className="chat-contact-form" onSubmit={prepareContact}>
                  <label>
                    Your name
                    <input
                      name="name"
                      minLength={2}
                      maxLength={100}
                      required
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      maxLength={254}
                      required
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    Subject
                    <input
                      name="subject"
                      minLength={2}
                      maxLength={150}
                      required
                    />
                  </label>
                  <label>
                    Message
                    <textarea
                      name="message"
                      minLength={10}
                      maxLength={4000}
                      rows={3}
                      required
                    />
                  </label>
                  <label className="honeypot" aria-hidden="true">
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                  <button className="btn primary" disabled={contactBusy}>
                    {contactBusy ? "Preparing…" : "Review message"}
                    <Icon name="ArrowRight" size={15} />
                  </button>
                  <p>
                    Saved to the owner inbox after your confirmation. Owner
                    notifications depend on the configured delivery service.
                  </p>
                </form>
              )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {messages.length > 0 && (
              <button className="chat-clear" onClick={clear} disabled={busy}>
                Clear conversation & pending actions
              </button>
            )}
            <div ref={end} />
          </div>
          {mode !== "contact" && (
            <form
              className="chat-input-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <div className="chat-input">
                <textarea
                  ref={chatInput}
                  aria-label="Message Meridian"
                  placeholder={
                    mode === "help"
                      ? "Ask how anything works…"
                      : "Ask about your workspace…"
                  }
                  maxLength={2000}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  className="icon-button"
                  aria-label="Send message"
                  disabled={busy || !input.trim()}
                >
                  <Icon name="Send" size={16} />
                </button>
              </div>
              <p>
                AI can make mistakes. Review every action. {input.length}/2000
              </p>
            </form>
          )}
        </section>
      )}
      <button
        ref={toggle}
        className="assistant-toggle"
        aria-label={open ? "Close assistant" : "Open Meridian assistant"}
        aria-expanded={open}
        aria-controls={open ? "meridian-chat" : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name={open ? "X" : "Sparkles"} size={23} />
        <span>Ask Meridian</span>
      </button>
    </div>
  );
}

function ActionSummary({ proposal }) {
  const { money } = useWorkspace();
  const a = proposal.args;
  const entries =
    proposal.name === "add_product"
      ? [
          ["Product", a.name],
          ["SKU", a.sku || "Assigned automatically"],
          ["Category", a.category],
          ["Selling price", money(a.price)],
          ["Cost price", money(a.cost)],
          ["Opening stock", a.stock + " units"],
        ]
      : proposal.name === "create_invoice"
        ? [
            ["Customer", a.customerName],
            ["Notes", a.description],
            ...a.lines.map((line) => [
              line.productName,
              line.quantity + " × " + money(line.unitPrice),
            ]),
          ]
        : proposal.name === "contact_owner"
          ? [
              ["Name", a.name],
              ["Email", a.email],
              ["Subject", a.subject],
              ["Message", a.message],
            ]
          : proposal.name === "delete_product"
            ? [["Product to remove", a.currentName]]
            : [
                ["Product", a.currentName],
                ...(a.name ? [["New name", a.name]] : []),
                ...(a.price !== undefined
                  ? [["New selling price", money(a.price)]]
                  : []),
                ...(a.category ? [["Category", a.category]] : []),
              ];
  return (
    <dl className="action-summary">
      {entries.map(([label, value], index) => (
        <div key={index}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
