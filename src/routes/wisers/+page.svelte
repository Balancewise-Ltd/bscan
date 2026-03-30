<script lang="ts">
	import { onMount } from 'svelte';
	import * as api from '$lib/api/client';
	import { auth } from '$lib/stores/auth';

	let activeTab = $state<'feed' | 'friends' | 'requests'>('feed');
	let friends = $state<any[]>([]);
	let incoming = $state<any[]>([]);
	let outgoing = $state<any[]>([]);
	let posts = $state<any[]>([]);
	let feedPage = $state(1);
	let feedType = $state<'all' | 'friends'>('all');
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let searching = $state(false);
	let loading = $state(true);
	let actionMsg = $state('');
	let newPost = $state('');
	let posting = $state(false);
	let commentInputs = $state<Record<number, string>>({});
	let expandedComments = $state<Set<number>>(new Set());
	let postComments = $state<Record<number, any[]>>({});

	onMount(async () => {
		await loadFeed();
		if ($auth.token) {
			try {
				const [fr, req] = await Promise.all([
					api.getFriends().catch(() => ({ friends: [] })),
					api.getFriendRequests().catch(() => ({ incoming: [], outgoing: [] }))
				]);
				friends = fr.friends || [];
				incoming = req.incoming || [];
				outgoing = req.outgoing || [];
			} catch {}
		}
		loading = false;
	});

	async function loadFeed() {
		try {
			const res = feedType === 'friends' && $auth.token
				? await api.getFriendsFeed(feedPage)
				: await api.getCommunityFeed(feedPage);
			posts = res.posts || [];
		} catch {}
	}

	async function submitPost() {
		if (!newPost.trim() || posting) return;
		posting = true;
		try {
			await api.createPost(newPost.trim());
			newPost = '';
			await loadFeed();
		} catch (e: any) { actionMsg = e.message || 'Error'; }
		posting = false;
	}

	async function toggleLike(postId: number) {
		if (!$auth.token) return;
		try {
			const res = await api.likePost(postId);
			posts = posts.map(p => p.id === postId ? {
				...p,
				likes_count: res.liked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
				_liked: res.liked
			} : p);
		} catch {}
	}

	async function toggleComments(postId: number) {
		const s = new Set(expandedComments);
		if (s.has(postId)) {
			s.delete(postId);
		} else {
			s.add(postId);
			if (!postComments[postId]) {
				try {
					const res = await api.getPost(postId);
					postComments = { ...postComments, [postId]: res.comments || [] };
				} catch {}
			}
		}
		expandedComments = s;
	}

	async function submitComment(postId: number) {
		const text = (commentInputs[postId] || '').trim();
		if (!text) return;
		try {
			await api.addComment(postId, text);
			commentInputs = { ...commentInputs, [postId]: '' };
			const res = await api.getPost(postId);
			postComments = { ...postComments, [postId]: res.comments || [] };
			posts = posts.map(p => p.id === postId ? { ...p, comments_count: (res.comments || []).length } : p);
		} catch {}
	}

	async function removePost(id: number) {
		if (!confirm('Delete this post?')) return;
		try { await api.deletePost(id); await loadFeed(); } catch {}
	}

	async function search() {
		if (searchQuery.length < 2) return;
		searching = true;
		try { searchResults = (await api.searchWisers(searchQuery)).users || []; } catch {}
		searching = false;
	}

	async function sendRequest(username: string) {
		try {
			const res = await api.sendFriendRequest(username);
			actionMsg = res.message || 'Sent!';
			setTimeout(() => actionMsg = '', 3000);
			const req = await api.getFriendRequests();
			incoming = req.incoming || []; outgoing = req.outgoing || [];
			if (res.status === 'accepted') { friends = (await api.getFriends()).friends || []; }
		} catch (e: any) { actionMsg = e.message || 'Error'; }
	}

	async function accept(id: number) {
		try { await api.acceptFriendRequest(id);
			friends = (await api.getFriends()).friends || [];
			incoming = (await api.getFriendRequests()).incoming || [];
		} catch {}
	}

	async function decline(id: number) {
		try { await api.declineFriendRequest(id);
			incoming = (await api.getFriendRequests()).incoming || [];
		} catch {}
	}

	async function removeFriend(username: string) {
		if (!confirm('Unfriend @' + username + '?')) return;
		try { await api.unfriend(username); friends = (await api.getFriends()).friends || []; } catch {}
	}

	function timeAgo(d: string) {
		const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
		if (s < 60) return 'just now';
		if (s < 3600) return Math.floor(s/60) + 'm ago';
		if (s < 86400) return Math.floor(s/3600) + 'h ago';
		return Math.floor(s/86400) + 'd ago';
	}
</script>

<svelte:head>
	<title>Wisers Community — BSCAN</title>
	<meta name="description" content="Connect with web professionals in the BSCAN community." />
</svelte:head>

<div class="wisers">
	<div class="wisers-header">
		<h1>Wisers</h1>
		<p class="text-secondary">The BSCAN community</p>
	</div>

	<!-- Tabs -->
	<div class="tabs">
		<button class:active={activeTab === 'feed'} onclick={() => activeTab = 'feed'}>Feed</button>
		<button class:active={activeTab === 'friends'} onclick={() => activeTab = 'friends'}>Friends ({friends.length})</button>
		{#if incoming.length > 0}
			<button class:active={activeTab === 'requests'} onclick={() => activeTab = 'requests'}>Requests ({incoming.length})</button>
		{/if}
	</div>

	{#if actionMsg}<div class="action-msg">{actionMsg}</div>{/if}

	<!-- FEED TAB -->
	{#if activeTab === 'feed'}
		<!-- Post Composer -->
		{#if $auth.token}
			<div class="composer">
				<textarea bind:value={newPost} placeholder="Share something with the community..." maxlength="2000" rows="3"></textarea>
				<div class="composer-footer">
					<span class="char-count">{newPost.length}/2000</span>
					<div class="feed-toggle">
						<button class:active={feedType === 'all'} onclick={() => { feedType = 'all'; loadFeed(); }}>All</button>
						<button class:active={feedType === 'friends'} onclick={() => { feedType = 'friends'; loadFeed(); }}>Friends</button>
					</div>
					<button class="btn-post" onclick={submitPost} disabled={posting || !newPost.trim()}>
						{posting ? 'Posting...' : 'Post'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Posts -->
		{#if posts.length === 0}
			<div class="empty">No posts yet. Be the first to share something!</div>
		{/if}
		{#each posts as post (post.id)}
			<div class="post-card">
				<div class="post-header">
					<a href="/wisers/{post.username}" class="post-author">@{post.username}</a>
					<span class="post-name">{post.display_name || post.user_name}</span>
					<span class="post-plan">{post.plan}</span>
					<span class="post-time">{timeAgo(post.created_at)}</span>
				</div>
				<div class="post-content">{post.content}</div>
				{#if post.post_type === 'scan_share' && post.scan_url}
					<div class="scan-share">
						<span class="scan-url">{post.scan_url}</span>
						<span class="scan-score" class:good={post.scan_score >= 70} class:warn={post.scan_score >= 40 && post.scan_score < 70} class:bad={post.scan_score < 40}>{post.scan_score}/100</span>
					</div>
				{/if}
				<div class="post-actions">
					<button class="action-btn" onclick={() => toggleLike(post.id)}>
						{post._liked ? '❤️' : '♡'} {post.likes_count || 0}
					</button>
					<button class="action-btn" onclick={() => toggleComments(post.id)}>
						💬 {post.comments_count || 0}
					</button>
					{#if $auth.user?.id === post.user_id}
						<button class="action-btn delete-btn" onclick={() => removePost(post.id)}>🗑️</button>
					{/if}
				</div>

				<!-- Comments Section -->
				{#if expandedComments.has(post.id)}
					<div class="comments-section">
						{#each postComments[post.id] || [] as c (c.id)}
							<div class="comment">
								<a href="/wisers/{c.username}" class="comment-author">@{c.username}</a>
								<span class="comment-text">{c.content}</span>
								<span class="comment-time">{timeAgo(c.created_at)}</span>
							</div>
						{/each}
						{#if $auth.token}
							<div class="comment-input">
								<input type="text" placeholder="Write a comment..."
									bind:value={commentInputs[post.id]}
									onkeydown={(e) => e.key === 'Enter' && submitComment(post.id)} />
								<button onclick={() => submitComment(post.id)}>Send</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

	<!-- FRIENDS TAB -->
	{:else if activeTab === 'friends'}
		<div class="search-bar">
			<input type="text" bind:value={searchQuery} placeholder="Search wisers..."
				onkeydown={(e) => e.key === 'Enter' && search()} />
			<button onclick={search} disabled={searching || searchQuery.length < 2}>Search</button>
		</div>

		{#if searchResults.length > 0}
			<div class="section"><h3>Results</h3>
				<div class="user-grid">
					{#each searchResults as u}
						<div class="user-card">
							<a href="/wisers/{u.username}" class="user-name">@{u.username}</a>
							<div class="user-display">{u.display_name || u.name}</div>
							<div class="user-actions"><span class="plan-badge">{u.plan}</span>
								<button class="btn-sm" onclick={() => sendRequest(u.username)}>Add</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="section"><h3>Your Friends ({friends.length})</h3>
			{#if friends.length === 0}<div class="empty">No friends yet</div>
			{:else}
				<div class="user-grid">
					{#each friends as f}
						<div class="user-card">
							<a href="/wisers/{f.username}" class="user-name">@{f.username}</a>
							<div class="user-display">{f.display_name || f.name}</div>
							<div class="user-actions"><span class="plan-badge">{f.plan}</span>
								<button class="btn-unfriend" onclick={() => removeFriend(f.username)}>Unfriend</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

	<!-- REQUESTS TAB -->
	{:else if activeTab === 'requests'}
		<div class="section"><h3>Incoming ({incoming.length})</h3>
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
				{#if !incoming.length}<div class="empty">No pending requests</div>{/if}
			</div>
		</div>
		{#if outgoing.length > 0}
			<div class="section"><h3>Sent ({outgoing.length})</h3>
				<div class="user-grid">
					{#each outgoing as req}
						<div class="user-card pending-card">
							<a href="/wisers/{req.username}" class="user-name">@{req.username}</a>
							<span class="status-pending">Pending</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.wisers { max-width: 700px; margin: 0 auto; padding: 32px 16px; }
	.wisers-header { text-align: center; margin-bottom: 24px; }
	.wisers-header h1 { font-size: 28px; font-weight: 800; color: var(--clr-gold, #f5a623); }
	.wisers-header p { font-size: 13px; margin-top: 4px; }
	.tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--clr-border, #2a2a3e); padding-bottom: 8px; }
	.tabs button { padding: 8px 16px; border: none; background: none; color: var(--clr-text-muted, #888); font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 8px 8px 0 0; }
	.tabs button.active { color: var(--clr-gold, #f5a623); border-bottom: 2px solid var(--clr-gold); }
	.action-msg { text-align: center; padding: 8px; font-size: 12px; color: var(--clr-success, #10b981); }
	.composer { margin-bottom: 20px; border: 1px solid var(--clr-border, #2a2a3e); border-radius: 12px; overflow: hidden; background: var(--clr-bg-card, #1a1a2e); }
	.composer textarea { width: 100%; padding: 14px 16px; border: none; background: transparent; color: var(--clr-text, #e0e0f0); font-size: 14px; resize: none; outline: none; font-family: inherit; }
	.composer-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-top: 1px solid var(--clr-border, #2a2a3e); }
	.char-count { font-size: 11px; color: var(--clr-text-muted); }
	.feed-toggle { display: flex; gap: 2px; }
	.feed-toggle button { padding: 4px 10px; border: 1px solid var(--clr-border); background: none; color: var(--clr-text-muted); font-size: 11px; border-radius: 6px; cursor: pointer; }
	.feed-toggle button.active { background: var(--clr-gold, #f5a623); color: #000; border-color: var(--clr-gold); }
	.btn-post { padding: 6px 20px; border: none; background: var(--clr-gold, #f5a623); color: #000; font-weight: 700; font-size: 12px; border-radius: 8px; cursor: pointer; }
	.btn-post:disabled { opacity: 0.4; cursor: not-allowed; }
	.post-card { border: 1px solid var(--clr-border, #2a2a3e); border-radius: 12px; padding: 16px; margin-bottom: 12px; background: var(--clr-bg-card, #1a1a2e); }
	.post-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
	.post-author { font-weight: 700; color: var(--clr-gold, #f5a623); text-decoration: none; font-size: 13px; }
	.post-author:hover { text-decoration: underline; }
	.post-name { font-size: 12px; color: var(--clr-text-secondary, #8888aa); }
	.post-plan { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 99px; background: rgba(245,166,35,0.15); color: var(--clr-gold); }
	.post-time { font-size: 11px; color: var(--clr-text-muted, #666); margin-left: auto; }
	.post-content { font-size: 14px; line-height: 1.5; color: var(--clr-text, #e0e0f0); white-space: pre-wrap; word-break: break-word; }
	.scan-share { margin-top: 10px; padding: 10px; border-radius: 8px; background: var(--clr-bg-deep, #0d0d1a); border: 1px solid var(--clr-border); display: flex; justify-content: space-between; align-items: center; }
	.scan-url { font-size: 12px; color: var(--clr-text-secondary); font-family: monospace; }
	.scan-score { font-size: 16px; font-weight: 800; }
	.scan-score.good { color: var(--clr-success, #10b981); }
	.scan-score.warn { color: var(--clr-warning, #f59e0b); }
	.scan-score.bad { color: var(--clr-danger, #ef4444); }
	.post-actions { display: flex; gap: 12px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--clr-border, #2a2a3e); }
	.action-btn { background: none; border: none; color: var(--clr-text-muted); font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
	.action-btn:hover { background: rgba(255,255,255,0.05); }
	.delete-btn { margin-left: auto; }
	.comments-section { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--clr-border, #2a2a3e); }
	.comment { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 13px; }
	.comment-author { color: var(--clr-gold); font-weight: 600; text-decoration: none; font-size: 12px; }
	.comment-text { color: var(--clr-text-secondary); margin-left: 6px; }
	.comment-time { font-size: 10px; color: var(--clr-text-muted); margin-left: 8px; }
	.comment-input { display: flex; gap: 6px; margin-top: 10px; }
	.comment-input input { flex: 1; padding: 8px 12px; border: 1px solid var(--clr-border); border-radius: 8px; background: var(--clr-bg-deep, #0d0d1a); color: var(--clr-text); font-size: 12px; outline: none; }
	.comment-input button { padding: 8px 14px; border: none; background: var(--clr-gold); color: #000; font-weight: 700; font-size: 11px; border-radius: 8px; cursor: pointer; }
	.search-bar { display: flex; gap: 8px; margin-bottom: 20px; }
	.search-bar input { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--clr-border); background: var(--clr-bg-card); color: var(--clr-text); font-size: 13px; outline: none; }
	.search-bar button { padding: 10px 20px; border-radius: 10px; border: none; background: var(--clr-gold); color: #000; font-weight: 700; font-size: 12px; cursor: pointer; }
	.section { margin-bottom: 24px; }
	.section h3 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
	.user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
	.user-card { padding: 14px; border-radius: 10px; border: 1px solid var(--clr-border); background: var(--clr-bg-card); }
	.user-name { font-size: 14px; font-weight: 700; color: var(--clr-gold); text-decoration: none; }
	.user-display { font-size: 11px; color: var(--clr-text-secondary); margin-top: 2px; }
	.user-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
	.plan-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 99px; background: rgba(245,166,35,0.15); color: var(--clr-gold); }
	.btn-sm { padding: 5px 12px; border-radius: 7px; border: none; background: var(--clr-gold); color: #000; font-size: 11px; font-weight: 700; cursor: pointer; }
	.btn-accept { padding: 5px 12px; border-radius: 7px; border: none; background: var(--clr-success, #10b981); color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; }
	.btn-decline { padding: 5px 12px; border-radius: 7px; border: 1px solid var(--clr-border); background: none; color: var(--clr-text-muted); font-size: 11px; cursor: pointer; }
	.btn-unfriend { padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.3); background: none; color: var(--clr-danger, #ef4444); font-size: 10px; font-weight: 600; cursor: pointer; }
	.request-actions { display: flex; gap: 6px; margin-top: 10px; }
	.request-card { border-color: var(--clr-success); }
	.pending-card { opacity: 0.6; }
	.status-pending { font-size: 11px; color: var(--clr-warning); font-weight: 600; }
	.empty { text-align: center; padding: 40px; color: var(--clr-text-muted); font-size: 13px; }
</style>