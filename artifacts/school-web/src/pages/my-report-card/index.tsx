import { useAppAuth } from "@/lib/auth-context";
import { useGetReportCard, getGetReportCardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { GraduationCap, Printer } from "lucide-react";

export default function MyReportCardPage() {
  const { user } = useAppAuth();
  const studentId = user?.studentId ?? null;
  const { data, isLoading } = useGetReportCard(studentId as number, {
    query: { enabled: studentId != null, queryKey: getGetReportCardQueryKey(studentId as number) },
  });

  if (!studentId) {
    return (
      <Card className="p-8 text-center border-dashed">
        <div className="text-4xl mb-3">🎓</div>
        <p className="font-semibold text-lg mb-1">Student profile not set up yet</p>
        <p className="text-muted-foreground text-sm">
          Your account hasn't been linked to a student record. Contact your admin to get it set up.
        </p>
      </Card>
    );
  }

  const results = data?.results ?? [];
  const average =
    results.length > 0 ? Math.round((results.reduce((sum, r) => sum + r.percentage, 0) / results.length) * 10) / 10 : null;
  const sorted = [...results].sort((a, b) => new Date(b.exam.date).getTime() - new Date(a.exam.date).getTime());

  return (
    <div className="space-y-6">
      {/* Print-only letterhead — the app sidebar/branding is hidden when printing */}
      <div className="hidden print:flex items-center gap-3 mb-2">
        {user?.schoolLogoUrl && <img src={user.schoolLogoUrl} alt="" className="w-10 h-10 object-contain" />}
        <div>
          <p className="font-bold text-lg">{user?.schoolName || "PathshalaHQ"}</p>
          <p className="text-sm text-muted-foreground">Report Card — {data?.student.user?.name}</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Report Card</h1>
          <p className="text-muted-foreground mt-1">All your exam results in one place.</p>
        </div>
        <div className="flex items-center gap-4">
          {average != null && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Overall average</p>
              <p className="text-2xl font-bold">{average}%</p>
            </div>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> Exam results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground border border-dashed rounded-lg">
              No exam results recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div>
                    <p className="text-sm font-medium">{r.exam.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.exam.name} · {format(new Date(r.exam.date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">
                      {r.marksObtained}/{r.exam.maxMarks}
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        r.percentage >= 60
                          ? "text-green-700 border-green-200 bg-green-50"
                          : "text-red-700 border-red-200 bg-red-50"
                      }
                    >
                      {r.percentage}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
