// Firebase Messaging Service Worker for BSCAN
// This file must be at the root of the site: /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCD-zcjA5UXn2rcCENMrvPuzaqedhpYut4",
  authDomain: "bscan-cefcb.firebaseapp.com",
  projectId: "bscan-cefcb",
  storageBucket: "bscan-cefcb.firebasestorage.app",
  messagingSenderId: "204862555986",
  appId: "1:204862555986:web:c0f3d1bc85b6dc57661c8b",
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const url = payload.data?.url || 'https://bscan.balancewises.io';

  self.registration.showNotification(title || 'BSCAN Alert', {
    body: body || 'You have a new notification.',
    icon: icon || '/icons/bscan-icon-192.png',
    badge: '/icons/bscan-badge-72.png',
    data: { url },
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://bscan.balancewises.io';
  event.waitUntil(clients.openWindow(url));
});
