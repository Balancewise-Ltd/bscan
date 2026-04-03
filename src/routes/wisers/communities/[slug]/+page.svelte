<script lang="ts">
  export const prerender = false;
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';
  import { timeAgo } from '$lib/utils/time';

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
  let joining = $state(false);
  let theme = $state<'dark'|'light'>('dark');
  let showSettings = $state(false);
  let settingsName = $state('');
  let settingsDesc = $state('');
  let settingsRules = $state('');
  let settingsCategory = $state('');
  let settingsPrivacy = $state('public');
  let savingSettings = $state(false);

  function openSettings() {
    settingsName = community?.name || '';
    settingsDesc = community?.description || '';
    settingsRules = community?.rules || '';
    settingsCategory = community?.category || '';
    settingsPrivacy = community?.privacy || 'public';
    showSettings = true;
  }

  async function saveSettings() {
    savingSettings = true;
    try {
      await api.updateCommunity(slug, { name: settingsName, description: settingsDesc, rules: settingsRules, category: settingsCategory, privacy: settingsPrivacy });
      community = { ...community, name: settingsName, description: settingsDesc, rules: settingsRules, category: settingsCategory, privacy: settingsPrivacy };
      showSettings = false;
    } catch {}
    savingSettings = false;
  }

  async function handleDelete() {
    if (!confirm('Delete this community? This cannot be undone.')) return;
    try { await api.deleteCommunity(slug); window.location.href = '/wisers/communities'; } catch {}
  }

  onMount(async () => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; }
    else if (!saved && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) { theme = 'light'; }
    if (typeof document !== 'undefined') { document.documentElement.setAttribute('data-wisers-theme', theme); document.body.style.background = theme === 'light' ? '#ffffff' : '#0a0a0f'; }
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
    if (joining) return;
    joining = true;
    try {
      await api.joinCommunity(slug);
      community = { ...community, is_member: true, my_role: 'member', member_count: (community.member_count || 0) + 1 };
    } catch (e: any) {
      // 409 = already a member, still mark as joined
      if (e.status === 409 || e.message?.includes('409')) {
        community = { ...community, is_member: true };
      } else {
        // Re-fetch community state to get truth from server
        try {
          const fresh = await api.getCommunity(slug);
          community = fresh;
        } catch {}
      }
    }
    joining = false;
  }
  async function handleLeave() {
    if (!confirm('Leave this community?')) return;
    try {
      await api.leaveCommunity(slug);
      community = { ...community, is_member: false, my_role: null, member_count: Math.max(0, (community.member_count || 1) - 1) };
    } catch {}
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
  function removeImage() { if (postImagePreview) URL.revokeObjectURL(postImagePreview); postImage = null; postImagePreview = ''; }

  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
</script>

<svelte:head><title>{community?.name || 'Community'} — Wisers</title></svelte:head>

<div class="cd-page" class:light={theme === "light"}>
  <div class="cd-inner">
  {#if loading}
    <div class="cd-loading">Loading...</div>
  {:else if !community}
    <div class="cd-loading">Community not found.</div>
  {:else}
    <div class="cd-hero">
      <a href="/wisers/communities" class="cd-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Communities</a>
      <div class="cd-hero-top">
        <div class="cd-icon">{initial(community.name)}</div>
        <div class="cd-hero-info">
          <h1>{community.name}</h1>
          <div class="cd-meta">{community.member_count} members · {community.post_count} posts · {community.category}</div>
        </div>
        {#if $auth.token}
          {#if community.is_member}
            {#if community.my_role === 'admin' || community.my_role === 'creator'}
              <button class="cd-settings-btn" onclick={openSettings} title="Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              </button>
            {/if}
            <button class="cd-joined" onclick={handleLeave}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Joined
            </button>
          {:else}
            <button class="cd-join" onclick={handleJoin} disabled={joining}>{joining ? 'Joining...' : 'Join'}</button>
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
                <a href="/wisers/{post.username}" class="cd-post-author">{post.display_name || post.user_name}</a>{#if post.plan === 'pro' || post.plan === 'agency'}<span class="cd-badge" style="fill:{post.plan === 'agency' ? '#f5a623' : '#3b82f6'}"><svg viewBox="0 0 22 22" width="16" height="16"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg></span>{/if}
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
      <div class="cd-about-grid">
        <!-- Description card -->
        <div class="cd-about-card cd-about-desc-card">
          <div class="cd-about-card-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <h3>About this community</h3>
          </div>
          <p class="cd-about-desc-text">{community.description || 'No description yet.'}</p>
        </div>

        <!-- Stats card -->
        <div class="cd-about-card">
          <div class="cd-about-card-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3>Community stats</h3>
          </div>
          <div class="cd-about-stats">
            <div class="cd-about-stat">
              <div class="cd-about-stat-num">{community.member_count || 0}</div>
              <div class="cd-about-stat-label">Members</div>
            </div>
            <div class="cd-about-stat">
              <div class="cd-about-stat-num">{community.post_count || 0}</div>
              <div class="cd-about-stat-label">Posts</div>
            </div>
            <div class="cd-about-stat">
              <div class="cd-about-stat-num">{community.privacy === 'public' ? 'Public' : 'Private'}</div>
              <div class="cd-about-stat-label">Visibility</div>
            </div>
          </div>
        </div>

        <!-- Rules card -->
        <div class="cd-about-card">
          <div class="cd-about-card-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <h3>Community rules</h3>
          </div>
          {#if community.rules}
            <div class="cd-about-rules">
              {#each community.rules.split('\n').filter((r: string) => r.trim()) as rule, i}
                <div class="cd-about-rule">
                  <span class="cd-about-rule-num">{i + 1}</span>
                  <span>{rule.trim()}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="cd-about-rules">
              <div class="cd-about-rule"><span class="cd-about-rule-num">1</span><span>Be respectful and supportive of all members</span></div>
              <div class="cd-about-rule"><span class="cd-about-rule-num">2</span><span>No spam, self-promotion, or off-topic content</span></div>
              <div class="cd-about-rule"><span class="cd-about-rule-num">3</span><span>Share knowledge and help others grow</span></div>
            </div>
          {/if}
        </div>

        <!-- Details card -->
        <div class="cd-about-card">
          <div class="cd-about-card-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <h3>Details</h3>
          </div>
          <div class="cd-about-details">
            <div class="cd-about-detail-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Created by</span>
              <a href="/wisers/{community.creator_username}" class="cd-about-creator">
                <span class="cd-about-creator-badge">{initial(community.creator_username)}</span>
                Wiser
              </a>
            </div>
            <div class="cd-about-detail-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              <span>Category</span>
              <strong class="cd-about-category">{community.category}</strong>
            </div>
            <div class="cd-about-detail-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">{#if community.privacy === 'public'}<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>{:else}<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>{/if}</svg>
              <span>Privacy</span>
              <strong>{community.privacy === 'public' ? 'Open to everyone' : 'Invite only'}</strong>
            </div>
            {#if community.created_at}
              <div class="cd-about-detail-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>Created</span>
                <strong>{new Date(community.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
  </div>
</div>

<!-- Settings Modal -->
{#if showSettings}
  <div class="cd-modal-overlay" onclick={() => showSettings = false} role="presentation">
    <div class="cd-modal" onclick={(e) => e.stopPropagation()}>
      <div class="cd-modal-header">
        <h3>Community Settings</h3>
        <button class="cd-modal-close" onclick={() => showSettings = false}>✕</button>
      </div>
      <div class="cd-modal-body">
        <label class="cd-field">
          <span>Name</span>
          <input type="text" bind:value={settingsName} maxlength="50" />
        </label>
        <label class="cd-field">
          <span>Description</span>
          <textarea bind:value={settingsDesc} maxlength="500" rows="3"></textarea>
        </label>
        <label class="cd-field">
          <span>Category</span>
          <select bind:value={settingsCategory}>
            <option value="general">General</option>
            <option value="side-hustle">Side Hustle</option>
            <option value="ecommerce">E-Commerce</option>
            <option value="investing">Investing</option>
            <option value="tech">Tech</option>
            <option value="freelance">Freelance</option>
            <option value="saas">SaaS</option>
            <option value="crypto">Crypto</option>
            <option value="property">Property</option>
            <option value="content-creation">Content Creation</option>
            <option value="careers">Careers</option>
            <option value="fire">FIRE</option>
            <option value="students">Students</option>
          </select>
        </label>
        <label class="cd-field">
          <span>Privacy</span>
          <select bind:value={settingsPrivacy}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label class="cd-field">
          <span>Rules (one per line)</span>
          <textarea bind:value={settingsRules} rows="4" placeholder="Be respectful&#10;No spam&#10;Stay on topic"></textarea>
        </label>
      </div>
      <div class="cd-modal-footer">
        <button class="cd-delete-btn" onclick={handleDelete}>Delete Community</button>
        <button class="cd-save-btn" onclick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .cd-page { width: 100%; min-height: 100vh; margin: 0; padding: 0;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--cd-t); background: var(--cd-bg);
    --cd-bg: #0a0a0f; --cd-card: #111117; --cd-t: #e4e6ea; --cd-t2: #8a8d91; --cd-t3: #606770; --cd-bd: #1e1e2a; --cd-gold: #f5a623; --cd-hover: rgba(255,255,255,0.04); }
  .cd-page.light { --cd-bg: #ffffff; --cd-card: #ffffff; --cd-t: #1c1e21; --cd-t2: #606770; --cd-t3: #8a8d91; --cd-bd: #dddfe2; --cd-gold: #d4a017; --cd-hover: rgba(0,0,0,0.04); }
  :global(body) { margin: 0; }
  :global(.page) { padding: 0 !important; }
  .cd-inner { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
  .cd-loading { text-align: center; color: var(--cd-t3); padding: 60px; }
  .cd-back { color: var(--cd-gold); text-decoration: none; font-size: 15px; display: inline-flex; align-items: center; gap: 6px; }
  .cd-back:hover { text-decoration: underline; }
  .cd-hero { background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: 16px; padding: 20px; margin: 12px 0 16px; }
  .cd-hero-top { display: flex; align-items: center; gap: 14px; }
  .cd-icon { width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 26px; flex-shrink: 0; }
  .cd-hero-info { flex: 1; }
  .cd-hero-info h1 { font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.3px; color: var(--cd-t); }
  .cd-meta { font-size: 15px; color: var(--cd-t3); margin-top: 4px; }
  .cd-desc { font-size: 15px; color: var(--cd-t2); margin: 12px 0 0; line-height: 1.5; }
  .cd-join { background: var(--cd-gold); color: #000; border: none; padding: 8px 24px; border-radius: 20px; font-weight: 700; font-size: 16px; cursor: pointer; flex-shrink: 0; font-family: inherit; }
  .cd-join:hover { filter: brightness(0.9); }
  .cd-joined { background: none; border: 1.5px solid #10b981; color: #10b981; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 15px; cursor: pointer; flex-shrink: 0; font-family: inherit; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
  .cd-joined:hover { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,0.06); }
  .cd-leave { background: none; border: 1px solid #ef4444; color: #ef4444; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 15px; cursor: pointer; flex-shrink: 0; font-family: inherit; }
  .cd-leave:hover { background: rgba(239,68,68,0.1); }
  .cd-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--cd-bd); padding-bottom: 12px; margin-bottom: 16px; }
  .cd-tabs button { background: none; border: none; color: var(--cd-t3); font-size: 16px; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: inherit; }
  .cd-tabs button.active { color: var(--cd-gold); background: rgba(245,166,35,0.1); }
  .cd-composer { background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: 14px; padding: 14px; margin-bottom: 16px; }
  .cd-composer textarea { width: 100%; background: transparent; border: none; color: var(--cd-t); font-size: 17px; resize: none; font-family: inherit; box-sizing: border-box; }
  .cd-composer textarea:focus { outline: none; }
  .cd-composer-bar { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .cd-photo-btn { background: none; border: none; color: var(--cd-t3); cursor: pointer; padding: 4px; }
  .cd-photo-btn:hover { color: var(--cd-gold); }
  .cd-char { font-size: 14px; color: var(--cd-t3); margin-left: auto; }
  .cd-post-btn { background: var(--cd-gold); color: #000; border: none; padding: 6px 20px; border-radius: 20px; font-weight: 700; font-size: 15px; cursor: pointer; font-family: inherit; }
  .cd-post-btn:disabled { opacity: 0.5; }
  .cd-img-preview { position: relative; margin: 8px 0; border-radius: 12px; overflow: hidden; }
  .cd-img-preview img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; }
  .cd-img-preview button { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff; border: none; cursor: pointer; font-size: 14px; }
  .cd-join-prompt { text-align: center; color: var(--cd-t3); padding: 20px; background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: 14px; margin-bottom: 16px; font-size: 16px; }
  .cd-empty { text-align: center; color: var(--cd-t3); padding: 40px; }
  .cd-post { background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: 14px; padding: 16px; margin-bottom: 10px; }
  .cd-post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .cd-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #000; text-decoration: none; font-size: 16px; flex-shrink: 0; overflow: hidden; }
  .cd-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cd-post-author { font-weight: 600; color: var(--cd-t); text-decoration: none; font-size: 16px; }
  .cd-post-author:hover { color: var(--cd-gold); }
  .cd-post-handle { color: var(--cd-t3); font-size: 15px; }
  .cd-milestone { background: linear-gradient(135deg, rgba(245,166,35,0.15), rgba(245,166,35,0.05)); border: 1px solid rgba(245,166,35,0.3); border-radius: 10px; padding: 10px 14px; font-weight: 700; color: var(--cd-gold); margin-bottom: 8px; font-size: 17px; }
  .cd-post-body { font-size: 17px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .cd-post-img { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .cd-post-img img { width: 100%; max-height: 500px; object-fit: cover; display: block; }
  .cd-members { display: flex; flex-direction: column; gap: 8px; }
  .cd-member { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: 12px; text-decoration: none; color: inherit; }
  .cd-member:hover { border-color: var(--cd-gold); }
  .cd-m-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #000; font-size: 18px; overflow: hidden; flex-shrink: 0; }
  .cd-m-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cd-m-name { font-weight: 600; font-size: 16px; }
  .cd-m-role { font-size: 14px; color: var(--cd-t3); text-transform: capitalize; }
  /* About grid */
  .cd-about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .cd-about-card { background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: 16px; padding: 24px; }
  .cd-about-desc-card { grid-column: 1 / -1; }
  .cd-about-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .cd-about-card-head svg { color: var(--cd-gold); flex-shrink: 0; }
  .cd-about-card-head h3 { font-size: 18px; font-weight: 700; margin: 0; color: var(--cd-t); }
  .cd-about-desc-text { font-size: 17px; color: var(--cd-t2); line-height: 1.7; margin: 0; white-space: pre-wrap; }

  /* Stats */
  .cd-about-stats { display: flex; gap: 0; }
  .cd-about-stat { flex: 1; text-align: center; padding: 16px 8px; border-right: 1px solid var(--cd-bd); }
  .cd-about-stat:last-child { border-right: none; }
  .cd-about-stat-num { font-size: 24px; font-weight: 800; color: var(--cd-t); }
  .cd-about-stat-label { font-size: 14px; color: var(--cd-t3); margin-top: 4px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

  /* Rules */
  .cd-about-rules { display: flex; flex-direction: column; gap: 0; }
  .cd-about-rule { display: flex; align-items: flex-start; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--cd-bd); font-size: 16px; color: var(--cd-t2); line-height: 1.5; }
  .cd-about-rule:last-child { border-bottom: none; }
  .cd-about-rule-num { width: 28px; height: 28px; border-radius: 50%; background: rgba(245,166,35,0.12); color: var(--cd-gold); font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

  /* Details */
  .cd-about-details { display: flex; flex-direction: column; gap: 0; }
  .cd-about-detail-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--cd-bd); font-size: 16px; color: var(--cd-t2); }
  .cd-about-detail-row:last-child { border-bottom: none; }
  .cd-about-detail-row svg { color: var(--cd-t3); flex-shrink: 0; }
  .cd-about-detail-row span:nth-child(2) { min-width: 80px; }
  .cd-about-detail-row strong { color: var(--cd-t); margin-left: auto; }
  .cd-about-creator { display: flex; align-items: center; gap: 8px; color: var(--cd-gold); text-decoration: none; font-weight: 600; margin-left: auto; }
  .cd-about-creator:hover { text-decoration: underline; }
  .cd-about-creator-badge { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--cd-gold), #e09100); color: #000; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .cd-about-category { background: rgba(245,166,35,0.1); color: var(--cd-gold); padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 600; margin-left: auto; }

  .cd-badge { display:inline-flex;vertical-align:middle;margin-left:2px; }

  @media (max-width: 700px) {
    .cd-about-grid { grid-template-columns: 1fr; }
  }
  :global(input, textarea, select) { font-size: 16px !important; -webkit-text-size-adjust: 100%; }

  /* Settings button */
  .cd-settings-btn { background: none; border: 1px solid var(--cpbd, #1e1e2a); border-radius: 8px; color: var(--cpt2, #8a8d91); cursor: pointer; padding: 6px 8px; transition: all 0.15s; }
  .cd-settings-btn:hover { border-color: var(--cpgold, #f5a623); color: var(--cpgold, #f5a623); }

  /* Modal */
  .cd-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 500; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
  .cd-modal { background: var(--cpcard, #16161f); border: 1px solid var(--cpbd, #1e1e2a); border-radius: 16px; width: 90%; max-width: 480px; max-height: 85vh; overflow-y: auto; }
  .cd-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--cpbd, #1e1e2a); }
  .cd-modal-header h3 { margin: 0; font-size: 22px; font-weight: 700; }
  .cd-modal-close { background: none; border: none; color: var(--cpt2, #8a8d91); cursor: pointer; font-size: 18px; }
  .cd-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .cd-field { display: flex; flex-direction: column; gap: 6px; }
  .cd-field span { font-size: 15px; font-weight: 600; color: var(--cpt2, #8a8d91); text-transform: uppercase; letter-spacing: 0.5px; }
  .cd-field input, .cd-field textarea, .cd-field select { padding: 10px 12px; border: 1px solid var(--cpbd, #1e1e2a); border-radius: 8px; background: var(--cpbg, #0a0a0f); color: var(--cpt, #e4e6ea); font-family: inherit; font-size: 16px; }
  .cd-field textarea { resize: vertical; }
  .cd-modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-top: 1px solid var(--cpbd, #1e1e2a); }
  .cd-save-btn { padding: 10px 24px; border-radius: 8px; background: var(--cpgold, #f5a623); color: #000; font-weight: 600; border: none; cursor: pointer; }
  .cd-save-btn:disabled { opacity: 0.5; }
  .cd-delete-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 15px; font-weight: 500; }
  .cd-delete-btn:hover { text-decoration: underline; }

  </style>
