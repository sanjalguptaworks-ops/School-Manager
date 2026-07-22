import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface AttendanceTrend {
  month: string;
  attendanceRate: number;
  totalRecords: number;
}

interface PerformanceTrend {
  month: string;
  avgPercentage: number;
  examCount: number;
}

export default function AnalyticsPage() {
  const [months, setMonths] = useState("6");
  const [attendance, setAttendance] = useState<AttendanceTrend[]>([]);
  const [performance, setPerformance] = useState<PerformanceTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, perfRes] = await Promise.all([
        fetch(`${BASE_URL}/api/analytics/attendance-trends?months=${months}`, { credentials: "include" }),
        fetch(`${BASE_URL}/api/analytics/performance-trends?months=${months}`, { credentials: "include" }),
      ]);
      if (attRes.ok) setAttendance(await attRes.json());
      if (perfRes.ok) setPerformance(await perfRes.json());
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => {
    load();
  }, [load]);

  const exportAttendance = () => {
    const csv = toCsv(["month", "attendanceRate", "totalRecords"], attendance.map((a) => [a.month, a.attendanceRate, a.totalRecords]));
    downloadCsv("attendance-trends.csv", csv);
  };
  const exportPerformance = () => {
    const csv = toCsv(["month", "avgPercentage", "examCount"], performance.map((p) => [p.month, p.avgPercentage, p.examCount]));
    downloadCsv("performance-trends.csv", csv);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Attendance and exam performance trends over time.</p>
        </div>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Attendance Rate</CardTitle>
          <Button variant="outline" size="sm" onClick={exportAttendance} disabled={!attendance.length} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : attendance.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
              No attendance data in this range
            </div>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <RechartsTooltip
                    formatter={(value: number) => [`${value}%`, "Attendance Rate"]}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Line type="monotone" dataKey="attendanceRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Attendance Rate" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Exam Performance</CardTitle>
          <Button variant="outline" size="sm" onClick={exportPerformance} disabled={!performance.length} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : performance.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
              No graded exams in this range
            </div>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <RechartsTooltip
                    formatter={(value: number) => [`${value}%`, "Avg Score"]}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Line type="monotone" dataKey="avgPercentage" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} name="Avg Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
