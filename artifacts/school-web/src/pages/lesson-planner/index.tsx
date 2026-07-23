import { useState } from "react";
import {
  useListLessonPlans,
  useCreateLessonPlan,
  useDeleteLessonPlan,
  useListClasses,
  getListLessonPlansQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function LessonPlannerPage() {
  const { user } = useAppAuth();
  const { data: plans, isLoading } = useListLessonPlans();
  const deletePlan = useDeleteLessonPlan();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this lesson plan?")) return;
    deletePlan.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLessonPlansQueryKey() });
          toast({ title: "Lesson plan deleted" });
        },
      },
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lesson Planner</h1>
          <p className="text-muted-foreground mt-1">Plan lessons by class, subject, and date</p>
        </div>
        <AddLessonPlanDialog />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : plans?.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FolderKanban className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">No lesson plans yet</p>
          <p className="text-muted-foreground text-sm">Add a plan to get started.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans?.map((p) => (
            <Card key={p.id} className="shadow-sm border-border/50">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.topic}</p>
                    <p className="text-xs text-muted-foreground">{p.subject} · {format(new Date(p.planDate), "MMM d, yyyy")}</p>
                  </div>
                  {(user?.role === "admin" || user?.role === "teacher") && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{p.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddLessonPlanDialog() {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const { data: classes, isLoading: classesLoading } = useListClasses();
  const createPlan = useCreateLessonPlan();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!classId || !subject.trim() || !planDate || !topic.trim() || !content.trim()) return;
    createPlan.mutate(
      { data: { classId: parseInt(classId), subject: subject.trim(), planDate, topic: topic.trim(), content: content.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLessonPlansQueryKey() });
          toast({ title: "Lesson plan added" });
          setOpen(false);
          setClassId(""); setSubject(""); setTopic(""); setContent("");
        },
        onError: (err: any) => toast({ title: err?.message || "Failed to add lesson plan", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Add Plan</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Lesson Plan</DialogTitle>
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
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fractions" />
          </div>
          <div className="space-y-1.5">
            <Label>Plan details</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!classId || !subject.trim() || !topic.trim() || !content.trim() || createPlan.isPending}>
            {createPlan.isPending ? "Saving…" : "Add Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
