import { useParams, useLocation } from "wouter";
import { useRef, useState } from "react";
import {
  useGetGalleryAlbum,
  useAddGalleryPhotos,
  useDeleteGalleryPhoto,
  getGetGalleryAlbumQueryKey,
  getListGalleryAlbumsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { ArrowLeft, ImageIcon, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { uploadGalleryPhoto, UploadConfigError } from "@/lib/upload-image";

export default function GalleryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const albumId = parseInt(id!);
  const [, navigate] = useLocation();
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  const { data: album, isLoading } = useGetGalleryAlbum(albumId);
  const addPhotos = useAddGalleryPhotos();
  const deletePhoto = useDeleteGalleryPhoto();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetGalleryAlbumQueryKey(albumId) });
    queryClient.invalidateQueries({ queryKey: getListGalleryAlbumsQueryKey() });
  };

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setUploading(true);
    try {
      const imageUrls = await Promise.all(files.map((f) => uploadGalleryPhoto(f)));
      addPhotos.mutate(
        { id: albumId, data: { imageUrls } },
        {
          onSuccess: () => { invalidate(); toast({ title: "Photos added" }); },
          onError: () => toast({ title: "Failed to add photos", variant: "destructive" }),
        },
      );
    } catch (err) {
      toast({ title: err instanceof UploadConfigError ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    if (!confirm("Delete this photo?")) return;
    deletePhoto.mutate(
      { id: albumId, photoId },
      { onSuccess: () => { invalidate(); toast({ title: "Photo deleted" }); } },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!album) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gallery")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{album.title}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(album.albumDate), "EEEE, MMMM d, yyyy")} · {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {canManage && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChosen} />
          <Button variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <ImageIcon className="w-4 h-4" /> {uploading ? "Uploading…" : "Add photos"}
          </Button>
        </div>
      )}

      {album.photos.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground border border-dashed rounded-lg">
          No photos in this album yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {album.photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border">
              <img
                src={photo.imageUrl}
                alt=""
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setPreview(photo.imageUrl)}
              />
              {canManage && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-1.5 right-1.5 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeletePhoto(photo.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <Button size="icon" variant="ghost" className="absolute top-4 right-4 text-white hover:text-white hover:bg-white/10" onClick={() => setPreview(null)}>
            <X className="w-5 h-5" />
          </Button>
          <img src={preview} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
