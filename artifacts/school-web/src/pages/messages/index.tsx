import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAppAuth } from "@/lib/auth-context";
import { useListTeachers, useListStudents } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { MessageSquare, Plus, Send, ChevronLeft } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface ConversationSummary {
  id: number;
  teacherId: number;
  parentId: number;
  studentId: number;
  teacherName: string;
  parentName: string;
  studentName: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: string;
}

export default function MessagesPage() {
  const { user } = useAppAuth();
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const selectedId = params.id ? Number(params.id) : null;

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${BASE_URL}/api/conversations`, { credentials: "include" });
      if (res.ok) setConversations(await res.json());
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1">Direct conversations between parents and teachers.</p>
        </div>
        {(user?.role === "parent" || user?.role === "teacher") && (
          <NewConversationDialog onCreated={(id) => { loadConversations(); setLocation(`/messages/${id}`); }} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className={`md:col-span-1 overflow-hidden ${selectedId ? "hidden md:block" : ""}`}>
          <CardContent className="p-0">
            {loadingList ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((c) => {
                  const other = user?.role === "teacher" ? c.parentName : c.teacherName;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setLocation(`/messages/${c.id}`)}
                      className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${c.id === selectedId ? "bg-muted/50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{other}</p>
                        {c.unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{c.unreadCount}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">Re: {c.studentName}</p>
                      {c.lastMessageBody && <p className="text-xs text-muted-foreground truncate mt-1">{c.lastMessageBody}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className={`md:col-span-2 ${!selectedId ? "hidden md:flex" : "flex"} flex-col`}>
          {selected ? (
            <ThreadView conversation={selected} onBack={() => setLocation("/messages")} onSent={loadConversations} />
          ) : (
            <Card className="flex-1 flex items-center justify-center min-h-[300px]">
              <p className="text-muted-foreground text-sm">Select a conversation to view messages.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadView({ conversation, onBack, onSent }: { conversation: ConversationSummary; onBack: () => void; onSent: () => void }) {
  const { user } = useAppAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const other = user?.role === "teacher" ? conversation.parentName : conversation.teacherName;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/conversations/${conversation.id}/messages`, { credentials: "include" });
      if (res.ok) setMessages(await res.json());
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${BASE_URL}/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (res.ok) {
        setBody("");
        await load();
        onSent();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex-1 flex flex-col min-h-[400px]">
      <div className="flex items-center gap-2 p-4 border-b">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <p className="font-medium text-sm">{other}</p>
          <p className="text-xs text-muted-foreground">Re: {conversation.studentName}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center">No messages yet -- say hello.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t">
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message..." />
        <Button type="submit" size="icon" disabled={sending || !body.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
}

function NewConversationDialog({ onCreated }: { onCreated: (conversationId: number) => void }) {
  const { user } = useAppAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Parent flow
  const [myChildren, setMyChildren] = useState<{ id: number; user: { name: string } }[]>([]);
  const [childId, setChildId] = useState("");
  const { data: teachers } = useListTeachers();
  const [teacherUserId, setTeacherUserId] = useState("");

  // Teacher flow
  const { data: myStudents } = useListStudents();
  const [studentId, setStudentId] = useState("");
  const [parents, setParents] = useState<{ id: number; name: string }[]>([]);
  const [parentUserId, setParentUserId] = useState("");

  useEffect(() => {
    if (user?.role === "parent" && open) {
      fetch(`${BASE_URL}/api/parents/${user.id}/students`, { credentials: "include" })
        .then((res) => res.json())
        .then(setMyChildren)
        .catch(() => {});
    }
  }, [user, open]);

  useEffect(() => {
    if (user?.role === "teacher" && studentId) {
      fetch(`${BASE_URL}/api/students/${studentId}/parents`, { credentials: "include" })
        .then((res) => res.json())
        .then(setParents)
        .catch(() => {});
    } else {
      setParents([]);
      setParentUserId("");
    }
  }, [user, studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body =
        user?.role === "parent"
          ? { studentId: Number(childId), teacherUserId: Number(teacherUserId) }
          : { studentId: Number(studentId), parentUserId: Number(parentUserId) };

      const res = await fetch(`${BASE_URL}/api/conversations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Failed to start conversation", variant: "destructive" });
        return;
      }
      setOpen(false);
      onCreated(data.id);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = user?.role === "parent" ? !!childId && !!teacherUserId : !!studentId && !!parentUserId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="w-4 h-4" /> New Conversation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> New Conversation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {user?.role === "parent" ? (
            <>
              <div className="space-y-1.5">
                <Label>Child</Label>
                <Select value={childId} onValueChange={setChildId}>
                  <SelectTrigger><SelectValue placeholder="Select your child" /></SelectTrigger>
                  <SelectContent>
                    {myChildren.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.user?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Teacher</Label>
                <Select value={teacherUserId} onValueChange={setTeacherUserId}>
                  <SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers?.map((t: any) => (
                      <SelectItem key={t.user.id} value={String(t.user.id)}>{t.user?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger>
                  <SelectContent>
                    {myStudents?.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.user?.name} ({s.rollNo})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Parent</Label>
                <Select value={parentUserId} onValueChange={setParentUserId} disabled={!studentId}>
                  <SelectTrigger><SelectValue placeholder={studentId ? "Select a parent" : "Select a student first"} /></SelectTrigger>
                  <SelectContent>
                    {parents.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {studentId && parents.length === 0 && (
                  <p className="text-xs text-muted-foreground">No parent account is linked to this student yet.</p>
                )}
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? "Starting..." : "Start Conversation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
