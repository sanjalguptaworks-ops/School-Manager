import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface AuditEntry {
  id: number;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  details: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "user.role_changed": "Changed role",
  "user.deleted": "Deleted user",
  "school.suspended": "Suspended school",
  "school.unsuspended": "Unsuspended school",
};

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/audit-log`, { credentials: "include" })
      .then((res) => res.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground mt-1">A trail of the most sensitive actions -- role changes, account deletion, suspensions.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="text-4xl mb-3">📜</div>
          <p className="font-semibold text-lg mb-1">Nothing logged yet</p>
          <p className="text-muted-foreground text-sm">Sensitive actions will show up here as they happen.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <History className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{e.actorName}</p>
                    <Badge variant="outline">{ACTION_LABELS[e.action] || e.action}</Badge>
                  </div>
                  {e.details && <p className="text-sm text-muted-foreground mt-0.5">{e.details}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(e.createdAt), "d MMM yyyy, h:mm a")}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
