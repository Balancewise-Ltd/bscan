<script lang="ts">
	import { onMount } from 'svelte';
	import * as api from '$lib/api/client';
	import { auth } from '$lib/stores/auth';

	let friends = $state<any[]>([]);
	let incoming = $state<any[]>([]);
	let outgoing = $state<any[]>([]);
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let searching = $state(false);
	let loading = $state(true);
	let actionMsg = $state('');

	onMount(async () => {
		if (!$auth.token) return;
		try {
			const [fr, req] = await Promise.all([
				api.getFriends().catch(() => ({ friends: [] })),
				api.getFriendRequests().catch(() => ({ incoming: [], outgoing: [] }))
			]);
			friends = fr.friends || [];
			incoming = req.incoming || [];
			outgoing = req.outgoing || [];
		} catch {}
		loading = false;
	});

	async function search() {
		if (searchQuery.length < 2) return;
		searching = true;
		try {
			const res = await api.searchWisers(searchQuery);
			searchResults = res.users || [];
		} catch {}
		searching = false;
	}

	async function sendRequest(username: string) {
		try {
			const res = await api.sendFriendRequest(username);
			actionMsg = res.message || 'Sent!';
			setTimeout(() => actionMsg = '', 3000);
			// Refresh
			const req = await api.getFriendRequests();
			incoming = req.incoming || [];
			outgoing = req.outgoing || [];
			if (res.status === 'accepted') {
				const fr = await api.getFriends();
				friends = fr.friends || [];
			}
		} catch (e: any) { actionMsg = e.message || 'Error'; }
	}

	async function accept(id: number) {
		try {
			await api.acceptFriendRequest(id);
			const [fr, req] = await Promise.all([api.getFriends(), api.getFriendRequests()]);
			friends = fr.friends || [];
			incoming = req.incoming || [];
		} catch {}
	}

	async function decline(id: number) {
		try {
			await api.declineFriendRequest(id);
			const req = await api.getFriendRequests();
			incoming = req.incoming || [];
		} catch {}
	}

	async function removeFriend(username: string) {
		if (!confirm('Unfriend @' + username + '?')) return;
		try {
			await api.unfriend(username);
			const fr = await api.getFriends();
			friends = fr.friends || [];
		} catch {}
	}
</script>

<svelte:head>
	<title>Wisers — BSCAN Community</title>
	<meta name="description" content="Connect with other BSCAN users, share insights, and grow your web presence together." />
</svelte:head>

<div class="community-page">
	<div class="community-header">
		<h1>Wisers</h1>
		<p class="text-secondary">The BSCAN community — connect with other web professionals</p>
	</div>

	<!-- Search -->
	<div class="search-bar">
		<input type="text" bind:value={searchQuery} placeholder="Search wisers by name or username..."
			onkeydown={(e) => e.key === 'Enter' && search()} />
		<button onclick={search} disabled={searching || searchQuery.length < 2}>
			{searching ? 'Searching...' : 'Search'}
		</button>
	</div>

	{#if actionMsg}
		<div class="action-msg">{actionMsg}</div>
	{/if}

	<!-- Search Results -->
	{#if searchResults.length > 0}
		<div class="section">
			<h3>Search Results ({searchResults.length})</h3>
			<div class="user-grid">
				{#each searchResults as u}
					<div class="user-card">
						<a href="/wisers/{u.username}" class="user-name">@{u.username}</a>
						<div class="user-display">{u.display_name || u.name}</div>
						{#if u.bio}<div class="user-bio">{u.bio}</div>{/if}
						<div class="user-actions">
							<span class="plan-badge">{u.plan}</span>
							<button class="btn-sm" onclick={() => sendRequest(u.username)}>Add Friend</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Incoming Requests -->
	{#if incoming.length > 0}
		<div class="section">
			<h3>Friend Requests ({incoming.length})</h3>
			<div class="user-grid">
				{#each incoming as req}
					<div class="user-card request-card">
						<a href="/wisers/{req.username}" class="user-name">@{req.username}</a>
						<div class="user-display">{req.display_name || req.name}</div>
						<div class="request-actions">
							<button class="btn-accept" onclick={() => accept(req.id)}>Accept</button>
							<button class="btn-decline" onclick={() => decline(req.id)}>Decline</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Outgoing Requests -->
	{#if outgoing.length > 0}
		<div class="section">
			<h3>Sent Requests ({outgoing.length})</h3>
			<div class="user-grid">
				{#each outgoing as req}
					<div class="user-card pending-card">
						<a href="/wisers/{req.username}" class="user-name">@{req.username}</a>
						<div class="user-display">{req.display_name || req.name}</div>
						<span class="status-pending">Pending</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Friends List -->
	<div class="section">
		<h3>Your Friends ({friends.length})</h3>
		{#if loading}
			<p class="text-muted">Loading...</p>
		{:else if friends.length === 0}
			<div class="empty-state">
				<p>No friends yet. Search for wisers above to connect!</p>
			</div>
		{:else}
			<div class="user-grid">
				{#each friends as f}
					<div class="user-card friend-card">
						<a href="/wisers/{f.username}" class="user-name">@{f.username}</a>
						<div class="user-display">{f.display_name || f.name}</div>
						{#if f.bio}<div class="user-bio">{f.bio}</div>{/if}
						<div class="user-actions">
							<span class="plan-badge">{f.plan}</span>
							<button class="btn-unfriend" onclick={() => removeFriend(f.username)}>Unfriend</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.community-page { max-width: 900px; margin: 0 auto; padding: 32px 16px; }
	.community-header { text-align: center; margin-bottom: 32px; }
	.community-header h1 { font-size: 28px; font-weight: 800; color: var(--clr-gold, #f5a623); }
	.community-header p { font-size: 14px; margin-top: 8px; }
	.search-bar { display: flex; gap: 8px; margin-bottom: 24px; }
	.search-bar input {
		flex: 1; padding: 12px 16px; border-radius: 12px;
		border: 1px solid var(--clr-border, #2a2a3e); background: var(--clr-bg-card, #1a1a2e);
		color: var(--clr-text, #e0e0f0); font-size: 14px; outline: none;
	}
	.search-bar input:focus { border-color: var(--clr-gold, #f5a623); }
	.search-bar button {
		padding: 12px 24px; border-radius: 12px; border: none;
		background: var(--clr-gold, #f5a623); color: #000; font-weight: 700;
		cursor: pointer; font-size: 13px;
	}
	.search-bar button:disabled { opacity: 0.5; cursor: not-allowed; }
	.action-msg { text-align: center; padding: 8px; font-size: 13px; color: var(--clr-success, #10b981); margin-bottom: 16px; }
	.section { margin-bottom: 32px; }
	.section h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: var(--clr-text, #e0e0f0); }
	.user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
	.user-card {
		padding: 16px; border-radius: 12px; border: 1px solid var(--clr-border, #2a2a3e);
		background: var(--clr-bg-card, #1a1a2e);
	}
	.user-name { font-size: 15px; font-weight: 700; color: var(--clr-gold, #f5a623); text-decoration: none; }
	.user-name:hover { text-decoration: underline; }
	.user-display { font-size: 12px; color: var(--clr-text-secondary, #8888aa); margin-top: 2px; }
	.user-bio { font-size: 12px; color: var(--clr-text-muted, #6666888); margin-top: 8px; line-height: 1.4; }
	.user-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
	.plan-badge {
		font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px;
		border-radius: 99px; background: rgba(245,166,35,0.15); color: var(--clr-gold, #f5a623);
	}
	.btn-sm, .btn-accept, .btn-decline, .btn-unfriend {
		padding: 6px 14px; border-radius: 8px; border: none; font-size: 11px;
		font-weight: 700; cursor: pointer;
	}
	.btn-sm { background: var(--clr-gold, #f5a623); color: #000; }
	.btn-accept { background: var(--clr-success, #10b981); color: #fff; }
	.btn-decline { background: transparent; border: 1px solid var(--clr-border); color: var(--clr-text-muted); }
	.btn-unfriend { background: transparent; border: 1px solid rgba(239,68,68,0.3); color: var(--clr-danger, #ef4444); font-size: 10px; }
	.request-actions { display: flex; gap: 8px; margin-top: 12px; }
	.status-pending { font-size: 11px; color: var(--clr-warning, #f59e0b); font-weight: 600; margin-top: 8px; }
	.empty-state { text-align: center; padding: 40px; color: var(--clr-text-muted); font-size: 13px; }
	.request-card { border-color: var(--clr-success, #10b981); }
	.pending-card { opacity: 0.7; }
</style>