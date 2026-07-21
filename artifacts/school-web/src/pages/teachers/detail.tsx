import { useGetTeacher, useUpdateTeacher, getGetTeacherQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Mail, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function TeacherDetail() {
  const { id } = useParams<{ id: string }>();
  const teacherId = Number(id);
  const { data: teacher, isLoading } = useGetTeacher(teacherId);

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-[200px]" /></div>;
  }

  if (!teacher) return <div>Teacher not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/teachers"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{teacher.user?.name}</h1>
          <p className="text-muted-foreground mt-1">Teacher Profile</p>
        </div>
      </div>

      <Card className="max-w-2xl shadow-sm border-border/50">
        <CardHeader className="flex flex-row justify-between items-start pb-4">
          <CardTitle>Profile Details</CardTitle>
          <EditTeacherDialog teacher={teacher} />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold overflow-hidden shrink-0">
              {teacher.user?.avatarUrl ? (
                <img src={teacher.user.avatarUrl} alt={teacher.user.name} className="w-full h-full object-cover" />
              ) : (
                teacher.user?.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{teacher.user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <BookOpen className="w-4 h-4" />
                <div className="flex flex-wrap gap-1.5">
                  {teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects.map((sub, i) => (
                    <Badge key={i} variant="secondary" className="font-normal">{sub}</Badge>
                  )) : <span>No subjects assigned</span>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const editSchema = z.object({
  subjects: z.string().optional(),
});

function EditTeacherDialog({ teacher }: { teacher: any }) {
  const [open, setOpen] = useState(false);
  const updateTeacher = useUpdateTeacher();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      subjects: teacher.subjects?.join(", ") || "",
    },
  });

  function onSubmit(values: z.infer<typeof editSchema>) {
    const subjectsArray = values.subjects ? values.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];
    updateTeacher.mutate(
      { id: teacher.id, data: { subjects: subjectsArray } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTeacherQueryKey(teacher.id) });
          setOpen(false);
          toast({ title: "Updated successfully" });
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit Subjects</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Subjects</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="subjects" render={({ field }) => (
              <FormItem>
                <FormLabel>Subjects</FormLabel>
                <FormControl><Input placeholder="Math, Science, English..." {...field} /></FormControl>
                <FormDescription>Comma separated list</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateTeacher.isPending}>Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}