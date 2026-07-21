import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface CertificateDetail {
  id: number;
  title: string;
  body: string;
  issueDate: string;
  issuedByName: string | null;
  student: { name: string | null };
  school: { name: string; certificateTemplateUrl: string | null };
}

export default function CertificateViewPage() {
  const { id } = useParams<{ id: string }>();
  const [certificate, setCertificate] = useState<CertificateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/certificates/${id}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not load this certificate.");
          return;
        }
        setCertificate(data);
      })
      .catch(() => setError("Could not reach the server."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-muted-foreground">{error || "Certificate not found."}</p>
        <Link href="/" className="text-primary text-sm font-medium hover:underline">Go back</Link>
      </div>
    );
  }

  const templateUrl = certificate.school.certificateTemplateUrl;

  return (
    <div className="min-h-screen bg-muted/40 py-10 px-4">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .certificate-frame { box-shadow: none !important; margin: 0 !important; max-width: none !important; width: 100% !important; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href="/"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </Button>
      </div>

      <div className="certificate-frame relative max-w-3xl mx-auto shadow-xl rounded-lg overflow-hidden bg-white">
        {templateUrl ? (
          <img src={templateUrl} alt="" className="w-full h-auto block" />
        ) : (
          <div className="w-full aspect-[1.414/1] border-[10px] border-double border-muted-foreground/30" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-[12%] py-[10%]">
          <p className="text-lg sm:text-2xl font-bold tracking-wide text-gray-900 mb-3">{certificate.title}</p>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">This is proudly presented to</p>
          <p className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3" style={{ fontFamily: "Georgia, serif" }}>
            {certificate.student.name}
          </p>
          <p className="text-xs sm:text-base text-gray-700 max-w-md leading-relaxed">{certificate.body}</p>

          <div className="absolute bottom-[8%] left-[12%] right-[12%] flex items-end justify-between text-gray-700">
            <div className="text-left">
              <p className="text-[10px] sm:text-xs border-t border-gray-400 pt-1">
                {format(new Date(certificate.issueDate), "MMM d, yyyy")}
              </p>
              <p className="text-[9px] sm:text-[11px] text-gray-500">Date</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] sm:text-xs border-t border-gray-400 pt-1">{certificate.issuedByName || certificate.school.name}</p>
              <p className="text-[9px] sm:text-[11px] text-gray-500">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
