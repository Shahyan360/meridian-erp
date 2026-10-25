import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../lib/context";
import { request, download } from "../services/api";
import {
  Badge,
  Counter,
  ErrorState,
  Icon,
  Reveal,
  Skeleton,
} from "../components/ui";

export default function Dashboard() {
  const { user, money, toast, config } = useWorkspace();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [months, setMonths] = useState("6");
  const load = useCallback(
    () =>
      request(`/dashboard?months=${months}`)
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => setError(e.message)),
    [months],
  );
  useEffect(() => {
    load();
    window.addEventListener("app-data-changed", load);
    return () => window.removeEventListener("app-data-changed", load);
  }, [load]);
  const exportReport = async () => {
    try {
      await download("/export/reports?format=pdf", "meridian-report.pdf");
      toast("Your financial report is ready.");
    } catch (e) {
      toast(e.message, "error");
    }
  };
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton rows={10} />;
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: data.settings?.timezone || "Asia/Karachi",
  });
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            YOUR BUSINESS, AT A GLANCE
          </div>
          <h1>
            A clearer view. A better day<span className="accent">.</span>
          </h1>
          <p>
            Welcome back, {user.name.split(" ")[0]}. Let’s make good things
            happen.
          </p>
        </div>
        <div className="heading-actions">
          <span className="date-chip">
            <Icon name="CalendarDays" size={16} />
            {date}
          </span>
          {user.role !== "EMPLOYEE" && (
            <button className="btn" onClick={exportReport}>
              <Icon name="Download" size={16} />
              Export report
            </button>
          )}
        </div>
      </div>
      <Reveal>
        <div className="welcome-banner">
          <div className="banner-copy">
            <span className="banner-tag">
              <span />A LITTLE CLARITY GOES A LONG WAY
            </span>
            <h2>
              Everything connected.
              <br />
              Every possibility, open.
            </h2>
            <p>
              Your people, products, and progress. Working together beautifully.
            </p>
            <Link to="/app/sales" className="banner-link">
              Let’s get to work <Icon name="ArrowUpRight" size={17} />
            </Link>
          </div>
          <div className="banner-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="glass-tile tile-a">
              <Icon name="Package" size={28} />
            </div>
            <div className="glass-tile tile-b">
              <Icon name="ChartNoAxesCombined" size={28} />
            </div>
            <div className="glass-tile tile-c">
              <Icon name="Users" size={28} />
            </div>
            <span className="art-spark spark-a">✦</span>
            <span className="art-spark spark-b">✦</span>
          </div>
          <span className="banner-index">01 / YOUR WORKSPACE</span>
        </div>
      </Reveal>
      <div className="kpi-grid">
        {[
          {
            label: "Revenue this month",
            value: data.revenue,
            format: money,
            icon: "Banknote",
            change: `${data.revenueChange >= 0 ? "+" : ""}${data.revenueChange}%`,
            note: "vs. last month",
            trend: data.revenueChange >= 0 ? "up" : "down",
            points: data.trend.map((t) => t.revenue),
          },
          {
            label: "Sales orders",
            value: data.orders,
            icon: "ShoppingBag",
            change: `${data.recentSales.filter((s) => s.status === "DRAFT").length} drafts`,
            note: "in your latest orders",
            points: [2, 3, 2, 5, 4, data.orders],
          },
          {
            label: "Active customers",
            value: data.customers,
            icon: "Users",
            change: "Connected",
            note: "and growing together",
            points: [1, 2, 3, 5, 7, data.customers],
          },
          {
            label: "Inventory value",
            value: data.inventoryValue,
            format: money,
            icon: "Boxes",
            change: `${data.lowStock.length} low stock`,
            note: "items need attention",
            trend: "warning",
            points: [7, 6, 8, 5, 6, 7],
          },
        ].map((k, i) => (
          <Reveal delay={i * 0.05} key={k.label}>
            <section className="kpi-card">
              <div className="kpi-top">
                <span>{k.label}</span>
                <span className={`kpi-icon tone-${i}`}>
                  <Icon name={k.icon} size={18} />
                </span>
              </div>
              <div className="kpi-value">
                <Counter value={k.value} format={k.format} />
                <Sparkline values={k.points} index={i} />
              </div>
              <div className="kpi-note">
                <span className={k.trend || "up"}>
                  {i === 0 && (
                    <Icon
                      name={
                        k.trend === "down" ? "ArrowDownRight" : "ArrowUpRight"
                      }
                      size={13}
                    />
                  )}
                  {k.change}
                </span>
                <small>{k.note}</small>
              </div>
            </section>
          </Reveal>
        ))}
      </div>
      <div className="dashboard-grid">
        <Reveal className="revenue-section">
          <section className="card">
            <div className="card-heading">
              <div>
                <h2>
                  Revenue overview{" "}
                  <span
                    className="info-dot"
                    title="Totals from posted and paid sales, including tax"
                  >
                    i
                  </span>
                </h2>
                <p>A little perspective on your progress.</p>
              </div>
              <select
                aria-label="Chart period"
                className="compact-select"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              >
                <option value="6">Last 6 months</option>
                <option value="12">Last 12 months</option>
              </select>
            </div>
            <div className="chart-summary">
              <b>{money(data.trend.reduce((n, t) => n + t.revenue, 0))}</b>
              <span className="chart-legend">
                <i />
                Revenue <i className="legend-secondary" />
                Purchases
              </span>
            </div>
            <RevenueChart data={data.trend} money={money} />
            <div className="chart-footnote">
              <span className="live-dot" />
              Live figures from your workspace
              <span>{config.currency} · Includes tax</span>
            </div>
          </section>
        </Reveal>
        <Reveal delay={0.1}>
          <section className="card stock-card">
            <div className="card-heading">
              <div>
                <h2>Inventory health</h2>
                <p>A well-stocked business runs better.</p>
              </div>
              <Link
                className="icon-button"
                aria-label="View inventory"
                to="/app/inventory"
              >
                <Icon name="ArrowUpRight" />
              </Link>
            </div>
            <InventoryDonut data={data.categoryStock} total={data.stockCount} />
            <div className="stock-legend">
              {data.categoryStock.slice(0, 5).map((c, i) => (
                <div key={c.name}>
                  <span>
                    <i style={{ background: palette[i % palette.length] }} />
                    {c.name}
                  </span>
                  <b>
                    {c.value.toLocaleString()} <small>units</small>
                  </b>
                </div>
              ))}
            </div>
            <Link to="/app/inventory" className="stock-alert">
              <Icon name="CircleAlert" size={16} />
              <span>{data.lowStock.length} products running low</span>
              <Icon name="ArrowRight" size={15} />
            </Link>
          </section>
        </Reveal>
      </div>
      <div className="dashboard-grid bottom-grid">
        <Reveal>
          <section className="card recent-orders">
            <div className="card-heading">
              <div>
                <h2>Recent orders</h2>
                <p>Small details. Big picture.</p>
              </div>
              <Link className="text-link" to="/app/sales">
                View all orders <Icon name="ArrowUpRight" size={15} />
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <Link
                          to={`/app/sales?q=${encodeURIComponent(s.invoiceNo)}`}
                          className="invoice-link"
                        >
                          {s.invoiceNo}
                        </Link>
                        <small>
                          {new Date(s.issueDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </small>
                      </td>
                      <td>
                        <span className="customer-cell">
                          <span className={`mini-avatar mini-${i % 4}`}>
                            {s.customerName.slice(0, 1)}
                          </span>
                          {s.customerName}
                        </span>
                      </td>
                      <td className="strong">{money(s.total)}</td>
                      <td>
                        <Badge value={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.recentSales.length && (
                <p className="panel-padding muted">
                  Your first order is the beginning of something good.
                </p>
              )}
            </div>
            <div className="table-bottom">
              <span>Latest updates across your workspace</span>
              <span>
                <Icon name="CircleCheck" size={14} />
                All synced
              </span>
            </div>
          </section>
        </Reveal>
        <Reveal delay={0.1}>
          <section className="card top-products">
            <div className="card-heading">
              <div>
                <h2>Top products</h2>
                <p>This month’s standouts.</p>
              </div>
              <Icon name="Package" size={19} />
            </div>
            <div className="top-product-list">
              {data.topProducts.map((p, i) => (
                <Link
                  to={`/app/products?q=${encodeURIComponent(p.name)}`}
                  key={p.id}
                >
                  <span className={`product-illustration product-${i}`}>
                    <Icon
                      name={
                        ["ContactRound", "Package", "Layers", "ShoppingBag"][i]
                      }
                      size={24}
                    />
                  </span>
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.units} sold · {p.category}
                    </small>
                    <div className="product-progress">
                      <i
                        style={{
                          width: `${Math.max(12, (p.revenue / (data.topProducts[0]?.revenue || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <strong>{money(p.revenue, true)}</strong>
                </Link>
              ))}
            </div>
            <Link className="text-link product-footer" to="/app/products">
              Explore your catalog <Icon name="ArrowRight" size={15} />
            </Link>
          </section>
        </Reveal>
      </div>
      <div className="dashboard-grid final-grid">
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Make your next move</h2>
              <p>Less searching. More doing.</p>
            </div>
            <Icon name="Zap" size={19} />
          </div>
          <div className="quick-actions">
            {(user.role === "EMPLOYEE"
              ? [
                  ["sales", "View sales", "ShoppingBag"],
                  ["inventory", "Check stock", "Boxes"],
                  ["customers", "Find a customer", "Users"],
                ]
              : [
                  ["sales", "Create an order", "ShoppingBag"],
                  ["products", "Add a product", "Package"],
                  ["expenses", "Record expense", "Receipt"],
                ]
            ).map(([r, t, icon]) => (
              <Link
                to={`/app/${r}${user.role === "EMPLOYEE" ? "" : "?new=1"}`}
                key={r}
              >
                <span>
                  <Icon name={icon} size={19} />
                </span>
                <b>{t}</b>
                <Icon name="ArrowUpRight" size={16} />
              </Link>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Workspace activity</h2>
              <p>Good things are happening.</p>
            </div>
            <Icon name="CheckCheck" size={18} />
          </div>
          <div className="activity-list">
            {data.activity.slice(0, 3).map((a) => (
              <div key={a.id}>
                <span className="activity-dot" />
                <div>
                  <b>
                    {a.action} {a.entity.replaceAll("-", " ")}
                  </b>
                  <p>{a.actor}</p>
                </div>
                <small>
                  {new Date(a.createdAt).toLocaleTimeString("en", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            ))}
            {!data.activity.length && (
              <p className="muted">Your workspace is up to date.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
function Sparkline({ values, index }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((v, i) => `${i * 14},${32 - (v / max) * 26}`)
    .join(" ");
  return (
    <svg
      className={`sparkline spark-${index}`}
      viewBox="0 0 74 36"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const palette = ["#3868ed", "#7e9df4", "#a9bff7", "#c8d6fa", "#e2e9fa"];
function InventoryDonut({ data, total }) {
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={`${total} units in stock by category`}
      >
        <circle
          cx="90"
          cy="90"
          r="67"
          fill="none"
          stroke="var(--line)"
          strokeWidth="16"
        />
        {data.map((c, i) => {
          const length = total ? (c.value / total) * 421 : 0;
          const start = offset;
          offset += length;
          return (
            <circle
              key={c.name}
              cx="90"
              cy="90"
              r="67"
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth="16"
              strokeDasharray={`${Math.max(0, length - 4)} ${421 - Math.max(0, length - 4)}`}
              strokeDashoffset={-start}
              transform="rotate(-90 90 90)"
            >
              <title>
                {c.name}: {c.value} units
              </title>
            </circle>
          );
        })}
      </svg>
      <div>
        <strong>
          <Counter value={total} />
        </strong>
        <span>Total units in stock</span>
      </div>
    </div>
  );
}
function RevenueChart({ data, money }) {
  const [hover, setHover] = useState(null);
  const max =
    Math.max(...data.flatMap((d) => [d.revenue, d.purchases]), 1000) * 1.15;
  const x = (i) => 55 + (i / Math.max(1, data.length - 1)) * 635;
  const y = (v) => 202 - (v / max) * 170;
  const path = (key) =>
    data.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[key])}`).join(" ");
  return (
    <div className="revenue-chart">
      <svg
        viewBox="0 0 725 245"
        role="group"
        aria-label="Revenue and purchases by month"
      >
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4978f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4978f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="55"
              x2="700"
              y1={202 - i * 43}
              y2={202 - i * 43}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <text x="0" y={206 - i * 43} fill="var(--muted)" fontSize="10">
              {new Intl.NumberFormat("en", {
                notation: "compact",
                maximumFractionDigits: 0,
              }).format((max * i) / 4)}
            </text>
          </g>
        ))}
        <path
          d={`${path("revenue")} L690,202 L55,202 Z`}
          fill="url(#revenue-fill)"
        />
        <path
          className="chart-line"
          d={path("purchases")}
          fill="none"
          stroke="#b6c6ec"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <path
          className="chart-line"
          d={path("revenue")}
          fill="none"
          stroke="#3868ed"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <g key={d.key}>
            <text
              x={x(i)}
              y="231"
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="10"
            >
              {d.month}
            </text>
            <circle
              cx={x(i)}
              cy={y(d.revenue)}
              r={hover === i ? 6 : 3}
              fill="#3868ed"
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <rect
              x={x(i) - 18}
              y="15"
              width="36"
              height="192"
              fill="transparent"
              tabIndex="0"
              role="button"
              aria-label={`${d.month}: revenue ${money(d.revenue)}, purchases ${money(d.purchases)}`}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="chart-tooltip"
          role="status"
          style={{
            left: `${Math.min(70, 9 + (hover / Math.max(1, data.length - 1)) * 75)}%`,
          }}
        >
          <b>{data[hover].month}</b>
          <span>Revenue {money(data[hover].revenue)}</span>
          <span>Purchases {money(data[hover].purchases)}</span>
        </div>
      )}
    </div>
  );
}
