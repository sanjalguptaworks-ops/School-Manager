import { useEffect, useState, useCallback, useRef } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useListClasses } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Paperclip, Plus, Trash2, Camera, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { uploadHomeworkSubmission, UploadConfigError } from "@/lib/upload-image";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface Homework {
  id: number;
  classId: number;
  title: string;
  description: string | null;
  dueDate: string;
  attachmentUrl: string | null;
  class: { id: number; name: string; section: string };
  completed: boolean;
  submissionUrl: string | null;
  completedCount: number;
}

export default function HomeworkPage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  const { toast } = useToast();

  const [classFilter, setClassFilter] = useState<string>("all");
  const { data: classes } = useListClasses();

  const [items, setItems] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = classFilter !== "all" ? `?classId=${classFilter}` : "";
      const res = await fetch(`${BASE_URL}/api/homework${qs}`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setItems(data);
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`${BASE_URL}/api/homework/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to delete homework", variant: "destructive" });
      return;
    }
    toast({ title: "Homework deleted" });
    await load();
  };

  const handleToggleComplete = async (hw: Homework) => {
    const method = hw.completed ? "DELETE" : "POST";
    const res = await fetch(`${BASE_URL}/api/homework/${hw.id}/complete`, { method, credentials: "include" });
    if (!res.ok && res.status !== 204) {
      toast({ title: "Failed to update", variant: "destructive" });
      return;
    }
    await load();
  };

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<Homework | null>(null);

  const handleAttachClick = (hw: Homework) => {
    uploadTargetRef.current = hw;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const hw = uploadTargetRef.current;
    if (!file || !hw) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image is too large (max 5MB)", variant: "destructive" });
      return;
    }

    setUploadingId(hw.id);
    try {
      const submissionUrl = await uploadHomeworkSubmission(file);
      const res = await fetch(`${BASE_URL}/api/homework/${hw.id}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionUrl }),
      });
      if (!res.ok && res.status !== 204) {
        toast({ title: "Failed to attach photo", variant: "destructive" });
        return;
      }
      toast({ title: "Photo attached" });
      await load();
    } catch (err) {
      toast({ title: err instanceof UploadConfigError ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Homework</h1>
          <p className="text-muted-foreground mt-1">
            {canManage ? "Assignments posted to your classes." : "Assignments for your class."}
          </p>
        </div>
        {canManage && <AddHomeworkDialog onCreated={load} />}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {canManage && (
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name} {c.section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="text-4xl mb-3">📚</div>
          <p className="font-semibold text-lg mb-1">No homework yet</p>
          <p className="text-muted-foreground text-sm">
            {canManage ? "Add an assignment to get started." : "Check back later for new assignments."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((hw) => {
            const overdue = !hw.completed && hw.dueDate < today;
            return (
              <Card key={hw.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  {user?.role === "student" && (
                    <Checkbox
                      checked={hw.completed}
                      onCheckedChange={() => handleToggleComplete(hw)}
                      className="mt-1 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium ${hw.completed ? "line-through text-muted-foreground" : ""}`}>{hw.title}</p>
                      {canManage && (
                        <span className="text-xs text-muted-foreground">
                          {hw.class.name} {hw.class.section}
                        </span>
                      )}
                    </div>
                    {hw.description && <p className="text-sm text-muted-foreground mt-0.5">{hw.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <p className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        Due {format(new Date(hw.dueDate), "d MMM yyyy")}
                      </p>
                      {hw.attachmentUrl && (
                        <a
                          href={hw.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          <Paperclip className="w-3 h-3" /> Attachment
                        </a>
                      )}
                      {canManage && (
                        <p className="text-xs text-muted-foreground">{hw.completedCount} student(s) completed</p>
                      )}
                      {user?.role === "student" && hw.submissionUrl && (
                        <a
                          href={hw.submissionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          <ImageIcon className="w-3 h-3" /> View your submission
                        </a>
                      )}
                      {user?.role === "student" && !hw.submissionUrl && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary disabled:opacity-50"
                          onClick={() => handleAttachClick(hw)}
                          disabled={uploadingId === hw.id}
                        >
                          <Camera className="w-3 h-3" /> {uploadingId === hw.id ? "Uploading..." : "Attach photo"}
                        </button>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(hw.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddHomeworkDialog({ onCreated }: { onCreated: () => void }) {
  const { data: classes } = useListClasses();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !title.trim() || !dueDate) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/homework`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: Number(classId),
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate,
          attachmentUrl: attachmentUrl.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to add homework", variant: "destructive" });
        return;
      }
      toast({ title: "Homework added" });
      setTitle("");
      setDescription("");
      setAttachmentUrl("");
      setOpen(false);
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Add Homework</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Add Homework</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classes?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} {c.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 4 exercises" />
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Attachment link (optional)</Label>
            <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !classId || !title.trim() || !dueDate}>
              {saving ? "Adding..." : "Add Homework"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
