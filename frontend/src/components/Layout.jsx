import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const linkClass = (path) =>
    `text-sm px-3 py-1.5 rounded-md ${
      location.pathname === path
        ? "text-white bg-raised"
        : "text-muted hover:text-white"
    }`;

  const mobileLinkClass = (path) =>
    `block text-sm px-3 py-2 rounded-md ${
      location.pathname === path
        ? "text-white bg-raised"
        : "text-muted hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-surface text-body">
      <nav className="relative bg-panel border-b border-edge">
        <div className="flex items-center h-14 px-4 sm:px-6">
          <Link to="/" className="text-lg font-bold text-accent-light mr-8">
            PulseCheck
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-1">
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

          {/* Desktop user info */}
          <div className="hidden md:flex ml-auto items-center gap-3 text-sm">
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

          {/* Hamburger button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden ml-auto text-muted hover:text-white p-2 cursor-pointer"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <>
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="17" y2="6" />
                  <line x1="3" y1="10" x2="17" y2="10" />
                  <line x1="3" y1="14" x2="17" y2="14" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div className="md:hidden border-t border-edge bg-panel px-4 py-3 flex flex-col gap-1">
            <Link to="/" className={mobileLinkClass("/")}>
              Dashboard
            </Link>
            <Link to="/incidents" className={mobileLinkClass("/incidents")}>
              Incidents
            </Link>
            <Link to="/services/new" className={mobileLinkClass("/services/new")}>
              Add Service
            </Link>
            <div className="border-t border-edge mt-2 pt-3 flex items-center gap-3">
              {user?.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="leading-tight flex-1 min-w-0">
                <div className="text-body text-xs font-medium truncate">
                  {user?.name}
                </div>
                <div className="text-muted text-[11px] truncate">
                  {user?.email}
                </div>
              </div>
              <button
                onClick={logout}
                className="border border-edge px-3 py-1.5 rounded-md text-xs text-muted hover:text-white hover:border-muted cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
      <main className="max-w-[1200px] mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
