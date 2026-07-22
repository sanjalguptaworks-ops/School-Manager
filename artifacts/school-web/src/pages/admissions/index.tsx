import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { UserPlus, Plus, Trash2, Mail, Phone } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface Inquiry {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  desiredClass: string | null;
  message: string | null;
  status: "new" | "contacted" | "admitted" | "rejected";
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  admitted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdmissionsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`${BASE_URL}/api/admission-inquiries${qs}`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setItems(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id: number, status: string) => {
    const res = await fetch(`${BASE_URL}/api/admission-inquiries/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    await load();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/admission-inquiries/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to delete", variant: "destructive" });
      return;
    }
    toast({ title: "Inquiry deleted" });
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admission Inquiries</h1>
          <p className="text-muted-foreground mt-1">Track prospective families who've reached out.</p>
        </div>
        <AddInquiryDialog onCreated={load} />
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="contacted">Contacted</TabsTrigger>
          <TabsTrigger value="admitted">Admitted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="text-4xl mb-3">🎒</div>
          <p className="font-semibold text-lg mb-1">No inquiries yet</p>
          <p className="text-muted-foreground text-sm">Log one when a prospective family reaches out.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((inq) => (
            <Card key={inq.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{inq.name}</p>
                    {inq.desiredClass && <span className="text-xs text-muted-foreground">Wants: {inq.desiredClass}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                    {inq.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {inq.email}</span>}
                    {inq.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {inq.phone}</span>}
                  </div>
                  {inq.message && <p className="text-sm text-muted-foreground mt-1.5">{inq.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5">{format(new Date(inq.createdAt), "d MMM yyyy")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={inq.status} onValueChange={(v) => handleStatusChange(inq.id, v)}>
                    <SelectTrigger className="w-32 h-8">
                      <Badge className={STATUS_STYLES[inq.status]} variant="outline">{inq.status}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="admitted">Admitted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(inq.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddInquiryDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredClass, setDesiredClass] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admission-inquiries`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          desiredClass: desiredClass.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to log inquiry", variant: "destructive" });
        return;
      }
      toast({ title: "Inquiry logged" });
      setName(""); setEmail(""); setPhone(""); setDesiredClass(""); setMessage("");
      setOpen(false);
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Log Inquiry</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Log Admission Inquiry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parent or student name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Desired class (optional)</Label>
            <Input value={desiredClass} onChange={(e) => setDesiredClass(e.target.value)} placeholder="e.g. Class 10" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Log Inquiry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
