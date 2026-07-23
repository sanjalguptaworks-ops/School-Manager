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
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { CalendarClock, Plus, Check, X } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function AppointmentsPage() {
  const { user } = useAppAuth();
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground mt-1">Schedule and manage parent-teacher meetings</p>
        </div>
        {user?.role === "parent" && <FixAppointmentDialog />}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : appointments?.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <CalendarClock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">No appointments yet</p>
          <p className="text-muted-foreground text-sm">
            {user?.role === "parent" ? "Request a meeting with a teacher to get started." : "Requests from parents will appear here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments?.map((appt) => (
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
          ))}
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
