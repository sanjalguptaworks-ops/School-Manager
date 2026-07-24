import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import { registerServiceWorker } from './lib/push-notifications';

import App from './App';

import './index.css';

setBaseUrl(import.meta.env.VITE_API_URL || null);
registerServiceWorker();

// The service worker posts this when a push notification is clicked while
// the app is already open in this tab (see public/sw.js's notificationclick
// handler) -- a full navigation is simplest here since this runs before the
// wouter Router exists to hook into.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'navigate' && event.data.link) {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
      window.location.assign(`${basePath}${event.data.link}`);
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
