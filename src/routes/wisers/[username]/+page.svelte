<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
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
  let followStatus = $state<{ i_follow: boolean; they_follow: boolean }>({ i_follow: false, they_follow: false });
  let followersCount = $state(0);
  let followingCount = $state(0);
  let isBlocked = $state(false);
  let editData = $state<any>({});
  let saving = $state(false);
  let bookmarkedPosts = $state(new Set<number>());
  let expandedComments = $state(new Set<number>());
  let postComments = $state<Record<number, any[]>>({});
  let editingPost = $state<number | null>(null);
  let editingContent = $state('');
  let openPostMenu = $state<number | null>(null);
  let avatarUploading = $state(false);
  let theme = $state<'dark'|'light'>('dark');
  let journeyData = $state<any>({ entries: [], goals: [] });
  let userCommunities = $state<any[]>([]);

  onMount(() => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; }
    else if (!saved && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) { theme = 'light'; }
    if (typeof document !== 'undefined') { document.documentElement.setAttribute('data-wisers-theme', theme); document.body.style.background = theme === 'light' ? '#ffffff' : '#0a0a0f'; document.addEventListener('click', () => { openPostMenu = null; }); }
  });

  $effect(() => { const u = $page.params.username; if (u) loadProfile(u); });

  async function loadProfile(username: string) {
    loading = true; error = '';
    try {
      profile = await api.getCommunityProfile(username);
      if ($auth.token) { 
        status = (await api.getFriendshipStatus(username).catch(() => ({ status: 'none' }))).status;
        if (status !== 'self') {
          try { followStatus = await api.getFollowStatus(username); } catch {}
          try { followersCount = (await api.getFollowers(username)).followers?.length || 0; } catch {}
          try { followingCount = (await api.getFollowing(username)).following?.length || 0; } catch {}
        }
      }
      try { posts = ((await api.getUserPosts(username)).posts || []).map(p => ({ ...p, _liked: !!p.my_liked, my_rocket: !!p.my_rocketed, my_repost: !!p.my_reposted })); } catch {}
    } catch (e: any) { error = e.message || 'User not found'; }
    loading = false;
    // Load journey + communities
    try { journeyData = await api.getJourney(username); } catch {}
    try { userCommunities = (await api.getMyCommunities()).communities || []; } catch {}
  }

  async function addFriend() {
    try { const r = await api.sendFriendRequest(profile.username); actionMsg = r.message; status = r.status === 'accepted' ? 'friends' : 'request_sent'; } catch (e: any) { actionMsg = e.message; }
    setTimeout(() => actionMsg = '', 3000);
  }
  async function removeFriend() { if (!confirm('Unfriend?')) return; await api.unfriend(profile.username); status = 'none'; }

  function startEdit() {
    editData = { display_name: profile.display_name || profile.name || '', bio: profile.bio || '', headline: profile.headline || '', company: profile.company || '', website: profile.website || '',
      skills: profile.skills || '', work_history: profile.work_history || '', education: profile.education || '',
      certifications: profile.certifications || '', languages: profile.languages || '', interests: profile.interests || '',
      github_url: profile.github_url || '', linkedin_url: profile.linkedin_url || '', twitter_url: profile.twitter_url || '',
      messages_from: profile.messages_from || 'everyone' };
    editing = true;
  }
  async function saveProfile() {
    saving = true;
    try {
      await api.updateProfile($auth.user?.email || '', editData);
      Object.assign(profile, editData);
      editing = false; actionMsg = 'Saved!';
    } catch { actionMsg = 'Failed'; }
    saving = false; setTimeout(() => actionMsg = '', 3000);
  }

  function avatarSrc(url: string | null): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : 'https://api-bscan.balancewises.io/avatars/' + url;
  }
  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
  function timeAgo(d: string) {
    if (!d) return '';
    const date = new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z');
    const now = new Date();
    const s = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function planColor(p: string) { return p === 'agency' ? '#f5a623' : p === 'pro' ? '#3b82f6' : '#555'; }
  function parseList(s: string) { return (s || '').split(',').map(i => i.trim()).filter(Boolean); }
  function parseEntries(s: string) { return (s || '').split('\n').filter(l => l.trim()); }

  const badge = '<svg viewBox="0 0 22 22" width="18" height="18"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg>';

  function renderContent(text: string): string {
    if (!text) return '';
    let html = text.replace(/#(\w{2,30})/g, '<a href="/wisers?tag=$1" style="color:var(--gold);text-decoration:none">#$1</a>');
    html = html.replace(/@(\w{2,30})/g, '<a href="/wisers/$1" style="color:var(--gold);text-decoration:none">@$1</a>');
    return html;
  }

  async function handleAvatarUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    avatarUploading = true;
    try {
      const res = await api.uploadAvatar(file);
      if (res.url) { profile.avatar_url = res.url; if ($auth.user) $auth.user.avatar_url = res.url; }
    } catch { alert('Upload failed'); }
    avatarUploading = false;
  }

  function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    auth.set({ token: null, user: null });
    goto('/wisers');
  }

  async function handleFollow() {
    if (!$auth.token || !profile) return;
    try {
      if (followStatus.i_follow) {
        await api.unfollowUser(profile.username);
        followStatus = { ...followStatus, i_follow: false };
        followersCount = Math.max(0, followersCount - 1);
      } else {
        await api.followUser(profile.username);
        followStatus = { ...followStatus, i_follow: true };
        followersCount += 1;
      }
    } catch {}
  }

  async function handleBlock() {
    if (!$auth.token || !profile) return;
    if (confirm('Block @' + profile.username + '? This will unfriend and prevent interaction.')) {
      try {
        await api.blockUser(profile.username);
        isBlocked = true;
      } catch {}
    }
  }

  async function handleMute() {
    if (!$auth.token || !profile) return;
    try {
      await api.muteUser(profile.username);
      alert('Muted @' + profile.username);
    } catch {}
  }

  async function toggleLike(postId: number) {
    if (!$auth.token) return;
    try {
      const res = await api.likePost(postId);
      posts = posts.map(p => p.id === postId ? { ...p, likes_count: res.liked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1), _liked: res.liked } : p);
    } catch {}
  }

  async function handleRocket(post: any) {
    if (!$auth.token) return;
    try {
      const res = await api.rocketPost(post.id);
      posts = posts.map(p => p.id === post.id ? { ...p, rockets_count: (p.rockets_count || 0) + (res.rocketed ? 1 : -1), my_rocket: res.rocketed } : p);
    } catch {}
  }

  async function handleRepost(post: any) {
    if (!$auth.token) return;
    try {
      const res = await api.repostPost(post.id);
      posts = posts.map(p => p.id === post.id ? { ...p, reposts_count: (p.reposts_count || 0) + (res.reposted ? 1 : -1), my_repost: res.reposted } : p);
    } catch {}
  }

  async function toggleComments(postId: number) {
    const s = new Set(expandedComments);
    if (s.has(postId)) { s.delete(postId); expandedComments = s; return; }
    s.add(postId); expandedComments = s;
    try {
      const res = await api.getComments(postId);
      postComments = { ...postComments, [postId]: res.comments || [] };
    } catch {}
  }

  async function handleBookmark(post: any) {
    if (!$auth.token) return;
    try {
      const res = await api.bookmarkPost(post.id);
      const s = new Set(bookmarkedPosts);
      if (res.bookmarked) { s.add(post.id); } else { s.delete(post.id); }
      bookmarkedPosts = s;
    } catch {}
  }

  async function handleEditPost(post: any) {
    if (editingPost === post.id) {
      try {
        await api.editPost(post.id, editingContent);
        posts = posts.map(p => p.id === post.id ? { ...p, content: editingContent } : p);
      } catch {}
      editingPost = null; editingContent = '';
    } else {
      editingPost = post.id; editingContent = post.content;
    }
  }

  async function removePost(postId: number) {
    if (!confirm('Delete this post?')) return;
    try {
      await api.deletePost(postId);
      posts = posts.filter(p => p.id !== postId);
    } catch {}
  }
</script>

<svelte:head>
  <title>{profile?.username ? '@' + profile.username + ' — Wisers' : 'Profile'}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  {#if profile}<meta property="og:title" content="@{profile.username} on Wisers" /><meta name="robots" content="index, follow" />{/if}
</svelte:head>

<div class="pr" class:light={theme === "light"}>
<div class="pr-back-bar"><a href="/wisers" class="pr-back-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Feed</a></div>
{#if loading}<div class="pr-center"><div class="pr-spin"></div></div>
{:else if error}<div class="pr-center"><p>{error}</p><a href="/wisers">Back to Wisers</a></div>
{:else if profile}

  <div class="pr-banner"></div>

  <div class="pr-wrap">
    <div class="pr-top">
      <div class="pr-av">{#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{:else}{initial(profile.display_name || profile.name)}{/if}</div>
      <div class="pr-top-right">
        {#if $auth.token && status === 'self'}
          <button class="pr-btn pr-btn-o" onclick={startEdit}>Edit profile</button>
          <a href="/account" class="pr-btn pr-btn-o">Settings</a>
        {:else if $auth.token}
          {#if status === 'friends'}<a href="/wisers/messages?user={profile.username}" class="pr-btn pr-btn-o">Message</a><button class="pr-btn pr-btn-g" onclick={removeFriend}>Friends ✓</button>
          {:else if status === 'request_sent'}<a href="/wisers/messages?user={profile.username}" class="pr-btn pr-btn-o">Message</a><button class="pr-btn pr-btn-o" disabled>Pending</button>
          {:else}<a href="/wisers/messages?user={profile.username}" class="pr-btn pr-btn-o">Message</a><button class="pr-btn pr-btn-p" onclick={addFriend}>Connect</button>{/if}
          <button class="pr-btn" style="background:#f5a623; color:#000; border:2px solid #f5a623; font-weight:700;" onclick={() => handleFollow()}>{followStatus.i_follow ? '✓ Following' : 'Follow'}</button>
        {/if}
      </div>
    </div>

    {#if editing}
      <!-- Modal overlay (X standard) -->
      <div class="pr-modal-overlay" onclick={() => editing = false}></div>
      <div class="pr-modal">
        <div class="pr-modal-header">
          <button class="pr-modal-close" onclick={() => editing = false} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>Edit profile</h3>
          <button class="pr-modal-save" onclick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
        <div class="pr-modal-body">
          <!-- Avatar with camera overlay -->
          <div class="pr-edit-avatar-wrap">
            <div class="pr-edit-avatar" onclick={() => document.getElementById('avatar-upload')?.click()}>
              {#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{:else}<span>{initial(profile.display_name || profile.name)}</span>{/if}
              <div class="pr-edit-avatar-overlay">{avatarUploading ? '...' : '📷'}</div>
            </div>
            <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onchange={handleAvatarUpload} style="display:none" />
          </div>
          <!-- Core fields (X standard: Name, Bio, Location, Website) -->
          <div class="pr-edit-grid">
            <div class="pr-edit-field"><label>Name</label><input bind:value={editData.display_name} placeholder="Your display name" maxlength="50" /><span class="pr-field-count">{(editData.display_name || '').length}/50</span></div>
            <div class="pr-edit-field"><label>Headline</label><input bind:value={editData.headline} placeholder="e.g. Full Stack Developer | Founder" maxlength="100" /></div>
            <div class="pr-edit-field"><label>Bio</label><textarea bind:value={editData.bio} rows="3" placeholder="Tell your story..." maxlength="160"></textarea><span class="pr-field-count">{(editData.bio || '').length}/160</span></div>
            <div class="pr-edit-field"><label>Company</label><input bind:value={editData.company} placeholder="Where you work" /></div>
            <div class="pr-edit-field"><label>Website</label><input bind:value={editData.website} placeholder="https://..." /></div>
          </div>
          <!-- Expandable: Professional details -->
          <details class="pr-edit-details">
            <summary>Professional details</summary>
            <div class="pr-edit-grid">
              <div class="pr-edit-field"><label>Skills (comma-separated)</label><input bind:value={editData.skills} placeholder="JavaScript, Python, SEO" /></div>
              <div class="pr-edit-field"><label>Work History (one per line)</label><textarea bind:value={editData.work_history} rows="3" placeholder="Software Engineer at Google (2020-2023)"></textarea></div>
              <div class="pr-edit-field"><label>Education (one per line)</label><textarea bind:value={editData.education} rows="2" placeholder="BSc Computer Science — MIT (2020)"></textarea></div>
              <div class="pr-edit-field"><label>Certifications (one per line)</label><textarea bind:value={editData.certifications} rows="2" placeholder="AWS Solutions Architect"></textarea></div>
              <div class="pr-edit-field"><label>Languages (comma-separated)</label><input bind:value={editData.languages} placeholder="English, French" /></div>
              <div class="pr-edit-field"><label>Interests (comma-separated)</label><input bind:value={editData.interests} placeholder="AI, Web3, Startups" /></div>
            </div>
          </details>
          <!-- Expandable: Social links -->
          <details class="pr-edit-details">
            <summary>Social links</summary>
            <div class="pr-edit-grid">
              <div class="pr-edit-field"><label>GitHub</label><input bind:value={editData.github_url} placeholder="https://github.com/you" /></div>
              <div class="pr-edit-field"><label>LinkedIn</label><input bind:value={editData.linkedin_url} placeholder="https://linkedin.com/in/you" /></div>
              <div class="pr-edit-field"><label>X / Twitter</label><input bind:value={editData.twitter_url} placeholder="https://x.com/you" /></div>
            </div>
          </details>
          <!-- Expandable: Privacy -->
          <details class="pr-edit-details">
            <summary>Privacy</summary>
            <div class="pr-edit-field">
              <label>Who can message you?</label>
              <div class="pr-privacy-toggle">
                <button class="pr-privacy-opt" class:active={editData.messages_from === 'everyone'} onclick={() => editData.messages_from = 'everyone'} type="button">Everyone</button>
                <button class="pr-privacy-opt" class:active={editData.messages_from === 'friends_only'} onclick={() => editData.messages_from = 'friends_only'} type="button">Friends only</button>
              </div>
            </div>
          </details>
        </div>
      </div>
    {/if}
    {#if !editing}
      <div class="pr-identity">
        <div class="pr-name-row"><h1>{profile.display_name || profile.name}</h1><span class="pr-badge" style="fill:{planColor(profile.plan)}">{@html badge}</span></div>
        <div class="pr-handle">@{profile.username}</div>
        {#if profile.headline}<div class="pr-headline">{profile.headline}</div>{/if}
        {#if profile.bio}<p class="pr-bio">{profile.bio}</p>{/if}

        <div class="pr-meta">
          {#if profile.company}<span>🏢 {profile.company}</span>{/if}
          {#if profile.city || profile.country}<span>📍 {[profile.city, profile.country].filter(Boolean).join(', ')}</span>{/if}
          {#if profile.website}<a href={profile.website} target="_blank" rel="noopener">🔗 {profile.website.replace(/https?:\/\//, '')}</a>{/if}
          <span>📅 Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
        </div>

        <div class="pr-socials">
          {#if profile.github_url}<a href={profile.github_url} target="_blank" rel="noopener" class="pr-social">GitHub</a>{/if}
          {#if profile.linkedin_url}<a href={profile.linkedin_url} target="_blank" rel="noopener" class="pr-social">LinkedIn</a>{/if}
          {#if profile.twitter_url}<a href={profile.twitter_url} target="_blank" rel="noopener" class="pr-social">X</a>{/if}
        </div>
        {#if actionMsg}<div class="pr-toast">{actionMsg}</div>{/if}
      </div>

      <div class="pr-stats">
        <div><strong>{profile.stats?.total_scans || 0}</strong> Scans</div>
        <div><strong>{profile.stats?.avg_score || 0}</strong> Avg</div>
        <div><strong>{profile.stats?.friends || 0}</strong> Friends</div>
        <div><strong>{posts.length}</strong> Posts</div>
      </div>

      <!-- Skills -->
      {#if parseList(profile.skills).length > 0}
        <div class="pr-section">
          <h3>Skills</h3>
          <div class="pr-tags">{#each parseList(profile.skills) as skill}<span class="pr-tag">{skill}</span>{/each}</div>
        </div>
      {/if}

      <!-- Work -->
      {#if parseEntries(profile.work_history).length > 0}
        <div class="pr-section">
          <h3>Experience</h3>
          {#each parseEntries(profile.work_history) as entry}<div class="pr-entry"><span class="pr-entry-dot"></span><div>{entry}</div></div>{/each}
        </div>
      {/if}

      <!-- Education -->
      {#if parseEntries(profile.education).length > 0}
        <div class="pr-section">
          <h3>Education</h3>
          {#each parseEntries(profile.education) as entry}<div class="pr-entry"><span class="pr-entry-dot ed"></span><div>{entry}</div></div>{/each}
        </div>
      {/if}

      <!-- Certifications -->
      {#if parseEntries(profile.certifications).length > 0}
        <div class="pr-section">
          <h3>Certifications</h3>
          {#each parseEntries(profile.certifications) as cert}<div class="pr-entry"><span class="pr-entry-dot cert"></span><div>{cert}</div></div>{/each}
        </div>
      {/if}

      <!-- Languages -->
      {#if parseList(profile.languages).length > 0}
        <div class="pr-section">
          <h3>Languages</h3>
          <div class="pr-tags">{#each parseList(profile.languages) as lang}<span class="pr-tag lang">{lang}</span>{/each}</div>
        </div>
      {/if}

      <!-- Interests -->
      {#if parseList(profile.interests).length > 0}
        <div class="pr-section">
          <h3>Interests</h3>
          <div class="pr-tags">{#each parseList(profile.interests) as i}<span class="pr-tag int">{i}</span>{/each}</div>
        </div>
      {/if}

      <!-- Tabs -->
      <div class="pr-tabs">
        <button class="pr-tab" class:active={activeTab === 'posts'} onclick={() => activeTab = 'posts'}>Posts</button>
        <button class="pr-tab" class:active={activeTab === 'about'} onclick={() => activeTab = 'about'}>About</button>
        <button class="pr-tab" class:active={activeTab === 'journey'} onclick={() => activeTab = 'journey'}>Journey</button>
        <button class="pr-tab" class:active={activeTab === 'communities'} onclick={() => activeTab = 'communities'}>Communities</button>
        <button class="pr-tab" class:active={activeTab === 'scans'} onclick={() => activeTab = 'scans'}>Activity</button>
      </div>

      {#if activeTab === 'posts'}
        {#if posts.length === 0}<div class="pr-empty">No posts yet</div>
        {:else}{#each posts as post}
          <div class="pr-post">
            <div class="pr-post-head">
              <div class="pr-post-av">{#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{:else}{initial(profile.display_name || profile.name)}{/if}</div>
              <div class="pr-post-meta-left">
                <span class="pr-post-name">{profile.display_name || profile.name}</span>
                <span class="pr-post-h">@{profile.username} · {timeAgo(post.created_at)}{#if post.edited}<span class="pr-post-edited"> · Edited</span>{/if}</span>
              </div>
              {#if $auth.token}
                <button class="w-post-menu-btn" onclick={(e) => { e.stopPropagation(); openPostMenu = openPostMenu === post.id ? null : post.id; }} aria-label="More">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                {#if openPostMenu === post.id}
                  <div class="w-post-menu-dropdown" onclick={(e) => e.stopPropagation()}>
                    {#if $auth.user?.id === post.user_id}
                      <button class="w-menu-item" onclick={() => { handleEditPost(post); openPostMenu = null; }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        {editingPost === post.id ? 'Save edit' : 'Edit post'}
                      </button>
                      <button class="w-menu-item w-menu-danger" onclick={() => { removePost(post.id); openPostMenu = null; }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Delete post
                      </button>
                    {:else}
                      <button class="w-menu-item" onclick={() => { handleFollow(); openPostMenu = null; }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                        {followStatus.i_follow ? 'Unfollow @' + profile.username : 'Follow @' + profile.username}
                      </button>
                      <button class="w-menu-item" onclick={() => { handleMute(); openPostMenu = null; }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                        Mute @{profile.username}
                      </button>
                      <button class="w-menu-item w-menu-danger" onclick={() => { handleBlock(); openPostMenu = null; }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        Block @{profile.username}
                      </button>
                      <div class="w-menu-divider"></div>
                      <button class="w-menu-item" onclick={() => { navigator.clipboard.writeText(window.location.href); openPostMenu = null; }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        Copy link
                      </button>
                      <button class="w-menu-item w-menu-danger" onclick={() => { const r = prompt('Why are you reporting this post?'); if (r) api.reportContent('post', post.id, r).then(() => alert('Report submitted')).catch(() => {}); openPostMenu = null; }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                        Report post
                      </button>
                    {/if}
                  </div>
                {/if}
              {/if}
            </div>
            {#if editingPost === post.id}
              <textarea class="pr-edit-box" bind:value={editingContent} rows="3"></textarea>
            {:else}
              <div class="pr-post-body">{@html renderContent(post.content)}</div>
            {#if post.image_url}<div class="pr-post-img"><img src={post.image_url} alt="" loading="lazy" /></div>{/if}
            {/if}
            <div class="pr-post-ft">
              <button class="w-action" class:w-liked={post._liked} onclick={() => toggleLike(post.id)} title="Like">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={post._liked ? '#f43f5e' : 'none'} stroke={post._liked ? '#f43f5e' : 'currentColor'} stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span>{post.likes_count || 0}</span>
              </button>
              <button class="w-action w-rocket-btn" class:w-rocketed={post.my_rocket} onclick={() => handleRocket(post)} title="Rocket">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={post.my_rocket ? '#f97316' : 'none'} stroke={post.my_rocket ? '#f97316' : 'currentColor'} stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
                <span>{post.rockets_count || 0}</span>
              </button>
              <button class="w-action w-repost-btn" class:w-reposted={post.my_repost} onclick={() => handleRepost(post)} title="Repost">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={post.my_repost ? '#10b981' : 'currentColor'} stroke-width={post.my_repost ? '2.5' : '2'}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                <span>{post.reposts_count || 0}</span>
              </button>
              <button class="w-action" onclick={() => toggleComments(post.id)} title="Comment">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>{post.comments_count || 0}</span>
              </button>
              {#if $auth.token}
                <button class="w-action w-bookmark-btn" class:w-bookmarked={bookmarkedPosts.has(post.id)} onclick={() => handleBookmark(post)} title="Bookmark">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarkedPosts.has(post.id) ? '#eab308' : 'none'} stroke={bookmarkedPosts.has(post.id) ? '#eab308' : 'currentColor'} stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </button>
              {/if}
            </div>
            {#if expandedComments.has(post.id)}
              <div class="w-comments">
                {#each postComments[post.id] || [] as c (c.id)}
                  <div class="w-comment">
                    <a href="/wisers/{c.username}" class="w-comment-author">@{c.username}</a>
                    <span class="w-comment-text">{c.content}</span>
                    <span class="w-comment-time">{timeAgo(c.created_at)}</span>
                  </div>
                {/each}
                {#if $auth.token}
                  <div class="w-comment-form">
                    <input class="w-comment-input" placeholder="Write a comment..." onkeydown={async (e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const input = e.currentTarget;
                        if (!input.value.trim()) return;
                        try {
                          await api.addComment(post.id, input.value.trim());
                          const res = await api.getComments(post.id);
                          postComments = { ...postComments, [post.id]: res.comments || [] };
                          posts = posts.map(p => p.id === post.id ? { ...p, comments_count: (res.comments || []).length } : p);
                          input.value = '';
                        } catch {}
                      }
                    }} />
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}{/if}
      {:else if activeTab === 'about'}
        <div class="pr-about-section">
          {#if parseList(profile.skills).length > 0}
            <div class="pr-about-card"><h4>Skills</h4><div class="pr-tags">{#each parseList(profile.skills) as skill}<span class="pr-tag">{skill}</span>{/each}</div></div>
          {/if}
          {#if parseEntries(profile.work_history).length > 0}
            <div class="pr-about-card"><h4>Experience</h4>{#each parseEntries(profile.work_history) as entry}<div class="pr-entry"><span class="pr-entry-dot"></span><div>{entry}</div></div>{/each}</div>
          {/if}
          {#if parseEntries(profile.education).length > 0}
            <div class="pr-about-card"><h4>Education</h4>{#each parseEntries(profile.education) as entry}<div class="pr-entry"><span class="pr-entry-dot ed"></span><div>{entry}</div></div>{/each}</div>
          {/if}
          {#if parseEntries(profile.certifications).length > 0}
            <div class="pr-about-card"><h4>Certifications</h4>{#each parseEntries(profile.certifications) as cert}<div class="pr-entry"><span class="pr-entry-dot cert"></span><div>{cert}</div></div>{/each}</div>
          {/if}
          {#if parseList(profile.languages).length > 0}
            <div class="pr-about-card"><h4>Languages</h4><div class="pr-tags">{#each parseList(profile.languages) as lang}<span class="pr-tag lang">{lang}</span>{/each}</div></div>
          {/if}
          {#if parseList(profile.interests).length > 0}
            <div class="pr-about-card"><h4>Interests</h4><div class="pr-tags">{#each parseList(profile.interests) as i}<span class="pr-tag int">{i}</span>{/each}</div></div>
          {/if}
        </div>

      {:else if activeTab === 'journey'}
        <div class="pr-journey">
          {#if journeyData.goals.length > 0}
            <h4 class="pr-j-heading">Goals</h4>
            {#each journeyData.goals as goal}
              <div class="pr-j-goal">
                <div class="pr-j-goal-top"><span class="pr-j-goal-title">{goal.title}</span><span class="pr-j-goal-status" class:achieved={goal.status === 'achieved'}>{goal.status}</span></div>
                <div class="pr-j-progress-bar"><div class="pr-j-progress-fill" style="width:{goal.target_value ? Math.min(100, (goal.current_value / goal.target_value) * 100) : 0}%"></div></div>
                <div class="pr-j-goal-nums">{goal.current_value} / {goal.target_value} {goal.unit}</div>
              </div>
            {/each}
          {/if}
          {#if journeyData.entries.length > 0}
            <h4 class="pr-j-heading">Timeline</h4>
            {#each journeyData.entries as entry}
              <div class="pr-j-entry">
                <div class="pr-j-entry-dot"></div>
                <div class="pr-j-entry-body">
                  <div class="pr-j-entry-title">{entry.title}</div>
                  {#if entry.description}<p class="pr-j-entry-desc">{entry.description}</p>{/if}
                  {#if entry.metric_name}<div class="pr-j-metric">{entry.metric_name}: {entry.metric_value} {entry.metric_unit}</div>{/if}
                  <span class="pr-j-entry-time">{new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            {/each}
          {/if}
          {#if journeyData.goals.length === 0 && journeyData.entries.length === 0}
            <div class="pr-empty">No journey entries yet.</div>
          {/if}
        </div>

      {:else if activeTab === 'communities'}
        <div class="pr-communities">
          {#if userCommunities.length === 0}
            <div class="pr-empty">Not a member of any communities yet.</div>
          {:else}
            {#each userCommunities as c}
              <a href="/wisers/communities/{c.slug}" class="pr-comm-card">
                <div class="pr-comm-icon">{c.name[0]}</div>
                <div class="pr-comm-info">
                  <div class="pr-comm-name">{c.name}</div>
                  <div class="pr-comm-meta">{c.member_count} members · {c.role}</div>
                </div>
              </a>
            {/each}
          {/if}
        </div>

      {:else}
        <div class="pr-activity-stats">
          <div class="pr-stat-row">
            <span>🔍</span>
            <span><strong>{profile.stats?.total_scans || 0}</strong> scans completed</span>
          </div>
          <div class="pr-stat-row">
            <span>📊</span>
            <span>Average score: <strong>{profile.stats?.avg_score || 0}</strong></span>
          </div>
          <div class="pr-stat-row">
            <span>👥</span>
            <span><strong>{followersCount}</strong> followers · <strong>{followingCount}</strong> following</span>
          </div>
          <div class="pr-stat-row">
            <span>🤝</span>
            <span><strong>{profile.stats?.friends || 0}</strong> friends</span>
          </div>
        </div>
      {/if}
    {/if}

  </div>
{/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  .pr { --bg:#0a0a0f;--card:#111117;--t1:#e4e6ea;--t2:#8a8d91;--t3:#606770;--bd:#1e1e2a;--gold:#f5a623;--hv:rgba(255,255,255,0.04);
    font-family:'DM Sans',-apple-system,sans-serif;color:var(--t1);background:var(--bg);min-height:100vh; }
  .pr-banner { height:200px;background:linear-gradient(135deg,#1a1a2e,#16213e 40%,#0f3460 70%,#1a1a2e);position:relative; }
  .pr-banner::after { content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,var(--bg) 100%); }
  .pr-wrap { max-width:680px;margin:0 auto;padding:0 20px 60px; }
  .pr-top { display:flex;justify-content:space-between;align-items:flex-start;margin-top:-60px;position:relative;z-index:2; }
  .pr-av { width:120px;height:120px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:42px;border:4px solid var(--bg);overflow:hidden;flex-shrink:0; }
  .pr-av img { width:100%;height:100%;object-fit:cover; }
  .pr-top-right { padding-top:72px;display:flex;gap:8px; }
  .pr-btn { padding:8px 20px;border-radius:20px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;border:none;text-decoration:none;display:inline-flex;align-items:center;gap:6px; }
  .pr-btn-p { background:var(--gold);color:#000; } .pr-btn-p:hover { filter:brightness(1.1); }
  .pr-btn-o { background:transparent;border:1px solid var(--bd);color:var(--t1); } .pr-btn-o:hover { border-color:var(--t2); }
  .pr-btn-g { border:1px solid #10b981;color:#10b981;background:transparent; }
  .pr-btn:disabled { opacity:0.4;cursor:default; }

  .pr-identity { margin-top:14px; }
  .pr-name-row { display:flex;align-items:center;gap:6px; }
  .pr-name-row h1 { font-size:24px;font-weight:800;margin:0; }
  .pr-badge { display:inline-flex; }
  .pr-handle { font-size:15px;color:var(--t2); }
  .pr-headline { font-size:15px;color:var(--t1);margin-top:6px;font-weight:500; }
  .pr-bio { font-size:14px;line-height:1.6;margin-top:10px;white-space:pre-wrap;color:var(--t2); }
  .pr-meta { display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:13px;color:var(--t2); }
  .pr-meta a { color:var(--gold);text-decoration:none; } .pr-meta a:hover { text-decoration:underline; }
  .pr-socials { display:flex;gap:8px;margin-top:10px; }
  .pr-social { padding:4px 12px;border-radius:14px;font-size:11px;font-weight:700;border:1px solid var(--bd);color:var(--t2);text-decoration:none; }
  .pr-social:hover { border-color:var(--gold);color:var(--gold); }
  .pr-toast { margin-top:8px;font-size:12px;color:#10b981; }

  .pr-stats { display:flex;gap:24px;margin-top:16px;padding:16px 0;border-bottom:1px solid var(--bd);font-size:14px;color:var(--t2); }
  .pr-stats strong { color:var(--t1);font-weight:800;margin-right:3px; }

  /* Sections */
  .pr-section { margin-top:20px;padding:20px;background:var(--card);border:1px solid var(--bd);border-radius:14px; }
  .pr-section h3 { font-size:16px;font-weight:800;margin:0 0 12px; }
  .pr-tags { display:flex;flex-wrap:wrap;gap:6px; }
  .pr-tag { padding:4px 12px;border-radius:14px;font-size:12px;font-weight:600;background:rgba(245,166,35,0.08);color:var(--gold);border:1px solid rgba(245,166,35,0.15); }
  .pr-tag.lang { background:rgba(59,130,246,0.08);color:#3b82f6;border-color:rgba(59,130,246,0.15); }
  .pr-tag.int { background:rgba(16,185,129,0.08);color:#10b981;border-color:rgba(16,185,129,0.15); }
  .pr-entry { display:flex;align-items:flex-start;gap:10px;padding:8px 0;font-size:14px;line-height:1.5; }
  .pr-entry-dot { width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:6px; }
  .pr-entry-dot.ed { background:#3b82f6; }
  .pr-entry-dot.cert { background:#10b981; }

  /* Edit form */
  .pr-edit { margin-top:16px;padding:24px;background:var(--card);border:1px solid var(--bd);border-radius:14px; }
  .pr-edit h3 { font-size:18px;font-weight:800;margin:0 0 16px; }
  .pr-edit-grid { display:flex;flex-direction:column;gap:12px; }
  .pr-edit-field { display:flex;flex-direction:column;gap:4px; }
  .pr-edit-field label { font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.05em; }
  .pr-edit-field input, .pr-edit-field textarea { padding:10px 14px;border-radius:10px;border:1px solid var(--bd);background:var(--bg);color:var(--t1);font-size:14px;font-family:inherit;outline:none;resize:vertical; }
  .pr-edit-field input:focus, .pr-edit-field textarea:focus { border-color:var(--gold); }
  .pr-edit-row { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px; }
  .pr-edit-btns { display:flex;gap:8px;margin-top:16px; }

  /* Tabs */
  .pr-tabs { display:flex;border-bottom:1px solid var(--bd);margin-top:20px; }
  .pr-tab { flex:1;padding:14px 0;text-align:center;font-size:14px;font-weight:600;color:var(--t2);background:none;border:none;cursor:pointer;border-bottom:3px solid transparent;font-family:inherit; }
  .pr-tab:hover { background:var(--hv); } .pr-tab.active { color:var(--gold);border-bottom-color:var(--gold); }

  .pr-empty { padding:40px;text-align:center;color:var(--t3);font-size:14px; }
  .pr-post { padding:16px 0;border-bottom:1px solid var(--bd); }
  .pr-post-head { display:flex;align-items:center;gap:10px;margin-bottom:8px; }
  .pr-post-av { width:36px;height:36px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;overflow:hidden;flex-shrink:0; }
  .pr-post-av img { width:100%;height:100%;object-fit:cover; }
  .pr-post-name { font-weight:700;font-size:14px; } .pr-post-h { font-size:13px;color:var(--t2);margin-left:4px; }
  .pr-post-body { font-size:15px;line-height:1.5;white-space:pre-wrap;word-break:break-word; }
  .pr-post-ft { display:flex;flex-wrap:wrap;gap:4px;margin-top:10px;font-size:13px;color:var(--t2); }
  .pr-edit-box { width:100%;background:#1a1a2a;border:1px solid #f5a623;border-radius:8px;color:#e4e6ea;padding:8px;font-size:14px;resize:vertical;margin-bottom:6px; }
  .w-comments { margin-top:10px;padding-top:10px;border-top:1px solid var(--bd,#1e1e2a); }
  .w-comment { display:flex;gap:8px;align-items:baseline;margin-bottom:6px;font-size:13px; }
  .w-comment-author { color:#f5a623;font-weight:600;text-decoration:none; }
  .w-comment-text { color:#c0c0c8; }
  .w-comment-time { color:#555;margin-left:auto; }
  .w-comment-form { margin-top:8px; }
  .w-comment-input { width:100%;background:#1a1a2a;border:1px solid #2a2a3a;border-radius:20px;color:#e4e6ea;padding:6px 14px;font-size:13px; }
  .w-action { display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:#8a8d91;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:13px;transition:color 0.15s; }
  .w-action:hover { color:#e4e6ea; }
  .w-liked svg,.w-liked { color:#f43f5e; }
  .w-rocketed svg,.w-rocketed { color:#f97316; }
  .w-reposted { color:#10b981; }
  .w-bookmarked svg { color:#eab308; }
  .w-action-del:hover { color:#ef4444 !important; }

  .pr-center { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px;color:var(--t3); }
  .pr-center a { color:var(--gold);text-decoration:none; }
  .pr-spin { width:28px;height:28px;border:3px solid var(--bd);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media(max-width:600px) { .pr-banner{height:140px} .pr-av{width:90px;height:90px;font-size:32px} .pr-top{margin-top:-45px} .pr-top-right{padding-top:52px} .pr-name-row h1{font-size:20px} .pr-edit-row{grid-template-columns:1fr} }
  .pr-follow-btn { background: var(--wgold) !important; color: #000 !important; font-weight: 700; }
  .pr-follow-btn.following { background: transparent !important; color: var(--wt2) !important; border: 1px solid var(--wbd); }
  .pr-follow-btn.following:hover { border-color: #ef4444; color: #ef4444 !important; }
  .pr-follow-stats { display: flex; gap: 16px; margin-top: 12px; font-size: 14px; color: var(--wt2); }
  .pr-follow-stats strong { color: var(--wt); font-weight: 700; }
  .pr-btn-mute { background: transparent !important; border: 1px solid var(--wbd) !important; color: var(--wt3) !important; font-size: 12px !important; }
  .pr-btn-block { background: transparent !important; border: 1px solid rgba(239,68,68,0.3) !important; color: #ef4444 !important; font-size: 12px !important; }
  .pr-activity-stats { padding:16px 0; }
  .pr-stat-row { display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--bd);font-size:14px;color:var(--t2); }
  .pr-stat-row strong { color:var(--t1); }
  .w-activity-list { display:flex;flex-direction:column;gap:0; }
  .w-activity-item { display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--wbd,#1e1e2a);font-size:14px; }
  .w-activity-icon { font-size:18px;width:28px;text-align:center; }
  .w-activity-text { flex:1;color:var(--wt1,#e4e6ea); }
  .w-activity-time { color:var(--wt3,#606770);font-size:12px;white-space:nowrap; }
  .pr-privacy-field { grid-column: 1 / -1; }
  .pr-privacy-toggle { display:flex;gap:8px;margin-top:8px; }
  .pr-privacy-opt { display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;border:1px solid var(--bd,#1e1e2a);background:transparent;color:var(--t2,#8a8d91);font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.15s; }
  .pr-privacy-opt.active { border-color:#f5a623;background:rgba(245,166,35,0.1);color:#f5a623; }
  .pr-privacy-opt:hover:not(.active) { border-color:#555;color:var(--t1,#e4e6ea); }
  .pr-privacy-hint { font-size:11px;color:var(--t3,#606770);margin-top:6px; }
  /* Theme */
  .pr { --pr-bg: #0a0a0f; --pr-card: #111117; --pr-t: #e4e6ea; --pr-t2: #8a8d91; --pr-t3: #606770; --pr-bd: #1e1e2a; --pr-gold: #f5a623; }
  .pr.light { --pr-bg: #ffffff; --pr-card: #ffffff; --pr-t: #1c1e21; --pr-t2: #606770; --pr-t3: #8a8d91; --pr-bd: #dddfe2; --pr-gold: #d4a017; }

  /* Full bleed */
  :global(body) { margin: 0; }
  :global(.page) { padding: 0 !important; }

  /* Back link */
  .pr-back-bar { max-width: 700px; margin: 0 auto; padding: 16px 20px 0; }
  .pr-back-link { font-size: 13px; color: var(--pr-gold); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
  .pr-back-link:hover { text-decoration: underline; }

  /* Post image */
  .pr-post-img { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .pr-post-img img { width: 100%; max-height: 500px; object-fit: cover; display: block; border-radius: 12px; }

  /* About section */
  .pr-about-section { display: flex; flex-direction: column; gap: 16px; }
  .pr-about-card { background: var(--pr-card); border: 1px solid var(--pr-bd); border-radius: 14px; padding: 18px; }
  .pr-about-card h4 { margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--pr-gold); }

  /* Journey */
  .pr-journey { display: flex; flex-direction: column; gap: 12px; }
  .pr-j-heading { margin: 8px 0; font-size: 15px; font-weight: 600; color: var(--pr-gold); }
  .pr-j-goal { background: var(--pr-card); border: 1px solid var(--pr-bd); border-radius: 14px; padding: 16px; }
  .pr-j-goal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .pr-j-goal-title { font-weight: 600; font-size: 14px; }
  .pr-j-goal-status { font-size: 12px; color: var(--pr-t3); text-transform: capitalize; padding: 3px 10px; border-radius: 12px; border: 1px solid var(--pr-bd); }
  .pr-j-goal-status.achieved { color: #10b981; border-color: rgba(16,185,129,0.3); }
  .pr-j-progress-bar { height: 6px; background: var(--pr-bd); border-radius: 3px; overflow: hidden; }
  .pr-j-progress-fill { height: 100%; background: var(--pr-gold); border-radius: 3px; transition: width 0.3s; }
  .pr-j-goal-nums { font-size: 12px; color: var(--pr-t3); margin-top: 6px; }
  .pr-j-entry { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--pr-bd); }
  .pr-j-entry:last-child { border-bottom: none; }
  .pr-j-entry-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pr-gold); margin-top: 5px; flex-shrink: 0; }
  .pr-j-entry-body { flex: 1; }
  .pr-j-entry-title { font-weight: 600; font-size: 14px; }
  .pr-j-entry-desc { font-size: 13px; color: var(--pr-t2); margin: 4px 0; line-height: 1.5; }
  .pr-j-metric { font-size: 13px; color: var(--pr-gold); font-weight: 600; margin: 4px 0; }
  .pr-j-entry-time { font-size: 12px; color: var(--pr-t3); }

  /* Communities */
  .pr-communities { display: flex; flex-direction: column; gap: 10px; }
  .pr-comm-card { display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--pr-card); border: 1px solid var(--pr-bd); border-radius: 14px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
  .pr-comm-card:hover { border-color: var(--pr-gold); }
  .pr-comm-icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, var(--pr-gold), #e09100); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 18px; flex-shrink: 0; }
  .pr-comm-info { flex: 1; }
  .pr-comm-name { font-weight: 600; font-size: 14px; }
  .pr-comm-meta { font-size: 12px; color: var(--pr-t3); margin-top: 2px; }

  /* Logout */
  .pr-logout-wrap { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--pr-bd); }
  .pr-logout-btn { background: none; border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 10px 24px; border-radius: 24px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; transition: all 0.15s; }
  .pr-logout-btn:hover { background: rgba(239,68,68,0.08); border-color: #ef4444; }

  /* Edit profile modal (X standard) */
  .pr-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1000; }
  .pr-modal { position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;max-width:calc(100vw - 32px);max-height:90vh;background:var(--card,#111117);border-radius:16px;z-index:1001;display:flex;flex-direction:column;overflow:hidden; }
  .pr-modal-header { display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--bd,#1e1e2a);flex-shrink:0; }
  .pr-modal-header h3 { flex:1;font-size:18px;font-weight:800;margin:0; }
  .pr-modal-close { width:34px;height:34px;border-radius:50%;background:none;border:none;color:var(--t1,#e4e6ea);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s; }
  .pr-modal-close:hover { background:rgba(255,255,255,0.1); }
  .pr-modal-save { padding:8px 18px;border-radius:20px;background:var(--gold,#f5a623);color:#000;font-weight:700;font-size:14px;border:none;cursor:pointer;font-family:inherit; }
  .pr-modal-save:disabled { opacity:0.5;cursor:not-allowed; }
  .pr-modal-save:hover:not(:disabled) { filter:brightness(1.1); }
  .pr-modal-body { flex:1;overflow-y:auto;padding:20px; }
  .pr-edit-avatar-wrap { display:flex;justify-content:center;margin-bottom:20px; }
  .pr-edit-avatar { width:100px;height:100px;border-radius:50%;background:var(--gold,#f5a623);position:relative;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:#000; }
  .pr-edit-avatar img { width:100%;height:100%;object-fit:cover; }
  .pr-edit-avatar-overlay { position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:24px;opacity:0;transition:opacity 0.15s; }
  .pr-edit-avatar:hover .pr-edit-avatar-overlay { opacity:1; }
  .pr-field-count { font-size:11px;color:var(--t3,#606770);text-align:right;margin-top:2px; }
  .pr-edit-details { margin-top:16px;border:1px solid var(--bd,#1e1e2a);border-radius:12px;overflow:hidden; }
  .pr-edit-details summary { padding:12px 16px;font-size:14px;font-weight:600;color:var(--t2,#8a8d91);cursor:pointer;list-style:none; }
  .pr-edit-details summary::-webkit-details-marker { display:none; }
  .pr-edit-details summary::before { content:'▸ ';transition:transform 0.15s; }
  .pr-edit-details[open] summary::before { content:'▾ '; }
  .pr-edit-details[open] summary { border-bottom:1px solid var(--bd,#1e1e2a); }
  .pr-edit-details .pr-edit-grid { padding:16px; }

  /* Three-dot menu on profile posts (X standard) */
  .pr-post-head { display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;position:relative; }
  .pr-post-meta-left { display:flex;align-items:center;gap:6px;min-width:0;flex:1;flex-wrap:wrap; }
  .w-post-menu-btn { width:34px;height:34px;border-radius:50%;background:none;border:none;color:var(--t3,#606770);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:all 0.15s;flex-shrink:0; }
  .pr-post:hover .w-post-menu-btn { opacity:1; }
  .w-post-menu-btn:hover { background:rgba(29,155,240,0.1);color:#1d9bf0; }
  .w-post-menu-dropdown { position:absolute;top:100%;right:0;min-width:260px;background:var(--card,#111117);border:1px solid var(--bd,#1e1e2a);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:4px 0;z-index:100; }
  .w-menu-item { display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;background:none;border:none;color:var(--t1,#e4e6ea);font-size:14px;cursor:pointer;font-family:inherit;text-align:left; }
  .w-menu-item:hover { background:rgba(255,255,255,0.04); }
  .w-menu-item.w-menu-danger { color:#ef4444; }
  .w-menu-divider { height:1px;background:var(--bd,#1e1e2a);margin:4px 0; }
  .pr-post-edited { font-size:11px;color:var(--t3,#606770);font-style:italic; }

  @media(max-width:600px) {
    .pr-modal { width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0;top:0;left:0;transform:none; }
    .w-post-menu-btn { opacity:1; }
  }
</style>