import { useState } from "react";
import { useListAttendance, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export default function MyAttendancePage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const { data: records, isLoading } = useListAttendance(
    { month },
    { query: { queryKey: getListAttendanceQueryKey({ month }) } },
  );

  const total = records?.length ?? 0;
  const present = records?.filter((r) => r.status === "present").length ?? 0;
  const absent = records?.filter((r) => r.status === "absent").length ?? 0;
  const late = records?.filter((r) => r.status === "late").length ?? 0;
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  const sorted = [...(records ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-muted-foreground mt-1">Your day-by-day attendance record.</p>
        </div>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Attendance rate" value={`${rate}%`} icon={CheckCircle2} color="text-green-600" bg="bg-green-100" />
        <StatCard label="Present" value={present} icon={CheckCircle2} color="text-green-600" bg="bg-green-100" />
        <StatCard label="Absent" value={absent} icon={XCircle} color="text-red-600" bg="bg-red-100" />
        <StatCard label="Late" value={late} icon={Clock} color="text-amber-600" bg="bg-amber-100" />
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-base">{format(new Date(`${month}-01`), "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground border border-dashed rounded-lg">
              No attendance recorded for this month yet.
            </div>
          ) : (
            <div className="divide-y">
              {sorted.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <span className="text-sm">{format(new Date(r.date), "EEEE, MMM d")}</span>
                  <Badge
                    variant="outline"
                    className={
                      r.status === "present"
                        ? "bg-green-100 text-green-800 border-green-200"
                        : r.status === "late"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-red-100 text-red-800 border-red-200"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
