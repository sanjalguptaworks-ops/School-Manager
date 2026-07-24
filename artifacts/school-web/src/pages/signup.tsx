import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function SignupPage() {
  const [schoolName, setSchoolName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
        <div className="bg-white rounded-xl w-[420px] max-w-full border shadow-lg p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Almost there</h1>
          <p className="text-sm text-muted-foreground">
            Your school <span className="font-medium text-foreground">{schoolName}</span> has been submitted for
            approval. You'll be able to log in with <span className="font-medium text-foreground">{email}</span>{" "}
            once it's approved.
          </p>
          <Link href="/login" className="text-sm font-medium text-primary hover:text-primary/90 inline-block">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-10">
      <div className="bg-white rounded-xl w-[420px] max-w-full border shadow-lg p-8">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="PathshalaHQ" className="h-10 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign up your school</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            You'll be the first admin. A quick approval is required before you can log in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="schoolName">School name</Label>
            <Input
              id="schoolName"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Greenwood High School"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Submitting..." : "Sign up"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By signing up you agree to our{" "}
            <Link href="/terms" className="underline hover:text-primary">Terms</Link>{" "}and{" "}
            <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary/90">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
