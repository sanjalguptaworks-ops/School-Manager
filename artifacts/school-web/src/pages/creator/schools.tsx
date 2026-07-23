import { useEffect, useState, useCallback, useRef } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { uploadSchoolLogo } from "@/lib/upload-image";
import { Check, X, Clock, School as SchoolIcon, Settings, Ban, Wallet, Plus, Trash2, Send, Camera } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface School {
  id: number;
  name: string;
  status: "pending" | "approved" | "rejected";
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  logoUrl: string | null;
  suspendedFrom: string | null;
  suspendedUntil: string | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  billingMode: "trial" | "manual" | "auto";
  paidUntil: string | null;
  trialStartedAt: string | null;
  discountPercent: number;
  trialDays: number | null;
  billingInterval: "monthly" | "annual" | null;
  createdAt: string;
}

interface PricingTier {
  id: number;
  minStudents: number;
  maxStudents: number | null;
  monthlyPriceRupees: number;
}

interface OverviewRow {
  schoolId: number;
  name: string;
  studentCount: number;
  tier: PricingTier | null;
  interval: "monthly" | "annual";
  price: { subtotalRupees: number; taxPercent: number; totalRupees: number } | null;
  billingMode: "trial" | "manual" | "auto";
  paidUntil: string | null;
  trialStartedAt: string | null;
  trialDays: number | null;
  discountPercent: number;
}

const BILLING_MODE_LABEL: Record<School["billingMode"], string> = {
  trial: "Free trial",
  manual: "Manual billing",
  auto: "Auto-pay",
};

// Mirrors the backend's isSchoolSuspended() -- checked lazily against
// today's date, no background job involved.
function isCurrentlySuspended(school: School): boolean {
  if (!school.suspendedFrom) return false;
  const today = new Date().toISOString().split("T")[0];
  if (today! < school.suspendedFrom) return false;
  if (school.suspendedUntil && today! > school.suspendedUntil) return false;
  return true;
}

// Mirrors the backend's isBillingLapsed().
function isBillingLapsed(school: { billingMode: School["billingMode"]; paidUntil: string | null }): boolean {
  if (school.billingMode === "auto") return false;
  if (!school.paidUntil) return false;
  const today = new Date().toISOString().split("T")[0];
  return today! > school.paidUntil;
}

function billingBadgeClass(lapsed: boolean, billingMode: School["billingMode"]): string {
  if (lapsed) return "bg-red-100 text-red-800 border-red-200";
  if (billingMode === "auto") return "bg-green-100 text-green-800 border-green-200";
  if (billingMode === "manual") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

function BillingBadge({ school }: { school: { billingMode: School["billingMode"]; paidUntil: string | null } }) {
  const lapsed = isBillingLapsed(school);
  const label = lapsed
    ? "Billing lapsed"
    : `${BILLING_MODE_LABEL[school.billingMode]}${
        school.paidUntil ? ` · until ${format(new Date(school.paidUntil), "MMM d, yyyy")}` : ""
      }`;
  return (
    <Badge variant="outline" className={billingBadgeClass(lapsed, school.billingMode)}>
      {label}
    </Badge>
  );
}

export default function CreatorSchoolsPage() {
  const { user } = useAppAuth();
  const { toast } = useToast();
  const [view, setView] = useState<"schools" | "billing">("schools");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/schools`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setSchools(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== "creator") {
    return <div className="p-6 text-muted-foreground">This page is only available to the platform creator.</div>;
  }

  const act = async (id: number, action: "approve" | "reject") => {
    setActingOn(id);
    try {
      const res = await fetch(`${BASE_URL}/api/schools/${id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        toast({ title: `Failed to ${action} school`, variant: "destructive" });
        return;
      }
      toast({ title: action === "approve" ? "School approved" : "School rejected" });
      await load();
    } finally {
      setActingOn(null);
    }
  };

  const pending = schools.filter((s) => s.status === "pending");
  const other = schools.filter((s) => s.status !== "pending");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schools</h1>
          <p className="text-muted-foreground mt-1">Review new signups and manage every school on the platform.</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <Button
            size="sm"
            variant={view === "schools" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setView("schools")}
          >
            <SchoolIcon className="w-3.5 h-3.5" /> Schools
          </Button>
          <Button
            size="sm"
            variant={view === "billing" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setView("billing")}
          >
            <Wallet className="w-3.5 h-3.5" /> Billing
          </Button>
        </div>
      </div>

      {view === "schools" ? (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Pending approval ({pending.length})
            </h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                          <SchoolIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">Requested {format(new Date(s.createdAt), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1" disabled={actingOn === s.id} onClick={() => act(s.id, "reject")}>
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                        <Button size="sm" className="gap-1" disabled={actingOn === s.id} onClick={() => act(s.id, "approve")}>
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {other.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">All other schools</h2>
              <div className="space-y-2">
                {other.map((s) => {
                  const suspended = isCurrentlySuspended(s);
                  return (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{s.name}</p>
                        <Badge variant={s.status === "approved" ? "default" : "destructive"} className="capitalize">
                          {s.status}
                        </Badge>
                        <BillingBadge school={s} />
                        {suspended && (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="w-3 h-3" /> Suspended
                          </Badge>
                        )}
                      </div>
                      <ManageSchoolDialog school={s} onDone={load} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <BillingView />
      )}
    </div>
  );
}

// ── Manage School Dialog ───────────────────────────────────────────────

function ManageSchoolDialog({ school, onDone }: { school: School; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(school.name);
  const [logoUrl, setLogoUrl] = useState(school.logoUrl || "");
  const [contactEmail, setContactEmail] = useState(school.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(school.contactPhone || "");
  const [address, setAddress] = useState(school.address || "");
  const [emailEnabled, setEmailEnabled] = useState(school.emailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(school.smsEnabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(school.whatsappEnabled);
  const [suspendedFrom, setSuspendedFrom] = useState(school.suspendedFrom || "");
  const [suspendedUntil, setSuspendedUntil] = useState(school.suspendedUntil || "");
  const [discountPercent, setDiscountPercent] = useState(String(school.discountPercent ?? 0));
  const [trialDays, setTrialDays] = useState(school.trialDays != null ? String(school.trialDays) : "");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">(school.billingInterval || "monthly");

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setName(school.name);
      setLogoUrl(school.logoUrl || "");
      setContactEmail(school.contactEmail || "");
      setContactPhone(school.contactPhone || "");
      setAddress(school.address || "");
      setEmailEnabled(school.emailEnabled);
      setSmsEnabled(school.smsEnabled);
      setWhatsappEnabled(school.whatsappEnabled);
      setSuspendedFrom(school.suspendedFrom || "");
      setSuspendedUntil(school.suspendedUntil || "");
      setDiscountPercent(String(school.discountPercent ?? 0));
      setTrialDays(school.trialDays != null ? String(school.trialDays) : "");
      setBillingInterval(school.billingInterval || "monthly");
    }
  };

  const clearSuspension = () => {
    setSuspendedFrom("");
    setSuspendedUntil("");
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image is too large (max 5MB)", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);
    try {
      const url = await uploadSchoolLogo(file);
      setLogoUrl(url);
    } catch (err: any) {
      toast({ title: err?.message || "Could not upload logo", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/schools/${school.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          logoUrl: logoUrl.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          address: address.trim() || null,
          emailEnabled,
          smsEnabled,
          whatsappEnabled,
          suspendedFrom: suspendedFrom || null,
          suspendedUntil: suspendedUntil || null,
          discountPercent: Number(discountPercent) || 0,
          trialDays: trialDays.trim() === "" ? null : Number(trialDays),
          billingInterval,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: data.error || "Failed to save changes", variant: "destructive" });
        return;
      }
      toast({ title: "School updated" });
      setOpen(false);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Settings className="w-3.5 h-3.5" /> Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage {school.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label>School name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>School logo</Label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 border">
                {logoUrl ? (
                  <img src={logoUrl} alt={name} className="w-full h-full object-contain" />
                ) : (
                  <SchoolIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5" />
                {uploadingLogo ? "Uploading..." : logoUrl ? "Change logo" : "Upload logo"}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLogoUrl("")}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Shown in place of the EduCore logo for this school's own users.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact phone</Label>
              <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address / notes</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" rows={2} />
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Communication</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">Welcome emails and notice/exam/fee-due notifications</p>
              </div>
              <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">SMS</p>
                <p className="text-xs text-muted-foreground">Notice/exam/fee-due SMS alerts, sent to any contact with a phone number on file</p>
              </div>
              <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Notice/exam/fee-due WhatsApp alerts, sent to any contact with a phone number on file</p>
              </div>
              <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing</p>
              <BillingBadge school={school} />
            </div>
            <p className="text-xs text-muted-foreground">
              Price is set by the pricing tier this school's student count falls into (see the Billing tab), minus the
              discount below. Trial days only matter while the school hasn't been billed yet — changing it re-anchors
              the trial end date from when the school was approved. Use the Billing tab to generate and send a payment
              link once it's time to bill.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Billing interval</Label>
                <Select value={billingInterval} onValueChange={(v) => setBillingInterval(v as "monthly" | "annual")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discount %</Label>
                <Input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Trial days</Label>
                <Input type="number" min={0} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder="e.g. 30" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduled suspension</p>
              {(suspendedFrom || suspendedUntil) && (
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={clearSuspension}>
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              While suspended, every user at this school is blocked from logging in and from using the app. Leave
              "Until" blank to suspend indefinitely; it lifts automatically the day after "Until".
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Suspended from</Label>
                <Input type="date" value={suspendedFrom} onChange={(e) => setSuspendedFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Until (optional)</Label>
                <Input type="date" value={suspendedUntil} onChange={(e) => setSuspendedUntil(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Billing view (pricing tiers + per-school overview) ──────────────────

function BillingView() {
  return (
    <div className="space-y-8">
      <PricingTiersSection />
      <SchoolsBillingOverview />
    </div>
  );
}

function PricingTiersSection() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/billing/tiers`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setTiers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addTier = async () => {
    const minStudents = Number(newMin);
    const monthlyPriceRupees = Number(newPrice);
    if (!Number.isFinite(minStudents) || newMin.trim() === "" || !Number.isFinite(monthlyPriceRupees) || newPrice.trim() === "") {
      toast({ title: "Min students and monthly price are required", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`${BASE_URL}/api/billing/tiers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minStudents,
          maxStudents: newMax.trim() === "" ? null : Number(newMax),
          monthlyPriceRupees,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: data.error || "Failed to add tier", variant: "destructive" });
        return;
      }
      setNewMin("");
      setNewMax("");
      setNewPrice("");
      await load();
    } finally {
      setAdding(false);
    }
  };

  const deleteTier = async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/billing/tiers/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to delete tier", variant: "destructive" });
      return;
    }
    await load();
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Pricing tiers</h2>
      <Card>
        <CardContent className="p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tiers configured yet — add one below.</p>
          ) : (
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-md border bg-muted/20 text-sm">
                  <span>
                    {t.minStudents}–{t.maxStudents ?? "∞"} students
                  </span>
                  <span className="font-medium">₹{t.monthlyPriceRupees.toLocaleString("en-IN")}/mo</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteTier(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t">
            <Input placeholder="Min students" type="number" value={newMin} onChange={(e) => setNewMin(e.target.value)} />
            <Input placeholder="Max (blank = ∞)" type="number" value={newMax} onChange={(e) => setNewMax(e.target.value)} />
            <Input placeholder="₹/month" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            <Button size="sm" className="gap-1" disabled={adding} onClick={addTier}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SchoolsBillingOverview() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [intervalChoice, setIntervalChoice] = useState<Record<number, "monthly" | "annual">>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/billing/overview`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async (schoolId: number) => {
    const row = rows.find((r) => r.schoolId === schoolId);
    const interval = intervalChoice[schoolId] || row?.interval || "monthly";
    setGeneratingFor(schoolId);
    try {
      const res = await fetch(`${BASE_URL}/api/billing/generate/${schoolId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to generate payment link", variant: "destructive" });
        return;
      }
      toast({
        title: data.emailSent ? "Payment link sent to the school" : "Payment link created (email failed to send)",
        description: data.razorpayPaymentLinkUrl,
      });
      await load();
    } finally {
      setGeneratingFor(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Schools</h2>
      <div className="space-y-2">
        {rows.map((r) => {
          const lapsed = isBillingLapsed(r);
          const chosenInterval = intervalChoice[r.schoolId] || r.interval;
          return (
            <Card key={r.schoolId}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.studentCount} student{r.studentCount === 1 ? "" : "s"}
                      {r.tier ? ` · tier ${r.tier.minStudents}–${r.tier.maxStudents ?? "∞"}` : " · no tier matched"}
                    </p>
                  </div>
                  <Badge variant="outline" className={billingBadgeClass(lapsed, r.billingMode)}>
                    {lapsed
                      ? "Billing lapsed"
                      : `${BILLING_MODE_LABEL[r.billingMode]}${r.paidUntil ? ` · until ${format(new Date(r.paidUntil), "MMM d, yyyy")}` : ""}`}
                  </Badge>
                </div>
                {r.price && (
                  <p className="text-sm text-muted-foreground">
                    ₹{r.price.totalRupees.toLocaleString("en-IN")} / {chosenInterval === "annual" ? "year" : "month"}
                    {" "}(incl. {r.price.taxPercent}% tax{r.discountPercent > 0 ? `, ${r.discountPercent}% school discount` : ""})
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Select
                    value={chosenInterval}
                    onValueChange={(v) => setIntervalChoice((prev) => ({ ...prev, [r.schoolId]: v as "monthly" | "annual" }))}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={generatingFor === r.schoolId || !r.tier}
                    onClick={() => generate(r.schoolId)}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {generatingFor === r.schoolId ? "Generating..." : "Generate & Send Payment Link"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
