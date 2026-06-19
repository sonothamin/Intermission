import React, { useEffect, useState } from "react";
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
} from "lucide-react";

const SIDEBAR_KEY = "intermission-sidebar-collapsed";

export const Layout: React.FC = () => {
  const { signOut, user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "true",
  );

  const isDetailPage =
    /^\/(movie|show)\/\d+/.test(location.pathname);

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
    <div className="flex h-screen bg-[#0a0a0a] text-[#ededed] overflow-hidden">
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1f1f1f',
            color: '#ededed',
            border: '1px solid #27272a',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#1f1f1f',
            },
          },
        }}
      />
      {/* Sidebar for Desktop/Tablet */}
      <aside
        className={`hidden md:flex flex-shrink-0 border-r border-[#27272a] bg-[#141414] flex flex-col transition-all duration-200 ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <div
          className={`flex items-center border-b border-[#27272a] ${
            collapsed ? "justify-center p-4" : "justify-between p-4 pl-6"
          }`}
        >
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <Film className="w-8 h-8 text-[#10b981] flex-shrink-0" />
            {!collapsed && (
              <h1 className="text-xl font-bold tracking-tight truncate">
                Intermission
              </h1>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md text-[#52525b] hover:text-[#ededed] hover:bg-[#27272a]/50"
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
              className="w-full flex items-center justify-center p-2 rounded-md text-[#52525b] hover:text-[#ededed] hover:bg-[#27272a]/50"
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
                } ${
                  isActive
                    ? "bg-[#10b981]/10 text-[#10b981] font-medium"
                    : "text-[#a1a1aa] hover:text-[#ededed] hover:bg-[#27272a]/50"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-[#27272a] ${collapsed ? "p-2" : "p-4"}`}>
          {collapsed ? (
            <div className="flex justify-center mb-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-[#27272a] flex items-center justify-center text-sm font-medium text-[#ededed] border border-[#27272a]">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (profile?.display_name || user?.email || "?").charAt(0).toUpperCase()
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#27272a] flex items-center justify-center text-sm font-medium text-[#ededed] border border-[#27272a]">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (profile?.display_name || user?.email || "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-[#ededed]">
                  {profile?.display_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-[#a1a1aa] truncate">{user?.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center text-sm text-[#a1a1aa] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors ${
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* Top Bar for Mobile */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#141414]/90 backdrop-blur-md border-b border-[#27272a] z-40 flex items-center justify-between px-4 md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <Film className="w-6 h-6 text-[#10b981]" />
          <span className="font-bold text-lg tracking-tight">Intermission</span>
        </Link>
        <Link to="/settings" className="w-8 h-8 rounded-full overflow-hidden bg-[#27272a] flex items-center justify-center text-xs font-medium text-[#ededed] border border-[#27272a] hover:opacity-85 transition-opacity">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (profile?.display_name || user?.email || "?").charAt(0).toUpperCase()
          )}
        </Link>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#141414]/95 backdrop-blur-md border-t border-[#27272a] z-40 flex items-center justify-around px-2 md:hidden">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 gap-1 transition-colors ${
                isActive ? "text-[#10b981]" : "text-[#a1a1aa] hover:text-[#ededed]"
              }`}
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
