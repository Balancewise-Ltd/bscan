<script lang="ts">
  export const prerender = false;
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';

  let slug = $state('');
  let community = $state<any>(null);
  let posts = $state<any[]>([]);
  let members = $state<any[]>([]);
  let loading = $state(true);
  let activeTab = $state<'feed'|'members'|'about'>('feed');
  let newPost = $state('');
  let posting = $state(false);
  let postImage = $state<File|null>(null);
  let postImagePreview = $state('');

  onMount(async () => {
    slug = $page.params.slug;
    try {
      community = await api.getCommunity(slug);
      const feed = await api.getCommunityFeedBySlug(slug);
      posts = feed.posts || [];
    } catch {}
    loading = false;
  });

  async function loadMembers() {
    try { members = (await api.getCommunityMembers(slug)).members || []; } catch {}
  }

  async function handleJoin() {
    try { await api.joinCommunity(slug); community = await api.getCommunity(slug); } catch {}
  }
  async function handleLeave() {
    if (!confirm('Leave this community?')) return;
    try { await api.leaveCommunity(slug); community = await api.getCommunity(slug); } catch {}
  }

  async function submitPost() {
    if (!newPost.trim() || posting) return;
    posting = true;
    try {
      let imageUrl = '';
      if (postImage) {
        const res = await api.uploadPostImage(postImage);
        imageUrl = res.url;
      }
      await api.postToCommunity(slug, { content: newPost, image_url: imageUrl });
      newPost = ''; postImage = null; postImagePreview = '';
      const feed = await api.getCommunityFeedBySlug(slug);
      posts = feed.posts || [];
    } catch {}
    posting = false;
  }

  function handleImageSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || file.size > 20 * 1024 * 1024) return;
    postImage = file;
    postImagePreview = URL.createObjectURL(file);
  }
  function removeImage() { postImage = null; postImagePreview = ''; }

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }
  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
</script>

<svelte:head><title>{community?.name || 'Community'} — Wisers</title></svelte:head>

<div class="cd-page">
  {#if loading}
    <div class="cd-loading">Loading...</div>
  {:else if !community}
    <div class="cd-loading">Community not found.</div>
  {:else}
    <div class="cd-hero">
      <a href="/wisers/communities" class="cd-back">← Communities</a>
      <div class="cd-hero-top">
        <div class="cd-icon">{initial(community.name)}</div>
        <div class="cd-hero-info">
          <h1>{community.name}</h1>
          <div class="cd-meta">{community.member_count} members · {community.post_count} posts · {community.category}</div>
        </div>
        {#if $auth.token}
          {#if community.is_member}
            <button class="cd-leave" onclick={handleLeave}>Leave</button>
          {:else}
            <button class="cd-join" onclick={handleJoin}>Join</button>
          {/if}
        {/if}
      </div>
      {#if community.description}
        <p class="cd-desc">{community.description}</p>
      {/if}
    </div>

    <div class="cd-tabs">
      <button class:active={activeTab === 'feed'} onclick={() => activeTab = 'feed'}>Feed</button>
      <button class:active={activeTab === 'members'} onclick={() => { activeTab = 'members'; loadMembers(); }}>Members</button>
      <button class:active={activeTab === 'about'} onclick={() => activeTab = 'about'}>About</button>
    </div>

    {#if activeTab === 'feed'}
      {#if community.is_member}
        <div class="cd-composer">
          <textarea bind:value={newPost} placeholder="Share with {community.name}..." maxlength="2000" rows="2"></textarea>
          {#if postImagePreview}
            <div class="cd-img-preview"><img src={postImagePreview} alt="" /><button onclick={removeImage}>✕</button></div>
          {/if}
          <div class="cd-composer-bar">
            <button class="cd-photo-btn" aria-label="Add image" onclick={() => document.getElementById('cd-img-input')?.click()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            </button>
            <input id="cd-img-input" type="file" accept="image/*" onchange={handleImageSelect} style="display:none" />
            <span class="cd-char">{newPost.length}/2000</span>
            <button class="cd-post-btn" onclick={submitPost} disabled={posting || !newPost.trim()}>{posting ? 'Posting...' : 'Post'}</button>
          </div>
        </div>
      {:else}
        <div class="cd-join-prompt">Join this community to post and participate.</div>
      {/if}

      {#if posts.length === 0}
        <div class="cd-empty">No posts yet. Be the first to share something.</div>
      {:else}
        {#each posts as post}
          <div class="cd-post">
            <div class="cd-post-header">
              <a href="/wisers/{post.username}" class="cd-avatar">{#if post.avatar_url}<img src={post.avatar_url} alt="" />{:else}{initial(post.display_name || post.user_name)}{/if}</a>
              <div class="cd-post-meta">
                <a href="/wisers/{post.username}" class="cd-post-author">{post.display_name || post.user_name}</a>
                <span class="cd-post-handle">@{post.username} · {timeAgo(post.created_at)}</span>
              </div>
            </div>
            {#if post.milestone_type}
              <div class="cd-milestone">🏆 {post.milestone_value}</div>
            {/if}
            <div class="cd-post-body">{post.content}</div>
            {#if post.image_url}<div class="cd-post-img"><img src={post.image_url} alt="" loading="lazy" /></div>{/if}
          </div>
        {/each}
      {/if}

    {:else if activeTab === 'members'}
      {#if members.length === 0}
        <div class="cd-empty">Loading members...</div>
      {:else}
        <div class="cd-members">
          {#each members as m}
            <a href="/wisers/{m.username}" class="cd-member">
              <div class="cd-m-avatar">{#if m.avatar_url}<img src={m.avatar_url} alt="" />{:else}{initial(m.display_name || m.username)}{/if}</div>
              <div class="cd-m-info">
                <div class="cd-m-name">{m.display_name || m.username}</div>
                <div class="cd-m-role">{m.role}</div>
              </div>
            </a>
          {/each}
        </div>
      {/if}

    {:else}
      <div class="cd-about">
        <h3>About</h3>
        <p>{community.description || 'No description.'}</p>
        {#if community.rules}
          <h3>Rules</h3>
          <p class="cd-rules">{community.rules}</p>
        {/if}
        <div class="cd-about-meta">
          <div>Created by <a href="/wisers/{community.creator_username}">@{community.creator_username}</a></div>
          <div>Category: {community.category}</div>
          <div>Privacy: {community.privacy}</div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .cd-page { max-width: 680px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e2e8f0; min-height: 100vh; }
  .cd-loading { text-align: center; color: #475569; padding: 60px; }
  .cd-back { color: #f5a623; text-decoration: none; font-size: 14px; }
  .cd-back:hover { text-decoration: underline; }
  .cd-hero { background: #141420; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; margin: 12px 0 16px; }
  .cd-hero-top { display: flex; align-items: center; gap: 14px; }
  .cd-icon { width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 26px; flex-shrink: 0; }
  .cd-hero-info { flex: 1; }
  .cd-hero-info h1 { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
  .cd-meta { font-size: 13px; color: #64748b; margin-top: 4px; }
  .cd-desc { font-size: 14px; color: #94a3b8; margin: 12px 0 0; line-height: 1.5; }
  .cd-join { background: #f5a623; color: #000; border: none; padding: 8px 24px; border-radius: 20px; font-weight: 700; font-size: 14px; cursor: pointer; flex-shrink: 0; font-family: inherit; }
  .cd-join:hover { background: #e09100; }
  .cd-leave { background: none; border: 1px solid #ef4444; color: #ef4444; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 13px; cursor: pointer; flex-shrink: 0; font-family: inherit; }
  .cd-leave:hover { background: rgba(239,68,68,0.1); }
  .cd-tabs { display: flex; gap: 4px; border-bottom: 1px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
  .cd-tabs button { background: none; border: none; color: #64748b; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: inherit; }
  .cd-tabs button.active { color: #f5a623; background: rgba(245,166,35,0.1); }
  .cd-composer { background: #141420; border: 1px solid #1e293b; border-radius: 14px; padding: 14px; margin-bottom: 16px; }
  .cd-composer textarea { width: 100%; background: transparent; border: none; color: #e2e8f0; font-size: 15px; resize: none; font-family: inherit; box-sizing: border-box; }
  .cd-composer textarea:focus { outline: none; }
  .cd-composer-bar { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .cd-photo-btn { background: none; border: none; color: #64748b; cursor: pointer; padding: 4px; }
  .cd-photo-btn:hover { color: #f5a623; }
  .cd-char { font-size: 12px; color: #475569; margin-left: auto; }
  .cd-post-btn { background: #f5a623; color: #000; border: none; padding: 6px 20px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
  .cd-post-btn:disabled { opacity: 0.5; }
  .cd-img-preview { position: relative; margin: 8px 0; border-radius: 12px; overflow: hidden; }
  .cd-img-preview img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; }
  .cd-img-preview button { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff; border: none; cursor: pointer; font-size: 14px; }
  .cd-join-prompt { text-align: center; color: #64748b; padding: 20px; background: #141420; border: 1px solid #1e293b; border-radius: 14px; margin-bottom: 16px; font-size: 14px; }
  .cd-empty { text-align: center; color: #475569; padding: 40px; }
  .cd-post { background: #141420; border: 1px solid #1e293b; border-radius: 14px; padding: 16px; margin-bottom: 10px; }
  .cd-post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .cd-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #000; text-decoration: none; font-size: 16px; flex-shrink: 0; overflow: hidden; }
  .cd-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cd-post-author { font-weight: 600; color: #e2e8f0; text-decoration: none; font-size: 14px; }
  .cd-post-author:hover { color: #f5a623; }
  .cd-post-handle { color: #64748b; font-size: 13px; }
  .cd-milestone { background: linear-gradient(135deg, rgba(245,166,35,0.15), rgba(245,166,35,0.05)); border: 1px solid rgba(245,166,35,0.3); border-radius: 10px; padding: 10px 14px; font-weight: 700; color: #f5a623; margin-bottom: 8px; font-size: 15px; }
  .cd-post-body { font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .cd-post-img { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .cd-post-img img { width: 100%; max-height: 500px; object-fit: cover; display: block; }
  .cd-members { display: flex; flex-direction: column; gap: 8px; }
  .cd-member { display: flex; align-items: center; gap: 12px; padding: 12px; background: #141420; border: 1px solid #1e293b; border-radius: 12px; text-decoration: none; color: inherit; }
  .cd-member:hover { border-color: #f5a623; }
  .cd-m-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #000; font-size: 18px; overflow: hidden; flex-shrink: 0; }
  .cd-m-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cd-m-name { font-weight: 600; font-size: 14px; }
  .cd-m-role { font-size: 12px; color: #64748b; text-transform: capitalize; }
  .cd-about { background: #141420; border: 1px solid #1e293b; border-radius: 14px; padding: 20px; }
  .cd-about h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #f5a623; }
  .cd-about p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
  .cd-rules { white-space: pre-wrap; }
  .cd-about-meta { font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 4px; }
  .cd-about-meta a { color: #f5a623; text-decoration: none; }
</style>
