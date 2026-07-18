import { useGetClass, useListStudents, useListExams, getGetClassQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileText, ChevronLeft, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const classId = Number(id);
  const { data: cls, isLoading: loadingClass } = useGetClass(classId);
  const { data: students, isLoading: loadingStudents } = useListStudents({ classId });
  const { data: exams, isLoading: loadingExams } = useListExams({ classId });

  if (loadingClass) {
    return <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>;
  }

  if (!cls) return <div>Class not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/classes"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{cls.name} <span className="text-muted-foreground font-normal">Section {cls.section}</span></h1>
          <p className="text-muted-foreground mt-1">{cls.studentCount || 0} students enrolled</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Students
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingStudents ? (
              <div className="p-6 space-y-4"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div>
            ) : students && students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Roll No</TableHead>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(s => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => window.location.href = `/students/${s.id}`}>
                      <TableCell className="pl-6 font-medium">{s.rollNo}</TableCell>
                      <TableCell>{s.user?.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-muted-foreground">No students in this class.</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Exams
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingExams ? (
              <div className="p-6 space-y-4"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div>
            ) : exams && exams.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Subject</TableHead>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map(e => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/30" onClick={() => window.location.href = `/exams/${e.id}`}>
                      <TableCell className="pl-6 font-medium">{e.subject}</TableCell>
                      <TableCell>{e.name}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(e.date), "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-muted-foreground">No exams scheduled for this class.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}