import { useEffect, useState, useCallback } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface SchoolEvent {
  id: number;
  title: string;
  description: string | null;
  date: string;
  classId: number | null;
  class: { id: number; name: string; section: string } | null;
}

export default function EventsPage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  const { toast } = useToast();

  const [month, setMonth] = useState(new Date());
  const monthKey = format(month, "yyyy-MM");

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events?month=${monthKey}`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/events/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to delete event", variant: "destructive" });
      return;
    }
    toast({ title: "Event deleted" });
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1">School events and important dates.</p>
        </div>
        {canManage && <AddEventDialog onCreated={load} />}
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <p className="font-semibold w-40 text-center">{format(month, "MMMM yyyy")}</p>
        <Button variant="ghost" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="text-4xl mb-3">📅</div>
          <p className="font-semibold text-lg mb-1">No events this month</p>
          <p className="text-muted-foreground text-sm">Check another month, or add one if you manage this school.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="w-14 text-center shrink-0">
                  <p className="text-xs text-muted-foreground uppercase">{format(new Date(e.date), "MMM")}</p>
                  <p className="text-2xl font-bold">{format(new Date(e.date), "d")}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{e.title}</p>
                  {e.description && <p className="text-sm text-muted-foreground mt-0.5">{e.description}</p>}
                  {e.class && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.class.name} {e.class.section} only
                    </p>
                  )}
                </div>
                {user?.role === "admin" && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(e.id)}>
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

function AddEventDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to add event", variant: "destructive" });
        return;
      }
      toast({ title: "Event added" });
      setTitle("");
      setDescription("");
      setOpen(false);
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Add Event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Add Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual Sports Day" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim() || !date}>
              {saving ? "Adding..." : "Add Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
