import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleButton } from "../components/GoogleButton";
import { PasswordInput } from "../components/PasswordInput";
import { AlertCircle, Mail, Lock } from "lucide-react";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/");
    }
  };

  return (
    <AuthLayout>
      <div className="dense-card p-6 sm:p-7 border border-theme bg-theme-secondary/50 backdrop-blur-md rounded-2xl shadow-xl space-y-4">
        <div className="space-y-1 text-center lg:text-left">
          <h2 className="text-2xl font-bold text-theme-primary">Welcome back</h2>
          <p className="text-xs text-theme-secondary">Sign in to your Intermission account</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-theme-secondary">Email address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 py-2 text-sm bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-medium text-theme-secondary">Password</label>
              <Link
                to="/forgot-password"
                className="text-[11px] text-[#10b981] hover:text-[#059669] hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              className="w-full py-2 text-sm bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-1 py-2 w-full flex justify-center items-center gap-2"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="flex items-center justify-between gap-4">
          <hr className="w-full border-theme" />
          <span className="text-[10px] text-theme-muted uppercase tracking-wider whitespace-nowrap">or</span>
          <hr className="w-full border-theme" />
        </div>

        <GoogleButton
          onClick={async () => {
            setLoading(true);
            setError(null);
            const { error: oauthError } =
              await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin },
              });
            if (oauthError) {
              setError(oauthError.message);
              setLoading(false);
            }
          }}
          disabled={loading}
          label="Continue with Google"
        />

        <p className="text-center text-xs text-theme-secondary">
          Don't have an account?{" "}
          <Link to="/register" className="text-[#10b981] hover:text-[#059669] hover:underline transition-colors font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
