import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the $env/static/public module
vi.mock('$env/static/public', () => ({
	PUBLIC_API_BASE: 'https://api-bscan.balancewises.io',
	PUBLIC_SITE_URL: 'https://bscan.balancewises.io'
}));

// Must import after mock
const api = await import('$lib/api/client');

function mockFetchSuccess(data: any) {
	(globalThis.fetch as any).mockResolvedValueOnce({
		ok: true,
		json: async () => data,
		status: 200
	});
}

function mockFetchError(status: number, detail: string) {
	(globalThis.fetch as any).mockResolvedValueOnce({
		ok: false,
		json: async () => ({ detail }),
		status
	});
}

beforeEach(() => {
	vi.mocked(globalThis.fetch).mockReset();
	localStorage.clear();
});

// ══════════════════════════════════════════════════════════
// Auth
// ══════════════════════════════════════════════════════════

describe('login', () => {
	it('sends correct request', async () => {
		mockFetchSuccess({ access_token: 'tok123', token_type: 'bearer', user: { id: '1', email: 'a@b.com' } });

		const result = await api.login('a@b.com', 'pass123');

		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, opts] = vi.mocked(fetch).mock.calls[0];
		expect(url).toContain('/api/auth/login');
		expect(opts?.method).toBe('POST');

		const body = JSON.parse(opts?.body as string);
		expect(body.email).toBe('a@b.com');
		expect(body.password).toBe('pass123');
		expect(result.access_token).toBe('tok123');
	});

	it('throws ApiError on failure', async () => {
		mockFetchError(401, 'Invalid email or password');

		await expect(api.login('bad@email.com', 'wrong')).rejects.toThrow('Invalid email or password');
	});
});

describe('register', () => {
	it('sends correct request', async () => {
		mockFetchSuccess({ access_token: 'newtok', token_type: 'bearer', user: { id: '2', email: 'new@b.com', name: 'New' } });

		const result = await api.register('new@b.com', 'pass1234', 'New');

		const [, opts] = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(opts?.body as string);
		expect(body.name).toBe('New');
		expect(result.access_token).toBe('newtok');
	});
});

describe('getMe', () => {
	it('sends auth header when token exists', async () => {
		localStorage.setItem('bscan_token', 'mytoken');
		mockFetchSuccess({ id: '1', email: 'a@b.com', plan: 'pro' });

		await api.getMe();

		const [, opts] = vi.mocked(fetch).mock.calls[0];
		expect(opts?.headers).toHaveProperty('Authorization', 'Bearer mytoken');
	});
});

// ══════════════════════════════════════════════════════════
// Scanning
// ══════════════════════════════════════════════════════════

describe('checkScanAllowance', () => {
	it('sends email in body', async () => {
		mockFetchSuccess({ can_scan: true, scans_remaining: 3, plan: 'free' });

		const result = await api.checkScanAllowance('test@test.com');

		const [, opts] = vi.mocked(fetch).mock.calls[0];
		expect(JSON.parse(opts?.body as string).email).toBe('test@test.com');
		expect(result.can_scan).toBe(true);
	});
});

describe('runScan', () => {
	it('sends url, email, business_name', async () => {
		mockFetchSuccess({ id: 'scan123', overall_score: 75, issues: [] });

		await api.runScan('https://example.com', 'a@b.com', 'Acme');

		const [url, opts] = vi.mocked(fetch).mock.calls[0];
		expect(url).toContain('/api/scan');
		const body = JSON.parse(opts?.body as string);
		expect(body.url).toBe('https://example.com');
		expect(body.email).toBe('a@b.com');
		expect(body.business_name).toBe('Acme');
	});
});

// ══════════════════════════════════════════════════════════
// Leaderboard
// ══════════════════════════════════════════════════════════

describe('getLeaderboard', () => {
	it('passes period and limit as query params', async () => {
		mockFetchSuccess({ leaderboard: [] });

		await api.getLeaderboard('month', 10);

		const [url] = vi.mocked(fetch).mock.calls[0];
		expect(url).toContain('period=month');
		expect(url).toContain('limit=10');
	});
});

// ══════════════════════════════════════════════════════════
// Billing
// ══════════════════════════════════════════════════════════

describe('createCheckout', () => {
	it('sends plan, email, interval', async () => {
		mockFetchSuccess({ checkout_url: 'https://checkout.stripe.com/c/pay/123' });

		const result = await api.createCheckout('pro', 'a@b.com', 'monthly');

		const [url, opts] = vi.mocked(fetch).mock.calls[0];
		expect(url).toContain('/api/billing/checkout/pro');
		const body = JSON.parse(opts?.body as string);
		expect(body.interval).toBe('monthly');
		expect(result.checkout_url).toContain('stripe.com');
	});
});

// ══════════════════════════════════════════════════════════
// Team
// ══════════════════════════════════════════════════════════

describe('inviteTeamMember', () => {
	it('sends email and role', async () => {
		mockFetchSuccess({ message: 'Invitation sent', status: 'pending' });

		await api.inviteTeamMember('colleague@co.com', 'admin');

		const [, opts] = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(opts?.body as string);
		expect(body.email).toBe('colleague@co.com');
		expect(body.role).toBe('admin');
	});
});

describe('acceptInvite', () => {
	it('sends token to correct endpoint', async () => {
		mockFetchSuccess({ message: 'Joined' });

		await api.acceptInvite('invite_token_123');

		const [url, opts] = vi.mocked(fetch).mock.calls[0];
		expect(url).toContain('/api/team/accept');
		expect(JSON.parse(opts?.body as string).token).toBe('invite_token_123');
	});
});

// ══════════════════════════════════════════════════════════
// Error handling
// ══════════════════════════════════════════════════════════

describe('ApiError', () => {
	it('includes status and detail', async () => {
		mockFetchError(403, 'Team management requires Agency plan.');

		try {
			await api.getTeam();
			expect.fail('Should have thrown');
		} catch (e: any) {
			expect(e.status).toBe(403);
			expect(e.detail).toBe('Team management requires Agency plan.');
		}
	});
});

// ══════════════════════════════════════════════════════════
// URL builders (no fetch)
// ══════════════════════════════════════════════════════════

describe('URL builders', () => {
	it('getScanBadgeUrl', () => {
		expect(api.getScanBadgeUrl('abc')).toContain('/api/scan/abc/badge');
	});

	it('getAchievementBadgeUrl', () => {
		expect(api.getAchievementBadgeUrl('scan1', 'ach2')).toContain('/scan1/achievement/ach2');
	});

	it('getPdfDownloadUrl', () => {
		expect(api.getPdfDownloadUrl('scan1')).toContain('/api/scan/scan1/pdf');
	});
});
