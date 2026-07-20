import { useEffect, useState, useCallback } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, School as SchoolIcon } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface School {
  id: number;
  name: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function CreatorSchoolsPage() {
  const { user } = useAppAuth();
  const { toast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/schools`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setSchools(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== "creator") {
    return <div className="p-6 text-muted-foreground">This page is only available to the platform creator.</div>;
  }

  const act = async (id: number, action: "approve" | "reject") => {
    setActingOn(id);
    try {
      const res = await fetch(`${BASE_URL}/api/schools/${id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        toast({ title: `Failed to ${action} school`, variant: "destructive" });
        return;
      }
      toast({ title: action === "approve" ? "School approved" : "School rejected" });
      await load();
    } finally {
      setActingOn(null);
    }
  };

  const pending = schools.filter((s) => s.status === "pending");
  const other = schools.filter((s) => s.status !== "pending");

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schools</h1>
        <p className="text-muted-foreground mt-1">Review and approve new school signups.</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" /> Pending approval ({pending.length})
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                      <SchoolIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">Requested {format(new Date(s.createdAt), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" disabled={actingOn === s.id} onClick={() => act(s.id, "reject")}>
                      <X className="w-3.5 h-3.5" /> Reject
                    </Button>
                    <Button size="sm" className="gap-1" disabled={actingOn === s.id} onClick={() => act(s.id, "approve")}>
                      <Check className="w-3.5 h-3.5" /> Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {other.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">All other schools</h2>
          <div className="space-y-2">
            {other.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-muted/20">
                <p className="text-sm font-medium">{s.name}</p>
                <Badge variant={s.status === "approved" ? "default" : "destructive"} className="capitalize">
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
