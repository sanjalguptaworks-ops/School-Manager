import { useState } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Clock, LogOut, ShieldCheck, Pencil, X } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function ProfilePage() {
  const { user, logout, refresh } = useAppAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  if (!user) return null;

  const startEditing = () => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error || "Could not update profile", variant: "destructive" });
        return;
      }
      await refresh();
      setEditing(false);
      if (data.emailChangePending) {
        setPendingEmail(email.trim().toLowerCase());
        toast({ title: "Check your new email inbox to confirm the change" });
      } else {
        setPendingEmail(null);
        toast({ title: "Profile updated" });
      }
    } catch {
      toast({ title: "Could not reach the server. Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account details</p>
        </div>
        {!editing && (
          <Button variant="outline" onClick={startEditing}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        )}
      </div>

      <Card className="shadow-sm border-border/50 overflow-hidden">
        <div className="h-32 bg-primary/5 w-full relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center p-1 shadow-sm">
              <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="pt-14 pb-8 px-6">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {email.trim().toLowerCase() !== user.email && (
                  <p className="text-xs text-muted-foreground">
                    We'll send a confirmation link to this address — your email won't change until you click it.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelEditing} disabled={saving}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4" /> {user.email}
                  </p>
                  {user.phone && (
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4" /> {user.phone}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="capitalize bg-muted/50 py-1">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  {user.role}
                </Badge>
              </div>

              {pendingEmail && (
                <div className="mt-4 text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded-md p-3">
                  Confirmation link sent to <span className="font-medium">{pendingEmail}</span>. Your login email
                  stays <span className="font-medium">{user.email}</span> until you confirm it.
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-border/50 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Account ID</p>
                    <p className="font-medium font-mono text-sm">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(user.createdAt), "MMMM yyyy")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-border/50">
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={async () => { await logout(); setLocation("/login"); }}
                >
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
