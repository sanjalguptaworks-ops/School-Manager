import { useParams, useLocation } from "wouter";
import { useRef, useState } from "react";
import {
  useGetCustomPage,
  useUpdateCustomPage,
  useDeleteCustomPage,
  useAddCustomPageAttachment,
  useDeleteCustomPageAttachment,
  getGetCustomPageQueryKey,
  getListCustomPagesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { ArrowLeft, Paperclip, Pencil, Trash2, Upload, X } from "lucide-react";
import { uploadCustomPageAttachment, UploadConfigError } from "@/lib/upload-image";

export default function CustomPageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pageId = parseInt(id!);
  const [, navigate] = useLocation();
  const { user } = useAppAuth();
  const canManage = user?.role === "admin";
  const { data: page, isLoading } = useGetCustomPage(pageId);
  const updatePage = useUpdateCustomPage();
  const deletePage = useDeleteCustomPage();
  const addAttachment = useAddCustomPageAttachment();
  const deleteAttachment = useDeleteCustomPageAttachment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCustomPageQueryKey(pageId) });
    queryClient.invalidateQueries({ queryKey: getListCustomPagesQueryKey() });
  };

  const startEditing = () => {
    if (!page) return;
    setTitle(page.title);
    setBody(page.body);
    setEditing(true);
  };

  const handleSave = () => {
    if (!title.trim() || !body.trim()) return;
    updatePage.mutate(
      { id: pageId, data: { title: title.trim(), body: body.trim() } },
      {
        onSuccess: () => { invalidate(); toast({ title: "Page updated" }); setEditing(false); },
        onError: () => toast({ title: "Failed to update page", variant: "destructive" }),
      },
    );
  };

  const handleDeletePage = () => {
    if (!confirm("Delete this page and all its attachments?")) return;
    deletePage.mutate(
      { id: pageId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomPagesQueryKey() });
          toast({ title: "Page deleted" });
          navigate("/custom-pages");
        },
      },
    );
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileUrl = await uploadCustomPageAttachment(file);
      addAttachment.mutate(
        { id: pageId, data: { fileUrl, fileName: file.name } },
        {
          onSuccess: () => { invalidate(); toast({ title: "Attachment added" }); },
          onError: () => toast({ title: "Failed to add attachment", variant: "destructive" }),
        },
      );
    } catch (err) {
      toast({ title: err instanceof UploadConfigError ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = (attachmentId: number) => {
    if (!confirm("Delete this attachment?")) return;
    deleteAttachment.mutate({ id: pageId, attachmentId }, { onSuccess: invalidate });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/custom-pages")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        {editing ? (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xl font-bold" />
        ) : (
          <h1 className="text-2xl font-bold tracking-tight flex-1">{page.title}</h1>
        )}
        {canManage && !editing && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={startEditing}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={handleDeletePage}><Trash2 className="w-4 h-4" /></Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!title.trim() || !body.trim() || updatePage.isPending}>
              {updatePage.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{page.body}</p>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Attachments</h2>
        {(page.attachments?.length ?? 0) === 0 && !canManage && (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        )}
        {page.attachments?.map((att) => (
          <div key={att.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline min-w-0">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{att.fileName}</span>
            </a>
            {canManage && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteAttachment(att.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
        {canManage && (
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />
            <Button variant="outline" size="sm" className="gap-1.5 mt-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Add attachment"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
