import { useState, useEffect } from "react";
import { useGetExam, useListStudents, useListMarks, useEnterMarksBulk, getListMarksQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);

  const { data: exam, isLoading: loadingExam } = useGetExam(examId);
  const { data: students, isLoading: loadingStudents } = useListStudents(
    exam ? { classId: exam.classId } : {},
    { query: { enabled: !!exam, queryKey: getListStudentsQueryKey(exam ? { classId: exam.classId } : {}) } }
  );
  const { data: marks, isLoading: loadingMarks } = useListMarks(
    { examId },
    { query: { enabled: !!examId, queryKey: getListMarksQueryKey({ examId }) } }
  );

  const enterMarks = useEnterMarksBulk();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [localMarks, setLocalMarks] = useState<Record<number, string>>({});

  // Initialize local state with fetched marks
  useEffect(() => {
    if (marks) {
      const initial: Record<number, string> = {};
      marks.forEach(m => {
        initial[m.studentId] = m.marksObtained.toString();
      });
      setLocalMarks(initial);
    }
  }, [marks]);

  if (loadingExam) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-[400px]" /></div>;
  }

  if (!exam) return <div>Exam not found.</div>;

  const handleMarksChange = (studentId: number, val: string) => {
    // Only allow numbers
    if (val !== "" && isNaN(Number(val))) return;
    if (Number(val) > exam.maxMarks) return;
    
    setLocalMarks(prev => ({ ...prev, [studentId]: val }));
  };

  const handleSave = () => {
    const records = Object.entries(localMarks)
      .filter(([_, val]) => val !== "")
      .map(([studentId, val]) => ({
        studentId: Number(studentId),
        marksObtained: Number(val)
      }));

    enterMarks.mutate(
      { data: { examId, records } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMarksQueryKey({ examId }) });
          toast({ title: "Marks saved successfully" });
        },
        onError: (err: any) => {
          toast({ title: "Failed to save marks", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/exams"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{exam.name}</h1>
          <p className="text-muted-foreground mt-1">
            {exam.subject} • {exam.class?.name} {exam.class?.section} • {format(new Date(exam.date), "PPP")}
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-lg">Marks Entry</CardTitle>
            <CardDescription>Max Marks: {exam.maxMarks}</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={enterMarks.isPending} size="sm">
            {enterMarks.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Marks
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingStudents || loadingMarks ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : students && students.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-32">Roll No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="w-48 pr-6">Marks Obtained</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => (
                  <TableRow key={student.id}>
                    <TableCell className="pl-6 font-medium text-muted-foreground">{student.rollNo}</TableCell>
                    <TableCell className="font-medium">{student.user?.name}</TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center gap-2">
                        <Input 
                          type="text" 
                          value={localMarks[student.id] || ""} 
                          onChange={(e) => handleMarksChange(student.id, e.target.value)}
                          className="w-20 text-center"
                          placeholder="-"
                        />
                        <span className="text-muted-foreground text-sm">/ {exam.maxMarks}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No students in this class.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}