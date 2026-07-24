import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { isPushSupported, subscribeToPush } from "@/lib/push-notifications";

const DISMISS_KEY = "educore:push-banner-dismissed";

export function NotificationPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (Notification.permission !== "default") return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const enable = async () => {
    setSubscribing(true);
    const ok = await subscribeToPush();
    setSubscribing(false);
    dismiss();
    if (!ok) console.warn("Push subscription failed or was denied");
  };

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b text-sm">
      <Bell className="w-4 h-4 text-primary shrink-0" />
      <p className="flex-1 min-w-0">Get instant alerts for notices, fees, and updates on this device.</p>
      <Button size="sm" onClick={enable} disabled={subscribing}>
        {subscribing ? "Enabling…" : "Enable"}
      </Button>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
