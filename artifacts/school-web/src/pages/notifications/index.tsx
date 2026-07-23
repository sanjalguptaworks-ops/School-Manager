import { Link } from "wouter";
import { useGetUnreadNotificationsByCategory } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, ChevronRight, Inbox } from "lucide-react";

const CATEGORY_LINKS: Record<string, string> = {
  Circulars: "/notices",
  Resources: "/resources",
  Galleries: "/gallery",
  Polls: "/polls",
  Appointments: "/appointments",
  "Leave Requests": "/leave-requests",
  Fees: "/fees",
  Exams: "/exams",
  Messages: "/messages",
  Events: "/events",
  Other: "/notices",
};

export default function NotificationsPage() {
  const { data: categories, isLoading } = useGetUnreadNotificationsByCategory();
  const total = categories?.reduce((sum, c) => sum + c.count, 0) ?? 0;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-1">Unread updates across the app</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : !categories || categories.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Inbox className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-lg mb-1">You're all caught up</p>
          <p className="text-muted-foreground text-sm">No unread updates right now.</p>
        </Card>
      ) : (
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Updates ({categories.length})</p>
            </div>
            <div className="divide-y">
              {categories.map((c) => (
                <Link key={c.category} href={CATEGORY_LINKS[c.category] ?? "/notices"}>
                  <div className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer">
                    <span className="font-medium text-sm">{c.category}</span>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary">{c.count}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {total > 0 && <p className="text-xs text-muted-foreground text-center">{total} unread total</p>}
    </div>
  );
}
