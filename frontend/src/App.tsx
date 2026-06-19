import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Loader2, Film } from "lucide-react";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";

import { Dashboard } from "./pages/Dashboard";
import { Search } from "./pages/Search";
import { Library } from "./pages/Library";
import { Watchlist } from "./pages/Watchlist";
import { Settings } from "./pages/Settings";
import { MovieDetail } from "./pages/MovieDetail";
import { ShowDetail } from "./pages/ShowDetail";

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
    </Router>
  </ThemeProvider>
);

export const App = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

export default App;
