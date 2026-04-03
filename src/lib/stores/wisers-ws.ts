import { writable, get } from 'svelte/store';
import { PUBLIC_API_BASE } from '$env/static/public';

const API = `${PUBLIC_API_BASE}/api/community`;

// ═══════════════════════════════════════
// STORES
// ═══════════════════════════════════════
export const wsNotifCount = writable(0);
export const wsUnreadDMs = writable(0);
export const wsConnected = writable(false);
export const wsLastMessage = writable<any>(null);

// ═══════════════════════════════════════
// SERVER SYNC (source of truth)
// ═══════════════════════════════════════
let lastFetchTime = 0;
const FETCH_COOLDOWN = 3000; // Don't re-fetch within 3s (prevents spam on reconnect flicker)

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try { return (await res.json()) as T; } catch { return fallback; }
}

export async function fetchUnreadCounts(authToken: string) {
  const now = Date.now();
  if (now - lastFetchTime < FETCH_COOLDOWN) return; // Debounce
  lastFetchTime = now;

  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${authToken}`,
  });

  try {
    const [dmRes, notifRes] = await Promise.all([
      fetch(`${API}/unread-count`, { headers, mode: 'cors' }),
      fetch(`${API}/notifications/unread-count`, { headers, mode: 'cors' }),
    ]);

    const dm = await safeJson(dmRes, { unread: 0 });
    const notif = await safeJson(notifRes, { count: 0 });

    wsUnreadDMs.set(Number((dm as any).unread || 0));
    wsNotifCount.set(Number((notif as any).count || 0));
  } catch (err) {
    console.error('fetchUnreadCounts failed:', err);
  }
}

// ═══════════════════════════════════════
// EXPLICIT READ ACTIONS
// ═══════════════════════════════════════
export async function markConvRead(authToken: string, convId: number, convUnread: number) {
  if (convUnread <= 0) return;
  wsUnreadDMs.update(n => Math.max(0, n - convUnread));
  try {
    await fetch(`${API}/conversations/${convId}/messages?mark_read=true`, { headers: { Authorization: `Bearer ${authToken}` } });
  } catch {}
}

export async function markNotifsRead(authToken: string) {
  wsNotifCount.set(0);
  try {
    await fetch(`${API}/notifications/read-all`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
  } catch {}
}

// ═══════════════════════════════════════
// SOUND
// ═══════════════════════════════════════
function playPing() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

// ═══════════════════════════════════════
// TAB TITLE (X-standard)
// ═══════════════════════════════════════
function updateTabTitle() {
  if (typeof document === 'undefined') return;
  const dm = get(wsUnreadDMs);
  const notif = get(wsNotifCount);
  const total = dm + notif;
  const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
  document.title = total > 0 ? `(${total > 99 ? '99+' : total}) ${base}` : base;
}

// ═══════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════
let ws: WebSocket | null = null;
let pingInterval: any = null;
let reconnectTimeout: any = null;
let token: string | null = null;

export function connectWS(authToken: string) {
  if (typeof window === 'undefined') return;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  token = authToken;
  const wsBase = PUBLIC_API_BASE.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

  try {
    ws = new WebSocket(`${wsBase}/api/community/ws?token=${authToken}`);

    ws.onopen = () => {
      wsConnected.set(true);
      console.log('[WS] Connected');
      // Sync with server on every connect/reconnect (catches missed events)
      fetchUnreadCounts(authToken);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'pong') return;

        // NOTIFICATION — separate from DMs
        if (data.action === 'new_notification') {
          wsNotifCount.update(n => n + 1);
          playPing();
          window.dispatchEvent(new CustomEvent('wisers:toast', {
            detail: { title: data.title || 'New notification', body: data.body || '', type: 'notification' }
          }));
        }

        // TYPING indicator
        if (data.action === 'typing') {
          window.dispatchEvent(new CustomEvent('wisers:typing', { detail: data }));
        }

        // DM — separate from notifications
        if (data.action === 'new_message') {
          wsUnreadDMs.update(n => n + 1);
          wsLastMessage.set(data);
          playPing();
          window.dispatchEvent(new CustomEvent('wisers:new_message', { detail: data }));
          window.dispatchEvent(new CustomEvent('wisers:toast', {
            detail: { title: 'New message', body: (data.content || '').slice(0, 60), type: 'message' }
          }));
        }
      } catch {}
    };

    ws.onclose = () => {
      wsConnected.set(false);
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
      // Reconnect after 3s
      reconnectTimeout = setTimeout(() => {
        if (token) connectWS(token);
      }, 3000);
    };

    ws.onerror = () => {
      wsConnected.set(false);
      ws?.close();
    };

  } catch {
    wsConnected.set(false);
  }
}

export function sendTyping(toUserId: string, conversationId?: number) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'typing', to_user_id: toUserId, conversation_id: conversationId }));
  }
}

export function disconnectWS() {
  if (typeof window === 'undefined') return;
  if (pingInterval) clearInterval(pingInterval);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (ws) { ws.close(); ws = null; }
  wsConnected.set(false);
  token = null;
}

export function resetNotifCount() { wsNotifCount.set(0); }
export function resetDMCount() { wsUnreadDMs.set(0); }

// Subscribe to stores for tab title updates
if (typeof window !== 'undefined') {
  wsUnreadDMs.subscribe(() => updateTabTitle());
  wsNotifCount.subscribe(() => updateTabTitle());
}
