/**
 * BSCAN API Client
 * Matches FastAPI backend at api-bscan.balancewises.io
 */

import type {
	ScanResult,
	ScanCheckResult,
	User,
	LeaderboardEntry,
	LeaderboardPeriod,
	TeamData,
	ChallengeData,
	BillingInterval
} from '$lib/types';
import { safeGetStorage } from '$lib/utils/security';
import { PUBLIC_API_BASE } from '$env/static/public';

const API_BASE = PUBLIC_API_BASE;

class ApiError extends Error {
	status: number;
	detail: string;
	constructor(status: number, detail: string) {
		super(detail);
		this.status = status;
		this.detail = detail;
	}
}

function getToken(): string | null {
	return safeGetStorage('bscan_token');
}

function authHeaders(): Record<string, string> {
	const token = getToken();
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: { ...authHeaders(), ...(options.headers || {}) }
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new ApiError(res.status, body.detail || `Request failed (${res.status})`);
	}
	return res.json();
}

// ══════════════════════════════════════════════════════════
// AUTH — matches /api/auth/*
// ══════════════════════════════════════════════════════════

/** Backend returns { access_token, token_type, user: UserResponse } */
interface AuthResponse {
	access_token: string;
	token_type: string;
	user: User;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
	return request('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	});
}

export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
	return request('/api/auth/register', {
		method: 'POST',
		body: JSON.stringify({ email, password, name })
	});
}

export async function getMe(): Promise<User> {
	return request('/api/auth/me');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
	return request('/api/auth/change-password', {
		method: 'POST',
		body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
	});
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
	return request('/api/auth/forgot-password', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
	return request('/api/auth/reset-password', {
		method: 'POST',
		body: JSON.stringify({ token, new_password: newPassword })
	});
}

/** Redeem promo code — POST /api/auth/redeem */
export async function redeemPromo(code: string): Promise<{ message: string; plan: string; expires: string }> {
	return request('/api/auth/redeem', {
		method: 'POST',
		body: JSON.stringify({ code })
	});
}

// ══════════════════════════════════════════════════════════
// SCANNING — matches /api/scan/*
// ══════════════════════════════════════════════════════════

export async function checkScanAllowance(email: string): Promise<ScanCheckResult> {
	return request('/api/scan/check', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
}

export async function runScan(url: string, email: string, businessName?: string): Promise<ScanResult> {
	return request('/api/scan', {
		method: 'POST',
		body: JSON.stringify({ url, email, business_name: businessName || '' })
	});
}

export async function getScan(scanId: string): Promise<ScanResult> {
	return request(`/api/scan/${scanId}`);
}

/** Detailed scan view from history — GET /api/scan/{id}/detail */
export async function getScanDetail(scanId: string): Promise<any> {
	return request(`/api/scan/${scanId}/detail`);
}

export async function getScanChallenge(scanId: string): Promise<ChallengeData> {
	return request(`/api/scan/${scanId}/challenge`);
}

export async function getScanAchievements(scanId: string): Promise<{ achievements: any[] }> {
	return request(`/api/scan/${scanId}/achievements`);
}

export function getScanBadgeUrl(scanId: string): string {
	return `${API_BASE}/api/scan/${scanId}/badge`;
}

export function getAchievementBadgeUrl(scanId: string, achievementId: string): string {
	return `${API_BASE}/api/scan/${scanId}/achievement/${achievementId}`;
}

/** Compare — POST /api/scan/compare */
export async function compareSites(urlA: string, urlB: string): Promise<any> {
	return request('/api/scan/compare', {
		method: 'POST',
		body: JSON.stringify({ url_a: urlA, url_b: urlB })
	});
}

// ══════════════════════════════════════════════════════════
// CHAT — POST /api/scan/chat
// ══════════════════════════════════════════════════════════

export async function sendChatMessage(
	message: string,
	scanId: string | null,
	history: Array<{ role: string; content: string }>
): Promise<{ reply: string; scan_id?: string }> {
	return request('/api/scan/chat', {
		method: 'POST',
		body: JSON.stringify({ message, scan_id: scanId, conversation_history: history.slice(-10) })
	});
}

// ══════════════════════════════════════════════════════════
// HISTORY — matches /api/scans/history & /api/history/*
// ══════════════════════════════════════════════════════════

/** Cursor-paginated scan history — GET /api/scans/history */
export async function getScanHistory(cursor?: string, limit: number = 20): Promise<{
	items: ScanResult[];
	next_cursor: string | null;
	has_more: boolean;
}> {
	const params = new URLSearchParams({ limit: String(limit) });
	if (cursor) params.set('cursor', cursor);
	return request(`/api/scans/history?${params}`);
}

/** Compare history — GET /api/history/compares */
export async function getCompareHistory(): Promise<any> {
	return request('/api/history/compares');
}

/** SEO history — GET /api/history/seo */
export async function getSeoHistory(): Promise<any> {
	return request('/api/history/seo');
}

// ══════════════════════════════════════════════════════════
// LEADERBOARD — GET /api/scans/leaderboard
// ══════════════════════════════════════════════════════════

export async function getLeaderboard(
	period: LeaderboardPeriod = 'week',
	limit: number = 25
): Promise<{ leaderboard: LeaderboardEntry[] }> {
	return request(`/api/scans/leaderboard?period=${period}&limit=${limit}`);
}

// ══════════════════════════════════════════════════════════
// PROFILE — matches /api/profile/*
// ══════════════════════════════════════════════════════════

export interface ProfileData {
	username?: string;
	display_name?: string;
	phone?: string;
	company?: string;
	address_line1?: string;
	address_line2?: string;
	city?: string;
	postcode?: string;
	country?: string;
	website?: string;
	bio?: string;
	brand_name?: string;
	brand_color?: string;
	brand_logo_url?: string;
}

export async function getPublicProfile(userId: string): Promise<any> {
	return request(`/api/profile/${userId}`);
}

/** Get own full profile (includes branding fields) — GET /api/profile */
export async function getProfile(): Promise<any> {
	return request('/api/profile');
}

/** Upload avatar image — POST /api/profile/avatar */
export async function uploadAvatar(file: File): Promise<{ message: string; avatar_url: string }> {
	const token = getToken();
	if (!token) throw new ApiError(401, 'Sign in to upload avatar');
	const formData = new FormData();
	formData.append('file', file);
	const res = await fetch(`${API_BASE}/api/profile/avatar`, {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}` },
		body: formData,
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new ApiError(res.status, body.detail || 'Upload failed');
	}
	return res.json();
}

/** Request a name change (goes to admin for approval) */
export async function requestNameChange(name: string): Promise<{ message: string }> {
	return request('/api/profile/request-name-change', {
		method: 'POST',
		body: JSON.stringify({ requested_name: name }),
	});
}

export async function updateProfile(email: string, data: ProfileData): Promise<{ message: string }> {
	return request('/api/profile/update', {
		method: 'PUT',
		body: JSON.stringify({ ...data, email })
	});
}

export async function checkUsername(username: string): Promise<{ available: boolean; reason?: string }> {
	return request(`/api/profile/username/check/${encodeURIComponent(username)}`);
}

// ══════════════════════════════════════════════════════════
// TEAM — matches /api/team/*
// ══════════════════════════════════════════════════════════

export async function getTeam(): Promise<{
	team: any[];
	is_owner: boolean;
	count: number;
	max_members: number;
}> {
	return request('/api/team');
}

export async function inviteTeamMember(email: string, role: string = 'member'): Promise<{ message: string; status: string }> {
	return request('/api/team/invite', {
		method: 'POST',
		body: JSON.stringify({ email, role })
	});
}

/** Accept invite — POST /api/team/accept (NOT /accept-invite) */
export async function acceptInvite(token: string): Promise<{ message: string }> {
	return request('/api/team/accept', {
		method: 'POST',
		body: JSON.stringify({ token })
	});
}

export async function removeTeamMember(memberId: string): Promise<{ message: string }> {
	return request(`/api/team/members/${memberId}`, { method: 'DELETE' });
}

/** Get team notes — GET /api/team/notes */
export async function getTeamNotes(): Promise<{ notes: any[] }> {
	return request('/api/team/notes');
}

/** Create a team note — POST /api/team/notes */
export async function createTeamNote(content: string): Promise<{ message: string; note: any }> {
	return request('/api/team/notes', { method: 'POST', body: JSON.stringify({ content }) });
}

/** Delete a team note — DELETE /api/team/notes/:id */
export async function deleteTeamNote(id: string): Promise<{ message: string }> {
	return request(`/api/team/notes/${id}`, { method: 'DELETE' });
}

/** Get team activity feed — GET /api/team/activity */
export async function getTeamActivity(): Promise<{ activity: any[] }> {
	return request('/api/team/activity');
}

// ══════════════════════════════════════════════════════════
// MONITORING — matches /api/monitoring/*
// ══════════════════════════════════════════════════════════

export async function getMonitoredSites(): Promise<{ sites: any[]; count: number; max_sites: number; plan: string }> {
	return request('/api/monitoring');
}

export async function addMonitoredSite(url: string, frequency: string = 'weekly', alert_threshold: number = 5): Promise<{ message: string; site: any }> {
	return request('/api/monitoring', {
		method: 'POST',
		body: JSON.stringify({ url, frequency, alert_threshold }),
	});
}

export async function updateMonitoredSite(siteId: string, data: { frequency?: string; alert_threshold?: number; is_active?: boolean }): Promise<{ message: string }> {
	return request(`/api/monitoring/${siteId}`, {
		method: 'PATCH',
		body: JSON.stringify(data),
	});
}

export async function removeMonitoredSite(siteId: string): Promise<{ message: string }> {
	return request(`/api/monitoring/${siteId}`, { method: 'DELETE' });
}

export async function getMonitoringTrend(siteId: string): Promise<{ url: string; trend: any[]; total_scans: number }> {
	return request(`/api/monitoring/${siteId}/trend`);
}

export async function triggerMonitoringScan(siteId: string): Promise<{ message: string }> {
	return request(`/api/monitoring/${siteId}/scan`, { method: 'POST' });
}

// ══════════════════════════════════════════════════════════
// AI FIX GENERATOR — matches /api/fix/*
// ══════════════════════════════════════════════════════════

export async function getAiFix(issue: {
	issue_title: string;
	issue_description: string;
	issue_category: string;
	issue_severity: string;
	url: string;
	current_value?: string;
}): Promise<any> {
	return request('/api/fix', {
		method: 'POST',
		body: JSON.stringify(issue),
	});
}

export async function getAiFixesForScan(scanId: string): Promise<{
	scan_id: string;
	url: string;
	total_issues: number;
	fixes_generated: number;
	fixes: any[];
}> {
	return request(`/api/fix/scan/${scanId}`, { method: 'POST' });
}

// ══════════════════════════════════════════════════════════
// DEEP CRAWL & BULK SCAN — matches /api/crawl/*
// ══════════════════════════════════════════════════════════

export async function deepCrawl(url: string, maxPages: number = 10): Promise<any> {
	return request('/api/crawl/deep', {
		method: 'POST',
		body: JSON.stringify({ url, max_pages: maxPages }),
	});
}

export async function bulkScan(urls: string[]): Promise<any> {
	return request('/api/crawl/bulk', {
		method: 'POST',
		body: JSON.stringify({ urls }),
	});
}

// ══════════════════════════════════════════════════════════
// BILLING — matches /api/billing/*
// ══════════════════════════════════════════════════════════

export async function createCheckout(
	plan: 'pro' | 'agency',
	email: string,
	interval: BillingInterval
): Promise<{ checkout_url: string }> {
	return request(`/api/billing/checkout/${plan}`, {
		method: 'POST',
		body: JSON.stringify({ email, interval })
	});
}

/** Stripe customer portal — POST /api/billing/portal */
export async function createBillingPortal(): Promise<{ url: string }> {
	return request('/api/billing/portal', { method: 'POST' });
}

// ══════════════════════════════════════════════════════════
// API KEYS — matches /api/v1/keys/*
// ══════════════════════════════════════════════════════════

export async function createApiKey(name: string): Promise<any> {
	return request('/api/v1/keys', {
		method: 'POST',
		body: JSON.stringify({ name })
	});
}

export async function listApiKeys(): Promise<any[]> {
	return request('/api/v1/keys');
}

export async function revokeApiKey(keyId: string): Promise<{ message: string }> {
	return request(`/api/v1/keys/${keyId}`, { method: 'DELETE' });
}

// ══════════════════════════════════════════════════════════
// SEO — matches /api/seo/*
// ══════════════════════════════════════════════════════════

export async function keywordResearch(keyword: string): Promise<any> {
	return request('/api/seo/keywords', {
		method: 'POST',
		body: JSON.stringify({ keyword })
	});
}

export async function getBacklinks(domain: string): Promise<any> {
	return request('/api/seo/backlinks', {
		method: 'POST',
		body: JSON.stringify({ domain })
	});
}

export async function getSeoAutocomplete(query: string): Promise<any> {
	return request(`/api/seo/autocomplete?q=${encodeURIComponent(query)}`);
}

// ══════════════════════════════════════════════════════════
// PDF — GET /api/scan/{id}/pdf (auth required)
// ══════════════════════════════════════════════════════════

export function getPdfDownloadUrl(scanId: string): string {
	const token = getToken();
	return `${API_BASE}/api/scan/${scanId}/pdf${token ? `?token=${token}` : ''}`;
}

/** Download PDF with proper auth — triggers browser download */
export async function downloadPdf(scanId: string, filename?: string): Promise<void> {
	const token = getToken();
	if (!token) throw new ApiError(401, 'Sign in to download PDFs');
	const res = await fetch(`${API_BASE}/api/scan/${scanId}/pdf`, {
		headers: { 'Authorization': `Bearer ${token}` }
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ detail: 'PDF download failed' }));
		throw new ApiError(res.status, err.detail || 'PDF download failed');
	}
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename || `bscan-report-${scanId.slice(0, 8)}.pdf`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export { ApiError, API_BASE };
