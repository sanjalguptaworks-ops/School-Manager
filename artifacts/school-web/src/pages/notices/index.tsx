import { useState } from "react";
import { useListNotices, useCreateNotice, useDeleteNotice, getListNoticesQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Bell, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

export default function NoticesPage() {
  const { user } = useAppAuth();
  const { data: notices, isLoading } = useListNotices();
  const deleteNotice = useDeleteNotice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    deleteNotice.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNoticesQueryKey() });
        toast({ title: "Notice deleted" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notice Board</h1>
          <p className="text-muted-foreground mt-1">Announcements and updates</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'teacher') && <AddNoticeDialog />}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-sm border-border/50">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))
        ) : notices?.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl bg-card">
            No notices published.
          </div>
        ) : (
          notices?.map((notice) => (
            <Card key={notice.id} className="shadow-sm border-border/50 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        To: <span className="capitalize ml-1 font-medium">{notice.targetRole}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">• {format(new Date(notice.createdAt), "PPP")}</span>
                      <span className="text-xs text-muted-foreground">• By {notice.createdByUser?.name}</span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{notice.title}</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap mt-2">{notice.body}</p>
                  </div>
                  {user?.role === 'admin' && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(notice.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Content is required"),
  targetRole: z.enum(["all", "students", "parents", "teachers", "admin"]),
});

function AddNoticeDialog() {
  const [open, setOpen] = useState(false);
  const createNotice = useCreateNotice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", body: "", targetRole: "all" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createNotice.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNoticesQueryKey() });
          setOpen(false);
          form.reset();
          toast({ title: "Notice published" });
        }
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-sm"><Plus className="w-4 h-4 mr-2" /> New Notice</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish Notice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="targetRole" render={({ field }) => (
              <FormItem>
                <FormLabel>Target Audience</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="students">Students Only</SelectItem>
                    <SelectItem value="parents">Parents Only</SelectItem>
                    <SelectItem value="teachers">Teachers Only</SelectItem>
                    <SelectItem value="admin">Staff Only</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="body" render={({ field }) => (
              <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createNotice.isPending}>Publish Notice</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}