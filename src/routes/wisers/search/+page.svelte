<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';
  import { timeAgo } from '$lib/utils/time';

  let query = $state('');
  let tab = $state<'people' | 'posts' | 'communities'>('people');
  let users = $state<any[]>([]);
  let posts = $state<any[]>([]);
  let communities = $state<any[]>([]);
  let loading = $state(false);
  let searched = $state(false);
  let followStates = $state<Record<string, boolean>>({});
  let theme = $state<'dark' | 'light'>('dark');

  function initial(name: string) { return (name || '?')[0].toUpperCase(); }
  function avatarSrc(url: string | null | undefined) { return url && url !== 'null' ? url : ''; }

  $effect(() => {
    const q = $page.url.searchParams.get('q');
    if (q && q !== query) { query = q; doSearch(q); }
  });

  $effect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wisers-theme');
      if (saved === 'light') theme = 'light';
    }
  });

  async function doSearch(q: string) {
    if (!q || q.length < 2) return;
    loading = true; searched = true;
    try {
      const res = await api.searchAll(q);
      users = res.users || [];
      posts = res.posts || [];
      communities = res.communities || [];
      // Check follow status for each user
      if ($auth.token && users.length > 0) {
        for (const u of users.slice(0, 20)) {
          if (u.username !== $auth.user?.username) {
            try {
              const fs = await api.getFollowStatus(u.username);
              followStates[u.username] = fs.i_follow;
            } catch {}
          }
        }
        followStates = { ...followStates };
      }
    } catch {}
    loading = false;
  }

  function handleSearch() {
    if (query.length < 2) return;
    goto(`/wisers/search?q=${encodeURIComponent(query)}`);
    doSearch(query);
  }

  async function toggleFollow(username: string) {
    if (!$auth.token) return;
    try {
      if (followStates[username]) {
        await api.unfollowUser(username);
        followStates[username] = false;
      } else {
        await api.followUser(username);
        followStates[username] = true;
      }
      followStates = { ...followStates };
    } catch {}
  }

  function renderContent(text: string) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/#(\w+)/g, '<a href="/wisers?tag=$1" class="ws-hashtag">#$1</a>')
      .replace(/@(\w+)/g, '<a href="/wisers/$1" class="ws-mention">@$1</a>');
  }
</script>

<svelte:head>
  <title>Search{query ? ` — ${query}` : ''} | Wisers</title>
</svelte:head>

<div class="ws" class:light={theme === 'light'}>
  <header class="ws-topbar">
    <a href="/wisers" class="ws-back" aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <div class="ws-search-wrap">
      <svg class="ws-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" class="ws-search" placeholder="Search wisers..." bind:value={query} onkeydown={(e) => e.key === 'Enter' && handleSearch()} autofocus />
      {#if query}
        <button class="ws-clear" onclick={() => { query = ''; users = []; posts = []; communities = []; searched = false; }} aria-label="Clear">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      {/if}
    </div>
  </header>

  {#if searched}
    <div class="ws-tabs">
      <button class="ws-tab" class:active={tab === 'people'} onclick={() => tab = 'people'}>
        People {#if users.length > 0}<span class="ws-tab-count">{users.length}</span>{/if}
      </button>
      <button class="ws-tab" class:active={tab === 'posts'} onclick={() => tab = 'posts'}>
        Posts {#if posts.length > 0}<span class="ws-tab-count">{posts.length}</span>{/if}
      </button>
      <button class="ws-tab" class:active={tab === 'communities'} onclick={() => tab = 'communities'}>
        Communities {#if communities.length > 0}<span class="ws-tab-count">{communities.length}</span>{/if}
      </button>
    </div>
  {/if}

  <div class="ws-body">
    {#if loading}
      <div class="ws-loading">
        {#each [1,2,3,4] as _}
          <div class="ws-skel-row"><div class="ws-skel ws-skel-av"></div><div class="ws-skel-col"><div class="ws-skel ws-skel-name"></div><div class="ws-skel ws-skel-desc"></div></div></div>
        {/each}
      </div>

    {:else if !searched}
      <div class="ws-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Search for people, posts, or communities</p>
      </div>

    {:else if tab === 'people'}
      {#if users.length === 0}
        <div class="ws-empty"><p>No people found for "{query}"</p></div>
      {:else}
        {#each users as u}
          <a href="/wisers/{u.username}" class="ws-user-row">
            <div class="ws-av">{#if avatarSrc(u.avatar_url)}<img src={avatarSrc(u.avatar_url)} alt="" />{:else}{initial(u.display_name || u.name)}{/if}</div>
            <div class="ws-user-info">
              <div class="ws-user-top">
                <span class="ws-user-name">{u.display_name || u.name}</span>
                <span class="ws-user-handle">@{u.username}</span>
              </div>
              {#if u.bio}<p class="ws-user-bio">{u.bio}</p>{/if}
            </div>
            {#if $auth.token && u.username !== $auth.user?.username}
              <button class="ws-follow-btn" class:following={followStates[u.username]} onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(u.username); }}>
                {followStates[u.username] ? 'Following' : 'Follow'}
              </button>
            {/if}
          </a>
        {/each}
      {/if}

    {:else if tab === 'posts'}
      {#if posts.length === 0}
        <div class="ws-empty"><p>No posts found for "{query}"</p></div>
      {:else}
        {#each posts as post}
          <a href="/wisers/{post.username}" class="ws-post-card">
            <div class="ws-post-header">
              <div class="ws-av-sm">{#if avatarSrc(post.avatar_url)}<img src={avatarSrc(post.avatar_url)} alt="" />{:else}{initial(post.display_name || post.username)}{/if}</div>
              <span class="ws-user-name">{post.display_name || post.username}</span>
              <span class="ws-user-handle">@{post.username}</span>
              <span class="ws-dot">·</span>
              <span class="ws-time">{timeAgo(post.created_at)}</span>
            </div>
            <div class="ws-post-body">{@html renderContent(post.content)}</div>
            {#if post.image_url}<img src={post.image_url} alt="" class="ws-post-img" loading="lazy" onerror={(e) => { e.currentTarget.style.display = 'none'; }} />{/if}
          </a>
        {/each}
      {/if}

    {:else if tab === 'communities'}
      {#if communities.length === 0}
        <div class="ws-empty"><p>No communities found for "{query}"</p></div>
      {:else}
        {#each communities as c}
          <a href="/wisers/communities/{c.slug}" class="ws-community-row">
            <div class="ws-com-icon">{#if c.icon_url}<img src={c.icon_url} alt="" />{:else}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>{/if}</div>
            <div class="ws-com-info">
              <span class="ws-com-name">{c.name}</span>
              {#if c.description}<p class="ws-com-desc">{c.description}</p>{/if}
              <span class="ws-com-members">{c.member_count || 0} members</span>
            </div>
          </a>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

  :global([data-wisers-theme="light"]) { --wsb: #ffffff; --wsc: #f0f2f5; --wst: #1c1e21; --wst2: #606770; --wst3: #8a8d91; --wsbd: #dddfe2; --wscard: #ffffff; --wsgold: #d4a017; }

  .ws {
    --wsb: #0a0a0f; --wsc: #111117; --wst: #e4e6ea; --wst2: #8a8d91; --wst3: #606770;
    --wsbd: #1e1e2a; --wscard: #16161f; --wsgold: #f5a623;
    font-family: 'DM Sans', -apple-system, sans-serif;
    color: var(--wst); background: var(--wsb); min-height: 100vh;
  }
  .ws.light { --wsb: #ffffff; --wsc: #f0f2f5; --wst: #1c1e21; --wst2: #606770; --wst3: #8a8d91; --wsbd: #dddfe2; --wscard: #ffffff; --wsgold: #d4a017; }

  .ws-topbar {
    position: sticky; top: 0; z-index: 100;
    background: var(--wscard); border-bottom: 1px solid var(--wsbd);
    display: flex; align-items: center; gap: 8px; padding: 8px 12px; height: 56px;
  }
  .ws-back {
    width: 36px; height: 36px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; color: var(--wst2);
    text-decoration: none; flex-shrink: 0;
  }
  .ws-back:hover { background: rgba(255,255,255,0.06); color: var(--wst); }
  .ws-search-wrap { flex: 1; position: relative; display: flex; align-items: center; }
  .ws-search-icon { position: absolute; left: 12px; color: var(--wst3); pointer-events: none; }
  .ws-search {
    width: 100%; padding: 10px 36px 10px 36px; border: none; border-radius: 20px;
    background: var(--wsc); color: var(--wst); font-size: 17px;
    outline: none; font-family: inherit;
  }
  .ws-search:focus { box-shadow: 0 0 0 2px var(--wsgold); }
  .ws-search::placeholder { color: var(--wst3); }
  .ws-clear {
    position: absolute; right: 8px; background: none; border: none;
    color: var(--wst3); cursor: pointer; padding: 4px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .ws-clear:hover { color: var(--wst); }

  .ws-tabs {
    display: flex; border-bottom: 1px solid var(--wsbd);
    background: var(--wscard); position: sticky; top: 56px; z-index: 50;
  }
  .ws-tab {
    flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--wst2); font-size: 16px; font-weight: 600; cursor: pointer;
    font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: all 0.15s;
  }
  .ws-tab:hover { color: var(--wst); background: rgba(255,255,255,0.03); }
  .ws-tab.active { color: var(--wsgold); border-bottom-color: var(--wsgold); }
  .ws-tab-count {
    background: rgba(245,166,35,0.15); color: var(--wsgold); font-size: 11px;
    padding: 1px 6px; border-radius: 10px; font-weight: 700;
  }

  .ws-body { max-width: 680px; margin: 0 auto; padding: 0 12px; }

  .ws-empty { text-align: center; padding: 48px 20px; color: var(--wst3); font-size: 16px; }
  .ws-empty svg { margin-bottom: 12px; }

  /* People results */
  .ws-user-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 4px;
    border-bottom: 1px solid var(--wsbd); text-decoration: none; color: inherit;
    transition: background 0.1s;
  }
  .ws-user-row:hover { background: rgba(255,255,255,0.03); }
  .ws-av {
    width: 48px; height: 48px; border-radius: 50%; background: var(--wsgold);
    color: #000; font-weight: 800; font-size: 18px; display: flex;
    align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
  }
  .ws-av img { width: 100%; height: 100%; object-fit: cover; }
  .ws-av-sm {
    width: 32px; height: 32px; border-radius: 50%; background: var(--wsgold);
    color: #000; font-weight: 800; font-size: 13px; display: flex;
    align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
  }
  .ws-av-sm img { width: 100%; height: 100%; object-fit: cover; }
  .ws-user-info { flex: 1; min-width: 0; }
  .ws-user-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ws-user-name { font-weight: 700; font-size: 17px; }
  .ws-user-handle { font-size: 15px; color: var(--wst2); }
  .ws-user-bio { font-size: 15px; color: var(--wst2); margin: 2px 0 0; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  .ws-follow-btn {
    padding: 6px 18px; border-radius: 20px; border: none;
    background: var(--wsgold); color: #000; font-weight: 700; font-size: 15px;
    cursor: pointer; font-family: inherit; white-space: nowrap; flex-shrink: 0;
    transition: all 0.15s;
  }
  .ws-follow-btn:hover { opacity: 0.9; }
  .ws-follow-btn.following { background: transparent; border: 1px solid var(--wsbd); color: var(--wst2); }
  .ws-follow-btn.following:hover { border-color: #ef4444; color: #ef4444; }

  /* Post results */
  .ws-post-card {
    display: block; padding: 14px 4px; border-bottom: 1px solid var(--wsbd);
    text-decoration: none; color: inherit; transition: background 0.1s;
  }
  .ws-post-card:hover { background: rgba(255,255,255,0.03); }
  .ws-post-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
  .ws-dot { color: var(--wst3); }
  .ws-time { font-size: 14px; color: var(--wst3); }
  .ws-post-body { font-size: 16px; line-height: 1.5; color: var(--wst); white-space: pre-wrap; word-break: break-word; }
  .ws-post-img { width: 100%; max-height: 300px; object-fit: cover; border-radius: 12px; margin-top: 8px; }
  :global(.ws-hashtag) { color: var(--wsgold, #f5a623); text-decoration: none; font-weight: 600; }
  :global(.ws-hashtag:hover) { text-decoration: underline; }
  :global(.ws-mention) { color: #3b82f6; text-decoration: none; font-weight: 600; }
  :global(.ws-mention:hover) { text-decoration: underline; }

  /* Community results */
  .ws-community-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 4px;
    border-bottom: 1px solid var(--wsbd); text-decoration: none; color: inherit;
    transition: background 0.1s;
  }
  .ws-community-row:hover { background: rgba(255,255,255,0.03); }
  .ws-com-icon {
    width: 48px; height: 48px; border-radius: 12px; background: rgba(245,166,35,0.12);
    color: var(--wsgold); display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; overflow: hidden;
  }
  .ws-com-icon img { width: 100%; height: 100%; object-fit: cover; }
  .ws-com-info { flex: 1; min-width: 0; }
  .ws-com-name { font-weight: 700; font-size: 17px; display: block; }
  .ws-com-desc { font-size: 15px; color: var(--wst2); margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ws-com-members { font-size: 14px; color: var(--wst3); }

  /* Skeletons */
  .ws-loading { padding: 12px 4px; }
  .ws-skel-row { display: flex; gap: 12px; align-items: center; padding: 14px 0; }
  .ws-skel-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .ws-skel { background: var(--wsbd); border-radius: 6px; animation: wsShimmer 1.5s infinite; }
  .ws-skel-av { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; }
  .ws-skel-name { height: 14px; width: 140px; }
  .ws-skel-desc { height: 10px; width: 200px; }
  @keyframes wsShimmer { 0% { opacity: 0.3; } 50% { opacity: 0.6; } 100% { opacity: 0.3; } }

  @media (max-width: 768px) {
    .ws-body { padding: 0; }
    .ws-user-row, .ws-post-card, .ws-community-row { padding: 14px 14px; }
    .ws-topbar { padding: 8px 8px; }
    .ws-body { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0)); }
  }
</style>
