import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { AuthFormCard } from "../components/AuthFormCard";
import { AuthErrorAlert } from "../components/AuthErrorAlert";
import { AuthDivider } from "../components/AuthDivider";
import { FormField, FieldLabel } from "../components/FormField";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { PasswordInput } from "../components/PasswordInput";
import { Mail, Lock, Loader2 } from "lucide-react";

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
      navigate("/dashboard");
    }
  };

  return (
    <AuthLayout>
      <AuthFormCard
        title="Welcome back"
        subtitle="Sign in to your Intermission account"
      >
        <AuthErrorAlert message={error} />

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <FormField
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            placeholder="you@example.com"
            disabled={loading}
          />

          <div className="space-y-1">
            <FieldLabel
              action={
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-[#10b981] hover:text-[#059669] hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              }
            >
              Password
            </FieldLabel>
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
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <AuthDivider />

        <GoogleAuthButton
          disabled={loading}
          onError={(message) => {
            setError(message);
            setLoading(false);
          }}
        />

        <p className="text-center text-xs text-theme-secondary">
          Don't have an account?{" "}
          <Link to="/register" className="text-[#10b981] hover:text-[#059669] hover:underline transition-colors font-medium">
            Sign up
          </Link>
        </p>
      </AuthFormCard>
    </AuthLayout>
  );
};
