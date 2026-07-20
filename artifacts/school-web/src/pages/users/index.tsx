import { useRef, useState } from "react";
import {
  useListUsers,
  useUpdateUser,
  useListStudents,
  useListClasses,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/lib/auth-context";
import { uploadProfilePicture } from "@/lib/upload-image";
import { Plus, Copy, Check, ShieldCheck, Link2, Pencil, KeyRound, Camera } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 border-purple-200",
  teacher: "bg-blue-100 text-blue-800 border-blue-200",
  student: "bg-green-100 text-green-800 border-green-200",
  parent: "bg-amber-100 text-amber-800 border-amber-200",
};

async function inviteUser(payload: Record<string, any>) {
  const res = await fetch(`${BASE_URL}/api/invite`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invite failed");
  return data as { user: any; tempPassword: string; teacherId: number | null; studentId: number | null };
}

export default function UsersPage() {
  const { user } = useAppAuth();
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Admin access required.
      </div>
    );
  }
  return <UserManagement />;
}

function UserManagement() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const { data: users, isLoading } = useListUsers();
  const updateUser = useUpdateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = (users || []).filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const handleRoleChange = (id: number, newRole: string) => {
    updateUser.mutate(
      { id, data: { role: newRole as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Role updated" });
        },
        onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Invite and manage all accounts across every role.
          </p>
        </div>
        <InviteUserDialog />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {["all", "admin", "teacher", "student", "parent"].map((r) => (
            <Button
              key={r}
              size="sm"
              variant={roleFilter === r ? "secondary" : "ghost"}
              onClick={() => setRoleFilter(r)}
              className="capitalize"
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_COLORS[u.role] || ""}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        {u.role === "parent" && (
                          <ManageChildrenDialog
                            parent={u}
                            onDone={() => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })}
                          />
                        )}
                        <EditProfileDialog
                          targetUser={u}
                          onDone={() => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })}
                        />
                        <ResetPasswordDialog targetUser={u} />
                        <Select
                          value={u.role}
                          onValueChange={(val) => handleRoleChange(u.id, val)}
                          disabled={updateUser.isPending}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Invite Dialog ─────────────────────────────────────────────────────────────

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "result">("form");
  const [result, setResult] = useState<{ user: any; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("teacher");
  const [subjects, setSubjects] = useState("");
  const [classId, setClassId] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [dob, setDob] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: classes } = useListClasses();
  const { data: students } = useListStudents();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reset = () => {
    setStep("form");
    setResult(null);
    setName(""); setEmail(""); setRole("teacher");
    setSubjects(""); setClassId(""); setRollNo("");
    setDob(""); setGuardianName(""); setGuardianContact("");
    setStudentId(""); setCopied(false);
  };

  const handleSubmit = async () => {
    if (!name || !email || !role) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = { name, email, role };
      if (role === "teacher") payload.subjects = subjects.split(",").map((s) => s.trim()).filter(Boolean);
      if (role === "student") { payload.classId = parseInt(classId); payload.rollNo = rollNo; payload.dob = dob || undefined; payload.guardianName = guardianName || undefined; payload.guardianContact = guardianContact || undefined; }
      if (role === "parent" && studentId) payload.studentIds = [parseInt(studentId)];

      const data = await inviteUser(payload);
      setResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (err: any) {
      toast({ title: err.message || "Invite failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Email: ${result.user.email}\nPassword: ${result.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Invite User</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === "form" ? "Invite New User" : "Account Created"}</DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Full Name</Label>
                <Input placeholder="e.g. Priya Mehta" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Email Address</Label>
                <Input type="email" placeholder="user@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Teacher fields */}
            {role === "teacher" && (
              <div className="space-y-2">
                <Label>Subjects <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
                <Input placeholder="Mathematics, Physics" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
              </div>
            )}

            {/* Student fields */}
            {role === "student" && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Student Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Class <span className="text-destructive">*</span></Label>
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.section}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Roll No. <span className="text-destructive">*</span></Label>
                    <Input className="h-8 text-sm" placeholder="10A-007" value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date of Birth</Label>
                    <Input className="h-8 text-sm" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Guardian Name</Label>
                    <Input className="h-8 text-sm" placeholder="Parent/Guardian" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Guardian Contact</Label>
                    <Input className="h-8 text-sm" placeholder="Phone number" value={guardianContact} onChange={(e) => setGuardianContact(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Parent fields */}
            {role === "parent" && (
              <div className="space-y-2">
                <Label>Link to Student <span className="text-muted-foreground text-xs">(optional, can add later)</span></Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student…" /></SelectTrigger>
                  <SelectContent>
                    {students?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {(s as any).user?.name || `Student #${s.id}`} — Roll {s.rollNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          /* Result step */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="font-semibold text-green-900">Account created successfully</p>
                <p className="text-sm text-green-700">{result?.user.name} can now sign in.</p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Login Credentials — Share with the user</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-mono font-medium">{result?.user.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Temporary Password</span>
                  <span className="text-sm font-mono font-bold bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded">{result?.tempPassword}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">The user should change their password after first sign-in via the Profile page.</p>
            </div>

            <Button variant="outline" className="w-full" onClick={handleCopy}>
              {copied ? <><Check className="w-4 h-4 mr-2 text-green-600" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy Credentials</>}
            </Button>
          </div>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !name || !email || !role || (role === "student" && (!classId || !rollNo))}
              >
                {loading ? "Creating…" : "Create Account"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>Invite Another</Button>
              <Button onClick={() => { setOpen(false); reset(); }}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Profile Dialog (admin: full profile edit for any user) ──────────

function EditProfileDialog({ targetUser, onDone }: { targetUser: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(targetUser.name);
  const [email, setEmail] = useState(targetUser.email);
  const [phone, setPhone] = useState(targetUser.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(targetUser.avatarUrl || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const updateUser = useUpdateUser();

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      setName(targetUser.name);
      setEmail(targetUser.email);
      setPhone(targetUser.phone || "");
      setAvatarUrl(targetUser.avatarUrl || "");
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image is too large (max 5MB)", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePicture(file);
      setAvatarUrl(url);
    } catch (err: any) {
      toast({ title: err?.message || "Could not upload photo", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = () => {
    setSaving(true);
    updateUser.mutate(
      { id: targetUser.id, data: { name, email, phone: phone || null, avatarUrl: avatarUrl || null } },
      {
        onSuccess: () => {
          onDone();
          setOpen(false);
          toast({ title: "Profile updated" });
        },
        onError: (err: any) => toast({ title: err?.message || "Failed to update profile", variant: "destructive" }),
        onSettled: () => setSaving(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
          <Pencil className="w-3 h-3" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile — {targetUser.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl overflow-hidden relative group shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                title="Change photo"
              >
                {uploadingPhoto ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {uploadingPhoto ? "Uploading photo…" : "Click the photo to change it."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploadingPhoto || !name.trim() || !email.trim()}>
            {saving ? "Saving..." : uploadingPhoto ? "Uploading photo…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────────────────

function ResetPasswordDialog({ targetUser }: { targetUser: any }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setTempPassword(null);
      setCopied(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/users/${targetUser.id}/reset-password`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setTempPassword(data.tempPassword);
    } catch (err: any) {
      toast({ title: err.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
          <KeyRound className="w-3 h-3" /> Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password — {targetUser.name}</DialogTitle>
        </DialogHeader>

        {!tempPassword ? (
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              This immediately replaces {targetUser.name}'s current password with a new temporary one.
              They'll be signed out of any existing session and need to use the new password to log back in.
            </p>
          </div>
        ) : (
          <div className="py-2 space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New Temporary Password — Share with {targetUser.name}
              </p>
              <p className="text-sm font-mono font-bold bg-yellow-50 border border-yellow-200 px-2 py-1 rounded text-center">
                {tempPassword}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              This won't be shown again. The user should change it after logging in via their Profile page.
            </p>
            <Button variant="outline" className="w-full" onClick={handleCopy}>
              {copied ? <><Check className="w-4 h-4 mr-2 text-green-600" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy Password</>}
            </Button>
          </div>
        )}

        <DialogFooter>
          {!tempPassword ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleReset} disabled={loading}>
                {loading ? "Resetting…" : "Reset Password"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpen(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ManageChildrenDialog({
  parent,
  onDone,
}: {
  parent: any;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { data: students } = useListStudents();

  const fetchLinked = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/parents/${parent.id}/students`, { credentials: "include" });
      const data = await res.json();
      setLinked(data);
    } catch {
      setLinked([]);
    }
  };

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) fetchLinked();
  };

  const handleLink = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/parents/${parent.id}/link-student`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: parseInt(selectedStudentId) }),
      });
      if (!res.ok) throw new Error("Failed to link");
      setSelectedStudentId("");
      await fetchLinked();
      onDone();
      toast({ title: "Student linked" });
    } catch {
      toast({ title: "Failed to link student", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (studentId: number) => {
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/api/parents/${parent.id}/link-student/${studentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchLinked();
      onDone();
      toast({ title: "Student unlinked" });
    } catch {
      toast({ title: "Failed to unlink", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const linkedIds = new Set(linked.map((l) => l.id));
  const unlinkableStudents = (students || []).filter((s) => !linkedIds.has(s.id));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
          <Link2 className="w-3 h-3" /> Children
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Linked Children — {parent.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Currently linked */}
          {linked.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
              No students linked yet.
            </p>
          ) : (
            <div className="space-y-2">
              {linked.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                  <div>
                    <p className="text-sm font-medium">{s.user?.name || `Student #${s.id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.class?.name} {s.class?.section} · Roll {s.rollNo}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive h-7 text-xs"
                    onClick={() => handleUnlink(s.id)}
                    disabled={loading}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Link new student */}
          <div className="flex gap-2">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="h-9 text-sm flex-1">
                <SelectValue placeholder="Add a student…" />
              </SelectTrigger>
              <SelectContent>
                {unlinkableStudents.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {(s as any).user?.name || `Student #${s.id}`} — Roll {s.rollNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleLink} disabled={!selectedStudentId || loading} className="h-9">
              Link
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
