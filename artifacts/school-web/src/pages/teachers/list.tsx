import { useState, useRef } from "react";
import { useListTeachers, useCreateTeacher, getListTeachersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, GraduationCap, Copy, Check, Upload, Download, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { parseCsv, rowsToObjects, toCsv, downloadCsv } from "@/lib/csv";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface BulkImportResult {
  row: number;
  email: string;
  success: boolean;
  error?: string;
  tempPassword?: string;
}

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
        <div className="flex gap-2">
          <BulkImportTeachersDialog />
          <AddTeacherDialog />
        </div>
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

// ── Bulk Import Dialog ──────────────────────────────────────────────────

const TEACHER_CSV_HEADERS = ["name", "email", "subjects"];

function BulkImportTeachersDialog() {
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
    const sample = toCsv(TEACHER_CSV_HEADERS, [["Jane Doe", "jane.doe@example.com", "Math;Science"]]);
    downloadCsv("teachers-import-template.csv", sample);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/teachers/bulk-import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r) => ({
            name: r.name,
            email: r.email,
            subjects: r.subjects ? r.subjects.split(";").map((s) => s.trim()).filter(Boolean) : [],
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Import failed", variant: "destructive" });
        return;
      }
      setResults(data.results);
      queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey() });
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
          <DialogTitle>Bulk Import Teachers</DialogTitle>
          <DialogDescription>Upload a CSV to create many teacher accounts at once.</DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4 py-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleDownloadTemplate}>
              <Download className="w-3.5 h-3.5" /> Download CSV template
            </Button>
            <p className="text-xs text-muted-foreground">
              Required columns: <code className="bg-muted px-1 rounded">name, email</code>. Optional:{" "}
              <code className="bg-muted px-1 rounded">subjects</code> (semicolon-separated, e.g. "Math;Science").
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
                Import {rows.length > 0 ? `${rows.length} teacher${rows.length === 1 ? "" : "s"}` : ""}
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