import { useState, useRef } from "react";
import { useListStudents, useGetClass, useListClasses, useCreateStudent } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Plus, UserCircle, Loader2, Copy, Check, Upload, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListStudentsQueryKey } from "@workspace/api-client-react";
import { parseCsv, rowsToObjects, toCsv, downloadCsv } from "@/lib/csv";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface BulkImportResult {
  row: number;
  email: string;
  success: boolean;
  error?: string;
  tempPassword?: string;
}

export default function StudentsList() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const { data: students, isLoading } = useListStudents(classFilter !== "all" ? { classId: Number(classFilter) } : {});
  const { data: classes } = useListClasses();
  
  const filteredStudents = students?.filter(s => 
    search === "" || 
    s.user?.name.toLowerCase().includes(search.toLowerCase()) || 
    s.rollNo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">Manage and view student records</p>
        </div>
        <div className="flex gap-2">
          <BulkImportStudentsDialog classes={classes || []} />
          <AddStudentDialog classes={classes || []} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or roll number..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full bg-background border-border/50"
          />
        </div>
        <div className="w-full sm:w-[200px]">
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
              <TableHead className="font-medium text-muted-foreground">Roll No</TableHead>
              <TableHead className="font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="font-medium text-muted-foreground">Class</TableHead>
              <TableHead className="font-medium text-muted-foreground">Contact</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredStudents?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No students found.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents?.map((student) => (
                <TableRow key={student.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{student.rollNo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0">
                        {student.user?.avatarUrl ? (
                          <img src={student.user.avatarUrl} alt={student.user.name} className="w-full h-full object-cover" />
                        ) : (
                          student.user?.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{student.user?.name}</p>
                        <p className="text-xs text-muted-foreground">{student.user?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-muted text-muted-foreground border-border font-normal">
                      {student.class?.name} {student.class?.section}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {student.guardianContact || <span className="text-muted-foreground italic">N/A</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/students/${student.id}`}>View Profile</Link>
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

function Badge({ children, className }: any) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  classId: z.coerce.number().min(1, "Class is required"),
  rollNo: z.string().min(1, "Roll number required"),
  dob: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
});

function AddStudentDialog({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "result">("form");
  const [result, setResult] = useState<{ email: string; tempPassword: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const createStudent = useCreateStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      rollNo: "",
      dob: "",
      guardianName: "",
      guardianContact: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createStudent.mutate(
      { data: values },
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          setResult({ email: values.email, tempPassword: data.tempPassword, emailSent: !!data.emailSent });
          setStep("result");
          form.reset();
        },
        onError: (err: any) => {
          toast({ title: "Error creating student", description: err.message, variant: "destructive" });
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
        <Button className="shadow-sm"><Plus className="w-4 h-4 mr-2" /> Add Student</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>Create a new student record and user account.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="classId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classes.map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name} {c.section}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="rollNo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roll No</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="dob" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="guardianContact" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guardian Contact</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="guardianName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guardian Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createStudent.isPending}>
                    {createStudent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Student
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Student Account Created</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Login Credentials — Share with the student
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
                  This won't be shown again. The student should change it after logging in via their Profile page.
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

// ── Bulk Import Dialog ──────────────────────────────────────────────────

const STUDENT_CSV_HEADERS = ["name", "email", "rollNo", "className", "section", "dob", "guardianName", "guardianContact"];

function BulkImportStudentsDialog({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<BulkImportResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setRows([]);
      setFileName("");
      setParseError(null);
      setResults(null);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    try {
      const text = await file.text();
      const parsed = rowsToObjects(parseCsv(text));
      if (parsed.length === 0) {
        setParseError("No rows found in this file.");
        setRows([]);
        return;
      }
      setParseError(null);
      setRows(parsed);
    } catch {
      setParseError("Could not read this file.");
      setRows([]);
    }
  };

  const handleDownloadTemplate = () => {
    const sample = toCsv(STUDENT_CSV_HEADERS, [
      ["Jane Doe", "jane.doe@example.com", "10A-003", "Class 10", "A", "2009-05-14", "Mohan Doe", "9876543210"],
    ]);
    downloadCsv("students-import-template.csv", sample);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/students/bulk-import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Import failed", variant: "destructive" });
        return;
      }
      setResults(data.results);
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
    } finally {
      setImporting(false);
    }
  };

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results ? results.length - successCount : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="shadow-sm"><Upload className="w-4 h-4 mr-2" /> Bulk Import</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Students</DialogTitle>
          <DialogDescription>Upload a CSV to create many student accounts at once.</DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4 py-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleDownloadTemplate}>
              <Download className="w-3.5 h-3.5" /> Download CSV template
            </Button>
            <p className="text-xs text-muted-foreground">
              Required columns: <code className="bg-muted px-1 rounded">name, email, rollNo, className, section</code>.
              Optional: <code className="bg-muted px-1 rounded">dob, guardianName, guardianContact</code>. className/section
              must match an existing class exactly (e.g. "Class 10" / "A").
              {classes.length > 0 && (
                <> Your classes: {classes.map((c) => `"${c.name}" / "${c.section}"`).join(", ")}.</>
              )}
            </p>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> {fileName || "Choose CSV file"}
            </Button>
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
            {rows.length > 0 && !parseError && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">
                {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleImport} disabled={rows.length === 0 || importing}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Import {rows.length > 0 ? `${rows.length} student${rows.length === 1 ? "" : "s"}` : ""}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex gap-3 text-sm">
              <span className="text-green-700 font-medium">{successCount} created</span>
              {failCount > 0 && <span className="text-red-700 font-medium">{failCount} failed</span>}
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1.5 border rounded-lg p-2">
              {results.map((r) => (
                <div key={r.row} className={`text-xs p-2 rounded-md ${r.success ? "bg-green-50" : "bg-red-50"}`}>
                  <span className="font-mono">{r.email || `Row ${r.row + 1}`}</span>
                  {r.success ? (
                    <span className="ml-2 text-green-700">created — temp password: <span className="font-mono font-bold">{r.tempPassword}</span></span>
                  ) : (
                    <span className="ml-2 text-red-700">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Copy the temporary passwords above before closing — they won't be shown again.
            </p>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
