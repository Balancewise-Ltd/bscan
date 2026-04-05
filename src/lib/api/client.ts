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

export class ApiError extends Error {
	status: number;
	body?: unknown;
	constructor(status: number, message: string, body?: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.body = body;
	}
}

function getToken(): string | null {
	return safeGetStorage('bscan_token');
}

let _refreshing: Promise<boolean> | null = null;

async function _tryRefresh(): Promise<boolean> {
	const rt = safeGetStorage('bscan_refresh_token');
	if (!rt) return false;
	try {
		const res = await fetch(`${API_BASE}/api/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refresh_token: rt })
		});
		if (!res.ok) return false;
		const data = await res.json();
		if (data.access_token) {
			if (typeof window !== 'undefined') {
				try { localStorage.setItem('bscan_token', data.access_token); } catch {}
				if (data.refresh_token) try { localStorage.setItem('bscan_refresh_token', data.refresh_token); } catch {}
			}
			return true;
		}
	} catch {}
	return false;
}

async function parseResponseBody(res: Response): Promise<unknown> {
	if (res.status === 204) return null;
	const contentType = res.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		try { return await res.json(); } catch { return null; }
	}
	try { return await res.text(); } catch { return null; }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers = new Headers(options.headers || {});
	headers.set('Accept', 'application/json');
	if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}
	const token = getToken();
	if (token && !headers.has('Authorization')) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	let res: Response;
	try {
		res = await fetch(`${API_BASE}${path}`, {
			...options,
			headers,
			mode: 'cors',
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Network request failed';
		throw new ApiError(0, `Network error: ${message}`);
	}

	// Auto-refresh on 401
	if (res.status === 401 && getToken()) {
		if (!_refreshing) _refreshing = _tryRefresh().finally(() => { _refreshing = null; });
		const ok = await _refreshing;
		if (ok) {
			headers.set('Authorization', `Bearer ${getToken()}`);
			try {
				res = await fetch(`${API_BASE}${path}`, { ...options, headers, mode: 'cors' });
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Network request failed';
				throw new ApiError(0, `Network error: ${message}`);
			}
		}
	}

	const body = await parseResponseBody(res);

	if (!res.ok) {
		const message =
			typeof body === 'object' && body && 'detail' in body
				? String((body as any).detail)
				: typeof body === 'object' && body && 'message' in body
				? String((body as any).message)
				: typeof body === 'string' && body.trim()
				? body
				: `Request failed with status ${res.status}`;
		throw new ApiError(res.status, message, body);
	}

	return body as T;
}

// ══════════════════════════════════════════════════════════
// AUTH — matches /api/auth/*
// ══════════════════════════════════════════════════════════

/** Backend returns { access_token, refresh_token, token_type, user } */
interface AuthResponse {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	user: User;
	requires_2fa?: boolean;
	requires_verification?: boolean;
}

export async function login(email: string, password: string, totp_code?: string): Promise<AuthResponse> {
	const body: Record<string, string> = { email, password };
	if (totp_code) body.totp_code = totp_code;
	// Send device trust token as header so backend can skip email verification for trusted devices
	const deviceToken = typeof window !== 'undefined' ? localStorage.getItem('bscan_device_trust') : null;
	const headers: HeadersInit = {};
	if (deviceToken) (headers as Record<string, string>)['X-Device-Trust'] = deviceToken;
	return request('/api/auth/login', {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
}

export async function verifyLoginCode(email: string, code: string, save_login: boolean = true): Promise<AuthResponse> {
	return request('/api/auth/verify-login-code', {
		method: 'POST',
		body: JSON.stringify({ email, code, save_login })
	});
}

export async function get2faStatus(): Promise<{ enabled: boolean }> {
	return request('/api/auth/2fa/status');
}

export async function setup2fa(): Promise<{ secret: string; provisioning_uri: string }> {
	return request('/api/auth/2fa/setup', { method: 'POST' });
}

export async function verify2fa(code: string): Promise<{ message: string; backup_codes: string[] }> {
	return request('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function disable2fa(code: string, password: string): Promise<{ message: string }> {
	return request('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code, password }) });
}

export async function recover2fa(email: string, backupCode: string): Promise<AuthResponse> {
	return request('/api/auth/2fa/recover', {
		method: 'POST',
		body: JSON.stringify({ email, backup_code: backupCode })
	});
}

export async function sendCode(email: string): Promise<{ message: string; email: string }> {
	return request('/api/auth/send-code', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
}

export async function register(email: string, password: string, name: string, referral_code: string = '', verification_code: string = '', date_of_birth: string = ''): Promise<any> {
	return request('/api/auth/register', {
		method: 'POST',
		body: JSON.stringify({ email, password, name, referral_code, verification_code, date_of_birth })
	});
}

export async function getMe(): Promise<User> {
	return request('/api/auth/me');
}

export async function getGoogleAuthUrl(): Promise<{ url?: string }> {
	return request('/api/auth/google/url');
}

export async function getPasskeyLoginOptions(): Promise<any> {
	return request('/api/auth/passkey/login-options', {
		method: 'POST',
		body: JSON.stringify({})
	});
}

export async function verifyPasskeyLogin(credential: any): Promise<AuthResponse> {
	return request('/api/auth/passkey/login-verify', {
		method: 'POST',
		body: JSON.stringify(credential)
	});
}

// ── Sessions & Login History ─────────────────────────
export async function getSessions(): Promise<{ sessions: any[] }> {
	return request('/api/auth/sessions');
}

export async function revokeSession(tokenId: string): Promise<{ message: string }> {
	return request(`/api/auth/sessions/${tokenId}`, { method: 'DELETE' });
}

export async function getLoginHistory(): Promise<{ history: any[] }> {
	return request('/api/auth/login-history');
}

// ── Change Email ─────────────────────────────────────
export async function changeEmail(newEmail: string, password: string): Promise<{ message: string }> {
	return request('/api/auth/change-email', {
		method: 'POST',
		body: JSON.stringify({ new_email: newEmail, password })
	});
}

export async function verifyEmailChange(code: string): Promise<{ message: string }> {
	return request('/api/auth/verify-email-change', {
		method: 'POST',
		body: JSON.stringify({ code })
	});
}

// ── GDPR Consent ─────────────────────────────────────
export async function getConsentStatus(): Promise<{ consents: any[] }> {
	return request('/api/gdpr/consent');
}

// ── Content Appeals ──────────────────────────────────
export async function createAppeal(contentId: string, contentType: string, reason: string): Promise<{ message: string }> {
	return request('/api/community/appeal', {
		method: 'POST',
		body: JSON.stringify({ content_id: contentId, content_type: contentType, reason })
	});
}

export async function getAppealStatus(): Promise<{ appeals: any[] }> {
	return request('/api/community/appeal/status');
}

// ── Notification Preferences ─────────────────────────
export async function getNotificationPreferences(): Promise<Record<string, boolean>> {
	return request('/api/community/notification-preferences');
}

export async function updateNotificationPreferences(prefs: Record<string, boolean>): Promise<Record<string, boolean>> {
	return request('/api/community/notification-preferences', {
		method: 'PUT',
		body: JSON.stringify(prefs)
	});
}

// ── Account Deactivation ─────────────────────────────
export async function deactivateAccount(): Promise<{ message: string }> {
	return request('/api/auth/deactivate', { method: 'POST' });
}

export async function reactivateAccount(): Promise<{ message: string }> {
	return request('/api/auth/reactivate', { method: 'POST' });
}

// ── Rate Limit Status ────────────────────────────────
export async function getRateLimitStatus(): Promise<{ remaining: number; limit: number; resets_in: number }> {
	return request('/api/auth/rate-limit-status');
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

export async function getScanResult(scanId: string): Promise<ScanResult> {
	const token = getToken();
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;
	const res = await fetch(`${API_BASE}/api/scan/${scanId}`, { headers });
	if (!res.ok) throw new ApiError(res.status, 'Failed to fetch scan result');
	return res.json();
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

export async function getScanBadgeCode(scanId: string): Promise<{ html: string; markdown: string; image_url: string; scan_url: string }> {
	return request(`/api/scan/${scanId}/badge-code`);
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
export async function getAiVisibilityHistory(): Promise<{ items: any[] }> {
	return request('/api/history/ai-visibility');
}

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
	date_of_birth?: string;
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
// AI VISIBILITY — matches /api/seo/ai-visibility
// ══════════════════════════════════════════════════════════

export async function checkAiVisibility(url: string): Promise<any> {
	return request('/api/seo/ai-visibility', {
		method: 'POST',
		body: JSON.stringify({ url }),
	});
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

export async function downloadDeepCrawlPdf(data: { url: string; pages: any[]; summary: any; issues: any[] }): Promise<Blob> {
	const token = getToken();
	const res = await fetch(`${API_BASE}/api/crawl/deep/pdf`, {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!res.ok) throw new ApiError(res.status, 'PDF generation failed');
	return res.blob();
}

export async function bulkScan(urls: string[]): Promise<any> {
	return request('/api/crawl/bulk', {
		method: 'POST',
		body: JSON.stringify({ urls }),
	});
}

// ══════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — matches /api/push/*
// ══════════════════════════════════════════════════════════

export async function registerPushToken(token: string): Promise<{ message: string }> {
	return request('/api/push/register', {
		method: 'POST',
		body: JSON.stringify({ token }),
	});
}

export async function unregisterPushToken(token: string): Promise<{ message: string }> {
	return request('/api/push/unregister', {
		method: 'POST',
		body: JSON.stringify({ token }),
	});
}

export async function testPush(): Promise<{ message: string }> {
	return request('/api/push/test', { method: 'POST' });
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

export async function getKeywordSuggestions(keyword: string, country: string = 'uk'): Promise<any> {
	return request('/api/seo/keywords/suggest', {
		method: 'POST',
		body: JSON.stringify({ keyword, country })
	});
}

export async function getKeywordIdeas(url: string, email: string, country: string = 'uk'): Promise<any> {
	return request('/api/seo/keywords/ideas', {
		method: 'POST',
		body: JSON.stringify({ url, email, country })
	});
}

export async function analyzeKeywords(domain: string, keywords: string[]): Promise<any> {
	return request('/api/seo/keywords/analyze', {
		method: 'POST',
		body: JSON.stringify({ domain, keywords })
	});
}

export async function compareBacklinks(domainA: string, domainB: string): Promise<any> {
	return request('/api/seo/backlinks/compare', {
		method: 'POST',
		body: JSON.stringify({ domain_a: domainA, domain_b: domainB })
	});
}

export async function generateSeoReport(url: string, email: string, includeBacklinks: boolean = true, includeAiAnalysis: boolean = true): Promise<any> {
	return request('/api/seo/report', {
		method: 'POST',
		body: JSON.stringify({ url, email, include_backlinks: includeBacklinks, include_ai_analysis: includeAiAnalysis })
	});
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
// ══════════════════════════════════════════════════════════
// GOOGLE SEARCH CONSOLE — matches /api/seo/gsc/*
// ══════════════════════════════════════════════════════════

/** Check if user has GSC connected */
export async function gscStatus(): Promise<{ connected: boolean; connected_at?: string }> {
	return request('/api/seo/gsc/status');
}

/** Get list of GSC sites */
export async function gscSites(): Promise<{ sites: any[] }> {
	return request('/api/seo/gsc/sites');
}

/** Get full ranking overview for a site */
export async function gscOverview(site_url: string, days: number = 28): Promise<any> {
	return request('/api/seo/gsc/overview', {
		method: 'POST',
		body: JSON.stringify({ site_url, days }),
	});
}

/** Get keyword rankings from GSC */
export async function gscKeywords(site_url: string, days: number = 28, limit: number = 50): Promise<any> {
	return request('/api/seo/gsc/keywords', {
		method: 'POST',
		body: JSON.stringify({ site_url, days, limit }),
	});
}

/** Get top pages from GSC */
export async function gscPages(site_url: string, days: number = 28): Promise<any> {
	return request('/api/seo/gsc/pages', {
		method: 'POST',
		body: JSON.stringify({ site_url, days }),
	});
}

/** Connect GSC — returns { auth_url } for redirect */
export async function gscConnect(): Promise<{ auth_url: string }> {
	return request('/api/seo/gsc/connect');
}

/** Disconnect GSC */
export async function gscDisconnect(): Promise<any> {
	return request('/api/seo/gsc/disconnect', { method: 'DELETE' });
}


// ══════════════════════════════════════════════════════════
// EMAIL VERIFICATION — matches /api/auth/verify & /resend-verification
// ══════════════════════════════════════════════════════════

export async function verifyEmail(token: string): Promise<{ message: string; verified: boolean }> {
	return request(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}

export async function resendVerification(): Promise<{ message: string }> {
	return request('/api/auth/resend-verification', { method: 'POST' });
}

/** Resend verification email by email address (no auth required — for login flow) */
export async function resendVerificationByEmail(email: string): Promise<{ message: string }> {
	return request('/api/auth/resend-verification-email', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
}



// REFERRAL SYSTEM
export async function referralStats(): Promise<any> {
	return request('/api/auth/referral/stats');
}

export async function claimReferralReward(): Promise<any> {
	return request('/api/auth/referral/claim', { method: 'POST' });
}


// ACCOUNT DELETION
export async function deleteAccount(): Promise<any> {
	return request('/api/auth/delete-account', { method: 'POST' });
}

export async function reinstateAccount(email: string, password: string): Promise<any> {
	return request('/api/auth/reinstate-account', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
	});
}

export { API_BASE };


// ══════════════════════════════════════════════════════════
// REPORTS — scheduled client reports (Agency only)
// ══════════════════════════════════════════════════════════

export interface ReportSchedule {
	id: string; url: string; recipient_email: string; recipient_name: string;
	frequency: string; include_ai_fixes: boolean; include_comparison: boolean;
	branding_company: string; branding_color: string; status: string;
	last_run_at: string | null; last_score: number | null;
	next_run_at: string | null; total_sent: number; created_at: string;
}

export interface ReportHistory {
	id: string; url: string; recipient_email: string;
	overall_score: number | null; previous_score: number | null;
	score_change: number | null; status: string; sent_at: string;
}

export interface ReportStats {
	total_schedules: number; active_schedules: number;
	total_reports_sent: number; reports_this_month: number;
	avg_client_score: number | null;
}

export async function getReportSchedules(): Promise<{ schedules: ReportSchedule[]; total: number }> {
	return request('/api/reports/schedules');
}

export async function createReportSchedule(data: Record<string, any>): Promise<{ id: string; status: string; next_run_at: string }> {
	return request('/api/reports/schedules', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateReportSchedule(id: string, data: Record<string, any>): Promise<{ status: string }> {
	return request('/api/reports/schedules/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteReportSchedule(id: string): Promise<{ status: string }> {
	return request('/api/reports/schedules/' + id, { method: 'DELETE' });
}

export async function sendReportNow(id: string): Promise<{ status: string; message: string }> {
	return request('/api/reports/schedules/' + id + '/send-now', { method: 'POST' });
}

export async function getReportHistory(id: string): Promise<{ history: ReportHistory[]; total: number }> {
	return request('/api/reports/schedules/' + id + '/history');
}

export async function getReportStats(): Promise<ReportStats> {
	return request('/api/reports/stats');
}

// ── Community / Wisers ──
export async function getCommunityProfile(username: string): Promise<any> {
	return request(`/api/community/profile/${username}`);
}
export async function searchWisers(q: string): Promise<{ users: any[] }> {
	return request(`/api/community/search?q=${encodeURIComponent(q)}`);
}
export async function getFriends(): Promise<{ friends: any[] }> {
	return request('/api/community/friends');
}
export async function getFriendRequests(): Promise<{ incoming: any[]; outgoing: any[] }> {
	return request('/api/community/friend-requests');
}
export async function sendFriendRequest(username: string): Promise<any> {
	return request(`/api/community/friend-request/${username}`, { method: 'POST' });
}
export async function acceptFriendRequest(id: number): Promise<any> {
	return request(`/api/community/friend-request/${id}/accept`, { method: 'POST' });
}
export async function declineFriendRequest(id: number): Promise<any> {
	return request(`/api/community/friend-request/${id}/decline`, { method: 'POST' });
}
export async function unfriend(username: string): Promise<any> {
	return request(`/api/community/unfriend/${username}`, { method: 'DELETE' });
}
export async function getFriendshipStatus(username: string): Promise<{ status: string }> {
	return request(`/api/community/friendship-status/${username}`);
}

// ── Community Feed ──
export async function getCommunityFeed(page: number = 1): Promise<any> {
	return request(`/api/community/feed?page=${page}`);
}
export const getFeed = getCommunityFeed;
export async function getFriendsFeed(page: number = 1): Promise<any> {
	return request(`/api/community/feed/friends?page=${page}`);
}
export async function uploadPostImage(file: File): Promise<{ url: string }> {
  const token = getToken();
  if (!token) throw new ApiError(401, 'Sign in to upload');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'posts');
  const res = await fetch(API_BASE + '/api/community/upload-image', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || 'Upload failed');
  }
  return res.json();
}

export async function uploadMedia(file: File): Promise<{id: string, url: string, thumbnail_url: string, type: string, filename: string, size: number, content_type: string, width: number, height: number, duration: number}> {
  const fd = new FormData();
  fd.append('file', file);
  return request('/api/media/upload', { method: 'POST', body: fd });
}

export async function uploadMediaAvatar(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return request('/api/media/upload/avatar', { method: 'POST', body: fd });
}

export async function getMedia(mediaId: string): Promise<any> {
  return request(`/api/media/${mediaId}`);
}

export async function deleteMedia(mediaId: string): Promise<{ message: string }> {
  return request(`/api/media/${mediaId}`, { method: 'DELETE' });
}

export async function createPost(content: string, postType: string = 'text', scanUrl: string = '', scanScore: number = 0, imageUrl: string = '', mediaIds: string[] = []): Promise<any> {
	const body: Record<string, any> = { content, post_type: postType, scan_url: scanUrl, scan_score: scanScore, image_url: imageUrl };
	if (mediaIds.length > 0) body.media_ids = mediaIds;
	return request('/api/community/posts', { method: 'POST', body: JSON.stringify(body) });
}
export async function deletePost(id: number): Promise<any> {
	return request(`/api/community/posts/${id}`, { method: 'DELETE' });
}
export async function getPost(id: number): Promise<any> {
	return request(`/api/community/posts/${id}`);
}
export async function likePost(id: number): Promise<any> {
	return request(`/api/community/posts/${id}/like`, { method: 'POST' });
}
export async function addComment(postId: number, content: string): Promise<any> {
	return request(`/api/community/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
}
export async function deleteComment(id: number): Promise<any> {
	return request(`/api/community/comments/${id}`, { method: 'DELETE' });
}
export async function getUserPosts(username: string, page: number = 1): Promise<any> {
	return request(`/api/community/user/${username}/posts?page=${page}`);
}

// ── Direct Messages ──
export async function getConversations(): Promise<any> {
	return request('/api/community/conversations');
}
export async function getMessages(convId: number, markRead: boolean = false): Promise<any> {
  return request('/api/community/conversations/' + convId + '/messages?mark_read=' + markRead);
}
export async function sendMessage(username: string, content: string, mediaId?: string, encryptedContent?: string, nonce?: string): Promise<any> {
	const body: Record<string, any> = { content };
	if (mediaId) body.media_id = mediaId;
	if (encryptedContent) body.encrypted_content = encryptedContent;
	if (nonce) body.nonce = nonce;
	return request(`/api/community/messages/${username}`, { method: 'POST', body: JSON.stringify(body) });
}
export async function getUnreadCount(): Promise<{ unread: number }> {
	return request('/api/community/unread-count');
}

// ── Notifications ──
export async function getNotifications(): Promise<any> {
  return request('/api/community/notifications');
}
export async function getNotificationCount(): Promise<{ count: number }> {
  return request('/api/community/notifications/unread-count');
}
export async function markAllNotificationsRead(): Promise<any> {
  return request('/api/community/notifications/read-all', { method: 'POST' });
}
export async function markNotificationRead(id: number): Promise<any> {
  return request(`/api/community/notifications/${id}/read`, { method: 'POST' });
}

// ── Discovery ──
export async function getSuggestedUsers(): Promise<any> {
  return request('/api/community/suggested-users');
}
export async function getAllUsers(page: number = 1): Promise<any> {
  return request(`/api/community/all-users?page=${page}`);
}

// ── Support (legacy tickets) ──
export async function getSupportTicket(): Promise<any> {
  return request('/api/community/support/my-ticket');
}
export async function sendSupportMessage(content: string): Promise<any> {
  return request('/api/community/support/send', { method: 'POST', body: JSON.stringify({ content }) });
}

// ── Live Support ──
export async function startSupportSession(platform: string, message: string, category?: string): Promise<any> {
  return request('/api/support/session/start', { method: 'POST', body: JSON.stringify({ platform, message, category }) });
}
export async function sendLiveSupportMessage(sessionId: string, message: string): Promise<any> {
  return request(`/api/support/session/${sessionId}/message`, { method: 'POST', body: JSON.stringify({ message }) });
}
export async function getSupportSession(sessionId: string): Promise<any> {
  return request(`/api/support/session/${sessionId}`);
}
export async function closeSupportSession(sessionId: string): Promise<any> {
  return request(`/api/support/session/${sessionId}/close`, { method: 'POST' });
}
export async function rateSupportSession(sessionId: string, rating: number): Promise<any> {
  return request(`/api/support/session/${sessionId}/rate`, { method: 'POST', body: JSON.stringify({ rating }) });
}

// ── Help Centre ──
export async function getHelpArticles(): Promise<any> {
  return request('/api/support/help');
}
export async function searchHelpArticles(q: string): Promise<any> {
  return request(`/api/support/help/search?q=${encodeURIComponent(q)}`);
}
export async function getHelpArticle(slug: string): Promise<any> {
  return request(`/api/support/help/${encodeURIComponent(slug)}`);
}

// ── Reports ──
export async function reportContent(type: string, id: number, reason: string): Promise<any> {
  return request('/api/community/report', { method: 'POST', body: JSON.stringify({ type, id, reason }) });
}

export async function reportContentV2(postId: number | null, commentId: number | null, userId: string | null, reason: string, details?: string): Promise<any> {
  return request('/api/community/report/v2', { method: 'POST', body: JSON.stringify({ post_id: postId, comment_id: commentId, user_id: userId, reason, details }) });
}

export async function getEngagementCheck(): Promise<{ show_community_card: boolean; show_post_card: boolean; communities: any[] }> {
  return request('/api/community/engagement-check');
}

export async function checkPostLiked(postId: number): Promise<{ liked: boolean }> {
  return request(`/api/community/posts/${postId}/liked`);
}

export async function getMyReactions(postId: number): Promise<{ liked: boolean; rocketed: boolean; reposted: boolean }> {
  return request(`/api/community/post/${postId}/my-reactions`);
}

export async function getIdVerificationStatus(): Promise<any> {
  return request('/api/community/id-verification/status');
}

export async function submitIdVerification(documentUrl: string, documentType: string, fullName: string): Promise<any> {
  return request('/api/community/id-verification/submit', { method: 'POST', body: JSON.stringify({ document_url: documentUrl, document_type: documentType, full_name: fullName }) });
}

// ── Rockets & Reposts ──
export async function toggleRocket(postId: number): Promise<any> {
  return request('/api/community/toggle-rocket/' + postId, { method: 'POST' });
}
export async function toggleRepost(postId: number): Promise<any> {
  return request('/api/community/repost/' + postId, { method: 'POST' });
}


// ═══════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════

export async function toggleBookmark(postId: number): Promise<{ bookmarked: boolean }> {
	return request(`/api/community/bookmark/${postId}`, { method: 'POST' });
}

export async function getBookmarks(page: number = 1): Promise<any> {
	return request(`/api/community/bookmarks?page=${page}`);
}

// ═══════════════════════════════════════════════
// BLOCK / MUTE
// ═══════════════════════════════════════════════

export async function blockUser(username: string): Promise<{ blocked: boolean }> {
	return request(`/api/community/block/${username}`, { method: 'POST' });
}

export async function unblockUser(username: string): Promise<{ blocked: boolean }> {
	return request(`/api/community/block/${username}`, { method: 'DELETE' });
}

export async function muteUser(username: string): Promise<{ muted: boolean }> {
	return request(`/api/community/mute/${username}`, { method: 'POST' });
}

export async function unmuteUser(username: string): Promise<{ muted: boolean }> {
	return request(`/api/community/mute/${username}`, { method: 'DELETE' });
}

export async function getBlockedUsers(): Promise<{ users: any[] }> {
	return request('/api/community/blocked-users');
}

export async function getMutedUsers(): Promise<{ users: any[] }> {
	return request('/api/community/muted-users');
}

// ═══════════════════════════════════════════════
// FOLLOW (non-mutual)
// ═══════════════════════════════════════════════

export async function followUser(username: string): Promise<{ following: boolean }> {
	return request(`/api/community/follow/${username}`, { method: 'POST' });
}

export async function unfollowUser(username: string): Promise<{ following: boolean }> {
	return request(`/api/community/follow/${username}`, { method: 'DELETE' });
}

export async function getFollowers(username: string): Promise<{ followers: any[]; count: number }> {
	return request(`/api/community/followers/${username}`);
}

export async function getFollowing(username: string): Promise<{ following: any[]; count: number }> {
	return request(`/api/community/following/${username}`);
}

export async function getFollowStatus(username: string): Promise<{ i_follow: boolean; they_follow: boolean }> {
	return request(`/api/community/follow-status/${username}`);
}

// ═══════════════════════════════════════════════
// USER SETTINGS
// ═══════════════════════════════════════════════

export async function getUserSettings(): Promise<Record<string, any>> {
	return request('/api/community/user-settings');
}

export async function updateUserSettings(data: Record<string, any>): Promise<{ message: string }> {
	return request('/api/community/user-settings', {
		method: 'PUT',
		body: JSON.stringify(data),
	});
}

export async function dismissNudge(key: string): Promise<{ message: string }> {
	return updateUserSettings({ [key]: true });
}

// ═══════════════════════════════════════════════
// POST EDIT
// ═══════════════════════════════════════════════

export async function editPost(postId: number, content: string): Promise<{ edited: boolean }> {
	return request(`/api/community/post/${postId}`, { method: 'PUT', body: JSON.stringify({ content }) });
}

export async function getPostEdits(postId: number): Promise<{ edits: any[] }> {
	return request(`/api/community/post/${postId}/edits`);
}

// ═══════════════════════════════════════════════
// HASHTAGS
// ═══════════════════════════════════════════════

export async function getTrendingHashtags(): Promise<{ hashtags: any[] }> {
	return request('/api/community/hashtags/trending');
}

export async function getHashtagPosts(tag: string, page: number = 1): Promise<any> {
	return request(`/api/community/hashtags/${encodeURIComponent(tag)}?page=${page}`);
}

export async function searchAll(q: string): Promise<{ users: any[]; posts: any[]; communities: any[]; query: string }> {
	return request(`/api/community/search/all?q=${encodeURIComponent(q)}`);
}

// ═══════════════════════════════════════════════
// POLLS
// ═══════════════════════════════════════════════

export async function createPoll(question: string, options: string[], content?: string, endsAt?: string): Promise<any> {
	return request('/api/community/poll', { method: 'POST', body: JSON.stringify({ question, options, content, ends_at: endsAt }) });
}

export async function votePoll(pollId: number, optionId: number): Promise<any> {
	return request(`/api/community/poll/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ option_id: optionId }) });
}

export async function getPoll(postId: number): Promise<any> {
	return request(`/api/community/poll/${postId}`);
}

// ═══════════════════════════════════════════════
// POST SCHEDULING
// ═══════════════════════════════════════════════

export async function schedulePost(content: string, scheduledFor: string): Promise<any> {
	return request('/api/community/schedule-post', { method: 'POST', body: JSON.stringify({ content, scheduled_for: scheduledFor }) });
}

export async function getScheduledPosts(): Promise<{ posts: any[] }> {
	return request('/api/community/scheduled-posts');
}

export async function deleteScheduledPost(id: number): Promise<any> {
	return request(`/api/community/scheduled-post/${id}`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════════
// DM READ RECEIPTS
// ═══════════════════════════════════════════════

export async function markMessageRead(msgId: number): Promise<any> {
	return request(`/api/community/messages/${msgId}/read`, { method: 'POST' });
}

export async function getReadStatus(conversationId: number): Promise<any> {
	return request(`/api/community/messages/${conversationId}/read-status`);
}

// ═══════════════════════════════════════════════
// MENTIONS
// ═══════════════════════════════════════════════

export async function getMentions(page: number = 1): Promise<{ posts: any[] }> {
	return request(`/api/community/mentions?page=${page}`);
}

// ═══════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════

export async function getPostAnalytics(postId: number): Promise<any> {
	return request(`/api/community/post/${postId}/analytics`);
}

// ═══════════════════════════════════════════════
// ACTIVITY
// ═══════════════════════════════════════════════

export async function getActivity(): Promise<{ activities: any[] }> {
	return request('/api/community/activity');
}

// ═══════════════════════════════════════════════
// GROUP CHATS
// ═══════════════════════════════════════════════

export async function createGroupChat(name: string, members: string[]): Promise<any> {
	return request('/api/community/group-chat', { method: 'POST', body: JSON.stringify({ name, members }) });
}

export async function getGroupChats(): Promise<{ groups: any[] }> {
	return request('/api/community/group-chats');
}

export async function getGroupMessages(groupId: number, page: number = 1): Promise<any> {
	return request(`/api/community/group-chat/${groupId}/messages?page=${page}`);
}

export async function sendGroupMessage(groupId: number, content: string): Promise<any> {
	return request(`/api/community/group-chat/${groupId}/send`, { method: 'POST', body: JSON.stringify({ content }) });
}

export async function addGroupMember(groupId: number, username: string): Promise<any> {
	return request(`/api/community/group-chat/${groupId}/add-member/${username}`, { method: 'POST' });
}

// ═══════════════════════════════════════════════
// WELCOME POST
// ═══════════════════════════════════════════════

export async function createWelcomePost(username: string): Promise<any> {
	return request(`/api/community/welcome-post/${username}`, { method: 'POST' });
}

export async function openConversation(username: string): Promise<{ conversation_id: number }> {
	return request('/api/community/open-conversation/' + username, { method: 'POST' });
}

export async function updateMessagesPrivacy(value: string): Promise<any> {
	return request('/api/community/profile/update', { method: 'PATCH', body: JSON.stringify({ messages_from: value }) });
}

// Aliases for toggleRocket/toggleRepost (used by profile page)
export const rocketPost = toggleRocket;
export const repostPost = toggleRepost;

export async function getComments(postId: number): Promise<any> {
	return request('/api/community/comments/' + postId);
}

export async function bookmarkPost(postId: number): Promise<any> {
	return request('/api/community/bookmark/' + postId, { method: 'POST' });
}

export async function markConvUnread(convId: number): Promise<any> {
  return request('/api/community/conversations/' + convId + '/mark-unread', { method: 'POST' });
}

export async function markConvRead(convId: number): Promise<any> {
  return request('/api/community/messages/' + convId + '/read', { method: 'POST' });
}

export async function getMessageRequests(): Promise<any> {
  return request('/api/community/message-requests');
}


// ═══════════════════════════════════════
// WISERS: Communities
// ═══════════════════════════════════════
export async function getCommunities(page: number = 1, category: string = '', q: string = ''): Promise<any> {
  return request('/api/wisers/communities?page=' + page + (category ? '&category=' + category : '') + (q ? '&q=' + encodeURIComponent(q) : ''));
}
export async function getCommunity(slug: string): Promise<any> {
  return request('/api/wisers/communities/' + slug);
}
export async function createCommunity(data: { name: string; description?: string; category?: string; privacy?: string; rules?: string }): Promise<any> {
  return request('/api/wisers/communities', { method: 'POST', body: JSON.stringify(data) });
}
export async function joinCommunity(slug: string): Promise<any> {
  return request('/api/wisers/communities/' + slug + '/join', { method: 'POST' });
}
export async function leaveCommunity(slug: string): Promise<any> {
  return request('/api/wisers/communities/' + slug + '/leave', { method: 'POST' });
}
export async function getCommunityFeedBySlug(slug: string, page: number = 1): Promise<any> {
  return request('/api/wisers/communities/' + slug + '/feed?page=' + page);
}
export async function postToCommunity(slug: string, data: { content: string; image_url?: string; milestone_type?: string; milestone_value?: string; media_ids?: string[] }): Promise<any> {
  const body: Record<string, any> = { ...data };
  if (!body.media_ids?.length) delete body.media_ids;
  return request('/api/wisers/communities/' + slug + '/post', { method: 'POST', body: JSON.stringify(body) });
}
export async function getCommunityMembers(slug: string, page: number = 1): Promise<any> {
  return request('/api/wisers/communities/' + slug + '/members?page=' + page);
}
export async function getMyCommunities(): Promise<any> {
  return request('/api/wisers/my-communities');
}

// ═══════════════════════════════════════
// WISERS: Milestones
// ═══════════════════════════════════════
export async function createMilestone(data: { content: string; milestone_type: string; milestone_value: string; image_url?: string; community_id?: number }): Promise<any> {
  return request('/api/wisers/milestone', { method: 'POST', body: JSON.stringify(data) });
}
export async function getMilestoneFeed(page: number = 1): Promise<any> {
  return request('/api/wisers/milestones/feed?page=' + page);
}

// ═══════════════════════════════════════
// WISERS: Journey
// ═══════════════════════════════════════
export async function addJourneyEntry(data: { title: string; description?: string; entry_type?: string; metric_name?: string; metric_value?: number; metric_unit?: string; visibility?: string }): Promise<any> {
  return request('/api/wisers/journey/entries', { method: 'POST', body: JSON.stringify(data) });
}
export async function getJourney(username: string): Promise<any> {
  return request('/api/wisers/journey/' + username);
}
export async function addJourneyGoal(data: { title: string; target_value?: number; unit?: string; deadline?: string }): Promise<any> {
  return request('/api/wisers/journey/goals', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateJourneyGoal(goalId: number, data: { current_value?: number; status?: string }): Promise<any> {
  return request('/api/wisers/journey/goals/' + goalId, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteJourneyEntry(entryId: number): Promise<any> {
  return request('/api/wisers/journey/entries/' + entryId, { method: 'DELETE' });
}

// ═══════════════════════════════════════
// WISERS: Mentorship
// ═══════════════════════════════════════
export async function saveMentorshipProfile(data: { role: string; expertise?: string; looking_for?: string; experience_level?: string; monthly_revenue?: string; max_mentees?: number }): Promise<any> {
  return request('/api/wisers/mentorship/profile', { method: 'POST', body: JSON.stringify(data) });
}
export async function getMyMentorshipProfile(): Promise<any> {
  return request('/api/wisers/mentorship/profile');
}
export async function browseMentors(role: string = 'mentor', category: string = '', page: number = 1): Promise<any> {
  return request('/api/wisers/mentorship/browse?role=' + role + (category ? '&category=' + encodeURIComponent(category) : '') + '&page=' + page);
}
export async function requestMentorship(username: string, message: string = ''): Promise<any> {
  return request('/api/wisers/mentorship/request/' + username, { method: 'POST', body: JSON.stringify({ message }) });
}
export async function getMentorshipRequests(): Promise<any> {
  return request('/api/wisers/mentorship/requests');
}
export async function respondMentorship(connectionId: number, action: string): Promise<any> {
  return request('/api/wisers/mentorship/respond/' + connectionId, { method: 'POST', body: JSON.stringify({ action }) });
}

// ══════════════════════════════════════════════════════════
// DISCOVER / ALGORITHMS
// ══════════════════════════════════════════════════════════

export async function getRankedFeed(page: number = 1): Promise<any> {
  return request('/api/wisers/feed/ranked?page=' + page);
}

export async function discoverPeople(page: number = 1): Promise<any> {
  return request('/api/wisers/discover/people?page=' + page);
}

export async function discoverContent(page: number = 1): Promise<any> {
  return request('/api/wisers/discover/content?page=' + page);
}

export async function discoverMentors(page: number = 1): Promise<any> {
  return request('/api/wisers/discover/mentors?page=' + page);
}

// ══════════════════════════════════════════════════════════
// LINK PREVIEWS
// ══════════════════════════════════════════════════════════

export async function getLinkPreview(url: string): Promise<{ title?: string; description?: string; image?: string; url: string }> {
  return request('/api/community/link-preview?url=' + encodeURIComponent(url));
}

// ══════════════════════════════════════════════════════════
// COMMUNITY MANAGEMENT
// ══════════════════════════════════════════════════════════

export async function updateCommunity(slug: string, data: { name?: string; description?: string; category?: string; rules?: string; privacy?: string }): Promise<any> {
  return request('/api/wisers/communities/' + slug, { method: 'PUT', body: JSON.stringify(data) });
}

export async function uploadCommunityIcon(slug: string): Promise<{ message: string }> {
  return request(`/api/wisers/communities/${slug}/icon`, { method: 'POST' });
}

export async function uploadCommunityCover(slug: string): Promise<{ message: string }> {
  return request(`/api/wisers/communities/${slug}/cover`, { method: 'POST' });
}

export async function deleteCommunity(slug: string): Promise<any> {
  return request('/api/wisers/communities/' + slug, { method: 'DELETE' });
}

export async function updateMemberRole(slug: string, username: string, role: string): Promise<any> {
  return request('/api/wisers/communities/' + slug + '/role', { method: 'PUT', body: JSON.stringify({ username, role }) });
}

// ══════════════════════════════════════════════════════════
// LIKES LIST
// ══════════════════════════════════════════════════════════

export async function getPostLikes(postId: number): Promise<{ users: any[] }> {
  return request('/api/community/posts/' + postId + '/likes');
}

// ══════════════════════════════════════════════════════════
// LOGOUT ALL
// ══════════════════════════════════════════════════════════

export async function logoutAll(): Promise<any> {
  return request('/api/auth/logout-all', { method: 'POST' });
}


export async function sendAiCoach(message: string, history: { role: string; content: string }[]): Promise<{ reply: string }> {
	return request('/api/community/ai-coach', {
		method: 'POST',
		body: JSON.stringify({ message, history })
	});
}

// ═══════════════════════════════════════════════
// ENCRYPTION KEYS
// ═══════════════════════════════════════════════

export async function uploadEncryptionKey(publicKey: string): Promise<any> {
	return request('/api/keys/upload', { method: 'POST', body: JSON.stringify({ public_key: publicKey }) });
}
export async function getEncryptionKey(userId: string): Promise<{ public_key: string }> {
	return request(`/api/keys/${userId}`);
}
export async function backupKey(encryptedKey: string): Promise<any> {
	return request('/api/keys/backup', { method: 'POST', body: JSON.stringify({ encrypted_key: encryptedKey }) });
}
export async function getKeyBackup(): Promise<{ encrypted_key: string }> {
	return request('/api/keys/backup');
}
export async function deleteKeyBackup(): Promise<any> {
	return request('/api/keys/backup', { method: 'DELETE' });
}

export async function validateEncryptionKey(publicKey: string): Promise<{ valid: boolean; error?: string }> {
	return request('/api/keys/validate', { method: 'POST', body: JSON.stringify({ public_key: publicKey }) });
}

// ═══════════════════════════════════════════════
// GDPR
// ═══════════════════════════════════════════════

export async function getBirthdaysToday(): Promise<{ birthdays: any[]; count: number }> {
	return request('/api/community/birthdays/today');
}

export async function getPasskeyRegisterOptions(): Promise<any> {
	return request('/api/auth/passkey/register-options', { method: 'POST' });
}

export async function verifyPasskeyRegister(credential: any): Promise<any> {
	return request('/api/auth/passkey/register-verify', { method: 'POST', body: JSON.stringify(credential) });
}

export async function getBackupCodes(): Promise<{ backup_codes: string[] }> {
	return request('/api/auth/2fa/backup-codes', { method: 'POST' });
}

export async function gdprExport(): Promise<any> {
	return request('/api/gdpr/export');
}

export async function gdprDeleteRequest(password: string): Promise<any> {
	return request('/api/gdpr/delete-request', { method: 'POST', body: JSON.stringify({ password }) });
}

export async function gdprCancelDeletion(): Promise<any> {
	return request('/api/gdpr/cancel-deletion', { method: 'POST' });
}

export async function gdprDeletionStatus(): Promise<any> {
	return request('/api/gdpr/deletion-status');
}

// ══════════════════════════════════════════════════════════
// API USAGE — GET /api/usage/*
// ══════════════════════════════════════════════════════════

export async function getApiUsage(): Promise<any> {
	return request('/api/usage');
}

export async function getApiUsageHistory(days: number = 30): Promise<any> {
	return request(`/api/usage/history?days=${days}`);
}

export async function getApiUsageLogs(limit: number = 50, offset: number = 0): Promise<any> {
	return request(`/api/usage/logs?limit=${limit}&offset=${offset}`);
}

export async function getApiUsageMonthly(months: number = 12): Promise<any> {
	return request(`/api/usage/monthly?months=${months}`);
}
