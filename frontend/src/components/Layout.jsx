import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const linkClass = (path) =>
    `text-sm px-3 py-1.5 rounded-md ${
      location.pathname === path
        ? "text-white bg-raised"
        : "text-muted hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-surface text-body">
      <nav className="flex items-center h-14 px-6 bg-panel border-b border-edge">
        <Link to="/" className="text-lg font-bold text-accent-light mr-8">
          PulseCheck
        </Link>
        <div className="flex gap-1">
          <Link to="/" className={linkClass("/")}>
            Dashboard
          </Link>
          <Link to="/incidents" className={linkClass("/incidents")}>
            Incidents
          </Link>
          <Link to="/services/new" className={linkClass("/services/new")}>
            Add Service
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user?.avatar_url && (
            <img
              src={user.avatar_url}
              alt=""
              className="w-7 h-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="leading-tight">
            <div className="text-body text-xs font-medium">{user?.name}</div>
            <div className="text-muted text-[11px]">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="border border-edge px-3 py-1 rounded-md text-xs text-muted hover:text-white hover:border-muted cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="max-w-[1200px] mx-auto p-6">{children}</main>
    </div>
  );
}
