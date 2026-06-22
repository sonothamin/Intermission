import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, profileApi } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { AuthFormCard } from "../components/AuthFormCard";
import { AuthErrorAlert } from "../components/AuthErrorAlert";
import { AuthDivider } from "../components/AuthDivider";
import { FormField, FieldLabel } from "../components/FormField";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { PasswordInput } from "../components/PasswordInput";
import { User, AtSign, Mail, Lock } from "lucide-react";

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
        navigate("/dashboard");
      } else {
        // If email confirmation is enabled, guide the user to check their email
        navigate("/login?check-email=1");
      }
    }
  };

  return (
    <AuthLayout>
      <AuthFormCard
        title="Join Intermission"
        subtitle="Track your watch history and analytics"
      >
        <AuthErrorAlert message={error} />

        <form onSubmit={handleRegister} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Full Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              placeholder="Jane Doe"
              disabled={loading}
            />

            <FormField
              label="Username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<AtSign className="w-4 h-4" />}
              placeholder="janedoe"
              disabled={loading}
            />
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel>Password</FieldLabel>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                className="w-full py-2 text-sm bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
                placeholder="••••••••"
                minLength={6}
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <FieldLabel>Confirm Password</FieldLabel>
              <PasswordInput
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                className="w-full py-2 text-sm bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary"
                placeholder="••••••••"
                minLength={6}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-1 py-2 w-full flex justify-center items-center gap-2"
          >
            {loading ? "Creating account..." : "Create account"}
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
          Already have an account?{" "}
          <Link to="/login" className="text-[#10b981] hover:text-[#059669] hover:underline transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </AuthFormCard>
    </AuthLayout>
  );
};
