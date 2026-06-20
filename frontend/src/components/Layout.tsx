import React, { useEffect, useRef, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Library,
  Search,
  ListPlus,
  Settings,
  LogOut,
  Film,
  PanelLeftClose,
  PanelLeftOpen,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useTheme, type Theme } from "../context/ThemeContext";

const SIDEBAR_KEY = "intermission-sidebar-collapsed";

export const Layout: React.FC = () => {
  const { signOut, user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "true",
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isDetailPage =
    /^\/(movie|show)\/\d+/.test(location.pathname);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  }, [collapsed]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Search", path: "/search", icon: Search },
    { name: "Library", path: "/library", icon: Library },
    { name: "Watchlist", path: "/watchlist", icon: ListPlus },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--toast-bg)",
            color: "var(--toast-color)",
            border: "1px solid var(--toast-border)",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "var(--toast-bg)",
            },
          },
        }}
      />

      {/* Sidebar for Desktop/Tablet */}
      <aside
        className={`hidden md:flex flex-shrink-0 flex-col transition-all duration-200 ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
        style={{
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className={`flex items-center ${
            collapsed ? "justify-center p-4" : "justify-between p-4 pl-6"
          }`}
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <Film className="w-8 h-8 text-[#10b981] flex-shrink-0" />
            {!collapsed && (
              <h1 className="text-xl font-bold tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
                Intermission
              </h1>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--border-subtle)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="px-2 pt-2">
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex items-center justify-center p-2 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--border-subtle)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                title={collapsed ? item.name : undefined}
                className={`flex items-center rounded-md transition-colors ${
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                }`}
                style={{
                  background: isActive ? "var(--accent-light)" : "transparent",
                  color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontWeight: isActive ? 500 : undefined,
                }}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div
          className={`${collapsed ? "p-2" : "p-4"}`}
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {collapsed ? (
            <div className="flex justify-center mb-2">
              <div
                className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-medium"
                style={{
                  background: "var(--border-subtle)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-focus)",
                }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (profile?.display_name || user?.email || "?").charAt(0).toUpperCase()
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div
                className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-sm font-medium"
                style={{
                  background: "var(--border-subtle)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-focus)",
                }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (profile?.display_name || user?.email || "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {profile?.display_name || user?.email?.split("@")[0]}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  {user?.email}
                </p>
              </div>
            </div>
          )}
          <ThemeSwitcher collapsed={collapsed} />
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center text-sm rounded-md transition-colors ${
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
            }`}
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* Top Bar for Mobile */}
      <header
        className="fixed top-0 left-0 right-0 h-14 backdrop-blur-md z-40 flex items-center justify-between px-4 md:hidden"
        style={{
          background: "var(--glass-bg)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link to="/" className="flex items-center gap-2">
          <Film className="w-6 h-6 text-[#10b981]" />
          <span className="font-bold text-lg tracking-tight" style={{ color: "var(--text-primary)" }}>
            Intermission
          </span>
        </Link>
        <div className="relative" ref={mobileMenuRef}>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={mobileMenuOpen}
            aria-label="Open account menu"
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-medium hover:opacity-85 transition-opacity"
            style={{
              background: "var(--border-subtle)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-focus)",
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              (profile?.display_name || user?.email || "?").charAt(0).toUpperCase()
            )}
          </button>
          {mobileMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl border overflow-hidden"
              style={{
                background: "var(--bg-tertiary)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div
                className="px-3 py-2.5"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {profile?.display_name || user?.email?.split("@")[0]}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {user?.email}
                </p>
              </div>

              <div className="px-2 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <p
                  className="px-1.5 pb-1.5 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Theme
                </p>
                <div
                  className="flex rounded-md p-0.5 gap-0.5"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {(
                    [
                      { value: "light", Icon: Sun, label: "Light" },
                      { value: "dark", Icon: Moon, label: "Dark" },
                      { value: "system", Icon: Monitor, label: "System" },
                    ] as { value: Theme; Icon: React.ElementType; label: string }[]
                  ).map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors"
                      style={{
                        color:
                          theme === value
                            ? "var(--accent-primary)"
                            : "var(--text-secondary)",
                        background:
                          theme === value ? "var(--accent-light)" : "transparent",
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => navigate("/settings")}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--border-subtle)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav
        className="fixed bottom-0 left-0 right-0 h-16 backdrop-blur-md z-40 flex items-center justify-around px-2 md:hidden"
        style={{
          background: "var(--glass-bg)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 py-1 gap-1 transition-colors"
              style={{ color: isActive ? "var(--accent-primary)" : "var(--text-secondary)" }}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative pt-14 pb-16 md:pt-0 md:pb-0">
        <div className="flex-1 overflow-y-auto">
          <div
            className={`mx-auto ${
              isDetailPage ? "max-w-7xl px-4 md:px-6 py-6" : "max-w-6xl p-4 md:p-8"
            }`}
          >
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};
