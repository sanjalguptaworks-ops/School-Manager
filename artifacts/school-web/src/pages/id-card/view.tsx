import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useAppAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface StudentCardData {
  user: { name: string; avatarUrl: string | null };
  rollNo: string;
  dob: string | null;
  class: { name: string; section: string };
}

interface TeacherCardData {
  user: { name: string; avatarUrl: string | null };
  subjects: string[] | null;
}

export default function IdCardViewPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const { user: authUser } = useAppAuth();
  const [data, setData] = useState<StudentCardData | TeacherCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isStudent = type === "student";
  const isTeacher = type === "teacher";

  useEffect(() => {
    if (!isStudent && !isTeacher) {
      setError("Unknown card type.");
      setLoading(false);
      return;
    }
    fetch(`${BASE_URL}/api/${isStudent ? "students" : "teachers"}/${id}`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error || "Could not load this ID card.");
          return;
        }
        setData(body);
      })
      .catch(() => setError("Could not reach the server."))
      .finally(() => setLoading(false));
  }, [type, id, isStudent, isTeacher]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-muted-foreground">{error || "Not found."}</p>
        <Link href="/" className="text-primary text-sm font-medium hover:underline">Go back</Link>
      </div>
    );
  }

  const schoolName = authUser?.schoolName || "EduCore";
  const schoolLogoUrl = authUser?.schoolLogoUrl;

  return (
    <div className="min-h-screen bg-muted/40 py-10 px-4">
      <style>{`
        @media print {
          @page { size: 3.375in 2.125in; margin: 0; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .id-card-frame { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="max-w-sm mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href="/"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </Button>
      </div>

      <div className="id-card-frame w-[3.375in] h-[2.125in] mx-auto rounded-xl shadow-xl overflow-hidden bg-white text-gray-900 flex flex-col">
        <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-2 shrink-0">
          {schoolLogoUrl && <img src={schoolLogoUrl} alt="" className="w-6 h-6 rounded object-contain bg-white/90 p-0.5" />}
          <div className="min-w-0">
            <p className="font-bold text-xs leading-tight truncate">{schoolName}</p>
            <p className="text-[9px] opacity-80 leading-tight">{isStudent ? "Student ID Card" : "Staff ID Card"}</p>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3 px-4 py-3">
          <div className="w-16 h-16 rounded-md bg-muted overflow-hidden shrink-0 border">
            {data.user.avatarUrl ? (
              <img src={data.user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                {data.user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight truncate">{data.user.name}</p>
            {isStudent ? (
              <>
                <p className="text-xs text-gray-600 mt-1">
                  {(data as StudentCardData).class.name} {(data as StudentCardData).class.section} &middot; Roll No. {(data as StudentCardData).rollNo}
                </p>
                {(data as StudentCardData).dob && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    DOB: {format(new Date((data as StudentCardData).dob as string), "d MMM yyyy")}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-gray-600 mt-1">Teacher</p>
                {(data as TeacherCardData).subjects && (data as TeacherCardData).subjects!.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                    {(data as TeacherCardData).subjects!.join(", ")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="border-t px-4 py-1.5 text-center shrink-0">
          <p className="text-[8px] text-gray-400">If found, please return to {schoolName}.</p>
        </div>
      </div>
    </div>
  );
}
