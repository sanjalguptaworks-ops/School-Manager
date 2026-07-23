import { useState } from "react";
import {
  useListTeachers,
  useListStaffAttendance,
  useMarkStaffAttendanceBulk,
  getListStaffAttendanceQueryKey,
} from "@workspace/api-client-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppAuth } from "@/lib/auth-context";

const STATUS_STYLES: Record<string, string> = {
  present: "bg-green-500 text-white",
  absent: "bg-red-500 text-white",
  late: "bg-amber-500 text-white",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StaffAttendancePage() {
  const { user } = useAppAuth();
  return user?.role === "teacher" ? <MyStaffAttendance /> : <AdminStaffAttendance />;
}

function AdminStaffAttendance() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: teachers, isLoading: loadingTeachers } = useListTeachers();
  const { data: records, isLoading: loadingRecords } = useListStaffAttendance(
    { date },
    { query: { queryKey: getListStaffAttendanceQueryKey({ date }) } },
  );

  const markBulk = useMarkStaffAttendanceBulk();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [localMarks, setLocalMarks] = useState<Record<number, "present" | "absent" | "late">>({});

  const getStatus = (teacherId: number) => {
    if (localMarks[teacherId]) return localMarks[teacherId];
    return records?.find((r) => r.teacherId === teacherId)?.status || null;
  };

  const handleMark = (teacherId: number, status: "present" | "absent" | "late") => {
    setLocalMarks((prev) => ({ ...prev, [teacherId]: status }));
  };

  const markAll = (status: "present" | "absent" | "late") => {
    if (!teachers) return;
    const newMarks: Record<number, "present" | "absent" | "late"> = {};
    teachers.forEach((t) => { newMarks[t.id] = status; });
    setLocalMarks(newMarks);
  };

  const hasChanges = Object.keys(localMarks).length > 0;

  const handleSave = () => {
    const recordsPayload = Object.entries(localMarks).map(([teacherId, status]) => ({
      teacherId: Number(teacherId),
      status,
    }));

    markBulk.mutate(
      { data: { date, records: recordsPayload } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStaffAttendanceQueryKey({ date }) });
          setLocalMarks({});
          toast({ title: "Staff attendance saved successfully" });
        },
        onError: (err: any) => {
          toast({ title: "Failed to save staff attendance", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Attendance</h1>
        <p className="text-muted-foreground mt-1">Mark and review daily teacher attendance</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border shadow-sm items-end sm:items-center">
        <div className="w-full sm:w-[200px]">
          <label className="text-sm font-medium mb-1.5 block">Date</label>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLocalMarks({}); }} className="bg-background" />
        </div>
      </div>

      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-lg">Staff Register</CardTitle>
            <CardDescription>{teachers?.length || 0} teachers</CardDescription>
          </div>
          {teachers && teachers.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => markAll("present")} className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
                <Check className="w-4 h-4 mr-1" /> Mark All Present
              </Button>
              <Button disabled={!hasChanges || markBulk.isPending} onClick={handleSave} size="sm">
                {markBulk.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Attendance
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingTeachers || loadingRecords ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : teachers && teachers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Teacher Name</TableHead>
                  <TableHead className="text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => {
                  const status = getStatus(teacher.id);
                  return (
                    <TableRow key={teacher.id} className={status === "absent" ? "bg-red-50/50" : ""}>
                      <TableCell className="pl-6 font-medium">{teacher.user?.name}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="inline-flex gap-1 p-1 bg-muted/50 rounded-lg">
                          <button
                            onClick={() => handleMark(teacher.id, "present")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === "present" ? "bg-green-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
                          >
                            <Check className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Present</span>
                          </button>
                          <button
                            onClick={() => handleMark(teacher.id, "late")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === "late" ? "bg-yellow-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
                          >
                            <Clock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Late</span>
                          </button>
                          <button
                            onClick={() => handleMark(teacher.id, "absent")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === "absent" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
                          >
                            <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Absent</span>
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No teachers found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MyStaffAttendance() {
  const [monthDate, setMonthDate] = useState(new Date());
  const month = format(monthDate, "yyyy-MM");
  const { data: records, isLoading } = useListStaffAttendance(
    { month },
    { query: { queryKey: getListStaffAttendanceQueryKey({ month }) } },
  );

  const total = records?.length ?? 0;
  const present = records?.filter((r) => r.status === "present").length ?? 0;
  const absent = records?.filter((r) => r.status === "absent").length ?? 0;
  const late = records?.filter((r) => r.status === "late").length ?? 0;
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  const recordByDate = new Map((records ?? []).map((r) => [format(new Date(r.date), "yyyy-MM-dd"), r]));

  const gridStart = startOfWeek(startOfMonth(monthDate));
  const gridEnd = endOfWeek(endOfMonth(monthDate));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Attendance</h1>
        <p className="text-muted-foreground mt-1">Your day-by-day attendance record.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Attendance rate" value={`${rate}%`} icon={Check} color="text-green-600" bg="bg-green-100" />
        <StatCard label="Present" value={present} icon={Check} color="text-green-600" bg="bg-green-100" />
        <StatCard label="Absent" value={absent} icon={X} color="text-red-600" bg="bg-red-100" />
        <StatCard label="Late" value={late} icon={Clock} color="text-amber-600" bg="bg-amber-100" />
      </div>

      <Card className="shadow-sm border-border/50">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setMonthDate((m) => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <p className="font-semibold w-36 text-center">{format(monthDate, "MMMM yyyy")}</p>
            <Button variant="ghost" size="icon" onClick={() => setMonthDate((m) => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {WEEKDAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const record = recordByDate.get(key);
                  const inMonth = isSameMonth(day, monthDate);
                  return (
                    <div
                      key={key}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs sm:text-sm ${
                        !inMonth ? "text-muted-foreground/30" : record ? STATUS_STYLES[record.status] : "text-foreground"
                      } ${isToday(day) && !record ? "ring-2 ring-primary" : ""}`}
                    >
                      {format(day, "d")}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 justify-center pt-2 text-xs text-muted-foreground">
                <LegendDot color="bg-green-500" label="Present" />
                <LegendDot color="bg-red-500" label="Absent" />
                <LegendDot color="bg-amber-500" label="Late" />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  bg: string;
}) {
  return (
    <Card className="shadow-sm border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
