import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { AlertCircle, CheckCircle2, ArrowLeft, Mail } from "lucide-react";

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="dense-card p-8 border border-theme bg-theme-secondary/50 backdrop-blur-md rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2 text-center lg:text-left">
          <h2 className="text-2xl font-bold text-theme-primary">Reset password</h2>
          <p className="text-sm text-theme-secondary">
            Enter your email and we'll send you instructions to reset your password.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success ? (
          <div className="space-y-6 text-center lg:text-left">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-400 text-sm text-left">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-theme-primary mb-1">Check your email</p>
                <p className="text-theme-secondary">
                  We have sent a password recovery link to <span className="font-medium text-theme-primary">{email}</span>.
                </p>
              </div>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-sm text-[#10b981] hover:text-[#059669] font-medium transition-colors w-full"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-theme-secondary">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary py-2.5 w-full flex justify-center items-center gap-2"
            >
              {loading ? "Sending link..." : "Send recovery link"}
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
