import { useState } from "react";
import {
  useListAppointments,
  useCreateAppointment,
  useUpdateAppointmentStatus,
  useListTeachers,
  useListParentStudents,
  getListAppointmentsQueryKey,
  getListParentStudentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { CalendarClock, Plus, Check, X, ChevronLeft, ChevronRight, List } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function AppointmentsPage() {
  const { user } = useAppAuth();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const { data: appointments, isLoading } = useListAppointments();
  const updateStatus = useUpdateAppointmentStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleStatusChange = (id: number, status: "confirmed" | "cancelled") => {
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          toast({ title: `Appointment ${status}` });
        },
        onError: (err: any) => toast({ title: err?.message || "Failed to update appointment", variant: "destructive" }),
      },
    );
  };

  const renderCard = (appt: any) => (
    <Card key={appt.id} className="shadow-sm border-border/50">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{appt.subject}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.role === "parent" ? `with ${appt.teacher?.name}` : `${appt.parent?.name} (re: ${appt.student?.rollNo})`}
            </p>
          </div>
          <Badge variant="outline" className={STATUS_STYLES[appt.status]}>{appt.status}</Badge>
        </div>
        <p className="text-sm">{format(new Date(appt.scheduledAt), "EEEE, MMM d, yyyy 'at' h:mm a")}</p>
        {appt.reason && <p className="text-sm text-muted-foreground">{appt.reason}</p>}
        {appt.status === "pending" && user?.role === "teacher" && appt.teacherId === user.id && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => handleStatusChange(appt.id, "confirmed")}>
              <Check className="w-3.5 h-3.5 mr-1.5" /> Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleStatusChange(appt.id, "cancelled")}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Decline
            </Button>
          </div>
        )}
        {appt.status === "pending" && user?.role === "parent" && appt.parentId === user.id && (
          <div className="pt-1">
            <Button size="sm" variant="outline" onClick={() => handleStatusChange(appt.id, "cancelled")}>
              Cancel request
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const gridStart = startOfWeek(startOfMonth(monthDate));
  const gridEnd = endOfWeek(endOfMonth(monthDate));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const apptsByDay = (day: Date) => (appointments ?? []).filter((a) => isSameDay(new Date(a.scheduledAt), day));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground mt-1">Schedule and manage parent-teacher meetings</p>
        </div>
        {user?.role === "parent" && <FixAppointmentDialog />}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5"><List className="w-3.5 h-3.5" /> List</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Calendar</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : view === "list" ? (
        appointments?.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <CalendarClock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold text-lg mb-1">No appointments yet</p>
            <p className="text-muted-foreground text-sm">
              {user?.role === "parent" ? "Request a meeting with a teacher to get started." : "Requests from parents will appear here."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">{appointments?.map(renderCard)}</div>
        )
      ) : (
        <div className="space-y-4">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setMonthDate((m) => subMonths(m, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <p className="font-semibold w-36 text-center">{format(monthDate, "MMMM yyyy")}</p>
                <Button variant="ghost" size="icon" onClick={() => setMonthDate((m) => addMonths(m, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
                {days.map((day) => {
                  const dayAppts = apptsByDay(day);
                  const inMonth = isSameMonth(day, monthDate);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm gap-0.5 transition-colors ${
                        !inMonth ? "text-muted-foreground/30" : "text-foreground hover:bg-muted"
                      } ${isSelected ? "ring-2 ring-primary" : ""} ${isToday(day) ? "font-bold" : ""}`}
                    >
                      {format(day, "d")}
                      {dayAppts.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedDay && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">{format(selectedDay, "EEEE, MMMM d, yyyy")}</p>
              {apptsByDay(selectedDay).length === 0 ? (
                <p className="text-sm text-muted-foreground">No appointments on this day.</p>
              ) : (
                apptsByDay(selectedDay).map(renderCard)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FixAppointmentDialog() {
  const { user } = useAppAuth();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const { data: children, isLoading: childrenLoading } = useListParentStudents(user?.id ?? 0, {
    query: { enabled: !!user?.id, queryKey: getListParentStudentsQueryKey(user?.id ?? 0) },
  });
  const { data: teachers, isLoading: teachersLoading } = useListTeachers();
  const createAppointment = useCreateAppointment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!studentId || !teacherId || !subject.trim() || !date || !time) return;
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    createAppointment.mutate(
      { data: { studentId: parseInt(studentId), teacherId: parseInt(teacherId), subject: subject.trim(), reason: reason.trim() || undefined, scheduledAt } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          toast({ title: "Appointment requested" });
          setOpen(false);
          setStudentId(""); setTeacherId(""); setSubject(""); setReason("");
        },
        onError: (err: any) => toast({ title: err?.message || "Failed to request appointment", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Fix Appointment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fix Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Child</Label>
            {childrenLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select your child…" /></SelectTrigger>
                <SelectContent>
                  {children?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.user?.name} ({c.class?.name} {c.class?.section})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Teacher</Label>
            {teachersLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger><SelectValue placeholder="Select a teacher…" /></SelectTrigger>
                <SelectContent>
                  {teachers?.map((t) => (
                    <SelectItem key={t.userId} value={String(t.userId)}>{t.user?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Discuss progress in Math" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!studentId || !teacherId || !subject.trim() || createAppointment.isPending}>
            {createAppointment.isPending ? "Requesting…" : "Request Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
