import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Loader2, Film } from "lucide-react";
import { Layout } from "./components/Layout";

// Public auth pages — small, no heavy dependencies. Lazy-load to avoid
// pulling the protected app shell into the Login/Register bundle.
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() =>
  import("./pages/ForgotPassword").then((m) => ({ default: m.ForgotPassword }))
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((m) => ({ default: m.ResetPassword }))
);

// Protected app pages. Dashboard pulls in recharts, MediaDetail pulls in
// MediaHero, etc. Lazy-loading them keeps the initial payload small and
// the protected shell responsive.
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Search = lazy(() => import("./pages/Search").then((m) => ({ default: m.Search })));
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const Watchlist = lazy(() => import("./pages/Watchlist").then((m) => ({ default: m.Watchlist })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const MovieDetail = lazy(() =>
  import("./pages/MovieDetail").then((m) => ({ default: m.MovieDetail }))
);
const ShowDetail = lazy(() =>
  import("./pages/ShowDetail").then((m) => ({ default: m.ShowDetail }))
);

const PageFallback: React.FC = () => (
  <div className="h-screen flex flex-col items-center justify-center bg-theme-primary text-theme-primary gap-4">
    <div className="flex items-center gap-3">
      <Film className="w-8 h-8 text-[#10b981]" />
      <span className="font-bold text-2xl tracking-tight" style={{ color: "var(--text-primary)" }}>
        Intermission
      </span>
    </div>
    <Loader2 className="w-6 h-6 text-[#10b981] animate-spin" />
  </div>
);

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-theme-primary text-theme-primary">
        <div className="flex items-center gap-3 mb-6">
          <Film className="w-10 h-10 text-[#10b981]" />
          <span className="font-bold text-3xl tracking-tight" style={{ color: "var(--text-primary)" }}>Intermission</span>
        </div>
        <Loader2 className="w-6 h-6 text-[#10b981] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Inner app — needs to be inside AuthProvider to use ThemeProvider
const AppInner = () => (
  <ThemeProvider>
    <Router>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route path="library" element={<Library />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="settings" element={<Settings />} />
            <Route path="movie/:id" element={<MovieDetail />} />
            <Route path="show/:id" element={<ShowDetail />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  </ThemeProvider>
);

export const App = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

export default App;
