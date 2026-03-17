import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_BASE: 'https://api-bscan.balancewises.io',
	PUBLIC_SITE_URL: 'https://bscan.balancewises.io'
}));

vi.mock('$lib/api/client', () => ({
	login: vi.fn(),
	register: vi.fn(),
	getMe: vi.fn()
}));

const apiMock = await import('$lib/api/client');
const { auth } = await import('$lib/stores/auth');

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	auth.logout();
});

describe('auth store', () => {
	it('starts with no user', () => {
		const s = get(auth);
		expect(s.user).toBeNull();
		expect(s.isLoggedIn).toBe(false);
		expect(s.plan).toBe('guest');
		expect(s.isPaid).toBe(false);
	});

	it('login sets user and token', async () => {
		const mockUser = { id: '1', email: 'a@b.com', name: 'Test', plan: 'pro', scans_this_month: 5, created_at: '2026-01-01' };
		vi.mocked(apiMock.login).mockResolvedValueOnce({
			access_token: 'tok_abc',
			token_type: 'bearer',
			user: mockUser as any
		});

		await auth.login('a@b.com', 'pass');

		const s = get(auth);
		expect(s.user).toEqual(mockUser);
		expect(s.isLoggedIn).toBe(true);
		expect(s.plan).toBe('pro');
		expect(s.isPaid).toBe(true);
		expect(localStorage.getItem('bscan_token')).toBe('tok_abc');
		expect(localStorage.getItem('bscan_email')).toBe('a@b.com');
	});

	it('register sets user and token', async () => {
		const mockUser = { id: '2', email: 'new@b.com', name: 'New', plan: 'free', scans_this_month: 0, created_at: '2026-03-15' };
		vi.mocked(apiMock.register).mockResolvedValueOnce({
			access_token: 'tok_new',
			token_type: 'bearer',
			user: mockUser as any
		});

		await auth.register('new@b.com', 'pass1234', 'New');

		const s = get(auth);
		expect(s.user).toEqual(mockUser);
		expect(s.isPaid).toBe(false);
	});

	it('logout clears everything', async () => {
		vi.mocked(apiMock.login).mockResolvedValueOnce({
			access_token: 'tok',
			token_type: 'bearer',
			user: { id: '1', email: 'a@b.com', plan: 'pro' } as any
		});
		await auth.login('a@b.com', 'pass');
		expect(get(auth).isLoggedIn).toBe(true);

		auth.logout();

		const s = get(auth);
		expect(s.user).toBeNull();
		expect(s.isLoggedIn).toBe(false);
		expect(localStorage.getItem('bscan_token')).toBeNull();
		expect(localStorage.getItem('bscan_email')).toBeNull();
	});

	it('isAgency is true only for agency plan', async () => {
		vi.mocked(apiMock.login).mockResolvedValueOnce({
			access_token: 'tok',
			token_type: 'bearer',
			user: { id: '1', email: 'a@b.com', plan: 'agency' } as any
		});
		await auth.login('a@b.com', 'pass');

		const s = get(auth);
		expect(s.isAgency).toBe(true);
		expect(s.isPaid).toBe(true);
	});

	it('init restores session from localStorage', async () => {
		localStorage.setItem('bscan_token', 'saved_tok');
		vi.mocked(apiMock.getMe).mockResolvedValueOnce({
			id: '1', email: 'saved@b.com', plan: 'free', scans_this_month: 1, created_at: '2026-01-01'
		} as any);

		await auth.init();

		const s = get(auth);
		expect(s.isLoggedIn).toBe(true);
		expect(s.user?.email).toBe('saved@b.com');
	});

	it('init clears invalid token', async () => {
		localStorage.setItem('bscan_token', 'expired_tok');
		vi.mocked(apiMock.getMe).mockRejectedValueOnce(new Error('401'));

		await auth.init();

		expect(get(auth).user).toBeNull();
		expect(localStorage.getItem('bscan_token')).toBeNull();
	});
});
