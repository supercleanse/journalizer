import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

const navLinks = [
  { to: "/dashboard", label: "Journal" },
  { to: "/new", label: "New Entry" },
  { to: "/settings", label: "Settings" },
];

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <Link to="/dashboard" className="text-lg font-semibold text-gray-900">
          Journalizer
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {user && (
            <button
              onClick={logout}
              className="ml-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
