import { useEffect, useState, useCallback } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useListStudents } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ShieldAlert, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface Incident {
  id: number;
  studentId: number;
  title: string;
  description: string | null;
  severity: "minor" | "moderate" | "severe";
  createdAt: string;
  student: { id: number; rollNo: string; name: string };
}

const SEVERITY_STYLES: Record<string, string> = {
  minor: "bg-amber-100 text-amber-700",
  moderate: "bg-orange-100 text-orange-700",
  severe: "bg-red-100 text-red-700",
};

export default function DisciplinePage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  const isParent = user?.role === "parent";
  const { toast } = useToast();

  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/discipline-incidents`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/discipline-incidents/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to delete", variant: "destructive" });
      return;
    }
    toast({ title: "Incident deleted" });
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discipline Log</h1>
          <p className="text-muted-foreground mt-1">
            {isParent ? "Behavior incidents involving your child." : "Behavior incidents for your classes."}
          </p>
        </div>
        {canManage && <AddIncidentDialog onCreated={load} />}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-lg mb-1">No incidents logged</p>
          <p className="text-muted-foreground text-sm">
            {canManage ? "Nothing to report -- add one if needed." : "Nothing to see here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((inc) => (
            <Card key={inc.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{inc.student.name}</p>
                    <span className="text-xs text-muted-foreground">Roll {inc.student.rollNo}</span>
                    <Badge className={SEVERITY_STYLES[inc.severity]} variant="outline">
                      {inc.severity}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mt-1.5">{inc.title}</p>
                  {inc.description && <p className="text-sm text-muted-foreground mt-0.5">{inc.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5">{format(new Date(inc.createdAt), "d MMM yyyy")}</p>
                </div>
                {canManage && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(inc.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddIncidentDialog({ onCreated }: { onCreated: () => void }) {
  const { data: students } = useListStudents();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/discipline-incidents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: Number(studentId),
          title: title.trim(),
          description: description.trim() || undefined,
          severity,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to log incident", variant: "destructive" });
        return;
      }
      toast({ title: "Incident logged" });
      setTitle("");
      setDescription("");
      setSeverity("minor");
      setOpen(false);
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Log Incident</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Log Incident</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {students?.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.user?.name} ({s.rollNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Disruptive in class" />
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !studentId || !title.trim()}>
              {saving ? "Saving..." : "Log Incident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
