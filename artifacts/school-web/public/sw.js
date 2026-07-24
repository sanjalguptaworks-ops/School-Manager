self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "EduCore", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // Non-JSON payload -- fall back to the default above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "EduCore", {
      body: data.body || "",
      icon: "/favicon.svg",
      data: { link: data.link || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "navigate", link });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    }),
  );
});
