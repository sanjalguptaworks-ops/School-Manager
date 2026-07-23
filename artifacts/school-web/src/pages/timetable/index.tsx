import { useEffect, useState, useCallback } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useListClasses, useListTeachers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";
import { useSelectedChild } from "@/lib/selected-child-context";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat",
};

interface TimetableSlot {
  id: number;
  classId: number;
  dayOfWeek: string;
  periodNumber: number;
  subject: string;
  teacherId: number | null;
  class?: { id: number; name: string; section: string };
  teacher?: { id: number; name: string } | null;
}

export default function TimetablePage() {
  const { user } = useAppAuth();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const { toast } = useToast();
  const { selectedChildId } = useSelectedChild();

  const { data: classes } = useListClasses();
  const { data: teachers } = useListTeachers();

  const [classId, setClassId] = useState<string>("");
  const [myScheduleMode, setMyScheduleMode] = useState(isTeacher);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<{ day: string; period: number; slot?: TimetableSlot } | null>(null);

  useEffect(() => {
    if (isAdmin && classes && classes.length > 0 && !classId) {
      setClassId(String(classes[0]!.id));
    }
  }, [isAdmin, classes, classId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!myScheduleMode && classId) params.set("classId", classId);
      if (user?.role === "parent" && selectedChildId) params.set("studentId", String(selectedChildId));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${BASE_URL}/api/timetable${qs}`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setSlots(data);
    } finally {
      setLoading(false);
    }
  }, [classId, myScheduleMode, user?.role, selectedChildId]);

  useEffect(() => {
    load();
  }, [load]);

  const maxPeriod = Math.max(8, ...slots.map((s) => s.periodNumber));
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  const findSlot = (day: string, period: number) => slots.find((s) => s.dayOfWeek === day && s.periodNumber === period);

  const handleSave = async (subject: string, teacherId: string) => {
    if (!editing || !classId) return;
    const res = await fetch(`${BASE_URL}/api/timetable`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: Number(classId),
        dayOfWeek: editing.day,
        periodNumber: editing.period,
        subject: subject.trim(),
        teacherId: teacherId ? Number(teacherId) : undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ title: data.error || "Failed to save", variant: "destructive" });
      return;
    }
    setEditing(null);
    await load();
  };

  const handleClear = async (slot: TimetableSlot) => {
    const res = await fetch(`${BASE_URL}/api/timetable/${slot.id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to clear slot", variant: "destructive" });
      return;
    }
    setEditing(null);
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Manage the weekly class schedule." : myScheduleMode ? "Your teaching schedule." : "Weekly class schedule."}
          </p>
        </div>
        {(isAdmin || isTeacher) && (
          <div className="flex items-center gap-3 flex-wrap">
            {isTeacher && (
              <div className="flex rounded-md border overflow-hidden">
                <button
                  className={`px-3 py-1.5 text-sm ${myScheduleMode ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  onClick={() => setMyScheduleMode(true)}
                >
                  My Schedule
                </button>
                <button
                  className={`px-3 py-1.5 text-sm ${!myScheduleMode ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  onClick={() => setMyScheduleMode(false)}
                >
                  By Class
                </button>
              </div>
            )}
            {(isAdmin || !myScheduleMode) && (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : myScheduleMode && isTeacher ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No periods assigned yet.</TableCell></TableRow>
                ) : (
                  slots.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="capitalize">{s.dayOfWeek}</TableCell>
                      <TableCell>{s.periodNumber}</TableCell>
                      <TableCell>{s.subject}</TableCell>
                      <TableCell>{s.class?.name} {s.class?.section}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Period</TableHead>
                  {WEEKDAYS.map((d) => (
                    <TableHead key={d}>{DAY_LABELS[d]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period}>
                    <TableCell className="font-medium">{period}</TableCell>
                    {WEEKDAYS.map((day) => {
                      const slot = findSlot(day, period);
                      return (
                        <TableCell
                          key={day}
                          className={isAdmin ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => isAdmin && setEditing({ day, period, slot })}
                        >
                          {slot ? (
                            <div>
                              <p className="text-sm font-medium">{slot.subject}</p>
                              {slot.teacher && <p className="text-xs text-muted-foreground">{slot.teacher.name}</p>}
                            </div>
                          ) : isAdmin ? (
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/50" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {editing && (
        <EditSlotDialog
          editing={editing}
          teachers={teachers}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onClear={editing.slot ? () => handleClear(editing.slot!) : undefined}
        />
      )}
    </div>
  );
}

function EditSlotDialog({
  editing,
  teachers,
  onClose,
  onSave,
  onClear,
}: {
  editing: { day: string; period: number; slot?: TimetableSlot };
  teachers: { id: number; user?: { name: string } }[] | undefined;
  onClose: () => void;
  onSave: (subject: string, teacherId: string) => Promise<void>;
  onClear?: () => Promise<void>;
}) {
  const [subject, setSubject] = useState(editing.slot?.subject || "");
  const [teacherId, setTeacherId] = useState(editing.slot?.teacherId ? String(editing.slot.teacherId) : "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setSaving(true);
    try {
      await onSave(subject, teacherId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">{editing.day} &middot; Period {editing.period}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
          </div>
          <div className="space-y-1.5">
            <Label>Teacher (optional)</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="No teacher assigned" />
              </SelectTrigger>
              <SelectContent>
                {teachers?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.user?.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {onClear && (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive mr-auto gap-1.5" onClick={onClear}>
                <X className="w-4 h-4" /> Clear
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !subject.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
