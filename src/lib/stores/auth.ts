import { writable, derived } from 'svelte/store';
import type { User, Plan } from '$lib/types';
import { safeGetStorage, safeSetStorage, safeRemoveStorage } from '$lib/utils/security';
import * as api from '$lib/api/client';

const _user = writable<User | null>(null);
const _token = writable<string | null>(null);
const _loading = writable(true);

// Combined derived store — this is what $auth reads from
const _store = derived(
	[_user, _token, _loading],
	([$user, $token, $loading]) => ({
		user: $user,
		token: $token,
		loading: $loading,
		isLoggedIn: $user !== null,
		plan: ($user?.plan ?? 'guest') as Plan,
		isPaid: $user?.plan === 'pro' || $user?.plan === 'agency',
		isAgency: $user?.plan === 'agency'
	})
);

async function init() {
	if (typeof window === 'undefined') { _loading.set(false); return; }
	const savedToken = safeGetStorage('bscan_token');
	if (!savedToken) { _loading.set(false); return; }
	_token.set(savedToken);
	try {
		const me = await api.getMe();
		_user.set(me);
	} catch {
		safeRemoveStorage('bscan_token');
		_token.set(null);
	}
	_loading.set(false);
}

async function login(email: string, password: string) {
	const result = await api.login(email, password);
	safeSetStorage('bscan_token', result.access_token);
	safeSetStorage('bscan_email', email);
	_token.set(result.access_token);
	_user.set(result.user);
	return result;
}

async function register(email: string, password: string, name: string, referral_code: string = '', verification_code: string = '') {
	const result = await api.register(email, password, name, referral_code, verification_code);
	if (result.access_token) {
		safeSetStorage('bscan_token', result.access_token);
		safeSetStorage('bscan_email', email);
		_token.set(result.access_token);
		_user.set(result.user);
	}
	return result;
}

function logout() {
	safeRemoveStorage('bscan_token');
	safeRemoveStorage('bscan_email');
	safeRemoveStorage('bscan_name');
	_token.set(null);
	_user.set(null);
}

async function refresh() {
	try {
		const me = await api.getMe();
		_user.set(me);
	} catch {
		logout();
	}
}

export const auth = {
	subscribe: _store.subscribe,
	init,
	login,
	register,
	logout,
	refresh
};
