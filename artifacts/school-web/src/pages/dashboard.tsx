import { useAppAuth } from "@/lib/auth-context";
import {
  useGetDashboardSummary,
  useGetAttendanceSummary,
  useGetRecentNotices,
  useGetFeeOverview,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, CreditCard, Clock, CheckCircle2, CalendarDays, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { TimelineFeed } from "@/components/timeline-feed";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function fetchStudentSummary(studentId: number) {
  const res = await fetch(`${BASE_URL}/api/students/${studentId}/summary`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch student summary");
  return res.json();
}

async function fetchParentStudents(parentId: number) {
  const res = await fetch(`${BASE_URL}/api/parents/${parentId}/students`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function Dashboard() {
  const { user } = useAppAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user.name}.{" "}
          {user.role === "admin" || user.role === "teacher"
            ? "Here's what's happening today."
            : "Here's your overview."}
        </p>
      </div>

      {(user.role === "admin" || user.role === "teacher") && <StaffDashboard />}
      {user.role === "student" && <StudentDashboard user={user} />}
      {user.role === "parent" && <ParentDashboard user={user} />}
    </div>
  );
}

// ── Staff Dashboard ───────────────────────────────────────────────────────────

function StaffDashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: attendance, isLoading: loadingAttendance } = useGetAttendanceSummary({
    date: format(new Date(), "yyyy-MM-dd"),
  });
  const { data: notices, isLoading: loadingNotices } = useGetRecentNotices();
  const { data: fees, isLoading: loadingFees } = useGetFeeOverview();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Students" value={summary?.totalStudents} icon={Users} isLoading={loadingSummary} />
        <KPICard title="Total Teachers" value={summary?.totalTeachers} icon={GraduationCap} isLoading={loadingSummary} />
        <KPICard title="Total Classes" value={summary?.totalClasses} icon={BookOpen} isLoading={loadingSummary} />
        <KPICard
          title="Today's Attendance"
          value={summary ? `${summary.attendanceRateToday.toFixed(1)}%` : undefined}
          icon={CheckCircle2}
          isLoading={loadingSummary}
          valueColor="text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Attendance by Class</CardTitle>
            <CardDescription>Today's breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAttendance ? (
              <Skeleton className="h-[300px] w-full" />
            ) : attendance && attendance.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="className" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Bar dataKey="present" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 4, 4]} name="Present" />
                    <Bar dataKey="late" stackId="a" fill="#eab308" name="Late" />
                    <Bar dataKey="absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                No attendance marked today
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Notices</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingNotices ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : notices && notices.length > 0 ? (
                <div className="space-y-4">
                  {notices.slice(0, 4).map((notice) => (
                    <div key={notice.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{notice.title}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(notice.createdAt), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent notices.</p>
              )}
            </CardContent>
          </Card>

          {!loadingFees && fees && (
            <Card className="shadow-sm border-border/50 bg-primary/5 border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Fee Collection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-2">
                  {[
                    { label: "Collected", amount: fees.totalCollected, color: "bg-primary" },
                    { label: "Pending", amount: fees.totalPending, color: "bg-destructive/80" },
                  ].map(({ label, amount, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">₹{amount.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color}`}
                          style={{ width: `${(amount / (fees.totalDue || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Student Dashboard ─────────────────────────────────────────────────────────

function StudentDashboard({ user }: { user: any }) {
  const studentId = user.studentId as number | null;
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data: notices, isLoading: loadingNotices } = useGetRecentNotices();

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    fetchStudentSummary(studentId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (!studentId) {
    return (
      <Card className="p-8 text-center border-dashed">
        <div className="text-4xl mb-3">🎓</div>
        <p className="font-semibold text-lg mb-1">Student profile not set up yet</p>
        <p className="text-muted-foreground text-sm">
          Your account hasn't been linked to a student record. Contact your admin — they can create your
          student profile from the <span className="font-medium text-foreground">Users</span> page.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Attendance Rate</p>
              {loading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                <p className="text-2xl font-bold text-green-600">
                  {summary?.attendance?.attendanceRate ?? 0}%
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Fees</p>
              {loading ? <Skeleton className="h-7 w-10 mt-1" /> : (
                <p className="text-2xl font-bold text-amber-600">
                  {summary?.fees?.pending ?? 0}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Days Present</p>
              {loading ? <Skeleton className="h-7 w-10 mt-1" /> : (
                <p className="text-2xl font-bold">{summary?.attendance?.present ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent marks */}
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Recent Exam Results</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            ) : summary?.recentMarks?.length > 0 ? (
              <div className="space-y-3">
                {summary.recentMarks.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <div>
                      <p className="text-sm font-medium">{r.exam?.subject}</p>
                      <p className="text-xs text-muted-foreground">{r.exam?.name} · {r.exam?.date && format(new Date(r.exam.date), "MMM d")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{r.marksObtained}/{r.exam?.maxMarks}</p>
                      <Badge variant="outline" className={r.percentage >= 60 ? "text-green-700 border-green-200 bg-green-50" : "text-red-700 border-red-200 bg-red-50"}>
                        {r.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground border border-dashed rounded-lg">No exam results yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming exams + notices */}
        <div className="space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Upcoming Exams</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2].map(i=><Skeleton key={i} className="h-8 w-full"/>)}</div>
              ) : summary?.upcomingExams?.length > 0 ? (
                <div className="space-y-2">
                  {summary.upcomingExams.map((e: any) => (
                    <div key={e.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/40 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{e.subject}</p>
                        <p className="text-xs text-muted-foreground">{e.name}</p>
                      </div>
                      <Badge variant="secondary">{format(new Date(e.date), "MMM d")}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming exams.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Notices</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingNotices ? (
                <div className="space-y-2">{[1,2].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div>
              ) : notices?.slice(0, 3).map((n) => (
                <div key={n.id} className="py-2 border-b last:border-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(n.createdAt), "MMM d")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <TimelineFeed />
    </div>
  );
}

// ── Parent Dashboard ──────────────────────────────────────────────────────────

function ParentDashboard({ user }: { user: any }) {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data: notices } = useGetRecentNotices();

  useEffect(() => {
    fetchParentStudents(user.id)
      .then((data: any[]) => {
        setChildren(data);
        if (data.length > 0) setSelectedChild(data[0]);
      })
      .catch(() => setChildren([]))
      .finally(() => setLoading(false));
  }, [user.id]);

  useEffect(() => {
    if (!selectedChild) return;
    setSummary(null);
    fetchStudentSummary(selectedChild.id)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [selectedChild]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (children.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <div className="text-4xl mb-3">👨‍👩‍👧</div>
        <p className="font-semibold text-lg mb-1">No children linked yet</p>
        <p className="text-muted-foreground text-sm">
          Ask your school admin to link your account to your child's student record via the{" "}
          <span className="font-medium text-foreground">Users → Link Student</span> button.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChild(c)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedChild?.id === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}
            >
              {c.user?.name || `Student #${c.id}`}
            </button>
          ))}
        </div>
      )}

      {selectedChild && (
        <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {selectedChild.user?.name?.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-lg">{selectedChild.user?.name}</p>
            <p className="text-sm text-muted-foreground">{selectedChild.class?.name} {selectedChild.class?.section} · Roll {selectedChild.rollNo}</p>
          </div>
        </div>
      )}

      {/* Same stats as student dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm"><CardContent className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
          <div><p className="text-sm text-muted-foreground">Attendance Rate</p>
            {!summary ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold text-green-600">{summary.attendance?.attendanceRate ?? 0}%</p>}
          </div>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-amber-600" /></div>
          <div><p className="text-sm text-muted-foreground">Pending Fees</p>
            {!summary ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold text-amber-600">{summary.fees?.pending ?? 0}</p>}
          </div>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><CalendarDays className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-sm text-muted-foreground">Days Present</p>
            {!summary ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold">{summary.attendance?.present ?? 0}</p>}
          </div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-4 h-4 text-primary" /> Recent Results</CardTitle></CardHeader>
          <CardContent>
            {!summary ? <div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-10"/>)}</div>
            : summary.recentMarks?.length > 0 ? (
              <div className="space-y-2">
                {summary.recentMarks.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <div><p className="text-sm font-medium">{r.exam?.subject}</p><p className="text-xs text-muted-foreground">{r.exam?.name}</p></div>
                    <Badge variant="outline" className={r.percentage >= 60 ? "text-green-700 border-green-200 bg-green-50" : "text-red-700 border-red-200 bg-red-50"}>{r.percentage}%</Badge>
                  </div>
                ))}
              </div>
            ) : <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg text-sm">No exam results yet.</div>}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">School Notices</CardTitle></CardHeader>
          <CardContent>
            {notices?.slice(0, 4).map((n) => (
              <div key={n.id} className="py-2 border-b last:border-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(n.createdAt), "MMM d")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <TimelineFeed />
    </div>
  );
}

function KPICard({ title, value, icon: Icon, isLoading, valueColor = "text-foreground" }: any) {
  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <p className={`text-3xl font-bold tracking-tight ${valueColor}`}>{value}</p>}
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary">
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
