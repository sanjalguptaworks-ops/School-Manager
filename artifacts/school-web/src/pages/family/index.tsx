import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { listAttendance, listFeePayments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CreditCard, BookOpen, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useSelectedChild } from "@/lib/selected-child-context";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Real fields on the JSON response (installment support) that predate the
// generated client's types -- same gap as pages/fees/index.tsx.
function effectiveAmount(payment: any): string {
  return payment.amount ?? payment.feeStructure?.amount;
}

interface Homework {
  completed: boolean;
}

interface ChildSummary {
  studentId: number;
  name: string;
  className: string;
  attendanceRate: number | null;
  pendingFeesCount: number;
  pendingFeesAmount: number;
  pendingHomeworkCount: number;
}

async function loadHomeworkPending(studentId: number): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/homework?studentId=${studentId}`, { credentials: "include" });
  if (!res.ok) return 0;
  const items: Homework[] = await res.json().catch(() => []);
  return items.filter((hw) => !hw.completed).length;
}

export default function FamilyPage() {
  const [, setLocation] = useLocation();
  const { children_, setSelectedChildId } = useSelectedChild();
  const [summaries, setSummaries] = useState<ChildSummary[] | null>(null);

  useEffect(() => {
    if (children_.length === 0) return;
    let cancelled = false;

    (async () => {
      const month = format(new Date(), "yyyy-MM");
      const results = await Promise.all(
        children_.map(async (child): Promise<ChildSummary> => {
          const [attendance, pendingFees, pendingHomeworkCount] = await Promise.all([
            listAttendance({ studentId: child.id, month }),
            listFeePayments({ studentId: child.id, status: "pending" }),
            loadHomeworkPending(child.id),
          ]);
          const present = attendance.filter((r) => r.status === "present").length;
          const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 1000) / 10 : null;
          const pendingFeesAmount = pendingFees.reduce((sum, fp) => sum + Number(effectiveAmount(fp) || 0), 0);

          return {
            studentId: child.id,
            name: child.user?.name ?? "Student",
            className: child.class ? `${child.class.name} ${child.class.section}` : "",
            attendanceRate,
            pendingFeesCount: pendingFees.length,
            pendingFeesAmount,
            pendingHomeworkCount,
          };
        }),
      );
      if (!cancelled) setSummaries(results);
    })();

    return () => {
      cancelled = true;
    };
  }, [children_]);

  const goToChild = (studentId: number, path: string) => {
    setSelectedChildId(studentId);
    setLocation(path);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Family Overview</h1>
        <p className="text-muted-foreground mt-1">A combined snapshot across all your children</p>
      </div>

      {summaries === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : summaries.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-muted-foreground">No linked children found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {summaries.map((s) => (
            <Card key={s.studentId} className="shadow-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{s.name}</span>
                  {s.className && <Badge variant="secondary">{s.className}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <button
                  onClick={() => goToChild(s.studentId, "/my-attendance")}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Attendance this month
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {s.attendanceRate === null ? "—" : `${s.attendanceRate}%`}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </span>
                </button>
                <button
                  onClick={() => goToChild(s.studentId, "/fees")}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    Pending fees
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {s.pendingFeesCount > 0 ? `₹${s.pendingFeesAmount} (${s.pendingFeesCount})` : "None"}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </span>
                </button>
                <button
                  onClick={() => goToChild(s.studentId, "/homework")}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Pending homework
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {s.pendingHomeworkCount}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </span>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
