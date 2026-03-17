<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { formatDate, scoreColor } from '$lib/utils/score';
	import { safeFaviconUrl, safeGetStorage, safeSetStorage, safeRedirect, isValidEmail } from '$lib/utils/security';
	import * as api from '$lib/api/client';
	import type { ScanResult } from '$lib/types';
	import Seo from '$lib/components/ui/Seo.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	// ── Auth form state ──────────────────────────────────
	let isRegister = $state(false);
	let authEmail = $state('');
	let authPassword = $state('');
	let authName = $state('');
	let authError = $state('');
	let authLoading = $state(false);

	// ── Dashboard tabs ───────────────────────────────────
	type Tab = 'overview' | 'profile' | 'billing' | 'history' | 'api-keys' | 'security';
	let activeTab = $state<Tab>('overview');

	// ── Profile state ────────────────────────────────────
	let profileData = $state<api.ProfileData>({});
	let profileSaving = $state(false);
	let profileMsg = $state('');
	let usernameCheck = $state('');

	// ── Billing state ────────────────────────────────────
	let promoCode = $state('');
	let promoLoading = $state(false);
	let promoMsg = $state('');
	let promoError = $state('');
	let portalLoading = $state(false);

	// ── History state ────────────────────────────────────
	let historyItems = $state<ScanResult[]>([]);
	let historyLoading = $state(false);
	let historyCursor = $state<string | null>(null);
	let historyHasMore = $state(false);

	// ── API Keys state ───────────────────────────────────
	let apiKeys = $state<any[]>([]);
	let newKeyName = $state('');
	let newKeyResult = $state<string | null>(null);

	// ── Password state ───────────────────────────────────
	let pwCurrent = $state('');
	let pwNew = $state('');
	let pwConfirm = $state('');
	let pwError = $state('');
	let pwSuccess = $state('');

	const user = $derived($auth.user);
	const plan = $derived(user?.plan || 'free');
	const planLabel = $derived(plan.charAt(0).toUpperCase() + plan.slice(1));
	const isPaid = $derived(plan === 'pro' || plan === 'agency');
	const isAgency = $derived(plan === 'agency');

	onMount(() => {
		const saved = safeGetStorage('bscan_email');
		if (saved) authEmail = saved;
		if (user) loadDashboard();
	});

	// Watch for auth changes
	$effect(() => {
		if (user && activeTab === 'overview') loadDashboard();
	});

	async function loadDashboard() {
		loadHistory();
		if (isPaid) loadApiKeys();
	}

	// ── Auth ─────────────────────────────────────────────
	function getDomain(url: string | undefined): string {
		if (!url) return '';
		return url.replace('https://', '').replace('http://', '').split('/')[0];
	}

	async function handleAuth() {
		authError = '';
		if (!authEmail || !authPassword) { authError = 'Fill in all fields.'; return; }
		if (isRegister && !authName) { authError = 'Name is required.'; return; }
		authLoading = true;
		try {
			if (isRegister) {
				await auth.register(authEmail, authPassword, authName);
			} else {
				await auth.login(authEmail, authPassword);
			}
			loadDashboard();
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Authentication failed.';
		}
		authLoading = false;
	}

	// ── Profile ──────────────────────────────────────────
	async function saveProfile() {
		if (!user) return;
		profileSaving = true;
		profileMsg = '';
		try {
			await api.updateProfile(user.email, profileData);
			profileMsg = 'Profile updated!';
			auth.refresh();
		} catch (err) {
			profileMsg = err instanceof Error ? err.message : 'Failed.';
		}
		profileSaving = false;
	}

	async function handleUsernameCheck() {
		const u = profileData.username?.trim();
		if (!u || u.length < 3) { usernameCheck = ''; return; }
		try {
			const res = await api.checkUsername(u);
			usernameCheck = res.available ? '✓ Available' : `✗ ${res.reason || 'Taken'}`;
		} catch { usernameCheck = ''; }
	}

	// ── Billing ──────────────────────────────────────────
	async function redeemPromo() {
		promoError = ''; promoMsg = '';
		if (!promoCode.trim()) return;
		promoLoading = true;
		try {
			const res = await api.redeemPromo(promoCode.trim());
			promoMsg = res.message;
			promoCode = '';
			auth.refresh();
		} catch (err) {
			promoError = err instanceof Error ? err.message : 'Invalid code.';
		}
		promoLoading = false;
	}

	async function openBillingPortal() {
		portalLoading = true;
		try {
			const res = await api.createBillingPortal();
			const safe = safeRedirect(res.url);
			if (safe) window.location.href = safe;
		} catch { }
		portalLoading = false;
	}

	// ── History ──────────────────────────────────────────
	async function loadHistory() {
		historyLoading = true;
		try {
			const res = await api.getScanHistory(undefined, 20);
			historyItems = res.items || [];
			historyCursor = res.next_cursor;
			historyHasMore = res.has_more;
		} catch { historyItems = []; }
		historyLoading = false;
	}

	async function loadMoreHistory() {
		if (!historyCursor) return;
		historyLoading = true;
		try {
			const res = await api.getScanHistory(historyCursor, 20);
			historyItems = [...historyItems, ...(res.items || [])];
			historyCursor = res.next_cursor;
			historyHasMore = res.has_more;
		} catch { }
		historyLoading = false;
	}

	// ── API Keys ─────────────────────────────────────────
	async function loadApiKeys() {
		try { apiKeys = await api.listApiKeys(); } catch { apiKeys = []; }
	}

	async function createKey() {
		if (!newKeyName.trim()) return;
		try {
			const res = await api.createApiKey(newKeyName);
			newKeyResult = res.key || res.api_key || JSON.stringify(res);
			newKeyName = '';
			loadApiKeys();
		} catch { }
	}

	async function revokeKey(id: string) {
		if (!confirm('Revoke this API key? This cannot be undone.')) return;
		try { await api.revokeApiKey(id); loadApiKeys(); } catch { }
	}

	// ── Password ─────────────────────────────────────────
	async function changePassword() {
		pwError = ''; pwSuccess = '';
		if (!pwCurrent || !pwNew || !pwConfirm) { pwError = 'All fields required.'; return; }
		if (pwNew.length < 8) { pwError = 'Must be 8+ characters.'; return; }
		if (pwNew !== pwConfirm) { pwError = 'Passwords do not match.'; return; }
		try {
			await api.changePassword(pwCurrent, pwNew);
			pwSuccess = 'Password changed successfully!';
			pwCurrent = ''; pwNew = ''; pwConfirm = '';
		} catch (err) {
			pwError = err instanceof Error ? err.message : 'Failed.';
		}
	}

	function kd(e: KeyboardEvent) { if (e.key === 'Enter') handleAuth(); }

	const tabs: Array<{ key: Tab; label: string; icon: string; show?: () => boolean }> = [
		{ key: 'overview', label: 'Overview', icon: '📊' },
		{ key: 'profile', label: 'Profile', icon: '👤' },
		{ key: 'billing', label: 'Billing', icon: '💳' },
		{ key: 'history', label: 'History', icon: '📋' },
		{ key: 'api-keys', label: 'API Keys', icon: '🔑', show: () => isPaid },
		{ key: 'security', label: 'Security', icon: '🔒' },
	];
</script>

<Seo title="Account" description="Sign in to your BSCAN account. View scan history, manage your subscription, edit your profile, and access API keys." />

<div class="container-narrow">

{#if !$auth.loading && !user}
	<!-- ══════ AUTH FORM ══════ -->
	<div class="auth-section animate-fade-up">
		<h2>{isRegister ? 'Create your' : 'Sign in to your'} <span class="text-gold">account</span></h2>
		<p class="text-secondary" style="margin-bottom: 24px;">
			{isRegister ? 'Start tracking your website health.' : 'Access your dashboard, scan history, and settings.'}
		</p>

		{#if isRegister}
			<div class="field">
				<label class="label" for="a-name">Full name *</label>
				<input class="input" type="text" id="a-name" placeholder="Your name" bind:value={authName} onkeydown={kd} />
			</div>
		{/if}

		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-email">Email address *</label>
			<input class="input" type="email" id="a-email" placeholder="you@company.com" autocomplete="email" bind:value={authEmail} onkeydown={kd} />
		</div>

		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-pw">Password *</label>
			<input class="input" type="password" id="a-pw" placeholder="Minimum 8 characters" bind:value={authPassword} onkeydown={kd} />
		</div>

		{#if authError}<div class="msg-error">{authError}</div>{/if}

		<button class="btn btn-gold" style="width: 100%; margin-top: 16px;" disabled={authLoading} onclick={handleAuth}>
			{#if authLoading}<span class="spinner spinner-sm"></span>{/if}
			{isRegister ? 'Create Account' : 'Sign In'}
		</button>

		<div class="auth-toggle">
			<span class="text-muted">{isRegister ? 'Already have an account?' : "Don't have an account?"}</span>
			<button class="toggle-link" onclick={() => { isRegister = !isRegister; authError = ''; }}>
				{isRegister ? 'Sign in' : 'Create one'}
			</button>
		</div>

		<div style="text-align: center; margin-top: 8px;">
			<button class="toggle-link" style="font-size: 12px; color: var(--clr-text-muted);" onclick={() => {}}>
				Forgot password?
			</button>
		</div>
	</div>

{:else if $auth.loading}
	<div style="max-width: 600px; margin: var(--space-xl) auto;">
		<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
			<Skeleton variant="circle" width="52px" />
			<div style="flex: 1;">
				<Skeleton variant="bar" width="40%" height="20px" />
				<div style="height: 8px;"></div>
				<Skeleton variant="bar" width="60%" height="14px" />
			</div>
		</div>
		<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
			<Skeleton variant="card" />
			<Skeleton variant="card" />
			<Skeleton variant="card" />
		</div>
		<Skeleton lines={5} />
	</div>

{:else if user}
	<!-- ══════ DASHBOARD ══════ -->
	<div class="dashboard animate-fade-up">

		<!-- Header -->
		<div class="dash-header">
			<div class="dash-avatar">{(user.name || user.email)[0].toUpperCase()}</div>
			<div class="dash-info">
				<h2>{user.name || 'User'}</h2>
				<p class="text-muted">{user.email}</p>
			</div>
			<div class="dash-actions">
				<span class="plan-badge {plan}">{planLabel}</span>
				<button class="btn btn-outline btn-sm" onclick={() => auth.logout()}>Sign Out</button>
			</div>
		</div>

		<!-- Tab Navigation -->
		<div class="tabs-row">
			{#each tabs as tab}
				{#if !tab.show || tab.show()}
					<button class="dash-tab" class:active={activeTab === tab.key} onclick={() => activeTab = tab.key}>
						<span class="tab-icon">{tab.icon}</span>
						<span class="tab-label">{tab.label}</span>
					</button>
				{/if}
			{/each}
		</div>

		<!-- ── OVERVIEW TAB ─────────────────────── -->
		{#if activeTab === 'overview'}
			<div class="tab-content animate-fade-up">
				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-label">Plan</div>
						<div class="stat-value"><span class="plan-badge {plan}">{planLabel}</span></div>
						{#if !isPaid}
							<button class="btn btn-gold btn-sm" style="margin-top: 8px;" onclick={() => activeTab = 'billing'}>Upgrade →</button>
						{/if}
					</div>
					<div class="stat-card">
						<div class="stat-label">Scans this month</div>
						<div class="stat-value">{user.scans_this_month}</div>
						<div class="stat-sub text-muted">
							{#if plan === 'free' || plan === 'guest'}of 3 free{:else if plan === 'pro'}of 30{:else}unlimited{/if}
						</div>
					</div>
					<div class="stat-card">
						<div class="stat-label">Member since</div>
						<div class="stat-value" style="font-size: 16px;">{formatDate(user.created_at)}</div>
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="quick-actions">
					<a href="/" class="action-card">
						<span class="action-icon">🔍</span>
						<span>New Scan</span>
					</a>
					<a href="/compare" class="action-card">
						<span class="action-icon">⚔️</span>
						<span>Compare</span>
					</a>
					<a href="/seo" class="action-card">
						<span class="action-icon">📊</span>
						<span>SEO Tools</span>
					</a>
					<a href="/team" class="action-card">
						<span class="action-icon">👥</span>
						<span>Team</span>
					</a>
				</div>

				<!-- Recent Scans Preview -->
				{#if historyItems.length > 0}
					<div class="card" style="margin-top: 20px;">
						<div class="card-header">
							<span>📋</span>
							<span style="font-weight: 700; font-size: 14px;">Recent Scans</span>
							<button class="btn btn-ghost btn-sm" style="margin-left: auto;" onclick={() => activeTab = 'history'}>View All →</button>
						</div>
						<div class="card-body" style="padding: 0;">
							{#each historyItems.slice(0, 5) as s}
								<div class="history-row">
									<img class="favicon" src={safeFaviconUrl(getDomain(s.url))} alt="" />
									<div class="history-url font-mono">{s.url?.replace('https://', '').replace('http://', '').split('/')[0] || '—'}</div>
									<div class="history-score font-mono" style="color: {scoreColor(s.overall_score || 0)};">{s.overall_score}</div>
									<div class="history-date text-muted">{s.created_at ? formatDate(s.created_at) : ''}</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ── PROFILE TAB ──────────────────────── -->
		{#if activeTab === 'profile'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">Edit Profile</h3>
				<div class="form-grid">
					<div class="field">
						<label class="label" for="p-username">Username</label>
						<input class="input" type="text" id="p-username" placeholder="e.g. chisom_bw" bind:value={profileData.username} oninput={handleUsernameCheck} />
						{#if usernameCheck}
							<span class="field-hint" class:hint-ok={usernameCheck.startsWith('✓')} class:hint-err={usernameCheck.startsWith('✗')}>{usernameCheck}</span>
						{/if}
					</div>
					<div class="field">
						<label class="label" for="p-display">Display Name</label>
						<input class="input" type="text" id="p-display" placeholder="How you appear to others" bind:value={profileData.display_name} />
					</div>
					<div class="field">
						<label class="label" for="p-company">Company</label>
						<input class="input" type="text" id="p-company" placeholder="e.g. Balancewise Technologies" bind:value={profileData.company} />
					</div>
					<div class="field">
						<label class="label" for="p-website">Website</label>
						<input class="input" type="url" id="p-website" placeholder="https://yoursite.com" bind:value={profileData.website} />
					</div>
					<div class="field">
						<label class="label" for="p-phone">Phone</label>
						<input class="input" type="tel" id="p-phone" placeholder="+44..." bind:value={profileData.phone} />
					</div>
					<div class="field">
						<label class="label" for="p-city">City</label>
						<input class="input" type="text" id="p-city" bind:value={profileData.city} />
					</div>
					<div class="field">
						<label class="label" for="p-postcode">Postcode</label>
						<input class="input" type="text" id="p-postcode" bind:value={profileData.postcode} />
					</div>
					<div class="field">
						<label class="label" for="p-country">Country</label>
						<input class="input" type="text" id="p-country" bind:value={profileData.country} />
					</div>
				</div>
				<div class="field" style="margin-top: 12px;">
					<label class="label" for="p-bio">Bio</label>
					<textarea class="input" id="p-bio" rows="3" placeholder="Tell us about yourself..." bind:value={profileData.bio} style="resize: vertical;"></textarea>
				</div>

				{#if profileMsg}<div class="msg-success">{profileMsg}</div>{/if}

				<button class="btn btn-gold" style="margin-top: 16px;" disabled={profileSaving} onclick={saveProfile}>
					{#if profileSaving}<span class="spinner spinner-sm"></span>{/if} Save Profile
				</button>
			</div>
		{/if}

		<!-- ── BILLING TAB ──────────────────────── -->
		{#if activeTab === 'billing'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">Billing & Plan</h3>

				<!-- Current Plan -->
				<div class="card" style="margin-bottom: 20px;">
					<div class="card-body">
						<div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
							<div>
								<div class="text-muted" style="font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px;">Current Plan</div>
								<div style="font-size: 28px; font-weight: 800;">{planLabel}</div>
							</div>
							<div style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap;">
								{#if !isPaid}
									<button class="btn btn-gold" onclick={() => ui.openCheckout('pro')}>Upgrade to Pro — £9/mo</button>
									<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Go Agency — £29/mo</button>
								{:else if plan === 'pro'}
									<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Upgrade to Agency</button>
									<button class="btn btn-outline" disabled={portalLoading} onclick={openBillingPortal}>
										{#if portalLoading}<span class="spinner spinner-sm"></span>{/if} Manage Subscription
									</button>
								{:else}
									<button class="btn btn-outline" disabled={portalLoading} onclick={openBillingPortal}>
										{#if portalLoading}<span class="spinner spinner-sm"></span>{/if} Manage Subscription
									</button>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Plan Comparison -->
				{#if !isPaid}
					<div class="plan-compare">
						<div class="compare-col">
							<div class="compare-header free">Free</div>
							<div class="compare-feat">3 scans/month</div>
							<div class="compare-feat">Basic audit</div>
							<div class="compare-feat dim">No PDF export</div>
							<div class="compare-feat dim">No history</div>
						</div>
						<div class="compare-col featured">
							<div class="compare-header pro">Pro · £9/mo</div>
							<div class="compare-feat">30 scans/month</div>
							<div class="compare-feat">Core Web Vitals</div>
							<div class="compare-feat">PDF reports</div>
							<div class="compare-feat">Scan history</div>
							<div class="compare-feat">Compare tool</div>
							<button class="btn btn-gold btn-sm" style="margin-top: 12px;" onclick={() => ui.openCheckout('pro')}>Upgrade</button>
						</div>
						<div class="compare-col">
							<div class="compare-header agency">Agency · £29/mo</div>
							<div class="compare-feat">Unlimited scans</div>
							<div class="compare-feat">5 team members</div>
							<div class="compare-feat">API access</div>
							<div class="compare-feat">White-label PDFs</div>
							<div class="compare-feat">AI SEO strategy</div>
							<button class="btn btn-blue btn-sm" style="margin-top: 12px;" onclick={() => ui.openCheckout('agency')}>Upgrade</button>
						</div>
					</div>
				{/if}

				<!-- Promo Code -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>🎁</span>
						<span style="font-weight: 700; font-size: 14px;">Promo Code</span>
					</div>
					<div class="card-body">
						<div style="display: flex; gap: 8px;">
							<input class="input" type="text" placeholder="Enter code..." bind:value={promoCode} style="flex: 1; text-transform: uppercase;" onkeydown={(e) => e.key === 'Enter' && redeemPromo()} />
							<button class="btn btn-gold" disabled={promoLoading} onclick={redeemPromo}>
								{#if promoLoading}<span class="spinner spinner-sm"></span>{:else}Redeem{/if}
							</button>
						</div>
						{#if promoMsg}<div class="msg-success">{promoMsg}</div>{/if}
						{#if promoError}<div class="msg-error">{promoError}</div>{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── HISTORY TAB ──────────────────────── -->
		{#if activeTab === 'history'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">Scan History</h3>

				{#if !isPaid}
					<div class="upgrade-banner">
						<span>🔒</span>
						<span>Scan history is a Pro feature. <button class="toggle-link" onclick={() => ui.openCheckout('pro')}>Upgrade to Pro →</button></span>
					</div>
				{/if}

				{#if historyLoading && historyItems.length === 0}
					<div class="card"><div class="card-body" style="padding: 0;">
						{#each Array(5) as _}
							<div style="display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--clr-border);">
								<Skeleton variant="circle" width="16px" />
								<div style="flex: 1;"><Skeleton variant="bar" width="70%" height="13px" /></div>
								<Skeleton variant="bar" width="32px" height="18px" />
								<Skeleton variant="bar" width="60px" height="11px" />
							</div>
						{/each}
					</div></div>
				{:else if historyItems.length === 0}
					<div class="empty-state">
						<p class="text-muted">No scans yet. <a href="/">Run your first scan →</a></p>
					</div>
				{:else}
					<div class="card">
						<div class="card-body" style="padding: 0;">
							{#each historyItems as s}
								<div class="history-row">
									<img class="favicon" src={safeFaviconUrl(getDomain(s.url))} alt="" />
									<div class="history-url font-mono">{s.url?.replace('https://', '').replace('http://', '').split('/')[0] || '—'}</div>
									<div class="history-score font-mono" style="color: {scoreColor(s.overall_score || 0)};">{s.overall_score}</div>
									<div class="history-date text-muted">{s.created_at ? formatDate(s.created_at) : ''}</div>
									{#if isPaid && s.id}
										<a href={api.getPdfDownloadUrl(s.id)} target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm">PDF</a>
									{/if}
								</div>
							{/each}
						</div>
					</div>
					{#if historyHasMore}
						<div style="text-align: center; margin-top: 16px;">
							<button class="btn btn-outline" disabled={historyLoading} onclick={loadMoreHistory}>
								{#if historyLoading}<span class="spinner spinner-sm"></span>{/if} Load More
							</button>
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- ── API KEYS TAB ─────────────────────── -->
		{#if activeTab === 'api-keys'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">API Keys</h3>

				<div class="card" style="margin-bottom: 20px;">
					<div class="card-header">
						<span>➕</span>
						<span style="font-weight: 700; font-size: 14px;">Create New Key</span>
					</div>
					<div class="card-body">
						<div style="display: flex; gap: 8px;">
							<input class="input" type="text" placeholder="Key name (e.g. Production)" bind:value={newKeyName} onkeydown={(e) => e.key === 'Enter' && createKey()} style="flex: 1;" />
							<button class="btn btn-gold" onclick={createKey}>Create</button>
						</div>
						{#if newKeyResult}
							<div class="key-reveal">
								<div class="text-muted" style="font-size: 11px; margin-bottom: 4px;">Your new API key (copy it now — it won't be shown again):</div>
								<code class="key-code">{newKeyResult}</code>
								<button class="btn btn-outline btn-sm" style="margin-top: 8px;" onclick={() => { navigator.clipboard.writeText(newKeyResult || ''); }}>Copy</button>
							</div>
						{/if}
					</div>
				</div>

				<div class="card">
					<div class="card-header">
						<span>🔑</span>
						<span style="font-weight: 700; font-size: 14px;">Active Keys</span>
					</div>
					<div class="card-body" style="padding: 0;">
						{#if apiKeys.length === 0}
							<div class="empty-state"><p class="text-muted">No API keys yet.</p></div>
						{:else}
							{#each apiKeys as key}
								<div class="key-row">
									<div>
										<div style="font-weight: 600; font-size: 13px;">{key.name || 'Unnamed'}</div>
										<div class="text-muted font-mono" style="font-size: 11px;">{key.prefix || key.id}...</div>
									</div>
									<button class="btn btn-ghost btn-sm" style="color: var(--clr-danger);" onclick={() => revokeKey(key.id)}>Revoke</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── SECURITY TAB ─────────────────────── -->
		{#if activeTab === 'security'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">Security</h3>
				<div class="card">
					<div class="card-header">
						<span>🔒</span>
						<span style="font-weight: 700; font-size: 14px;">Change Password</span>
					</div>
					<div class="card-body">
						<div class="field">
							<label class="label" for="s-current">Current Password</label>
							<input class="input" type="password" id="s-current" bind:value={pwCurrent} />
						</div>
						<div class="field" style="margin-top: 12px;">
							<label class="label" for="s-new">New Password</label>
							<input class="input" type="password" id="s-new" placeholder="Minimum 8 characters" bind:value={pwNew} />
						</div>
						<div class="field" style="margin-top: 12px;">
							<label class="label" for="s-confirm">Confirm New Password</label>
							<input class="input" type="password" id="s-confirm" bind:value={pwConfirm} />
						</div>
						{#if pwError}<div class="msg-error">{pwError}</div>{/if}
						{#if pwSuccess}<div class="msg-success">{pwSuccess}</div>{/if}
						<button class="btn btn-gold" style="margin-top: 16px;" onclick={changePassword}>Update Password</button>
					</div>
				</div>
			</div>
		{/if}

	</div>
{/if}

</div>

<style>
	/* ── Auth ──────────────────────────────── */
	.auth-section { max-width: 400px; margin: var(--space-xl) auto; text-align: center; }
	.field { text-align: left; }
	.auth-toggle { margin-top: 16px; font-size: 13px; text-align: center; }
	.toggle-link { background: none; border: none; color: var(--clr-gold); cursor: pointer; font-family: inherit; font-weight: 600; font-size: 13px; margin-left: 4px; }
	.loading-state { text-align: center; padding: var(--space-2xl); }

	.msg-error { margin-top: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--clr-danger-dim); color: var(--clr-danger); font-size: 12px; border: 1px solid rgba(239,68,68,0.2); }
	.msg-success { margin-top: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--clr-success-dim); color: var(--clr-success); font-size: 12px; }

	/* ── Dashboard ─────────────────────────── */
	.dashboard { margin-top: var(--space-md); }

	.dash-header { display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg); flex-wrap: wrap; }
	.dash-avatar { width: 52px; height: 52px; border-radius: var(--radius-lg); background: var(--clr-gold-dim); border: 2px solid rgba(240,165,0,0.3); color: var(--clr-gold); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; flex-shrink: 0; }
	.dash-info { flex: 1; min-width: 0; }
	.dash-info h2 { font-size: 20px; }
	.dash-actions { display: flex; align-items: center; gap: 8px; }

	.plan-badge { display: inline-block; padding: 3px 12px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; }
	.plan-badge.free, .plan-badge.guest { background: var(--clr-border); color: var(--clr-text-secondary); }
	.plan-badge.pro { background: var(--clr-gold-dim); color: var(--clr-gold); }
	.plan-badge.agency { background: var(--clr-blue-dim); color: var(--clr-blue); }

	/* ── Tabs ──────────────────────────────── */
	.tabs-row { display: flex; gap: 2px; margin-bottom: var(--space-lg); background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 4px; overflow-x: auto; }
	.dash-tab { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: var(--radius-md); font-size: 12px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; background: transparent; color: var(--clr-text-muted); transition: all var(--duration-fast); white-space: nowrap; }
	.dash-tab.active { background: var(--clr-blue); color: white; }
	.dash-tab:hover:not(.active) { color: var(--clr-text-primary); background: rgba(255,255,255,0.04); }
	.tab-icon { font-size: 14px; }
	.tab-content { min-height: 200px; }

	/* ── Stats ─────────────────────────────── */
	.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: var(--space-lg); }
	.stat-card { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: var(--space-md); }
	.stat-label { font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
	.stat-value { font-size: 22px; font-weight: 700; }
	.stat-sub { font-size: 11px; margin-top: 2px; }

	/* ── Quick Actions ─────────────────────── */
	.quick-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
	.action-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); text-decoration: none; color: var(--clr-text-secondary); font-size: 13px; font-weight: 500; transition: all var(--duration-fast); }
	.action-card:hover { border-color: var(--clr-border-light); transform: translateY(-2px); color: var(--clr-text-primary); }
	.action-icon { font-size: 22px; }

	/* ── History ───────────────────────────── */
	.history-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--clr-border); }
	.history-row:last-child { border-bottom: none; }
	.favicon { width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0; }
	.history-url { flex: 1; font-size: 13px; color: var(--clr-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
	.history-score { font-size: 18px; font-weight: 800; flex-shrink: 0; }
	.history-date { font-size: 11px; flex-shrink: 0; }

	.empty-state { padding: var(--space-xl); text-align: center; }
	.upgrade-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--clr-gold-dim); border: 1px solid rgba(240,165,0,0.2); border-radius: var(--radius-md); font-size: 13px; margin-bottom: var(--space-md); }

	/* ── Profile Form ─────────────────────── */
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.field-hint { font-size: 11px; margin-top: 4px; display: block; }
	.hint-ok { color: var(--clr-success); }
	.hint-err { color: var(--clr-danger); }

	/* ── Plan Comparison ──────────────────── */
	.plan-compare { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
	.compare-col { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 16px; text-align: center; }
	.compare-col.featured { border-color: var(--clr-gold); box-shadow: var(--shadow-glow-gold); }
	.compare-header { font-weight: 700; font-size: 14px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--clr-border); }
	.compare-header.pro { color: var(--clr-gold); }
	.compare-header.agency { color: var(--clr-blue); }
	.compare-feat { font-size: 12px; color: var(--clr-text-secondary); padding: 3px 0; }
	.compare-feat.dim { color: var(--clr-text-muted); opacity: 0.5; }

	/* ── API Keys ─────────────────────────── */
	.key-reveal { margin-top: 12px; padding: 12px; background: var(--clr-bg-primary); border: 1px solid var(--clr-border); border-radius: var(--radius-md); }
	.key-code { display: block; font-family: var(--font-mono); font-size: 12px; color: var(--clr-gold); word-break: break-all; padding: 8px; background: var(--clr-bg-deep); border-radius: var(--radius-sm); margin-top: 4px; }
	.key-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--clr-border); }
	.key-row:last-child { border-bottom: none; }

	textarea.input { font-family: inherit; }

	@media (max-width: 640px) {
		.form-grid { grid-template-columns: 1fr; }
		.plan-compare { grid-template-columns: 1fr; }
		.dash-header { gap: var(--space-sm); }
		.dash-actions { width: 100%; justify-content: flex-end; }
		.tabs-row { gap: 0; }
		.tab-label { display: none; }
		.dash-tab { padding: 10px 12px; }
	}
</style>
