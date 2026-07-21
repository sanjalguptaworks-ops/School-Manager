import { useState } from "react";
import { useListClasses, useListStudents, useListAttendance, useMarkAttendanceBulk, getListAttendanceQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, Loader2, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toCsv, downloadCsv } from "@/lib/csv";

export default function AttendancePage() {
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  
  const { data: classes } = useListClasses();
  
  const { data: students, isLoading: loadingStudents } = useListStudents(
    classId ? { classId: Number(classId) } : {}, 
    { query: { enabled: !!classId, queryKey: getListStudentsQueryKey(classId ? { classId: Number(classId) } : {}) } }
  );
  
  const { data: attendanceRecords, isLoading: loadingRecords } = useListAttendance(
    (classId && date) ? { classId: Number(classId), date } : {},
    { query: { enabled: !!classId && !!date, queryKey: getListAttendanceQueryKey((classId && date) ? { classId: Number(classId), date } : {}) } }
  );

  const markBulk = useMarkAttendanceBulk();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state for edits before saving
  const [localMarks, setLocalMarks] = useState<Record<number, "present"|"absent"|"late">>({});

  // Merge server records with local unsaved marks
  const getStatus = (studentId: number) => {
    if (localMarks[studentId]) return localMarks[studentId];
    const record = attendanceRecords?.find(r => r.studentId === studentId);
    return record?.status || null;
  };

  const handleMark = (studentId: number, status: "present"|"absent"|"late") => {
    setLocalMarks(prev => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: "present"|"absent"|"late") => {
    if (!students) return;
    const newMarks: Record<number, "present"|"absent"|"late"> = {};
    students.forEach(s => { newMarks[s.id] = status; });
    setLocalMarks(newMarks);
  };

  const hasChanges = Object.keys(localMarks).length > 0;

  const handleSave = () => {
    if (!classId || !date) return;
    
    // Convert localMarks to the bulk format
    const records = Object.entries(localMarks).map(([studentId, status]) => ({
      studentId: Number(studentId),
      status
    }));

    markBulk.mutate(
      { data: { classId: Number(classId), date, records } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ classId: Number(classId), date }) });
          setLocalMarks({});
          toast({ title: "Attendance saved successfully" });
        },
        onError: (err: any) => {
          toast({ title: "Failed to save attendance", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">Mark and review daily student attendance</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border shadow-sm items-end sm:items-center">
        <div className="w-full sm:w-[250px]">
          <label className="text-sm font-medium mb-1.5 block">Select Class</label>
          <Select value={classId} onValueChange={(val) => { setClassId(val); setLocalMarks({}); }}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes?.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name} {c.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[200px]">
          <label className="text-sm font-medium mb-1.5 block">Date</label>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLocalMarks({}); }} className="bg-background" />
        </div>
      </div>

      {classId && (
        <Card className="shadow-sm border-border/50 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-lg">Class Register</CardTitle>
              <CardDescription>
                {students?.length || 0} students
              </CardDescription>
            </div>
            {students && students.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const csv = toCsv(
                      ["rollNo", "name", "date", "status"],
                      students.map((s) => [s.rollNo, s.user?.name, date, getStatus(s.id) || ""]),
                    );
                    downloadCsv(`attendance-${date}.csv`, csv);
                  }}
                >
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
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
            {loadingStudents || loadingRecords ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : students && students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 w-24">Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(student => {
                    const status = getStatus(student.id);
                    return (
                      <TableRow key={student.id} className={status === 'absent' ? 'bg-red-50/50' : ''}>
                        <TableCell className="pl-6 font-medium text-muted-foreground">{student.rollNo}</TableCell>
                        <TableCell className="font-medium">{student.user?.name}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="inline-flex gap-1 p-1 bg-muted/50 rounded-lg">
                            <button
                              onClick={() => handleMark(student.id, "present")}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === 'present' ? 'bg-green-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                            >
                              <Check className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Present</span>
                            </button>
                            <button
                              onClick={() => handleMark(student.id, "late")}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === 'late' ? 'bg-yellow-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                            >
                              <Clock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Late</span>
                            </button>
                            <button
                              onClick={() => handleMark(student.id, "absent")}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === 'absent' ? 'bg-red-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
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
              <div className="p-12 text-center text-muted-foreground">
                No students in this class.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}