import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Eye } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface CertificateRow {
  id: number;
  title: string;
  issueDate: string;
  issuedByName: string | null;
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/certificates`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (res.ok) setCertificates(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Certificates</h1>
        <p className="text-muted-foreground mt-1">Certificates issued to you by your school.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : certificates.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="text-4xl mb-3">🏆</div>
          <p className="font-semibold text-lg mb-1">No certificates yet</p>
          <p className="text-muted-foreground text-sm">Certificates your school issues to you will show up here.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {certificates.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.issueDate), "MMM d, yyyy")}
                      {c.issuedByName ? ` · issued by ${c.issuedByName}` : ""}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <Link href={`/certificates/${c.id}/view`}>
                    <Eye className="w-3.5 h-3.5" /> View
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
