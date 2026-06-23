import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, CheckCircle2, Lock, Info } from "lucide-react";

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  // Detect a PASSWORD_RECOVERY session arriving from a Supabase recovery email link.
  // We wait briefly for AuthContext to pick up the session, then if no user is
  // present and no recovery event fired, the user likely landed here without a
  // valid email link — and should be redirected to /forgot-password.
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setHasRecoverySession(true);
      setRecoveryChecked(true);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || session?.user) {
          setHasRecoverySession(true);
          setRecoveryChecked(true);
        }
      }
    );

    // Give the recovery session a moment to propagate.
    const timeout = window.setTimeout(() => {
      setRecoveryChecked(true);
    }, 1500);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [authLoading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

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

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // If the user was authenticated before changing their password, keep
    // them signed in. If they came in via a recovery link, sign them out
    // and send them to /login so they can sign in with the new password.
    if (!user) {
      await supabase.auth.signOut();
      window.setTimeout(() => navigate("/login"), 2500);
    } else {
      window.setTimeout(() => navigate("/dashboard/settings"), 2500);
    }
  };

  const showLoggedInBanner = !!user && hasRecoverySession;
  const showRecoveryPrompt = recoveryChecked && !user && !hasRecoverySession;

  return (
    <AuthLayout>
      <div className="dense-card p-8 border border-theme bg-theme-secondary/50 backdrop-blur-md rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2 text-center lg:text-left">
          <h2 className="text-2xl font-bold text-theme-primary">Set new password</h2>
          <p className="text-sm text-theme-secondary">
            Please enter your new password below.
          </p>
        </div>

        {showLoggedInBanner && (
          <div className="p-4 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-start gap-3 text-[#10b981] text-sm">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>
              You're signed in as <span className="font-semibold">{user?.email}</span>.
              Your new password will be saved to this account.
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-400 text-sm text-left">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-theme-primary mb-1">Password updated successfully</p>
              <p className="text-theme-secondary">
                {user
                  ? "Redirecting you back to settings..."
                  : "Redirecting to login in a few seconds..."}
              </p>
            </div>
          </div>
        ) : showRecoveryPrompt ? (
          <div className="space-y-4 text-center lg:text-left">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm text-left">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-theme-primary mb-1">Invalid or expired link</p>
                <p className="text-theme-secondary">
                  This page requires a valid password recovery link, or you must be
                  signed in to change your password.
                </p>
              </div>
            </div>
            <Link
              to="/forgot-password"
              className="btn-primary py-2.5 w-full flex justify-center items-center"
            >
              Request a new link
            </Link>
            <Link
              to="/login"
              className="block text-center text-xs text-theme-secondary hover:text-theme-primary hover:underline transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-theme-secondary">
                New Password
              </label>
              <PasswordInput
                id="password"
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
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-theme-secondary">
                Confirm New Password
              </label>
              <PasswordInput
                id="confirmPassword"
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
              className="btn-primary py-2.5 w-full flex justify-center items-center gap-2"
            >
              {loading ? "Updating password..." : "Reset password"}
            </button>
          </form>
        )}

        {!success && !showRecoveryPrompt && (
          <div className="pt-2 text-center">
            <Link
              to={user ? "/dashboard/settings" : "/login"}
              className="text-xs text-theme-secondary hover:text-theme-primary hover:underline transition-colors"
            >
              {user ? "Back to settings" : "Back to sign in"}
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
