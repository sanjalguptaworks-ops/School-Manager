import { useListSubjects, getListSubjectsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";
import { useSelectedChild } from "@/lib/selected-child-context";

export default function SubjectsPage() {
  const { selectedChildId } = useSelectedChild();
  const params = selectedChildId ? { studentId: selectedChildId } : undefined;
  const { data: subjects, isLoading } = useListSubjects(params, {
    query: { queryKey: getListSubjectsQueryKey(params) },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
        <p className="text-muted-foreground mt-1">Subjects and their teachers</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : subjects?.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">No subjects yet</p>
          <p className="text-muted-foreground text-sm">Subjects will appear once the class timetable is set up.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {subjects?.map((s) => (
            <Card key={s.subject}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {s.teacherAvatarUrl ? (
                    <img src={s.teacherAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{(s.teacherName || "?").charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{s.subject}</p>
                  <p className="text-sm text-muted-foreground truncate">{s.teacherName || "No teacher assigned"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
