import { useState } from "react";
import { useGetClass, useListStudents, useListExams, useListClasses, getGetClassQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, FileText, ChevronLeft, CalendarCheck, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useAppAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const classId = Number(id);
  const { user } = useAppAuth();
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/classes"><ChevronLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{cls.name} <span className="text-muted-foreground font-normal">Section {cls.section}</span></h1>
            <p className="text-muted-foreground mt-1">{cls.studentCount || 0} students enrolled</p>
          </div>
        </div>
        {user?.role === "admin" && (students?.length ?? 0) > 0 && <PromoteStudentsDialog classId={classId} studentCount={students!.length} />}
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

function PromoteStudentsDialog({ classId, studentCount }: { classId: number; studentCount: number }) {
  const { data: classes } = useListClasses();
  const [open, setOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const otherClasses = classes?.filter((c) => c.id !== classId) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClassId) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/classes/${classId}/promote-students`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetClassId: Number(targetClassId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to promote students", variant: "destructive" });
        return;
      }
      toast({ title: `${data.promoted} student(s) promoted` });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: getGetClassQueryKey(classId) });
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey({ classId }) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5"><ArrowUpRight className="w-4 h-4" /> Promote Students</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote Students</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Move all {studentCount} student(s) in this class to another class -- typically used for a year-end promotion.
          </p>
          <div className="space-y-1.5">
            <Select value={targetClassId} onValueChange={setTargetClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target class" />
              </SelectTrigger>
              <SelectContent>
                {otherClasses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !targetClassId}>
              {saving ? "Promoting..." : "Promote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}