import { useGetStudent, useUpdateStudent, useGetReportCard, useGetAttendanceSummary, getGetStudentQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, BookOpen, UserCircle, GraduationCap, Phone, Mail, FileText, ChevronLeft, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAppAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const { data: student, isLoading } = useGetStudent(studentId);
  const { data: reportCard, isLoading: reportLoading } = useGetReportCard(studentId);
  const { user } = useAppAuth();

  if (isLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-[200px] w-full" />
    </div>;
  }

  if (!student) return <div>Student not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/students"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{student.user?.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
              {student.class?.name} {student.class?.section}
            </span>
            <span>•</span>
            <span>Roll No: {student.rollNo}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="shadow-sm border-border/50 col-span-1">
          <CardHeader className="flex flex-row justify-between items-start pb-4">
            <CardTitle>Profile Details</CardTitle>
            {user?.role === 'admin' && <EditStudentDialog student={student} />}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold border-4 border-background shadow-sm overflow-hidden">
                {student.user?.avatarUrl ? (
                  <img src={student.user.avatarUrl} alt={student.user.name} className="w-full h-full object-cover" />
                ) : (
                  student.user?.name.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            <div className="space-y-4">
              <DetailRow icon={Mail} label="Email" value={student.user?.email} />
              <DetailRow icon={CalIcon} label="Date of Birth" value={student.dob ? format(new Date(student.dob), "PPP") : "-"} />
              <DetailRow icon={UserCircle} label="Guardian" value={student.guardianName || "-"} />
              <DetailRow icon={Phone} label="Contact" value={student.guardianContact || "-"} />
            </div>
          </CardContent>
        </Card>

        {/* Academic Records */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Latest Report Card
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : reportCard && reportCard.results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3 font-medium rounded-tl-md rounded-bl-md">Subject</th>
                        <th className="px-4 py-3 font-medium">Exam</th>
                        <th className="px-4 py-3 font-medium">Marks</th>
                        <th className="px-4 py-3 font-medium rounded-tr-md rounded-br-md">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportCard.results.map((res: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{res.exam.subject}</td>
                          <td className="px-4 py-3 text-muted-foreground">{res.exam.name}</td>
                          <td className="px-4 py-3">{res.marksObtained} / {res.exam.maxMarks}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${res.percentage >= 80 ? 'bg-green-500' : res.percentage >= 50 ? 'bg-blue-500' : 'bg-red-500'}`} 
                                  style={{ width: `${res.percentage}%` }} 
                                />
                              </div>
                              <span className="font-medium">{Math.round(res.percentage)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg">
                  No exams recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any, label: string, value: string | undefined }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

const editSchema = z.object({
  rollNo: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
});

function EditStudentDialog({ student }: { student: any }) {
  const [open, setOpen] = useState(false);
  const updateStudent = useUpdateStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      rollNo: student.rollNo,
      guardianName: student.guardianName || "",
      guardianContact: student.guardianContact || "",
    },
  });

  function onSubmit(values: z.infer<typeof editSchema>) {
    updateStudent.mutate(
      { id: student.id, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(student.id) });
          setOpen(false);
          toast({ title: "Updated successfully" });
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Details</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="rollNo" render={({ field }) => (
              <FormItem><FormLabel>Roll No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="guardianName" render={({ field }) => (
              <FormItem><FormLabel>Guardian Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="guardianContact" render={({ field }) => (
              <FormItem><FormLabel>Guardian Contact</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateStudent.isPending}>Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
