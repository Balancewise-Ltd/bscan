import { writable, get } from 'svelte/store';

export const wsNotifCount = writable(0);
export const wsUnreadDMs = writable(0);

const API = 'https://api-bscan.balancewises.io/api/community';

export async function fetchUnreadCounts(authToken: string) {
  const h = { Authorization: `Bearer ${authToken}` };
  try {
    const dm = await fetch(`${API}/unread-count`, { headers: h }).then(r => r.json());
    wsUnreadDMs.set(dm.unread || 0);
  } catch {}
  try {
    const notif = await fetch(`${API}/notifications/unread-count`, { headers: h }).then(r => r.json());
    wsNotifCount.set(notif.count || 0);
  } catch {}
}

export async function markConvRead(authToken: string, convId: number, convUnread: number) {
  if (convUnread <= 0) return;
  wsUnreadDMs.update(n => Math.max(0, n - convUnread));
  try {
    await fetch(`${API}/conversations/${convId}/messages`, { headers: { Authorization: `Bearer ${authToken}` } });
  } catch {}
}

export async function markNotifsRead(authToken: string) {
  wsNotifCount.set(0);
  try {
    await fetch(`${API}/notifications/read-all`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
  } catch {}
}

export const wsConnected = writable(false);

let ws: WebSocket | null = null;
let pingInterval: any = null;
let reconnectTimeout: any = null;
let token: string | null = null;

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

export function connectWS(authToken: string) {
  if (typeof window === 'undefined') return;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  token = authToken;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    ws = new WebSocket(`${protocol}//api-bscan.balancewises.io/api/community/ws?token=${authToken}`);

    ws.onopen = () => {
      wsConnected.set(true);
      console.log('[WS] Connected for user:', authToken.slice(0, 10));
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
        if (data.action === 'new_notification') {
          // Dispatch toast event for UI
          window.dispatchEvent(new CustomEvent('wisers:toast', { detail: { title: data.title || 'New notification', body: data.body || '', type: 'notification' } }));
          wsNotifCount.update(n => {
            const next = n + 1;
            playPing();
            return next;
          });
        }
        if (data.action === 'new_message') {
          // Dispatch toast for message
          window.dispatchEvent(new CustomEvent('wisers:toast', { detail: { title: 'New message', body: (data.content || '').slice(0, 60), type: 'message', from: data.sender_id } }));
          wsUnreadDMs.update(n => {
            const next = n + 1;
            playPing();
            return next;
          });
          // Dispatch a custom event so WisersDM and messages page can react
          window.dispatchEvent(new CustomEvent('wisers:new_message', { detail: data }));
        }
      } catch {}
    };

    ws.onclose = () => {
      wsConnected.set(false);
      console.log('[WS] Disconnected');
      if (pingInterval) clearInterval(pingInterval);
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

export function disconnectWS() {
  if (typeof window === 'undefined') return;
  if (pingInterval) clearInterval(pingInterval);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (ws) { ws.close(); ws = null; }
  wsConnected.set(false);
  token = null;
}

export function resetNotifCount() {
  wsNotifCount.set(0);
}

export function resetDMCount() {
  wsUnreadDMs.set(0);
}

// X-standard: update browser tab title with unread count
function updateTabTitle() {
  if (typeof document === 'undefined') return;
  const dm = get(wsUnreadDMs);
  const notif = get(wsNotifCount);
  const total = dm + notif;
  const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
  document.title = total > 0 ? `(${total > 99 ? '99+' : total}) ${base}` : base;
}

// Subscribe to both stores to keep tab title in sync
if (typeof window !== 'undefined') {
  wsUnreadDMs.subscribe(() => updateTabTitle());
  wsNotifCount.subscribe(() => updateTabTitle());
}
