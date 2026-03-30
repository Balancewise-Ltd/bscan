<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import * as api from '$lib/api/client';
	import { auth } from '$lib/stores/auth';

	let profile = $state<any>(null);
	let status = $state('');
	let loading = $state(true);
	let error = $state('');
	let actionMsg = $state('');

	$effect(() => {
		const username = $page.params.username;
		if (username) loadProfile(username);
	});

	async function loadProfile(username: string) {
		loading = true;
		error = '';
		try {
			profile = await api.getCommunityProfile(username);
			if ($auth.token) {
				const s = await api.getFriendshipStatus(username).catch(() => ({ status: 'none' }));
				status = s.status;
			}
		} catch (e: any) {
			error = e.message || 'User not found';
		}
		loading = false;
	}

	async function addFriend() {
		try {
			const res = await api.sendFriendRequest(profile.username);
			actionMsg = res.message;
			status = res.status === 'accepted' ? 'friends' : 'request_sent';
		} catch (e: any) { actionMsg = e.message; }
	}

	async function removeFriend() {
		if (!confirm('Unfriend @' + profile.username + '?')) return;
		try {
			await api.unfriend(profile.username);
			status = 'none';
		} catch {}
	}
</script>

<svelte:head>
	<title>{profile?.username ? '@' + profile.username : 'Profile'} — BSCAN Wisers</title>
</svelte:head>

<div class="profile-page">
	{#if loading}
		<div class="loading">Loading profile...</div>
	{:else if error}
		<div class="error-state">
			<p>{error}</p>
			<a href="/wisers">Back to Wisers</a>
		</div>
	{:else if profile}
		<div class="profile-card">
			<div class="profile-header">
				<div class="profile-avatar">{(profile.display_name || profile.name || '?')[0].toUpperCase()}</div>
				<div>
					<h1 class="profile-username">@{profile.username}</h1>
					<div class="profile-realname">{profile.display_name || profile.name}</div>
					<span class="plan-badge">{profile.plan}</span>
				</div>
			</div>

			{#if profile.bio}
				<p class="profile-bio">{profile.bio}</p>
			{/if}

			<div class="profile-meta">
				{#if profile.company}<span>{profile.company}</span>{/if}
				{#if profile.city || profile.country}<span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>{/if}
				{#if profile.website}<a href={profile.website} target="_blank" rel="noopener">{profile.website}</a>{/if}
			</div>

			<div class="profile-stats">
				<div class="stat">
					<div class="stat-num">{profile.stats.total_scans}</div>
					<div class="stat-label">Scans</div>
				</div>
				<div class="stat">
					<div class="stat-num">{profile.stats.avg_score}</div>
					<div class="stat-label">Avg Score</div>
				</div>
				<div class="stat">
					<div class="stat-num">{profile.stats.friends}</div>
					<div class="stat-label">Friends</div>
				</div>
			</div>

			{#if $auth.token && status !== 'self'}
				<div class="profile-action">
					{#if status === 'friends'}
						<button class="btn-friends" onclick={removeFriend}>Friends ✓</button>
					{:else if status === 'request_sent'}
						<button class="btn-pending" disabled>Request Sent</button>
					{:else if status === 'request_received'}
						<button class="btn-accept-profile" onclick={addFriend}>Accept Request</button>
					{:else}
						<button class="btn-add" onclick={addFriend}>Add Friend</button>
					{/if}
					{#if actionMsg}<span class="action-msg">{actionMsg}</span>{/if}
				</div>
			{/if}
		</div>

		<div style="text-align: center; margin-top: 24px;">
			<a href="/wisers" class="back-link">← Back to Wisers</a>
		</div>
	{/if}
</div>

<style>
	.profile-page { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
	.loading, .error-state { text-align: center; padding: 60px; color: var(--clr-text-muted); }
	.error-state a { color: var(--clr-gold); }
	.profile-card {
		padding: 28px; border-radius: 16px; border: 1px solid var(--clr-border, #2a2a3e);
		background: var(--clr-bg-card, #1a1a2e);
	}
	.profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
	.profile-avatar {
		width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center;
		justify-content: center; font-size: 22px; font-weight: 800;
		background: var(--clr-gold, #f5a623); color: #000;
	}
	.profile-username { font-size: 22px; font-weight: 800; color: var(--clr-gold, #f5a623); }
	.profile-realname { font-size: 13px; color: var(--clr-text-secondary); margin-top: 2px; }
	.plan-badge {
		font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px;
		border-radius: 99px; background: rgba(245,166,35,0.15); color: var(--clr-gold);
		margin-top: 4px; display: inline-block;
	}
	.profile-bio { font-size: 13px; line-height: 1.5; color: var(--clr-text-secondary); margin-bottom: 16px; }
	.profile-meta { display: flex; gap: 16px; font-size: 12px; color: var(--clr-text-muted); margin-bottom: 20px; flex-wrap: wrap; }
	.profile-meta a { color: var(--clr-gold); text-decoration: none; }
	.profile-stats { display: flex; gap: 24px; justify-content: center; padding: 20px 0; border-top: 1px solid var(--clr-border); }
	.stat { text-align: center; }
	.stat-num { font-size: 24px; font-weight: 800; color: var(--clr-text); }
	.stat-label { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
	.profile-action { text-align: center; margin-top: 20px; }
	.btn-add, .btn-accept-profile { padding: 10px 28px; border-radius: 10px; border: none; background: var(--clr-gold); color: #000; font-weight: 700; cursor: pointer; font-size: 13px; }
	.btn-friends { padding: 10px 28px; border-radius: 10px; border: 1px solid var(--clr-success); background: transparent; color: var(--clr-success); font-weight: 700; cursor: pointer; font-size: 13px; }
	.btn-pending { padding: 10px 28px; border-radius: 10px; border: 1px solid var(--clr-border); background: transparent; color: var(--clr-text-muted); font-weight: 600; font-size: 13px; }
	.action-msg { display: block; margin-top: 8px; font-size: 12px; color: var(--clr-success); }
	.back-link { font-size: 13px; color: var(--clr-text-muted); text-decoration: none; }
	.back-link:hover { color: var(--clr-gold); }
</style>