export function timeAgo(d: string): string {
  if (!d) return '';
  const date = new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z');
  const now = new Date();
  const s = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
