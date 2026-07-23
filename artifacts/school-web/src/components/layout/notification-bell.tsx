import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface Notification {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadCount = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/api/notifications/unread-count`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setUnreadCount(data.count);
    }
  }, []);

  const loadList = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/api/notifications`, { credentials: "include" });
    if (res.ok) setItems(await res.json());
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60000);
    return () => clearInterval(interval);
  }, [loadCount]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadList();
  };

  const handleItemClick = async (n: Notification) => {
    if (!n.read) {
      await fetch(`${BASE_URL}/api/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" });
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) setLocation(n.link);
  };

  const handleMarkAllRead = async () => {
    await fetch(`${BASE_URL}/api/notifications/mark-all-read`, { method: "POST", credentials: "include" });
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={handleMarkAllRead}>
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">No notifications yet.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <button
          className="w-full text-center text-xs text-primary hover:underline py-2.5 border-t"
          onClick={() => { setOpen(false); setLocation("/notifications"); }}
        >
          See all updates
        </button>
      </PopoverContent>
    </Popover>
  );
}
