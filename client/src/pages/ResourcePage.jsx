import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { catalog, tabs, labelFor } from "../../../shared/catalog";
import { useWorkspace } from "../lib/context";
import { request, download, queryString } from "../services/api";
import {
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  Skeleton,
} from "../components/ui";

const numericMoney = new Set([
  "salary",
  "amount",
  "salePrice",
  "purchasePrice",
  "total",
  "balance",
  "unitCost",
  "netSalary",
  "basicSalary",
  "allowances",
  "deductions",
  "openingBalance",
]);
export function canView(user, resource) {
  if (!user) return false;
  if (["users", "settings", "inbox", "audit"].includes(resource))
    return user.role === "ADMIN";
  return (
    user.role !== "EMPLOYEE" ||
    [
      "products",
      "product-categories",
      "inventory",
      "stock-movements",
      "customers",
      "vendors",
      "sales",
      "purchases",
      "students",
      "classes",
      "guardians",
      "attendance",
      "student-leaves",
    ].includes(resource)
  );
}
export default function ResourcePage() {
  const { resource } = useParams();
  const { user } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const options = (tabs[resource] || [resource]).filter((r) =>
    canView(user, r),
  );
  const active = options.includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : options[0];
  if (!catalog[resource])
    return (
      <EmptyState
        title="This page took a different turn."
        description="Head back to your overview to find what you need."
        icon="Globe"
      >
        <Link className="btn primary" to="/app/dashboard">
          Back to overview
        </Link>
      </EmptyState>
    );
  if (!canView(user, resource))
    return (
      <EmptyState
        title="A different level of access"
        description="Your role doesn’t include this workspace. An administrator can help with access."
        icon="ShieldCheck"
      />
    );
  return (
    <>
      <div className="module-tabs" aria-label="Module sections">
        {options.length > 1 &&
          options.map((r) => (
            <button
              key={r}
              className={active === r ? "active" : ""}
              onClick={() => setSearchParams({ tab: r })}
            >
              {catalog[r]?.title || labelFor(r)}
            </button>
          ))}
      </div>
      <ResourceView key={active} resource={active} />
    </>
  );
}
export function ResourceView({ resource }) {
  const config = catalog[resource];
  const { user, money, toast } = useWorkspace();
  const [params] = useSearchParams();
  const routeQuery = params.get("q") || "";
  const [query, setQuery] = useState(params.get("q") || ""),
    [debounced, setDebounced] = useState(query),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState("id"),
    [direction, setDirection] = useState("desc"),
    [status, setStatus] = useState("");
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(null),
    [modal, setModal] = useState(
      params.has("new") && user.role !== "EMPLOYEE" ? "edit" : "",
    ),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [exporting, setExporting] = useState("");
  const canWrite = user.role !== "EMPLOYEE" && !config.readOnly;
  useEffect(() => {
    setQuery(routeQuery);
    setPage(1);
  }, [routeQuery]);
  const qs = queryString({
    q: debounced,
    page,
    pageSize,
    sort,
    direction,
    status,
  });
  const reload = useCallback(() => {
    setRefresh((n) => n + 1);
    window.dispatchEvent(new Event("app-data-changed"));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let alive = true;
    request(`/${resource}?${qs}`)
      .then((result) => {
        if (alive) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [resource, qs, refresh]);
  useEffect(() => {
    const changed = () => setRefresh((n) => n + 1);
    window.addEventListener("erp-tool-completed", changed);
    return () => window.removeEventListener("erp-tool-completed", changed);
  }, []);
  const open = (kind, record = null) => {
    setEditing(record);
    setModal(kind);
  };
  const close = useCallback(() => setModal(""), []);
  const action = async (type) => {
    setBusy(true);
    try {
      if (type === "delete")
        await request(`/${resource}/${editing.id}`, { method: "DELETE" });
      else
        await request(`/${resource}/${editing.id}/${type}`, {
          method: "POST",
          body: {},
        });
      toast(
        type === "delete"
          ? "Record removed."
          : type === "post"
            ? "Order posted. Stock and accounts updated."
            : "Order cancelled. Stock and accounts reversed.",
      );
      close();
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const exportData = async (format) => {
    setExporting(format);
    try {
      await download(
        `/export/${resource}?${queryString({ q: debounced, status, sort, direction, format })}`,
        `meridian-${resource}.${format}`,
      );
      toast("Your export is ready.");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setExporting("");
    }
  };
  const document = async (record) => {
    try {
      await download(
        `/${resource}/${record.id}/document`,
        `${record.invoiceNo || record.billNo || record.receiptNo || "payslip"}.pdf`,
      );
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const statusField = config.fields.find((f) => f.key === "status");
  const activeField = config.fields.some((f) => f.key === "active");
  const states = config.order
    ? ["DRAFT", "POSTED", "PAID", "CANCELLED"]
    : resource === "fees"
      ? ["POSTED", "PAID"]
      : statusField?.options;
  const renderValue = (row, key) =>
    key === "guardianIds" ? (
      row.guardianLinks?.map((link) => link.guardian.name).join(", ") || "—"
    ) : key === "active" || key === "status" || key === "notificationStatus" ? (
      <Badge value={row[key]} />
    ) : numericMoney.has(key) ? (
      <span className="tabular">{money(row[key])}</span>
    ) : /Date$|At$/.test(key) && row[key] ? (
      new Date(row[key]).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    ) : typeof row[key] === "boolean" ? (
      row[key] ? (
        "Yes"
      ) : (
        "No"
      )
    ) : (
      String(row[key] ?? "—")
    );
  const mutable = (row) =>
    !config.immutable &&
    !(
      (config.order || ["payroll", "expenses"].includes(resource)) &&
      row.status !== "DRAFT"
    ) &&
    resource !== "fee-payments";
  return (
    <section className="resource-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A PLACE FOR EVERY DETAIL</div>
          <h1>
            {config.title}
            <span className="accent">.</span>
          </h1>
          <p>
            {config.description ||
              `Keep your ${config.title.toLowerCase()} organized, connected, and up to date.`}
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="btn"
            onClick={() => exportData("pdf")}
            disabled={Boolean(exporting)}
          >
            <Icon name="Download" size={16} />
            {exporting === "pdf" ? "Preparing…" : "Export PDF"}
          </button>
          {canWrite && resource !== "inbox" && (
            <button className="btn primary" onClick={() => open("edit")}>
              <Icon name="Plus" size={17} />
              Add {config.singular}
            </button>
          )}
        </div>
      </div>
      {user.role === "EMPLOYEE" && (
        <div className="info-banner">
          <Icon name="ShieldCheck" size={17} />
          You have view access. Your manager can create and update records.
        </div>
      )}
      <section className="card records-card">
        <div className="records-title">
          <div>
            <h2>
              All {config.title.toLowerCase()}{" "}
              <span className="count-badge">{data?.total ?? "—"}</span>
            </h2>
            <p>A little order makes everything easier.</p>
          </div>
          <button
            className="text-link"
            disabled={Boolean(exporting)}
            onClick={() => exportData("csv")}
          >
            <Icon name="Download" size={15} />
            {exporting === "csv" ? "Preparing…" : "Download CSV"}
          </button>
        </div>
        <div className="records-toolbar">
          <label className="table-search">
            <Icon name="Search" size={17} />
            <input
              aria-label={`Search ${config.title}`}
              placeholder={`Search ${config.title.toLowerCase()}…`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                aria-label="Clear search"
                className="icon-button"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </label>
          <div className="filter-actions">
            {(states || activeField) && (
              <label className="filter-select">
                <Icon name="SlidersHorizontal" size={15} />
                <select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {(states || ["true", "false"]).map((s) => (
                    <option key={s} value={s}>
                      {s === "true"
                        ? "Active"
                        : s === "false"
                          ? "Inactive"
                          : s.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="icon-button"
              aria-label="Refresh records"
              onClick={reload}
            >
              <Icon name="RefreshCw" size={17} />
            </button>
          </div>
        </div>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <Skeleton rows={6} />
        ) : !data?.data.length ? (
          <EmptyState
            title={
              query || status
                ? "No matches. A fresh search?"
                : `Your first ${config.singular} is the start.`
            }
            description={
              query || status
                ? "Try a different search or clear your filters."
                : `Add a ${config.singular} to bring this part of your workspace to life.`
            }
          >
            {canWrite && !query && !status && (
              <button className="btn primary" onClick={() => open("edit")}>
                <Icon name="Plus" size={16} />
                Add {config.singular}
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="table-scroll">
              <table className="records-table">
                <thead>
                  <tr>
                    {config.columns.map((key) => (
                      <th key={key}>
                        {key === "balance" ? (
                          labelFor(key)
                        ) : (
                          <button
                            onClick={() => {
                              setSort(key);
                              setDirection((d) =>
                                sort === key && d === "asc" ? "desc" : "asc",
                              );
                              setPage(1);
                            }}
                            aria-label={`Sort by ${labelFor(key)}`}
                          >
                            {labelFor(key)}
                            <Icon
                              name={
                                sort === key
                                  ? direction === "asc"
                                    ? "ArrowUpRight"
                                    : "ArrowDownRight"
                                  : "ChevronDown"
                              }
                              size={12}
                            />
                          </button>
                        )}
                      </th>
                    ))}
                    <th className="actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr key={row.id}>
                      {config.columns.map((key, i) => (
                        <td
                          key={key}
                          className={
                            i === 0 || numericMoney.has(key) ? "strong" : ""
                          }
                        >
                          {i === 0 &&
                          [
                            "customers",
                            "vendors",
                            "users",
                            "employees",
                            "inbox",
                          ].includes(resource) ? (
                            <span className="customer-cell">
                              <span
                                className={`mini-avatar mini-${row.id % 4}`}
                              >
                                {String(row[key] || "M").slice(0, 1)}
                              </span>
                              {renderValue(row, key)}
                            </span>
                          ) : (
                            renderValue(row, key)
                          )}
                          {resource === "inventory" &&
                            key === "quantity" &&
                            Number(row.quantity) <=
                              Number(row.reorderLevel) && (
                              <span className="stock-warning">Low stock</span>
                            )}
                        </td>
                      ))}
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`View ${config.singular} ${row.id}`}
                            title="View details"
                            onClick={() => open("view", row)}
                          >
                            <Icon name="Eye" size={16} />
                          </button>
                          {canWrite && mutable(row) && (
                            <button
                              className="icon-button"
                              aria-label={`Edit ${config.singular} ${row.id}`}
                              title="Edit"
                              onClick={() => open("edit", row)}
                            >
                              <Icon name="Pencil" size={15} />
                            </button>
                          )}
                          {canWrite &&
                            config.order &&
                            row.status === "DRAFT" && (
                              <button
                                className="small-button"
                                onClick={() => open("post", row)}
                              >
                                Post
                              </button>
                            )}
                          {canWrite &&
                            config.order &&
                            row.status === "POSTED" && (
                              <button
                                className="small-button"
                                onClick={() => open("payment", row)}
                              >
                                Pay
                              </button>
                            )}
                          {canWrite && mutable(row) && (
                            <button
                              className="icon-button danger-text"
                              aria-label={`Delete ${config.singular} ${row.id}`}
                              title="Delete"
                              onClick={() => open("delete", row)}
                            >
                              <Icon name="Trash2" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, data.total)} of {data.total} records
              </span>
              <div>
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  disabled={page <= 1}
                  onClick={() => setPage((n) => n - 1)}
                  aria-label="Previous page"
                >
                  <Icon name="ChevronLeft" size={16} />
                </button>
                <b>
                  {page} <span>/ {data.pages}</span>
                </b>
                <button
                  className="icon-button"
                  disabled={page >= data.pages}
                  onClick={() => setPage((n) => n + 1)}
                  aria-label="Next page"
                >
                  <Icon name="ChevronRight" size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      {modal === "edit" && canWrite && (
        <RecordForm
          resource={resource}
          record={editing}
          onClose={close}
          onSaved={() => {
            close();
            reload();
          }}
        />
      )}
      {["delete", "post", "cancel"].includes(modal) && (
        <Modal
          title={
            modal === "delete"
              ? `Remove this ${config.singular}?`
              : modal === "post"
                ? "Ready to post this order?"
                : "Cancel this order?"
          }
          description={
            modal === "delete"
              ? "This removes the record from your workspace. Linked or posted records are protected."
              : modal === "post"
                ? "Posting updates inventory and creates balanced accounting entries. The order will be locked for editing."
                : "An unpaid posted order will create reversing stock and journal entries. This cannot be undone."
          }
          onClose={close}
        >
          <div className="confirm-summary">
            <Icon name={modal === "delete" ? "Trash2" : "FileText"} size={23} />
            <div>
              <b>
                {editing?.name ||
                  editing?.invoiceNo ||
                  editing?.billNo ||
                  editing?.description ||
                  `Record #${editing?.id}`}
              </b>
              {editing?.total && <p>{money(editing.total)}</p>}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" disabled={busy} onClick={close}>
              Keep as is
            </button>
            <button
              className={`btn ${modal === "delete" || modal === "cancel" ? "danger" : "primary"}`}
              disabled={busy}
              onClick={() => action(modal)}
            >
              {busy
                ? "Working…"
                : modal === "delete"
                  ? "Remove record"
                  : modal === "post"
                    ? "Post order"
                    : "Cancel order"}
            </button>
          </div>
        </Modal>
      )}
      {modal === "payment" && (
        <PaymentForm
          resource={resource}
          record={editing}
          onClose={close}
          onSaved={() => {
            close();
            reload();
          }}
        />
      )}
      {modal === "view" && (
        <Modal
          title={
            editing.name ||
            editing.invoiceNo ||
            editing.billNo ||
            `${config.singular} #${editing.id}`
          }
          description="The details, all in one place."
          onClose={close}
          wide={config.order}
        >
          <div className="detail-grid">
            {[
              ...new Set([
                ...config.columns,
                ...config.fields.map((f) => f.key),
              ]),
            ]
              .filter((key) => key !== "password")
              .map((key) => (
                <div key={key}>
                  <small>{labelFor(key)}</small>
                  <p>{renderValue(editing, key)}</p>
                </div>
              ))}
          </div>
          {resource === "inbox" && (
            <div className="message-body">{editing.message}</div>
          )}
          {resource === "inbox" && editing.notification && (
            <div className="info-banner">
              <Icon name="Mail" size={17} />
              <div>
                <b>
                  Owner email notification:{" "}
                  {editing.notification.status
                    .toLowerCase()
                    .replaceAll("_", " ")}
                </b>
                <p>
                  {editing.notification.lastError ||
                    (editing.notification.sentAt
                      ? `Sent ${new Date(editing.notification.sentAt).toLocaleString()}`
                      : "This message remains saved in Inbox regardless of email availability.")}
                </p>
              </div>
              {editing.notification.status !== "SENT" && (
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      const result = await request(
                        `/inbox/${editing.id}/notification`,
                        { method: "POST", body: {} },
                      );
                      toast(
                        result.status === "SENT"
                          ? "Email notification sent."
                          : result.status === "NOT_CONFIGURED"
                            ? "Set up the server email provider first."
                            : "Delivery is pending. Check your email provider.",
                      );
                      close();
                      reload();
                    } catch (e) {
                      toast(e.message, "error");
                    }
                  }}
                >
                  Retry email
                </button>
              )}
            </div>
          )}
          {config.order && editing.lines && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {editing.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.product.name}</td>
                      <td>{line.quantity}</td>
                      <td>{money(line.unitPrice)}</td>
                      <td>{money(line.quantity * Number(line.unitPrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {resource === "journal" && editing.lines && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {editing.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.debitAccount?.code || line.creditAccount?.code} ·{" "}
                        {line.debitAccount?.name || line.creditAccount?.name}
                      </td>
                      <td>{money(line.debit)}</td>
                      <td>{money(line.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editing.payments?.length > 0 && (
            <div className="payment-history">
              <h3>Payment history</h3>
              {editing.payments.map((p) => (
                <p key={p.id}>
                  <span>
                    {p.reference} · {p.method}
                  </span>
                  <b>{money(p.amount)}</b>
                </p>
              ))}
            </div>
          )}
          <div className="form-actions">
            {["sales", "purchases", "payroll", "fee-payments"].includes(
              resource,
            ) && (
              <button className="btn" onClick={() => document(editing)}>
                <Icon name="Download" size={16} />
                Download PDF
              </button>
            )}
            {canWrite &&
              config.order &&
              !["PAID", "CANCELLED"].includes(editing.status) && (
                <button
                  className="btn danger"
                  onClick={() => setModal("cancel")}
                >
                  Cancel order
                </button>
              )}
            {canWrite && resource === "inbox" && editing.status === "NEW" && (
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    await request(`/inbox/${editing.id}`, {
                      method: "PUT",
                      body: {
                        name: editing.name,
                        email: editing.email,
                        subject: editing.subject,
                        message: editing.message,
                        status: "READ",
                      },
                    });
                    toast("Message marked as read.");
                    close();
                    reload();
                  } catch (e) {
                    toast(e.message, "error");
                  }
                }}
              >
                Mark as read
              </button>
            )}
            <button className="btn" onClick={close}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
const lookupLabel = (r) =>
  r.name ||
  (r.firstName
    ? `${r.firstName} ${r.lastName || ""}`
    : r.className
      ? `${r.className} · ${r.section}`
      : r.studentName
        ? `${r.studentName} · ${r.feeType} · ${r.amount}`
        : String(r.id));
async function allOptions(resource) {
  const first = await request(
    `/${resource}?pageSize=100&sort=id&direction=asc`,
  );
  const data = [...first.data];
  for (let page = 2; page <= first.pages; page++)
    data.push(
      ...(await request(`/${resource}?pageSize=100&page=${page}`)).data,
    );
  return data;
}
function RecordForm({ resource, record, onClose, onSaved }) {
  const config = catalog[resource];
  const { toast, money } = useWorkspace();
  const initial = Object.fromEntries(
    config.fields.map((f) => [
      f.key,
      f.multiple
        ? record?.guardianLinks?.map((link) => link.guardianId) || []
        : f.type === "password"
          ? ""
          : f.type === "date"
            ? record?.[f.key]?.slice(0, 10) ||
              (f.required ? new Date().toISOString().slice(0, 10) : "")
            : (record?.[f.key] ?? f.default ?? ""),
    ]),
  );
  const [form, setForm] = useState(initial),
    [lines, setLines] = useState(
      record?.lines?.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })) || [{ productId: "", quantity: 1, unitPrice: "" }],
    ),
    [options, setOptions] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState({}),
    [optionsLoading, setOptionsLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const resources = [
      ...new Set([
        ...config.fields.filter((f) => f.resource).map((f) => f.resource),
        ...(config.order ? ["products"] : []),
      ]),
    ];
    Promise.all(resources.map(async (r) => [r, await allOptions(r)]))
      .then((entries) => {
        if (alive) setOptions(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setOptionsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [config]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      const payload = {
        ...form,
        ...(config.order
          ? {
              lines: lines.map((l) => ({
                productId: Number(l.productId),
                quantity: Number(l.quantity),
                unitPrice: Number(l.unitPrice),
              })),
            }
          : {}),
      };
      await request(`/${resource}${record ? `/${record.id}` : ""}`, {
        method: record ? "PUT" : "POST",
        body: payload,
      });
      toast(
        `${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${record ? "updated" : "created"}.`,
      );
      onSaved();
    } catch (reason) {
      setError(reason.message);
      setFields(reason.fields || {});
    } finally {
      setBusy(false);
    }
  };
  const subtotal = lines.reduce(
    (n, l) =>
      n + Math.round(Number(l.unitPrice || 0) * 100) * Number(l.quantity || 0),
    0,
  );
  const net = subtotal - Math.round(Number(form.discount || 0) * 100);
  const total =
    (net + Math.round((net * Number(form.taxRate || 0)) / 100)) / 100;
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${config.singular}`}
      description={
        config.order
          ? "Start with a draft. Review the details, then post when you’re ready."
          : "Thoughtful details make a well-run workspace."
      }
      onClose={onClose}
      wide={config.order}
    >
      <form onSubmit={submit} className="record-form">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {optionsLoading ? (
          <Skeleton rows={3} />
        ) : (
          <div className="form-grid">
            {config.fields.map((f) => {
              const id = `field-${f.key}`;
              const common = {
                id,
                name: f.key,
                required: f.required || (f.key === "password" && !record),
                value: String(form[f.key] ?? ""),
                onChange: (e) =>
                  setForm((v) => ({ ...v, [f.key]: e.target.value })),
                "aria-invalid": Boolean(fields[f.key]),
                "aria-describedby": fields[f.key] ? `${id}-error` : undefined,
              };
              return (
                <label
                  className={f.type === "textarea" ? "full-width" : ""}
                  key={f.key}
                  htmlFor={id}
                >
                  <span>
                    {f.label}
                    {f.required && <i className="required-star">*</i>}
                  </span>
                  {f.type === "relation" ? (
                    <select
                      {...common}
                      multiple={f.multiple}
                      value={f.multiple ? form[f.key] : common.value}
                      onChange={
                        f.multiple
                          ? (e) =>
                              setForm((v) => ({
                                ...v,
                                [f.key]: Array.from(
                                  e.target.selectedOptions,
                                  (option) => Number(option.value),
                                ),
                              }))
                          : common.onChange
                      }
                      disabled={resource === "inventory" && Boolean(record)}
                    >
                      {!f.multiple && (
                        <option value="">Choose {f.label.toLowerCase()}</option>
                      )}
                      {(options[f.resource] || [])
                        .filter(
                          (r) =>
                            r.active !== false || r.id === Number(form[f.key]),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {lookupLabel(r)}
                          </option>
                        ))}
                    </select>
                  ) : f.type === "select" ? (
                    <select {...common}>
                      <option value="">Choose {f.label.toLowerCase()}</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {f.boolean
                            ? o === "true"
                              ? "Active"
                              : "Inactive"
                            : o.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea {...common} maxLength={4000} rows={3} />
                  ) : (
                    <input
                      {...common}
                      type={f.type === "number" ? "number" : f.type}
                      min={f.min ?? 0}
                      max={
                        f.max ?? (f.type === "number" ? 1000000000 : undefined)
                      }
                      step={
                        f.integer ? 1 : f.type === "number" ? 0.01 : undefined
                      }
                      minLength={f.type === "password" ? 12 : undefined}
                      maxLength={f.type === "password" ? 128 : 254}
                      pattern={f.pattern}
                      autoComplete={
                        f.type === "password" ? "new-password" : undefined
                      }
                    />
                  )}
                  {fields[f.key] && (
                    <small className="field-error" id={`${id}-error`}>
                      {fields[f.key]}
                    </small>
                  )}
                </label>
              );
            })}
          </div>
        )}
        {config.order && !optionsLoading && (
          <section className="line-items">
            <div className="line-heading">
              <h3>Order items</h3>
              <button
                className="text-link"
                type="button"
                onClick={() =>
                  setLines((v) => [
                    ...v,
                    { productId: "", quantity: 1, unitPrice: "" },
                  ])
                }
              >
                <Icon name="Plus" size={15} />
                Add item
              </button>
            </div>
            {lines.map((line, i) => (
              <div className="order-line" key={i}>
                <label>
                  Product
                  <select
                    aria-label={`Product ${i + 1}`}
                    required
                    value={line.productId}
                    onChange={(e) => {
                      const product = options.products?.find(
                        (p) => p.id === Number(e.target.value),
                      );
                      setLines((v) =>
                        v.map((l, index) =>
                          index === i
                            ? {
                                ...l,
                                productId: Number(e.target.value),
                                unitPrice:
                                  product?.[
                                    resource === "sales"
                                      ? "salePrice"
                                      : "purchasePrice"
                                  ] || 0,
                              }
                            : l,
                        ),
                      );
                    }}
                  >
                    <option value="">Choose a product</option>
                    {options.products
                      ?.filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Qty
                  <input
                    aria-label={`Quantity ${i + 1}`}
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((v) =>
                        v.map((l, index) =>
                          index === i ? { ...l, quantity: e.target.value } : l,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Unit price
                  <input
                    aria-label={`Unit price ${i + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((v) =>
                        v.map((l, index) =>
                          index === i ? { ...l, unitPrice: e.target.value } : l,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button danger-text"
                  aria-label={`Remove item ${i + 1}`}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((v) => v.filter((_, index) => index !== i))
                  }
                >
                  <Icon name="Trash2" size={16} />
                </button>
              </div>
            ))}
            {Object.entries(fields)
              .filter(([k]) => k.startsWith("lines"))
              .map(([k, v]) => (
                <p className="field-error" key={k}>
                  {v}
                </p>
              ))}
            <div className="order-total">
              <span>
                Subtotal <b>{money(subtotal / 100)}</b>
              </span>
              <span>
                Discount <b>−{money(form.discount)}</b>
              </span>
              <span>
                Tax <b>{form.taxRate || 0}%</b>
              </span>
              <strong>
                Total <b>{money(total)}</b>
              </strong>
            </div>
          </section>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={busy || optionsLoading}>
            {busy ? (
              <>
                <Icon name="LoaderCircle" size={16} />
                Saving…
              </>
            ) : (
              <>
                <Icon name="Check" size={16} />
                {config.order ? "Save draft" : "Save changes"}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PaymentForm({ resource, record, onClose, onSaved }) {
  const { toast, money } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="A payment, neatly recorded"
      description={`Outstanding balance: ${money(record.balance)}`}
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          try {
            await request(`/${resource}/${record.id}/payments`, {
              method: "POST",
              body: data,
            });
            toast("Payment recorded. Your accounts are up to date.");
            onSaved();
          } catch (reason) {
            setError(reason.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-grid">
          <label>
            Amount
            <input
              name="amount"
              type="number"
              required
              min="0.01"
              step="0.01"
              max={record.balance}
              defaultValue={record.balance}
            />
          </label>
          <label>
            Payment method
            <select name="method" required>
              <option>Bank transfer</option>
              <option>Cash</option>
              <option>Card</option>
            </select>
          </label>
          <label>
            Paid on
            <input
              name="paidAt"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Recording…" : "Record payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
