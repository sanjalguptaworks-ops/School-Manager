import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ResetPasswordPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "That reset link is invalid or expired.");
        return;
      }
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
        <div className="bg-white rounded-xl w-[400px] max-w-full border shadow-lg p-8 text-center">
          <p className="text-sm text-destructive">This reset link is missing or invalid.</p>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/90 mt-4 inline-block">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <div className="bg-white rounded-xl w-[400px] max-w-full border shadow-lg p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set a new password</h1>
        </div>

        {success ? (
          <p className="text-sm text-center bg-muted rounded-md p-3">
            Password updated. Redirecting to sign in...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
              />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
