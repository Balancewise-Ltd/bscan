/**
 * BSCAN Push Notifications
 * Handles Firebase Cloud Messaging setup, permission request, and token registration.
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
	apiKey: "AIzaSyCD-zcjA5UXn2rcCENMrvPuzaqedhpYut4",
	authDomain: "bscan-cefcb.firebaseapp.com",
	projectId: "bscan-cefcb",
	storageBucket: "bscan-cefcb.firebasestorage.app",
	messagingSenderId: "204862555986",
	appId: "1:204862555986:web:c0f3d1bc85b6dc57661c8b",
};

let app: ReturnType<typeof initializeApp> | null = null;
let messaging: ReturnType<typeof getMessaging> | null = null;

function getFirebaseApp() {
	if (!app) app = initializeApp(firebaseConfig);
	return app;
}

function getFirebaseMessaging() {
	if (!messaging) messaging = getMessaging(getFirebaseApp());
	return messaging;
}

export const VAPID_KEY = 'BLeBuIBXDuyzNRn7YCVBf0fjJ_S7uWTj8vb_tvkdqQ-akzj4rI1U4xYKJHtaf0tmCfwJGrHvFuDEEaTIdx_0bN0';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
	return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get current permission status
 */
export function getPushPermission(): NotificationPermission | 'unsupported' {
	if (!isPushSupported()) return 'unsupported';
	return Notification.permission;
}

/**
 * Request push notification permission and get FCM token.
 * Returns the token string or null if denied.
 */
export async function requestPushPermission(vapidKey: string): Promise<string | null> {
	if (!isPushSupported()) return null;

	try {
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return null;

		// Register service worker
		const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

		const msg = getFirebaseMessaging();
		const token = await getToken(msg, {
			vapidKey,
			serviceWorkerRegistration: registration,
		});

		return token || null;
	} catch (err) {
		console.error('Push permission error:', err);
		return null;
	}
}

/**
 * Listen for foreground messages (when app is open).
 * Shows a toast/notification in the UI.
 */
export function onForegroundMessage(callback: (payload: any) => void): void {
	if (!isPushSupported()) return;
	try {
		const msg = getFirebaseMessaging();
		onMessage(msg, (payload) => {
			callback(payload);
		});
	} catch { }
}
