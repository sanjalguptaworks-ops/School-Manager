import { useEffect, useState, useCallback } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, School as SchoolIcon, Settings, Ban } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface School {
  id: number;
  name: string;
  status: "pending" | "approved" | "rejected";
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  suspendedFrom: string | null;
  suspendedUntil: string | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
  createdAt: string;
}

// Mirrors the backend's isSchoolSuspended() -- checked lazily against
// today's date, no background job involved.
function isCurrentlySuspended(school: School): boolean {
  if (!school.suspendedFrom) return false;
  const today = new Date().toISOString().split("T")[0];
  if (today! < school.suspendedFrom) return false;
  if (school.suspendedUntil && today! > school.suspendedUntil) return false;
  return true;
}

export default function CreatorSchoolsPage() {
  const { user } = useAppAuth();
  const { toast } = useToast();
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
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schools</h1>
        <p className="text-muted-foreground mt-1">Review new signups and manage every school on the platform.</p>
      </div>

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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.name}</p>
                    <Badge variant={s.status === "approved" ? "default" : "destructive"} className="capitalize">
                      {s.status}
                    </Badge>
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
    </div>
  );
}

// ── Manage School Dialog ───────────────────────────────────────────────

function ManageSchoolDialog({ school, onDone }: { school: School; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [name, setName] = useState(school.name);
  const [contactEmail, setContactEmail] = useState(school.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(school.contactPhone || "");
  const [address, setAddress] = useState(school.address || "");
  const [emailEnabled, setEmailEnabled] = useState(school.emailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(school.smsEnabled);
  const [suspendedFrom, setSuspendedFrom] = useState(school.suspendedFrom || "");
  const [suspendedUntil, setSuspendedUntil] = useState(school.suspendedUntil || "");

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setName(school.name);
      setContactEmail(school.contactEmail || "");
      setContactPhone(school.contactPhone || "");
      setAddress(school.address || "");
      setEmailEnabled(school.emailEnabled);
      setSmsEnabled(school.smsEnabled);
      setSuspendedFrom(school.suspendedFrom || "");
      setSuspendedUntil(school.suspendedUntil || "");
    }
  };

  const clearSuspension = () => {
    setSuspendedFrom("");
    setSuspendedUntil("");
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
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          address: address.trim() || null,
          emailEnabled,
          smsEnabled,
          suspendedFrom: suspendedFrom || null,
          suspendedUntil: suspendedUntil || null,
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
            <div className="flex items-center justify-between opacity-60">
              <div>
                <p className="text-sm font-medium">SMS</p>
                <p className="text-xs text-muted-foreground">Coming soon — no SMS provider is connected yet</p>
              </div>
              <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} disabled />
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
