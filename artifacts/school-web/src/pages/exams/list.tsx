import { useState } from "react";
import { useListExams, useListClasses, useCreateExam, getListExamsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ExamsList() {
  const [classFilter, setClassFilter] = useState<string>("all");
  const { data: exams, isLoading } = useListExams(classFilter !== "all" ? { classId: Number(classFilter) } : {});
  const { data: classes } = useListClasses();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exams</h1>
          <p className="text-muted-foreground mt-1">Manage examinations and marks</p>
        </div>
        <AddExamDialog classes={classes || []} />
      </div>

      <div className="flex bg-card p-4 rounded-xl border shadow-sm">
        <div className="w-full sm:w-[250px]">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="bg-background border-border/50">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes?.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name} {c.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-medium text-muted-foreground pl-6">Exam Name</TableHead>
              <TableHead className="font-medium text-muted-foreground">Class</TableHead>
              <TableHead className="font-medium text-muted-foreground">Subject</TableHead>
              <TableHead className="font-medium text-muted-foreground">Date</TableHead>
              <TableHead className="font-medium text-muted-foreground">Max Marks</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : exams?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No exams found.
                </TableCell>
              </TableRow>
            ) : (
              exams?.map((exam) => (
                <TableRow key={exam.id} className="group hover:bg-muted/30">
                  <TableCell className="pl-6 font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      {exam.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{exam.class?.name} {exam.class?.section}</TableCell>
                  <TableCell>{exam.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(exam.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{exam.maxMarks}</TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/exams/${exam.id}`}>Enter Marks</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  classId: z.coerce.number().min(1, "Class is required"),
  subject: z.string().min(1, "Subject is required"),
  date: z.string().min(1, "Date is required"),
  maxMarks: z.coerce.number().min(1, "Max marks must be > 0"),
});

function AddExamDialog({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const createExam = useCreateExam();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date: format(new Date(), "yyyy-MM-dd"),
      subject: "",
      maxMarks: 100,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createExam.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
          setOpen(false);
          form.reset();
          toast({ title: "Exam created" });
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-sm"><Plus className="w-4 h-4 mr-2" /> Schedule Exam</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule New Exam</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Exam Name (e.g. Midterm)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name} {c.section}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="maxMarks" render={({ field }) => (
                <FormItem><FormLabel>Max Marks</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createExam.isPending}>Save Exam</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}