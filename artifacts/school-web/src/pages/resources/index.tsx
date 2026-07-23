import { useState } from "react";
import {
  useListResources,
  useCreateResource,
  useDeleteResource,
  useListClasses,
  getListResourcesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { BookOpen, Plus, Trash2, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { useSelectedChild } from "@/lib/selected-child-context";

export default function ResourcesPage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  const { selectedChildId } = useSelectedChild();
  const params = user?.role === "parent" && selectedChildId ? { studentId: selectedChildId } : {};
  const { data: resources, isLoading } = useListResources(params, {
    query: { queryKey: getListResourcesQueryKey(params) },
  });
  const deleteResource = useDeleteResource();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this update?")) return;
    deleteResource.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListResourcesQueryKey(params) });
          toast({ title: "Update deleted" });
        },
      },
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
          <p className="text-muted-foreground mt-1">Daily updates and class resources from teachers</p>
        </div>
        {canManage && <AddResourceDialog />}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : resources?.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">No updates yet</p>
          <p className="text-muted-foreground text-sm">Daily updates from teachers will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {resources?.map((r) => (
            <Card key={r.id} className="shadow-sm border-border/50">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">{r.groupName}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy")}</span>
                    </div>
                    <p className="font-semibold mt-1.5">{r.title}</p>
                  </div>
                  {user?.role === "admin" && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                {r.attachmentUrl && (
                  <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <Paperclip className="w-3.5 h-3.5" /> Attachment
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddResourceDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [groupName, setGroupName] = useState("Daily Updates");
  const [classId, setClassId] = useState("");
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const { data: classes, isLoading: classesLoading } = useListClasses();
  const createResource = useCreateResource();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!title.trim() || !body.trim() || !classId) return;
    createResource.mutate(
      { data: { title: title.trim(), groupName: groupName.trim() || undefined, body: body.trim(), classId: parseInt(classId), attachmentUrl: attachmentUrl.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListResourcesQueryKey({}) });
          toast({ title: "Update posted" });
          setOpen(false);
          setTitle(""); setBody(""); setClassId(""); setAttachmentUrl(""); setGroupName("Daily Updates");
        },
        onError: (err: any) => toast({ title: err?.message || "Failed to post update", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Add Update</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Class</Label>
            {classesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select a class…" /></SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Daily update" />
            </div>
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Daily Updates" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="I sang: Rhymes...&#10;I enjoyed: Circle time...&#10;I learned: Phonic sounds..." />
          </div>
          <div className="space-y-1.5">
            <Label>Attachment link (optional)</Label>
            <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !body.trim() || !classId || createResource.isPending}>
            {createResource.isPending ? "Posting…" : "Post Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
