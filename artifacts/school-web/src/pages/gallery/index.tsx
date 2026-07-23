import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  useListGalleryAlbums,
  useCreateGalleryAlbum,
  useDeleteGalleryAlbum,
  useListClasses,
  getListGalleryAlbumsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Images, Plus, Trash2, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { uploadGalleryPhoto, UploadConfigError } from "@/lib/upload-image";

export default function GalleryPage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  const { data: albums, isLoading } = useListGalleryAlbums();
  const deleteAlbum = useDeleteGalleryAlbum();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this album and all its photos?")) return;
    deleteAlbum.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGalleryAlbumsQueryKey() });
          toast({ title: "Album deleted" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gallery</h1>
          <p className="text-muted-foreground mt-1">Photos from school activities and events</p>
        </div>
        {canManage && <AddAlbumDialog />}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : albums?.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Images className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">No albums yet</p>
          <p className="text-muted-foreground text-sm">Photos from school activities will appear here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums?.map((album) => (
            <Link key={album.id} href={`/gallery/${album.id}`}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
                <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                  {album.coverPhotoUrl ? (
                    <img src={album.coverPhotoUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{album.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(album.albumDate), "MMM d, yyyy")} · {album.photoCount} photo{album.photoCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {user?.role === "admin" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0"
                      onClick={(e) => { e.preventDefault(); handleDelete(album.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AddAlbumDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [albumDate, setAlbumDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [classId, setClassId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: classes, isLoading: classesLoading } = useListClasses();
  const createAlbum = useCreateGalleryAlbum();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !albumDate) return;
    setUploading(true);
    try {
      const imageUrls = await Promise.all(files.map((f) => uploadGalleryPhoto(f)));
      createAlbum.mutate(
        { data: { title: title.trim(), albumDate, classId: classId ? parseInt(classId) : undefined, imageUrls } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListGalleryAlbumsQueryKey() });
            toast({ title: "Album created" });
            setOpen(false);
            setTitle(""); setClassId(""); setFiles([]);
          },
          onError: () => toast({ title: "Failed to create album", variant: "destructive" }),
        },
      );
    } catch (err) {
      toast({ title: err instanceof UploadConfigError ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Add Album</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Gallery Album</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sports Day" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={albumDate} onChange={(e) => setAlbumDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Class (optional — leave blank for whole school)</Label>
            {classesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Whole school" /></SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Photos</Label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChosen} />
            <Button type="button" variant="outline" className="w-full gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-4 h-4" /> {files.length > 0 ? `${files.length} photo${files.length === 1 ? "" : "s"} selected` : "Choose photos"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !albumDate || uploading || createAlbum.isPending}>
            {uploading || createAlbum.isPending ? "Saving…" : "Create Album"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
