import { useEffect, useState } from "react";
import { useSearch, Link } from "wouter";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function ConfirmEmailChangePage() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setMessage("This confirmation link is missing or invalid.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/users/confirm-email-change`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "That confirmation link is invalid or expired.");
          return;
        }
        setStatus("success");
        setMessage(`Your email has been updated to ${data.email}. You can now log in with it.`);
      } catch {
        setStatus("error");
        setMessage("Could not reach the server. Try again.");
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <div className="bg-white rounded-xl w-[420px] max-w-full border shadow-lg p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Email confirmation</h1>
        {status === "loading" && <p className="text-sm text-muted-foreground">Confirming your new email...</p>}
        {status === "success" && (
          <p className="text-sm bg-muted rounded-md p-3">{message}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{message}</p>
        )}
        <Link href="/login" className="text-sm font-medium text-primary hover:text-primary/90 inline-block">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
