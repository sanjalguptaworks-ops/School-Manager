import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useAppAuth } from "@/lib/auth-context";
import { useListStudents } from "@workspace/api-client-react";
import { uploadCertificateTemplate } from "@/lib/upload-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Award, Camera, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface CertificateRow {
  id: number;
  studentId: number;
  title: string;
  body: string;
  issueDate: string;
  issuedByName: string | null;
  createdAt: string;
  student: { id: number; rollNo: string; name: string | null };
}

export default function CertificatesPage() {
  const { user } = useAppAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();

  const [school, setSchool] = useState<{ certificateTemplateUrl: string | null } | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: students } = useListStudents();

  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [creating, setCreating] = useState(false);

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/certificates`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setCertificates(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchool = useCallback(async () => {
    if (!isAdmin) return;
    const res = await fetch(`${BASE_URL}/api/schools/me`, { credentials: "include" });
    const data = await res.json().catch(() => null);
    if (res.ok) setSchool(data);
  }, [isAdmin]);

  useEffect(() => {
    loadCertificates();
    loadSchool();
  }, [loadCertificates, loadSchool]);

  const handleTemplateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Image is too large (max 8MB)", variant: "destructive" });
      return;
    }
    setUploadingTemplate(true);
    try {
      const url = await uploadCertificateTemplate(file);
      const res = await fetch(`${BASE_URL}/api/schools/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateTemplateUrl: url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: data.error || "Could not save template", variant: "destructive" });
        return;
      }
      setSchool({ certificateTemplateUrl: url });
      toast({ title: "Certificate template updated" });
    } catch (err: any) {
      toast({ title: err?.message || "Could not upload template", variant: "destructive" });
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !title.trim() || !body.trim() || !issueDate) return;
    setCreating(true);
    try {
      const res = await fetch(`${BASE_URL}/api/certificates`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: Number(studentId), title: title.trim(), body: body.trim(), issueDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to issue certificate", variant: "destructive" });
        return;
      }
      toast({ title: "Certificate issued" });
      setStudentId("");
      setTitle("");
      setBody("");
      await loadCertificates();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/certificates/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to delete certificate", variant: "destructive" });
      return;
    }
    toast({ title: "Certificate deleted" });
    await loadCertificates();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Certificates</h1>
        <p className="text-muted-foreground mt-1">Issue certificates to students and manage your school's design.</p>
      </div>

      {isAdmin && (
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Certificate design</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="w-32 h-20 rounded-lg bg-muted border overflow-hidden flex items-center justify-center shrink-0">
              {school?.certificateTemplateUrl ? (
                <img src={school.certificateTemplateUrl} alt="Certificate template" className="w-full h-full object-cover" />
              ) : (
                <Award className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <input ref={templateInputRef} type="file" accept="image/*" className="hidden" onChange={handleTemplateChange} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploadingTemplate}
                onClick={() => templateInputRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5" />
                {uploadingTemplate ? "Uploading..." : school?.certificateTemplateUrl ? "Change design" : "Upload design"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Used as the background for every certificate this school issues. Landscape images work best.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Issue a new certificate</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Student</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
                    <SelectContent>
                      {students?.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.user?.name} ({s.rollNo}{s.class ? ` · ${s.class.name} ${s.class.section}` : ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Issue date</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Certificate of Achievement" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. For outstanding performance in the Annual Science Exhibition, 2026."
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={creating || !studentId || !title.trim() || !body.trim()}>
                {creating ? "Issuing..." : "Issue certificate"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Issued certificates</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : certificates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certificates issued yet.</p>
        ) : (
          <div className="space-y-2">
            {certificates.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.student.name} ({c.student.rollNo}) · {format(new Date(c.issueDate), "MMM d, yyyy")}
                      {c.issuedByName ? ` · issued by ${c.issuedByName}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
                      <Link href={`/certificates/${c.id}/view`}>
                        <Eye className="w-3.5 h-3.5" /> View
                      </Link>
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
