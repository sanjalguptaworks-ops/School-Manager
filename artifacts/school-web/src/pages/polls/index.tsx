import { useState } from "react";
import {
  useListPolls,
  useCreatePoll,
  useVotePoll,
  useDeletePoll,
  useListClasses,
  getListPollsQueryKey,
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
import { Vote, Plus, Trash2, Check } from "lucide-react";
import { format } from "date-fns";

export default function PollsPage() {
  const { user } = useAppAuth();
  const canManage = user?.role === "admin" || user?.role === "teacher";
  const { data: polls, isLoading } = useListPolls();
  const deletePoll = useDeletePoll();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this poll?")) return;
    deletePoll.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() });
          toast({ title: "Poll deleted" });
        },
      },
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Polls</h1>
          <p className="text-muted-foreground mt-1">Vote on school polls and surveys</p>
        </div>
        {canManage && <CreatePollDialog />}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : polls?.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Vote className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">No polls yet</p>
          <p className="text-muted-foreground text-sm">Polls will appear here once one is created.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {polls?.map((poll) => (
            <PollCard key={poll.id} poll={poll} canDelete={user?.role === "admin"} onDelete={() => handleDelete(poll.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PollCard({ poll, canDelete, onDelete }: { poll: any; canDelete: boolean; onDelete: () => void }) {
  const votePoll = useVotePoll();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const closed = poll.closesAt && new Date(poll.closesAt) < new Date();

  const handleVote = (optionId: number) => {
    votePoll.mutate(
      { id: poll.id, data: { optionId } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() }),
        onError: (err: any) => toast({ title: err?.message || "Failed to vote", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="shadow-sm border-border/50">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{poll.question}</p>
          {canDelete && (
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {poll.options.map((opt: any) => {
            const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
            const isMine = poll.myOptionId === opt.id;
            if (poll.hasVoted) {
              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      {isMine && <Check className="w-3.5 h-3.5 text-primary" />}
                      {opt.text}
                    </span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${isMine ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            }
            return (
              <Button
                key={opt.id}
                variant="outline"
                className="w-full justify-start"
                disabled={closed || votePoll.isPending}
                onClick={() => handleVote(opt.id)}
              >
                {opt.text}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
          {poll.closesAt && ` · ${closed ? "Closed" : "Closes"} ${format(new Date(poll.closesAt), "MMM d, yyyy")}`}
        </p>
      </CardContent>
    </Card>
  );
}

function CreatePollDialog() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [classId, setClassId] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const { data: classes, isLoading: classesLoading } = useListClasses();
  const createPoll = useCreatePoll();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const validOptions = options.map((o) => o.trim()).filter(Boolean);

  const updateOption = (i: number, value: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  };

  const handleSubmit = () => {
    if (!question.trim() || validOptions.length < 2) return;
    createPoll.mutate(
      { data: { question: question.trim(), classId: classId ? parseInt(classId) : undefined, options: validOptions } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPollsQueryKey() });
          toast({ title: "Poll created" });
          setOpen(false);
          setQuestion(""); setClassId(""); setOptions(["", ""]);
        },
        onError: () => toast({ title: "Failed to create poll", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> Create Poll</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Poll</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Preferred sports day date?" />
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
            <Label>Options</Label>
            {options.map((opt, i) => (
              <Input key={i} value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className="mb-2" />
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOptions((prev) => [...prev, ""])}>
              + Add option
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!question.trim() || validOptions.length < 2 || createPoll.isPending}>
            {createPoll.isPending ? "Creating…" : "Create Poll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
