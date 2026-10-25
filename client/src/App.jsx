import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Component, lazy, Suspense } from "react";
import { WorkspaceProvider, useWorkspace } from "./lib/context";
import Shell from "./components/Shell";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ResourcePage = lazy(() => import("./pages/ResourcePage"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
import {
  PublicLayout,
  Landing,
  About,
  Contact,
  Login,
  NotFound,
} from "./pages/PublicPages";
import { Icon } from "./components/ui";
import "./App.css";
const ChatWidget = lazy(() => import("./components/ChatWidget"));
function Protected() {
  const { user, loading, connectionError } = useWorkspace();
  if (loading)
    return (
      <div className="boot">
        <Icon name="LoaderCircle" />
        Opening your workspace…
      </div>
    );
  if (connectionError)
    return (
      <div className="boot">
        <p>{connectionError}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reconnect
        </button>
      </div>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="boot">
        <h1>A little interruption.</h1>
        <p>Your data is safe. Reload to reopen your workspace.</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <WorkspaceProvider>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <Suspense
            fallback={<div className="boot">Opening your workspace…</div>}
          >
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Landing />} />
                <Route path="about" element={<About />} />
                <Route path="contact" element={<Contact />} />
                <Route path="login" element={<Login />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route element={<Protected />}>
                <Route path="app" element={<Shell />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path=":resource" element={<ResourcePage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
          <Suspense fallback={null}>
            <ChatWidget />
          </Suspense>
        </WorkspaceProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
