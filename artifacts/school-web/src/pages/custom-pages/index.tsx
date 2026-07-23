import { useState } from "react";
import { Link } from "wouter";
import {
  useListCustomPages,
  useCreateCustomPage,
  getListCustomPagesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { FolderOpen, Plus, ChevronRight } from "lucide-react";

export default function CustomPagesPage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin";
  const { data: pages, isLoading } = useListCustomPages();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pages</h1>
          <p className="text-muted-foreground mt-1">Food menus, holiday lists, and other school documents</p>
        </div>
        {canManage && <CreatePageDialog />}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : pages?.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">No pages yet</p>
          <p className="text-muted-foreground text-sm">School documents will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {pages?.map((page) => (
            <Link key={page.id} href={`/custom-pages/${page.id}`}>
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <p className="font-medium truncate">{page.title}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreatePageDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const createPage = useCreateCustomPage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) return;
    createPage.mutate(
      { data: { title: title.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomPagesQueryKey() });
          toast({ title: "Page created" });
          setOpen(false);
          setTitle(""); setBody("");
        },
        onError: () => toast({ title: "Failed to create page", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Add Page</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Page</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Food Menu 2026-27" />
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Page content…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !body.trim() || createPage.isPending}>
            {createPage.isPending ? "Creating…" : "Create Page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
