import { useEffect, useRef, useId, useState } from "react";
import { motion, useReducedMotion, animate } from "framer-motion";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  ContactRound,
  ChartNoAxesCombined,
  Receipt,
  GraduationCap,
  Inbox,
  Settings2,
  Search,
  Bell,
  Plus,
  X,
  Menu,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCheck,
  Download,
  Pencil,
  Trash2,
  MoreHorizontal,
  LoaderCircle,
  CircleHelp,
  Sparkles,
  Send,
  Mail,
  ShieldCheck,
  Command,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  CalendarDays,
  CircleCheck,
  CircleAlert,
  Building2,
  CreditCard,
  Globe,
  Layers,
  Zap,
  Heart,
  UserRound,
  Eye,
  FileText,
  LockKeyhole,
  ArrowLeft,
  Copy,
  Banknote,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
export const icons = {
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  ContactRound,
  ChartNoAxesCombined,
  Receipt,
  GraduationCap,
  Inbox,
  Settings2,
  Search,
  Bell,
  Plus,
  X,
  Menu,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCheck,
  Download,
  Pencil,
  Trash2,
  MoreHorizontal,
  LoaderCircle,
  CircleHelp,
  Sparkles,
  Send,
  Mail,
  ShieldCheck,
  Command,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  CalendarDays,
  CircleCheck,
  CircleAlert,
  Building2,
  CreditCard,
  Globe,
  Layers,
  Zap,
  Heart,
  UserRound,
  Eye,
  FileText,
  LockKeyhole,
  ArrowLeft,
  Copy,
  Banknote,
  CheckCircle2,
  MessageCircle,
};
export function Icon({ name, size = 19, ...props }) {
  const Component = icons[name] || Package;
  return (
    <Component size={size} strokeWidth={1.7} aria-hidden="true" {...props} />
  );
}
export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 18V6l9 7 9-7v12M3 6l9 7 9-7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="m8 18 4-3 4 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          meridian<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Badge({ value }) {
  const label =
    typeof value === "boolean"
      ? value
        ? "Active"
        : "Inactive"
      : String(value || "DRAFT")
          .replaceAll("_", " ")
          .toLowerCase();
  return (
    <span className={`badge ${label.replaceAll(" ", "-").toLowerCase()}`}>
      <i />
      {label}
    </span>
  );
}
export function Skeleton({ rows = 5 }) {
  return (
    <div className="skeleton-wrap" role="status" aria-label="Loading data">
      {Array.from({ length: rows }, (_, i) => (
        <div
          className="skeleton"
          key={i}
          style={{ width: i % 2 ? "86%" : "100%" }}
        />
      ))}
    </div>
  );
}
export function EmptyState({
  icon = "Package",
  title = "A fresh start",
  description = "Your records will appear here. Add your first one to get things moving.",
  children,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <Icon name="CircleAlert" />
      <div>
        <b>Something needs a second try</b>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          <Icon name="RefreshCw" size={16} />
          Retry
        </button>
      )}
    </div>
  );
}
export function Modal({ title, description, onClose, children, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [
      ...ref.current.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
      ),
    ];
    focusable()[0]?.focus();
    const handle = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        className={`modal ${wide ? "wide-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="X" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Reveal({ children, className = "", delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, delay }}
    >
      {children}
    </motion.div>
  );
}
export function Counter({
  value,
  format = (v) => Math.round(v).toLocaleString(),
}) {
  const [display, setDisplay] = useState(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const control = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: setDisplay,
    });
    return () => control.stop();
  }, [value, reduce]);
  return <span>{format(reduce ? value : display)}</span>;
}
