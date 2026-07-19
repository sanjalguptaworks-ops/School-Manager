import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <div className="bg-white rounded-xl w-[400px] max-w-full border shadow-lg p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset your password</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <p className="text-sm text-center bg-muted rounded-md p-3">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/login" className="font-medium text-primary hover:text-primary/90">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
