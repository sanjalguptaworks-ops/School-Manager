import { useEffect, useState, useCallback } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Users, Clock, Tag } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface PricingTier {
  id: number;
  minStudents: number;
  maxStudents: number | null;
  monthlyPriceRupees: number;
}

interface PendingPayment {
  id: number;
  interval: "monthly" | "annual";
  totalRupees: number;
  razorpayPaymentLinkUrl: string;
  status: "created" | "paid" | "expired" | "cancelled";
  createdAt: string;
}

interface BillingStatus {
  billingMode: "trial" | "manual" | "auto";
  paidUntil: string | null;
  suspendedFrom: string | null;
  suspendedUntil: string | null;
  suspensionReason: "manual" | "billing" | null;
  subscriptionStatus: "none" | "created" | "trialing" | "active" | "halted" | "cancelled";
  studentCount: number;
  tier: PricingTier | null;
  interval: "monthly" | "annual";
  price: { subtotalRupees: number; taxPercent: number; totalRupees: number } | null;
  pendingPayment: PendingPayment | null;
}

const BILLING_MODE_LABEL: Record<BillingStatus["billingMode"], string> = {
  trial: "Free trial",
  manual: "Manual billing",
  auto: "Auto-pay",
};

function isBillingLapsed(status: Pick<BillingStatus, "billingMode" | "paidUntil">): boolean {
  if (status.billingMode === "auto") return false;
  if (!status.paidUntil) return false;
  const today = new Date().toISOString().split("T")[0];
  return today! > status.paidUntil;
}

export default function BillingPage() {
  const { user } = useAppAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingAutoPay, setStartingAutoPay] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/billing/status`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (res.ok) setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== "admin") {
    return <div className="p-6 text-muted-foreground">This page is only available to school admins.</div>;
  }

  const startAutoPay = async () => {
    setStartingAutoPay(true);
    try {
      const res = await fetch(`${BASE_URL}/api/billing/auto-pay/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Could not start auto-pay", variant: "destructive" });
        return;
      }
      window.location.href = data.checkoutUrl;
    } finally {
      setStartingAutoPay(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!status) {
    return <p className="text-sm text-muted-foreground">Couldn't load billing status. Try refreshing the page.</p>;
  }

  const lapsed = isBillingLapsed(status);
  const intervalLabel = status.interval === "annual" ? "year" : "month";
  const suspended = !!status.suspendedFrom;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Your school's subscription status and terms.</p>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <p className="font-semibold">Subscription</p>
            </div>
            <Badge
              variant="outline"
              className={
                lapsed
                  ? "bg-red-100 text-red-800 border-red-200"
                  : status.billingMode === "auto"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : status.billingMode === "manual"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
              }
            >
              {lapsed ? "Billing lapsed" : BILLING_MODE_LABEL[status.billingMode]}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{status.studentCount} student{status.studentCount === 1 ? "" : "s"}</span>
            </div>
            {status.price && status.tier && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tag className="w-4 h-4" />
                <span>₹{status.price.totalRupees.toLocaleString("en-IN")}/{intervalLabel} (incl. {status.price.taxPercent}% tax)</span>
              </div>
            )}
            {status.paidUntil && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <Clock className="w-4 h-4" />
                <span>
                  {status.billingMode === "trial" ? "Trial ends" : "Paid through"} {format(new Date(status.paidUntil), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>

          {suspended && (
            <div className="text-sm bg-red-50 text-red-900 border border-red-200 rounded-md p-3">
              Access is currently suspended{status.suspensionReason === "billing" ? " due to a billing issue" : ""}.
              {status.suspensionReason === "billing" && " Pay the amount due below to restore access."}
            </div>
          )}
          {!suspended && lapsed && (
            <div className="text-sm bg-red-50 text-red-900 border border-red-200 rounded-md p-3">
              Your trial or last paid period has ended. Pay the amount due below to restore access.
            </div>
          )}

          {status.pendingPayment && status.pendingPayment.status === "created" && (
            <div className="border border-amber-200 bg-amber-50 rounded-md p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                Payment due: ₹{status.pendingPayment.totalRupees.toLocaleString("en-IN")} ({status.pendingPayment.interval})
              </p>
              <Button asChild className="w-full">
                <a href={status.pendingPayment.razorpayPaymentLinkUrl} target="_blank" rel="noopener noreferrer">
                  Pay Now
                </a>
              </Button>
            </div>
          )}

          {status.billingMode !== "auto" && (
            <div className="pt-1">
              <Button variant="outline" onClick={startAutoPay} disabled={startingAutoPay} className="w-full">
                {startingAutoPay ? "Starting auto-pay..." : "Set up auto-pay"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">
                Pay automatically each {intervalLabel} instead of waiting for a payment link.
              </p>
            </div>
          )}

          {status.billingMode === "auto" && (
            <p className="text-xs text-muted-foreground">
              Auto-pay is active ({status.subscriptionStatus}). To change your payment method or cancel, contact support.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
