import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, profileApi } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleButton } from "../components/GoogleButton";
import { PasswordInput } from "../components/PasswordInput";
import { AlertCircle, User, AtSign, Mail, Lock } from "lucide-react";

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Username validation check
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      setError("Username must be 3-30 characters long and contain only letters, numbers, or underscores");
      setLoading(false);
      return;
    }

    // Password validation checks
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    const sanitizedUsername = username.toLowerCase();

    // Call sign up with metadata
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          username: sanitizedUsername,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      // If we got a session (email confirmation is disabled), sync with profiles table
      if (data?.session) {
        try {
          await profileApi.update({
            display_name: name,
            username: sanitizedUsername,
          });
        } catch (profileErr: any) {
          console.error("Failed to update profile display name & username:", profileErr);
        }
        navigate("/");
      } else {
        // If email confirmation is enabled, guide the user to check their email
        navigate("/");
      }
    }
  };

  return (
    <AuthLayout>
      <div className="dense-card p-8 border border-theme bg-theme-secondary/50 backdrop-blur-md rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2 text-center lg:text-left">
          <h2 className="text-2xl font-bold text-theme-primary">Join Intermission</h2>
          <p className="text-sm text-theme-secondary">Track your watch history and analytics</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-theme-secondary">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
                placeholder="Jane Doe"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-theme-secondary">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
                <AtSign className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
                placeholder="janedoe"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-theme-secondary">Email address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-theme-secondary">Password</label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-5 h-5" />}
              className="w-full bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
              placeholder="••••••••"
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-theme-secondary">Confirm Password</label>
            <PasswordInput
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock className="w-5 h-5" />}
              className="w-full bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
              placeholder="••••••••"
              minLength={6}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2 py-2.5 w-full flex justify-center items-center gap-2"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="flex items-center justify-between gap-4">
          <hr className="w-full border-theme" />
          <span className="text-xs text-theme-muted uppercase tracking-wider whitespace-nowrap">or</span>
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

        <p className="text-center text-sm text-theme-secondary">
          Already have an account?{" "}
          <Link to="/login" className="text-[#10b981] hover:text-[#059669] hover:underline transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
