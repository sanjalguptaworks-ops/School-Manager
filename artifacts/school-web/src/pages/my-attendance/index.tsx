import { useState } from "react";
import { useListAttendance, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useSelectedChild } from "@/lib/selected-child-context";

const STATUS_STYLES: Record<string, string> = {
  present: "bg-green-500 text-white",
  absent: "bg-red-500 text-white",
  late: "bg-amber-500 text-white",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MyAttendancePage() {
  const [monthDate, setMonthDate] = useState(new Date());
  const month = format(monthDate, "yyyy-MM");
  const { selectedChildId } = useSelectedChild();
  const params = selectedChildId ? { month, studentId: selectedChildId } : { month };
  const { data: records, isLoading } = useListAttendance(params, { query: { queryKey: getListAttendanceQueryKey(params) } });

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-muted-foreground mt-1">Your day-by-day attendance record.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Attendance rate" value={`${rate}%`} icon={CheckCircle2} color="text-green-600" bg="bg-green-100" />
        <StatCard label="Present" value={present} icon={CheckCircle2} color="text-green-600" bg="bg-green-100" />
        <StatCard label="Absent" value={absent} icon={XCircle} color="text-red-600" bg="bg-red-100" />
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
