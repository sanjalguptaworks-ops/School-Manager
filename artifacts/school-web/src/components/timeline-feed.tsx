import { Link } from "wouter";
import { useGetTimeline } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CalendarDays, NotebookPen, Image as ImageIcon, Vote, Rss } from "lucide-react";
import { format } from "date-fns";
import { useSelectedChild } from "@/lib/selected-child-context";

const TYPE_META: Record<string, { icon: any; label: string; badge: string }> = {
  notice: { icon: Bell, label: "Notice", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  event: { icon: CalendarDays, label: "Event", badge: "bg-purple-100 text-purple-800 border-purple-200" },
  homework: { icon: NotebookPen, label: "Homework", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  gallery: { icon: ImageIcon, label: "Gallery", badge: "bg-green-100 text-green-800 border-green-200" },
  poll: { icon: Vote, label: "Poll", badge: "bg-pink-100 text-pink-800 border-pink-200" },
};

export function TimelineFeed() {
  const { selectedChildId } = useSelectedChild();
  const { data: items, isLoading } = useGetTimeline(selectedChildId ? { studentId: selectedChildId } : undefined);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Rss className="w-4 h-4 text-primary" /> Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : items?.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg text-sm">
            Nothing new yet — updates will show up here.
          </div>
        ) : (
          <div className="divide-y">
            {items?.map((item) => {
              const meta = TYPE_META[item.type] ?? TYPE_META.notice!;
              const Icon = meta.icon;
              return (
                <Link key={item.id} href={item.link}>
                  <div className="py-3 flex items-start gap-3 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${meta.badge} text-xs`}>{meta.label}</Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(item.date), "MMM d, yyyy")}</span>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{item.title}</p>
                      {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.subtitle}</p>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
