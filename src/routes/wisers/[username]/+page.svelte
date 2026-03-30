<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let profile = $state<any>(null);
  let posts = $state<any[]>([]);
  let status = $state('');
  let loading = $state(true);
  let error = $state('');
  let actionMsg = $state('');
  let activeTab = $state('posts');
  let editing = $state(false);
  let editBio = $state('');
  let editCompany = $state('');
  let editWebsite = $state('');
  let saving = $state(false);

  $effect(() => {
    const username = $page.params.username;
    if (username) loadProfile(username);
  });

  async function loadProfile(username: string) {
    loading = true; error = '';
    try {
      profile = await api.getCommunityProfile(username);
      if ($auth.token) {
        const s = await api.getFriendshipStatus(username).catch(() => ({ status: 'none' }));
        status = s.status;
      }
      try { posts = (await api.getUserPosts(username)).posts || []; } catch {}
    } catch (e: any) { error = e.message || 'User not found'; }
    loading = false;
  }

  async function addFriend() {
    try {
      const res = await api.sendFriendRequest(profile.username);
      actionMsg = res.message;
      status = res.status === 'accepted' ? 'friends' : 'request_sent';
    } catch (e: any) { actionMsg = e.message; }
    setTimeout(() => actionMsg = '', 3000);
  }

  async function removeFriend() {
    if (!confirm('Unfriend @' + profile.username + '?')) return;
    await api.unfriend(profile.username); status = 'none';
  }

  function avatarSrc(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return 'https://api-bscan.balancewises.io/avatars/' + url;
  }

  function initial(name: string) { return (name || '?')[0].toUpperCase(); }

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60) + 'm';
    if (s < 86400) return Math.floor(s/3600) + 'h'; return Math.floor(s/86400) + 'd';
  }

  async function saveProfile() {
    saving = true;
    try {
      await api.updateProfile({ bio: editBio, company: editCompany, website: editWebsite });
      profile.bio = editBio;
      profile.company = editCompany;
      profile.website = editWebsite;
      editing = false;
      actionMsg = 'Profile updated';
      setTimeout(() => actionMsg = '', 3000);
    } catch (e: any) { actionMsg = 'Failed to save'; }
    saving = false;
  }

  function startEdit() {
    editBio = profile.bio || '';
    editCompany = profile.company || '';
    editWebsite = profile.website || '';
    editing = true;
  }

  function planLabel(p: string) {
    if (p === 'agency') return 'Agency';
    if (p === 'pro') return 'Pro';
    return 'Free';
  }
  function planColor(p: string) {
    if (p === 'agency') return '#f5a623';
    if (p === 'pro') return '#3b82f6';
    return '#555';
  }

  const verifySvg = '<svg viewBox="0 0 22 22" width="18" height="18"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg>';
</script>

<svelte:head>
  <title>{profile?.username ? '@' + profile.username + ' — Wisers' : 'Profile — Wisers'}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  {#if profile}
    <meta property="og:title" content="@{profile.username} on Wisers" />
    <meta property="og:description" content="{profile.bio || (profile.display_name || profile.name) + ' on BSCAN Wisers'}" />
    <meta name="robots" content="index, follow" />
  {/if}
</svelte:head>

<div class="pr">
  {#if loading}
    <div class="pr-state"><div class="pr-spinner"></div></div>
  {:else if error}
    <div class="pr-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
      <p>{error}</p>
      <a href="/wisers" class="pr-back-link">Back to Wisers</a>
    </div>
  {:else if profile}

    <!-- Banner -->
    <div class="pr-banner">
      <div class="pr-banner-gradient"></div>
    </div>

    <!-- Profile Header -->
    <div class="pr-header">
      <div class="pr-header-inner">
        <div class="pr-avatar-wrap">
          <div class="pr-avatar">
            {#if avatarSrc(profile.avatar_url)}
              <img src={avatarSrc(profile.avatar_url)} alt="" class="pr-avatar-img" />
            {:else}
              {initial(profile.display_name || profile.name)}
            {/if}
          </div>
        </div>

        <div class="pr-header-right">
          {#if $auth.token && status === 'self'}
            <div class="pr-actions">
              <button class="pr-btn pr-btn-outline" onclick={startEdit}>Edit profile</button>
              <a href="/account" class="pr-btn pr-btn-outline">Settings</a>
            </div>
          {:else if $auth.token}
            <div class="pr-actions">
              {#if status === 'friends'}
                <a href="/wisers/messages" class="pr-btn pr-btn-outline">Message</a>
                <button class="pr-btn pr-btn-outline pr-btn-green" onclick={removeFriend}>Friends ✓</button>
              {:else if status === 'request_sent'}
                <button class="pr-btn pr-btn-outline" disabled>Pending</button>
              {:else if status === 'request_received'}
                <button class="pr-btn pr-btn-primary" onclick={addFriend}>Accept</button>
              {:else}
                <button class="pr-btn pr-btn-primary" onclick={addFriend}>Connect</button>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <div class="pr-identity">
        <div class="pr-name-row">
          <h1 class="pr-display-name">{profile.display_name || profile.name}</h1>
          <span class="pr-verify" style="fill: {planColor(profile.plan)};">{@html verifySvg}</span>
        </div>
        <div class="pr-handle">@{profile.username}</div>
        {#if editing}
          <div class="pr-edit-form">
            <label class="pr-edit-label">Bio</label>
            <textarea class="pr-edit-input" bind:value={editBio} rows="3" maxlength="300" placeholder="Tell people about yourself..."></textarea>
            <label class="pr-edit-label">Company</label>
            <input class="pr-edit-input" type="text" bind:value={editCompany} placeholder="Where you work" />
            <label class="pr-edit-label">Website</label>
            <input class="pr-edit-input" type="url" bind:value={editWebsite} placeholder="https://yoursite.com" />
            <div class="pr-edit-actions">
              <button class="pr-btn pr-btn-primary" onclick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button class="pr-btn pr-btn-outline" onclick={() => editing = false}>Cancel</button>
            </div>
          </div>
        {:else if profile.bio}
          <p class="pr-bio">{profile.bio}</p>
        {/if}
        <div class="pr-meta-row">
          {#if profile.company}
            <span class="pr-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              {profile.company}
            </span>
          {/if}
          {#if profile.city || profile.country}
            <span class="pr-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {[profile.city, profile.country].filter(Boolean).join(', ')}
            </span>
          {/if}
          {#if profile.website}
            <a href={profile.website} target="_blank" rel="noopener" class="pr-meta-item pr-meta-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              {profile.website.replace(/https?:\/\//, '')}
            </a>
          {/if}
          <span class="pr-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        {#if actionMsg}<div class="pr-toast">{actionMsg}</div>{/if}
      </div>

      <!-- Stats -->
      <div class="pr-stats">
        <div class="pr-stat"><strong>{profile.stats?.total_scans || 0}</strong> Scans</div>
        <div class="pr-stat"><strong>{profile.stats?.avg_score || 0}</strong> Avg Score</div>
        <div class="pr-stat"><strong>{profile.stats?.friends || 0}</strong> Friends</div>
        <div class="pr-stat"><strong>{posts.length}</strong> Posts</div>
      </div>

      <!-- Tabs -->
      <div class="pr-tabs">
        <button class="pr-tab" class:active={activeTab === 'posts'} onclick={() => activeTab = 'posts'}>Posts</button>
        <button class="pr-tab" class:active={activeTab === 'scans'} onclick={() => activeTab = 'scans'}>Scans</button>
      </div>
    </div>

    <!-- Content -->
    <div class="pr-content">
      {#if activeTab === 'posts'}
        {#if posts.length === 0}
          <div class="pr-empty">No posts yet</div>
        {:else}
          {#each posts as post}
            <div class="pr-post">
              <div class="pr-post-header">
                <div class="pr-post-av">
                  {#if avatarSrc(profile.avatar_url)}
                    <img src={avatarSrc(profile.avatar_url)} alt="" />
                  {:else}
                    {initial(profile.display_name || profile.name)}
                  {/if}
                </div>
                <div>
                  <span class="pr-post-name">{profile.display_name || profile.name}</span>
                  <span class="pr-post-handle">@{profile.username} · {timeAgo(post.created_at)}</span>
                </div>
              </div>
              <div class="pr-post-body">{post.content}</div>
              <div class="pr-post-footer">
                <span>❤️ {post.likes_count || 0}</span>
                <span>💬 {post.comments_count || 0}</span>
              </div>
            </div>
          {/each}
        {/if}
      {:else}
        <div class="pr-empty">
          <p><strong>{profile.stats?.total_scans || 0}</strong> scans completed with an average score of <strong>{profile.stats?.avg_score || 0}</strong></p>
        </div>
      {/if}
    </div>

  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  .pr { --bg: #0a0a0f; --card: #111117; --t1: #e4e6ea; --t2: #8a8d91; --t3: #606770; --bd: #1e1e2a; --gold: #f5a623; --hover: rgba(255,255,255,0.04);
    font-family: 'DM Sans', -apple-system, sans-serif; color: var(--t1); background: var(--bg); min-height: 100vh; }

  /* Banner */
  .pr-banner { height: 200px; position: relative; overflow: hidden; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #1a1a2e 100%); }
  .pr-banner-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, var(--bg) 100%); }

  /* Header */
  .pr-header { max-width: 680px; margin: 0 auto; padding: 0 20px; }
  .pr-header-inner { display: flex; justify-content: space-between; align-items: flex-start; margin-top: -60px; position: relative; z-index: 2; }
  .pr-avatar-wrap { flex-shrink: 0; }
  .pr-avatar { width: 120px; height: 120px; border-radius: 50%; background: var(--gold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 42px; border: 4px solid var(--bg); overflow: hidden; }
  .pr-avatar-img { width: 100%; height: 100%; object-fit: cover; }
  .pr-header-right { padding-top: 72px; }

  /* Actions */
  .pr-actions { display: flex; gap: 8px; }
  .pr-btn { padding: 8px 20px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; border: none; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
  .pr-btn-primary { background: var(--gold); color: #000; }
  .pr-btn-primary:hover { filter: brightness(1.1); }
  .pr-btn-outline { background: transparent; border: 1px solid var(--bd); color: var(--t1); }
  .pr-btn-outline:hover { border-color: var(--t2); }
  .pr-btn-green { border-color: #10b981; color: #10b981; }
  .pr-btn:disabled { opacity: 0.4; cursor: default; }

  /* Identity */
  .pr-identity { margin-top: 12px; }
  .pr-name-row { display: flex; align-items: center; gap: 6px; }
  .pr-display-name { font-size: 24px; font-weight: 800; margin: 0; }
  .pr-verify { display: inline-flex; }
  .pr-handle { font-size: 15px; color: var(--t2); }
  .pr-bio { font-size: 15px; line-height: 1.5; margin-top: 10px; white-space: pre-wrap; }
  .pr-meta-row { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; font-size: 13px; color: var(--t2); }
  .pr-meta-item { display: inline-flex; align-items: center; gap: 4px; }
  .pr-meta-link { color: var(--gold); text-decoration: none; }
  .pr-meta-link:hover { text-decoration: underline; }
  .pr-edit-form { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .pr-edit-label { font-size: 11px; font-weight: 700; color: var(--t2); text-transform: uppercase; letter-spacing: 0.05em; }
  .pr-edit-input { padding: 10px 14px; border-radius: 10px; border: 1px solid var(--bd); background: var(--bg); color: var(--t1); font-size: 14px; font-family: inherit; outline: none; resize: vertical; }
  .pr-edit-input:focus { border-color: var(--gold); }
  .pr-edit-actions { display: flex; gap: 8px; margin-top: 4px; }
  .pr-toast { margin-top: 8px; font-size: 12px; color: #10b981; }

  /* Stats */
  .pr-stats { display: flex; gap: 24px; margin-top: 16px; padding: 16px 0; border-bottom: 1px solid var(--bd); }
  .pr-stat { font-size: 14px; color: var(--t2); }
  .pr-stat strong { color: var(--t1); font-weight: 800; margin-right: 3px; }

  /* Tabs */
  .pr-tabs { display: flex; border-bottom: 1px solid var(--bd); }
  .pr-tab { flex: 1; padding: 14px 0; text-align: center; font-size: 14px; font-weight: 600; color: var(--t2); background: none; border: none; cursor: pointer; border-bottom: 3px solid transparent; font-family: inherit; }
  .pr-tab:hover { background: var(--hover); }
  .pr-tab.active { color: var(--gold); border-bottom-color: var(--gold); }

  /* Content */
  .pr-content { max-width: 680px; margin: 0 auto; padding: 0 20px 60px; }
  .pr-empty { padding: 40px; text-align: center; color: var(--t3); font-size: 14px; }

  /* Posts */
  .pr-post { padding: 16px 0; border-bottom: 1px solid var(--bd); }
  .pr-post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .pr-post-av { width: 36px; height: 36px; border-radius: 50%; background: var(--gold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; overflow: hidden; flex-shrink: 0; }
  .pr-post-av img { width: 100%; height: 100%; object-fit: cover; }
  .pr-post-name { font-weight: 700; font-size: 14px; }
  .pr-post-handle { font-size: 13px; color: var(--t2); margin-left: 4px; }
  .pr-post-body { font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .pr-post-footer { display: flex; gap: 20px; margin-top: 10px; font-size: 13px; color: var(--t2); }

  /* States */
  .pr-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 12px; color: var(--t3); }
  .pr-back-link { color: var(--gold); text-decoration: none; font-size: 14px; }
  .pr-spinner { width: 28px; height: 28px; border: 3px solid var(--bd); border-top-color: var(--gold); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Mobile */
  @media (max-width: 600px) {
    .pr-banner { height: 140px; }
    .pr-avatar { width: 90px; height: 90px; font-size: 32px; }
    .pr-header-inner { margin-top: -45px; }
    .pr-header-right { padding-top: 52px; }
    .pr-display-name { font-size: 20px; }
    .pr-stats { gap: 16px; flex-wrap: wrap; }
  }
</style>