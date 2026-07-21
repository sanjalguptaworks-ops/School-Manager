import { useState } from "react";
import { useListTeachers, useCreateTeacher, getListTeachersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, GraduationCap, Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function TeachersList() {
  const [search, setSearch] = useState("");
  const { data: teachers, isLoading } = useListTeachers();
  
  const filteredTeachers = teachers?.filter(t => 
    search === "" || 
    t.user?.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subjects?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
          <p className="text-muted-foreground mt-1">Manage teaching staff</p>
        </div>
        <AddTeacherDialog />
      </div>

      <div className="flex bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or subject..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full bg-background border-border/50"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-medium text-muted-foreground pl-6">Teacher</TableHead>
              <TableHead className="font-medium text-muted-foreground">Email</TableHead>
              <TableHead className="font-medium text-muted-foreground">Subjects</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6"><div className="flex items-center gap-3"><Skeleton className="w-8 h-8 rounded-full"/><Skeleton className="h-4 w-32"/></div></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full"/><Skeleton className="h-5 w-16 rounded-full"/></div></TableCell>
                  <TableCell className="pr-6 text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredTeachers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No teachers found.</TableCell>
              </TableRow>
            ) : (
              filteredTeachers?.map((teacher) => (
                <TableRow key={teacher.id} className="group hover:bg-muted/30">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0">
                        {teacher.user?.avatarUrl ? (
                          <img src={teacher.user.avatarUrl} alt={teacher.user.name} className="w-full h-full object-cover" />
                        ) : (
                          teacher.user?.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="font-medium">{teacher.user?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{teacher.user?.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {teacher.subjects?.map((sub, i) => (
                        <Badge key={i} variant="secondary" className="bg-muted border-border font-normal text-xs">{sub}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/teachers/${teacher.id}`}>View Profile</Link>
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
  email: z.string().email(),
  subjects: z.string().optional(),
});

function AddTeacherDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "result">("form");
  const [result, setResult] = useState<{ email: string; tempPassword: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const createTeacher = useCreateTeacher();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", subjects: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const subjectsArray = values.subjects ? values.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

    createTeacher.mutate(
      { data: { name: values.name, email: values.email, subjects: subjectsArray } },
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey() });
          setResult({ email: values.email, tempPassword: data.tempPassword, emailSent: !!data.emailSent });
          setStep("result");
          form.reset();
        },
        onError: (err: any) => {
          toast({ title: "Error creating teacher", description: err.message, variant: "destructive" });
        }
      }
    );
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setStep("form");
      setResult(null);
      setCopied(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Email: ${result.email}\nPassword: ${result.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="shadow-sm"><Plus className="w-4 h-4 mr-2" /> Add Teacher</Button>
      </DialogTrigger>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add New Teacher</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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
                  <Button type="submit" disabled={createTeacher.isPending}>Save Teacher</Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Teacher Account Created</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Login Credentials — Share with the teacher
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-mono font-medium">{result?.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Temporary Password</span>
                    <span className="text-sm font-mono font-bold bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded">
                      {result?.tempPassword}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This won't be shown again. The teacher should change it after logging in via their Profile page.
                </p>
              </div>
              {result?.emailSent ? (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">
                  These credentials were also emailed to {result.email}.
                </p>
              ) : (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Couldn't send this by email — please share these credentials manually.
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={handleCopy}>
                {copied ? <><Check className="w-4 h-4 mr-2 text-green-600" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy Credentials</>}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}