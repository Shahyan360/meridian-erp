import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../lib/context";
import { download, request, queryString } from "../services/api";
import {
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
} from "../components/ui";
import { ResourceView } from "./ResourcePage";

export default function Reports() {
  const { user, money, toast } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const active = ["accounts", "journal", "bank"].includes(params.get("tab"))
    ? params.get("tab")
    : "reports";
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [range, setRange] = useState({}),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0),
    [exporting, setExporting] = useState("");
  useEffect(() => {
    if (user.role === "EMPLOYEE") return;
    let alive = true;
    request(`/reports?${queryString(range)}`)
      .then((d) => {
        if (alive) {
          setData(d);
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
  }, [range, version, user.role]);
  if (user.role === "EMPLOYEE")
    return (
      <EmptyState
        title="A different level of access"
        description="Financial reports are available to managers and administrators."
        icon="ShieldCheck"
      />
    );
  const exportFile = async (format) => {
    setExporting(format);
    try {
      await download(
        `/export/reports?${queryString({ ...range, format })}`,
        `meridian-financial-report.${format}`,
      );
      toast("Your financial report is ready.");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setExporting("");
    }
  };
  return (
    <>
      <div className="module-tabs">
        {[
          ["reports", "Financial overview"],
          ["accounts", "Chart of accounts"],
          ["journal", "Journal"],
          ["bank", "Bank accounts"],
        ].map(([key, title]) => (
          <button
            key={key}
            className={active === key ? "active" : ""}
            onClick={() => setParams({ tab: key })}
          >
            {title}
          </button>
        ))}
      </div>
      {active !== "reports" ? (
        <ResourceView key={active} resource={active} />
      ) : (
        <section>
          <div className="page-heading">
            <div>
              <div className="eyebrow">THE NUMBERS TELL A STORY</div>
              <h1>
                Financial clarity<span className="accent">.</span>
              </h1>
              <p>Know where you stand. Plan where you’re going.</p>
            </div>
            <div className="heading-actions">
              <button
                className="btn"
                disabled={Boolean(exporting)}
                onClick={() => exportFile("csv")}
              >
                <Icon name="Download" size={16} />
                Export CSV
              </button>
              <button
                className="btn primary"
                disabled={Boolean(exporting)}
                onClick={() => exportFile("pdf")}
              >
                <Icon name="FileText" size={16} />
                {exporting === "pdf" ? "Preparing…" : "Download report"}
              </button>
            </div>
          </div>
          <form
            className="report-filter card"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to && from > to) {
                toast("Start date must be before end date.", "error");
                return;
              }
              setLoading(true);
              setRange({ from, to });
            }}
          >
            <Icon name="CalendarDays" />
            <label>
              From
              <input
                aria-label="Report from date"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <span>→</span>
            <label>
              To
              <input
                aria-label="Report to date"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button className="btn" type="submit">
              Apply period
            </button>
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
                setRange({});
              }}
            >
              All time
            </button>
          </form>
          {error ? (
            <ErrorState
              message={error}
              onRetry={() => setVersion((n) => n + 1)}
            />
          ) : loading || !data ? (
            <Skeleton rows={8} />
          ) : (
            <>
              <div className="kpi-grid">
                {[
                  ["Income", data.income, "ArrowUpRight"],
                  ["Expenses", data.expenses, "ArrowDownRight"],
                  ["Net profit", data.profit, "ChartNoAxesCombined"],
                  ["Cash & bank", data.cash, "Banknote"],
                ].map(([label, value, icon], i) => (
                  <section className="kpi-card" key={label}>
                    <div className="kpi-top">
                      <span>{label}</span>
                      <span className={`kpi-icon tone-${i}`}>
                        <Icon name={icon} size={19} />
                      </span>
                    </div>
                    <div className="kpi-value">{money(value)}</div>
                    <p className="muted small">
                      {i < 3
                        ? "For the selected period"
                        : "As of the period end"}
                    </p>
                  </section>
                ))}
              </div>
              <div className="report-columns">
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Profit & loss</h2>
                      <p>The story of your selected period.</p>
                    </div>
                    <Icon name="ChartNoAxesCombined" />
                  </div>
                  <div className="financial-lines">
                    <p>
                      <span>Operating income</span>
                      <b>{money(data.income)}</b>
                    </p>
                    <p>
                      <span>Cost of sales & operating expenses</span>
                      <b>{money(data.expenses)}</b>
                    </p>
                    <p className="financial-total">
                      <span>Net profit / loss</span>
                      <b>{money(data.profit)}</b>
                    </p>
                  </div>
                  <div className="report-mini-grid">
                    <div>
                      <small>ACCOUNTS RECEIVABLE</small>
                      <strong>{money(data.receivables)}</strong>
                      <p>Outstanding customer & fee balances</p>
                    </div>
                    <div>
                      <small>ACCOUNTS PAYABLE</small>
                      <strong>{money(data.payables)}</strong>
                      <p>Outstanding supplier balances</p>
                    </div>
                  </div>
                </section>
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Balance sheet</h2>
                      <p>A snapshot at the end of your period.</p>
                    </div>
                    <Icon name="Layers" />
                  </div>
                  <div className="financial-lines">
                    <p>
                      <span>Assets</span>
                      <b>{money(data.assets)}</b>
                    </p>
                    <p>
                      <span>Liabilities</span>
                      <b>{money(data.liabilities)}</b>
                    </p>
                    <p>
                      <span>Capital & retained earnings</span>
                      <b>{money(data.equity)}</b>
                    </p>
                    <p className="financial-total">
                      <span>Liabilities + equity</span>
                      <b>{money(data.liabilities + data.equity)}</b>
                    </p>
                  </div>
                  <div className="info-banner">
                    <Icon name="ShieldCheck" size={18} />
                    Includes prior-period balances and retained earnings.
                  </div>
                </section>
              </div>
              <section className="card records-card">
                <div className="records-title">
                  <div>
                    <h2>Trial balance</h2>
                    <p>
                      Every debit has its credit. Every detail has its place.
                    </p>
                  </div>
                  <Badge
                    value={data.balanced ? "BALANCED" : "REVIEW REQUIRED"}
                  />
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th>Opening</th>
                        <th>Movement</th>
                        <th>Debit</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.accounts.map((a) => (
                        <tr key={a.id}>
                          <td className="mono">{a.code}</td>
                          <td className="strong">{a.name}</td>
                          <td>
                            <span className="account-type">
                              {a.type.toLowerCase()}
                            </span>
                          </td>
                          <td>{money(a.openingBalance)}</td>
                          <td>{money(a.movement)}</td>
                          <td>{money(a.debit)}</td>
                          <td>{money(a.credit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="5">Total debits and credits</td>
                        <td>{money(data.totalDebit)}</td>
                        <td>{money(data.totalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </>
          )}
        </section>
      )}
    </>
  );
}
