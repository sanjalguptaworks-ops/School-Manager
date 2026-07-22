import { useEffect, useState, useCallback } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarOff, Check, Plus, X, Users } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface LeaveRequest {
  id: number;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  requester?: { id: number; name: string; role: string };
}

interface SubstituteSuggestion {
  dayOfWeek: string;
  periodNumber: number;
  subject: string;
  class: string;
  freeTeachers: { id: number; name: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function LeaveRequestsPage() {
  const { user } = useAppAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`${BASE_URL}/api/leave-requests${qs}`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setItems(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReview = async (id: number, status: "approved" | "rejected") => {
    const res = await fetch(`${BASE_URL}/api/leave-requests/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast({ title: "Failed to update request", variant: "destructive" });
      return;
    }
    toast({ title: status === "approved" ? "Request approved" : "Request rejected" });
    await load();
  };

  const handleCancel = async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/leave-requests/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to cancel request", variant: "destructive" });
      return;
    }
    toast({ title: "Request cancelled" });
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Review leave requests from teachers and students." : "Your leave requests."}
          </p>
        </div>
        {!isAdmin && <NewLeaveRequestDialog onCreated={load} />}
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="text-4xl mb-3">🗓️</div>
          <p className="font-semibold text-lg mb-1">No leave requests</p>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Nothing to review here yet." : "Submit one if you need time off."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((lr) => (
            <Card key={lr.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && lr.requester && (
                      <p className="font-medium">
                        {lr.requester.name} <span className="text-xs text-muted-foreground capitalize">({lr.requester.role})</span>
                      </p>
                    )}
                    <Badge className={STATUS_STYLES[lr.status]} variant="outline">
                      {lr.status}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1">
                    {format(new Date(lr.startDate), "d MMM yyyy")} – {format(new Date(lr.endDate), "d MMM yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{lr.reason}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {isAdmin && lr.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleReview(lr.id, "approved")}>
                        <Check className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => handleReview(lr.id, "rejected")}>
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {isAdmin && lr.status === "approved" && lr.requester?.role === "teacher" && (
                    <SubstituteSuggestionsDialog leaveRequestId={lr.id} teacherName={lr.requester.name} />
                  )}
                  {!isAdmin && lr.status === "pending" && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleCancel(lr.id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SubstituteSuggestionsDialog({ leaveRequestId, teacherName }: { leaveRequestId: number; teacherName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SubstituteSuggestion[]>([]);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/leave-requests/${leaveRequestId}/substitute-suggestions`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setSuggestions(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Users className="w-3.5 h-3.5" /> Find Substitutes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Substitute Suggestions</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {teacherName}'s periods during this leave, and which other teachers are free at that time.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No timetable periods fall within this leave range.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {suggestions.map((s, i) => (
              <div key={i} className="border rounded-lg p-3">
                <p className="text-sm font-medium capitalize">{s.dayOfWeek} &middot; Period {s.periodNumber}</p>
                <p className="text-xs text-muted-foreground">{s.subject} &middot; {s.class}</p>
                <p className="text-xs mt-1.5">
                  {s.freeTeachers.length === 0 ? (
                    <span className="text-destructive">No free teachers found</span>
                  ) : (
                    <span>Free: {s.freeTeachers.map((t) => t.name).join(", ")}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewLeaveRequestDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/leave-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to submit request", variant: "destructive" });
        return;
      }
      toast({ title: "Leave request submitted" });
      setReason("");
      setOpen(false);
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> New Request</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarOff className="w-4 h-4" /> New Leave Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Family function" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !startDate || !endDate || !reason.trim()}>
              {saving ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
