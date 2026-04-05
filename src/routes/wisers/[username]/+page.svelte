<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';
  import { timeAgo } from '$lib/utils/time';

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
  let showProfileMore = $state(false);
  let avatarUploading = $state(false);
  let avatarToast = $state<{ msg: string; type: 'success'|'error' } | null>(null);
  let showAvatarConfirm = $state(false);
  let pendingAvatarUrl = $state('');
  let showEntryForm = $state(false);
  let showGoalForm = $state(false);
  let entryForm = $state({ title: '', description: '', entry_type: 'milestone', metric_name: '', metric_value: '', metric_unit: '' });
  let goalForm = $state({ title: '', target_value: '', unit: '', deadline: '' });
  let journeySaving = $state(false);
  let editingGoalId = $state<number | null>(null);
  let editGoalValue = $state('');
  let theme = $state<'dark'|'light'>('dark');
  let journeyData = $state<any>({ entries: [], goals: [] });
  let userCommunities = $state<any[]>([]);
  let mediaImages = $derived(posts.filter(p => p.image_url || p.media?.some((m: any) => m.type === 'image')).flatMap(p => {
    const imgs: { url: string; id: number; created_at: string }[] = [];
    if (p.image_url) imgs.push({ url: p.image_url, id: p.id, created_at: p.created_at });
    if (p.media) p.media.filter((m: any) => m.type === 'image').forEach((m: any) => imgs.push({ url: m.url, id: p.id, created_at: p.created_at }));
    return imgs;
  }));
  function formatFileSize(b: number) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }

  onMount(() => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; }
    else if (!saved && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) { theme = 'light'; }
    if (typeof document !== 'undefined') { document.documentElement.setAttribute('data-wisers-theme', theme); document.body.style.background = theme === 'light' ? '#ffffff' : '#0a0a0f'; }
    const clickHandler = () => { openPostMenu = null; showProfileMore = false; };
    document.addEventListener('click', clickHandler);
    return () => { document.removeEventListener('click', clickHandler); };
  });

  $effect(() => { const u = $page.params.username; if (u) loadProfile(u); });

  async function loadProfile(username: string) {
    loading = true; error = '';
    try {
      profile = await api.getCommunityProfile(username);
      if ($auth.token) {
        status = (await api.getFriendshipStatus(username).catch(() => ({ status: 'none' }))).status;
        try { followersCount = (await api.getFollowers(username)).followers?.length || 0; } catch {}
        try { followingCount = (await api.getFollowing(username)).following?.length || 0; } catch {}
        if (status !== 'self') {
          try { followStatus = await api.getFollowStatus(username); } catch {}
        }
      }
      try { posts = ((await api.getUserPosts(username)).posts || []).map((p: any) => ({ ...p, _liked: !!p.my_liked, my_rocket: !!p.my_rocketed, my_repost: !!p.my_reposted })); } catch {}
    } catch (e: any) { error = e.message || 'User not found'; }
    loading = false;
    // Load journey + communities
    try { journeyData = await api.getJourney(username); } catch {}
    if (status === 'self') { try { userCommunities = (await api.getMyCommunities()).communities || []; } catch {} }
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
      profile = { ...profile, ...editData };
      editing = false; actionMsg = 'Saved!';
    } catch { actionMsg = 'Failed'; }
    saving = false; setTimeout(() => actionMsg = '', 3000);
  }

  async function submitEntry() {
    if (!entryForm.title.trim()) return;
    journeySaving = true;
    try {
      const data: any = { title: entryForm.title, description: entryForm.description || undefined, entry_type: entryForm.entry_type };
      if (entryForm.metric_name) { data.metric_name = entryForm.metric_name; data.metric_value = parseFloat(entryForm.metric_value) || 0; data.metric_unit = entryForm.metric_unit; }
      await api.addJourneyEntry(data);
      journeyData = await api.getJourney($page.params.username!);
      showEntryForm = false;
      entryForm = { title: '', description: '', entry_type: 'milestone', metric_name: '', metric_value: '', metric_unit: '' };
    } catch {}
    journeySaving = false;
  }
  async function submitGoal() {
    if (!goalForm.title.trim()) return;
    journeySaving = true;
    try {
      await api.addJourneyGoal({ title: goalForm.title, target_value: parseFloat(goalForm.target_value) || undefined, unit: goalForm.unit || undefined, deadline: goalForm.deadline || undefined });
      journeyData = await api.getJourney($page.params.username!);
      showGoalForm = false;
      goalForm = { title: '', target_value: '', unit: '', deadline: '' };
    } catch {}
    journeySaving = false;
  }
  async function deleteEntry(entryId: number) {
    if (!confirm('Delete this entry?')) return;
    try { await api.deleteJourneyEntry(entryId); journeyData = await api.getJourney($page.params.username!); } catch {}
  }
  async function saveGoalProgress(goalId: number) {
    const val = parseFloat(editGoalValue);
    if (isNaN(val)) return;
    try { await api.updateJourneyGoal(goalId, { current_value: val }); journeyData = await api.getJourney($page.params.username!); } catch {}
    editingGoalId = null; editGoalValue = '';
  }

  function avatarSrc(url: string | null): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : 'https://api-bscan.balancewises.io/avatars/' + url;
  }
  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
  function planColor(p: string) { return p === 'agency' ? '#f5a623' : p === 'pro' ? '#3b82f6' : '#555'; }
  function parseList(s: string) { return (s || '').split(',').map(i => i.trim()).filter(Boolean); }
  function parseEntries(s: string) { return (s || '').split('\n').filter(l => l.trim()); }

  const badge = '<svg viewBox="0 0 22 22" width="18" height="18"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg>';

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderContent(text: string): string {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/#(\w{2,30})/g, '<a href="/wisers?tag=$1" style="color:var(--gold);text-decoration:none">#$1</a>');
    html = html.replace(/@(\w{2,30})/g, '<a href="/wisers/$1" style="color:var(--gold);text-decoration:none">@$1</a>');
    return html;
  }

  async function handleAvatarUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return; }
    avatarUploading = true;
    try {
      const res = await api.uploadAvatar(file);
      if (res.avatar_url) {
        profile.avatar_url = res.avatar_url;
        if ($auth.user) $auth.user.avatar_url = res.avatar_url;
        pendingAvatarUrl = res.avatar_url;
        showToast('Profile picture updated!', 'success');
        showAvatarConfirm = true;
      }
    } catch {
      showToast('Upload failed. Please try again.', 'error');
    }
    avatarUploading = false;
    input.value = '';
  }

  function showToast(msg: string, type: 'success'|'error') {
    avatarToast = { msg, type };
    setTimeout(() => avatarToast = null, 4000);
  }

  async function postAvatarToFeed() {
    if (!pendingAvatarUrl) return;
    try {
      await api.createPost('Updated my profile picture', 'text', '', 0, pendingAvatarUrl);
      // Reload posts to include the new one
      try { posts = ((await api.getUserPosts(profile.username)).posts || []).map((p: any) => ({ ...p, _liked: !!p.my_liked, my_rocket: !!p.my_rocketed, my_repost: !!p.my_reposted })); } catch {}
      showToast('Posted to your feed!', 'success');
    } catch {
      showToast('Could not post to feed', 'error');
    }
    showAvatarConfirm = false;
    pendingAvatarUrl = '';
  }

  function skipAvatarPost() {
    showAvatarConfirm = false;
    pendingAvatarUrl = '';
  }

  function handleLogout() {
    auth.logout();
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
{#if loading}<div class="pr-center"><div class="pr-spin"></div></div>
{:else if error}<div class="pr-center"><p>{error}</p><a href="/wisers">Back to Wisers</a></div>
{:else if profile}

  <div class="pr-banner">
    <a href="/wisers" class="pr-back-link" aria-label="Back to Wisers"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></a>
  </div>

  <div class="pr-wrap">
    <div class="pr-top">
      <div class="pr-av">{#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{:else}{initial(profile.display_name || profile.name)}{/if}</div>
    </div>
    <div class="pr-actions">
        {#if $auth.token && status === 'self'}
          <div class="pr-more-wrap">
            <button class="pr-more-btn" onclick={(e) => { e.stopPropagation(); showProfileMore = !showProfileMore; }} aria-label="More">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            {#if showProfileMore}
              <div class="pr-more-dropdown" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                <button class="pr-more-item" onclick={() => { navigator.clipboard.writeText(window.location.href); showProfileMore = false; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Copy profile link
                </button>
                <button class="pr-more-item" onclick={() => { if (navigator.share) navigator.share({ title: '@' + profile.username, url: window.location.href }); showProfileMore = false; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share profile
                </button>
              </div>
            {/if}
          </div>
          <button class="pr-btn pr-btn-o" onclick={startEdit}>Edit profile</button>
        {:else if $auth.token}
          <div class="pr-more-wrap">
            <button class="pr-more-btn" onclick={(e) => { e.stopPropagation(); showProfileMore = !showProfileMore; }} aria-label="More">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            {#if showProfileMore}
              <div class="pr-more-dropdown" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                <button class="pr-more-item" onclick={() => { handleMute(); showProfileMore = false; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  Mute @{profile.username}
                </button>
                <button class="pr-more-item pr-more-danger" onclick={() => { handleBlock(); showProfileMore = false; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  Block @{profile.username}
                </button>
                <div class="pr-more-divider"></div>
                <button class="pr-more-item" onclick={() => { navigator.clipboard.writeText(window.location.href); showProfileMore = false; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Copy profile link
                </button>
                <button class="pr-more-item pr-more-danger" onclick={() => { const r = prompt('Why are you reporting this user?'); if (r) api.reportContent('user', profile.id, r).then(() => alert('Report submitted')).catch(() => {}); showProfileMore = false; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  Report @{profile.username}
                </button>
              </div>
            {/if}
          </div>
          {#if status === 'friends'}<a href="/wisers/messages?user={profile.username}" class="pr-btn pr-btn-o">Message</a><button class="pr-btn pr-btn-g" onclick={removeFriend}>Friends</button>
          {:else if status === 'request_sent'}<a href="/wisers/messages?user={profile.username}" class="pr-btn pr-btn-o">Message</a><button class="pr-btn pr-btn-o" disabled>Pending</button>
          {:else}<a href="/wisers/messages?user={profile.username}" class="pr-btn pr-btn-o">Message</a><button class="pr-btn pr-btn-p" onclick={addFriend}>Connect</button>{/if}
          {#if isBlocked}
            <button class="pr-btn pr-btn-block" onclick={async () => { try { await api.unblockUser(profile.username); isBlocked = false; } catch {} }}>Unblock</button>
          {:else}
            <button class="pr-btn pr-btn-follow" class:following={followStatus.i_follow} onclick={() => handleFollow()}>{followStatus.i_follow ? 'Following' : 'Follow'}</button>
          {/if}
        {/if}
    </div>

    {#if editing}
      <!-- Modal overlay (X standard) -->
      <div class="pr-modal-overlay" role="button" tabindex="0" aria-label="Close edit profile" onclick={() => editing = false} onkeydown={(e) => { if (e.key === 'Enter') editing = false; }}></div>
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
            <div class="pr-edit-avatar" role="button" tabindex="0" aria-label="Upload avatar" onclick={() => document.getElementById('avatar-upload')?.click()} onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('avatar-upload')?.click(); }}>
              {#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{:else}<span>{initial(profile.display_name || profile.name)}</span>{/if}
              <div class="pr-edit-avatar-overlay">{avatarUploading ? '...' : '📷'}</div>
            </div>
            <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onchange={handleAvatarUpload} style="display:none" />
          </div>
          <!-- Core fields (X standard: Name, Bio, Location, Website) -->
          <div class="pr-edit-grid">
            <div class="pr-edit-field"><label for="edit-name">Name</label><input id="edit-name" bind:value={editData.display_name} placeholder="Your display name" maxlength="50" /><span class="pr-field-count">{(editData.display_name || '').length}/50</span></div>
            <div class="pr-edit-field"><label for="edit-headline">Headline</label><input id="edit-headline" bind:value={editData.headline} placeholder="e.g. Full Stack Developer | Founder" maxlength="100" /></div>
            <div class="pr-edit-field"><label for="edit-bio">Bio</label><textarea id="edit-bio" bind:value={editData.bio} rows="3" placeholder="Tell your story..." maxlength="160"></textarea><span class="pr-field-count">{(editData.bio || '').length}/160</span></div>
            <div class="pr-edit-field"><label for="edit-company">Company</label><input id="edit-company" bind:value={editData.company} placeholder="Where you work" /></div>
            <div class="pr-edit-field"><label for="edit-website">Website</label><input id="edit-website" bind:value={editData.website} placeholder="https://..." /></div>
          </div>
          <!-- Expandable: Professional details -->
          <details class="pr-edit-details">
            <summary>Professional details</summary>
            <div class="pr-edit-grid">
              <div class="pr-edit-field"><label for="edit-skills">Skills (comma-separated)</label><input id="edit-skills" bind:value={editData.skills} placeholder="JavaScript, Python, SEO" /></div>
              <div class="pr-edit-field"><label for="edit-work">Work History (one per line)</label><textarea id="edit-work" bind:value={editData.work_history} rows="3" placeholder="Software Engineer at Google (2020-2023)"></textarea></div>
              <div class="pr-edit-field"><label for="edit-education">Education (one per line)</label><textarea id="edit-education" bind:value={editData.education} rows="2" placeholder="BSc Computer Science — MIT (2020)"></textarea></div>
              <div class="pr-edit-field"><label for="edit-certs">Certifications (one per line)</label><textarea id="edit-certs" bind:value={editData.certifications} rows="2" placeholder="AWS Solutions Architect"></textarea></div>
              <div class="pr-edit-field"><label for="edit-languages">Languages (comma-separated)</label><input id="edit-languages" bind:value={editData.languages} placeholder="English, French" /></div>
              <div class="pr-edit-field"><label for="edit-interests">Interests (comma-separated)</label><input id="edit-interests" bind:value={editData.interests} placeholder="AI, Web3, Startups" /></div>
            </div>
          </details>
          <!-- Expandable: Social links -->
          <details class="pr-edit-details">
            <summary>Social links</summary>
            <div class="pr-edit-grid">
              <div class="pr-edit-field"><label for="edit-github">GitHub</label><input id="edit-github" bind:value={editData.github_url} placeholder="https://github.com/you" /></div>
              <div class="pr-edit-field"><label for="edit-linkedin">LinkedIn</label><input id="edit-linkedin" bind:value={editData.linkedin_url} placeholder="https://linkedin.com/in/you" /></div>
              <div class="pr-edit-field"><label for="edit-twitter">X / Twitter</label><input id="edit-twitter" bind:value={editData.twitter_url} placeholder="https://x.com/you" /></div>
            </div>
          </details>
          <!-- Expandable: Privacy -->
          <details class="pr-edit-details">
            <summary>Privacy</summary>
            <div class="pr-edit-field">
              <span id="privacy-msg-label" class="pr-edit-field-label">Who can message you?</span>
              <div class="pr-privacy-toggle" role="radiogroup" aria-labelledby="privacy-msg-label">
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
        <button class="pr-stat-item" onclick={() => {}}><span class="pr-stat-num">{followersCount}</span><span class="pr-stat-label">Followers</span></button>
        <button class="pr-stat-item" onclick={() => {}}><span class="pr-stat-num">{followingCount}</span><span class="pr-stat-label">Following</span></button>
        <button class="pr-stat-item" onclick={() => activeTab = 'posts'}><span class="pr-stat-num">{posts.length}</span><span class="pr-stat-label">Posts</span></button>
      </div>

      <!-- Tabs -->
      <div class="pr-tabs-scroll">
        <div class="pr-tabs">
          <button class="pr-tab" class:active={activeTab === 'posts'} onclick={() => activeTab = 'posts'}>Posts</button>
          <button class="pr-tab" class:active={activeTab === 'media'} onclick={() => activeTab = 'media'}>Media</button>
          <button class="pr-tab" class:active={activeTab === 'about'} onclick={() => activeTab = 'about'}>About</button>
          <button class="pr-tab" class:active={activeTab === 'journey'} onclick={() => activeTab = 'journey'}>Journey</button>
          {#if status === 'self' && userCommunities.length > 0}<button class="pr-tab" class:active={activeTab === 'communities'} onclick={() => activeTab = 'communities'}>Communities</button>{/if}
          <button class="pr-tab" class:active={activeTab === 'scans'} onclick={() => activeTab = 'scans'}>Activity</button>
        </div>
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
                  <div class="w-post-menu-dropdown" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
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
            {#if post.image_url}<div class="pr-post-img"><img src={post.image_url} alt="" loading="lazy" onerror={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }} /></div>{/if}
            {#if post.media?.length}
              <div class="pr-post-media">
                {#each post.media.filter((m: any) => m.type === 'image') as m}
                  <div class="pr-grid-item"><img src={m.url} alt="" loading="lazy" onerror={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }} /></div>
                {/each}
                {#each post.media.filter((m: any) => m.type === 'video') as m}
                  <div class="pr-media-video"><video src={m.url} poster={m.thumbnail_url} controls preload="metadata" playsinline><track kind="captions" /></video></div>
                {/each}
                {#each post.media.filter((m: any) => m.type === 'audio') as m}
                  <div class="pr-media-audio"><span>🎵</span><audio src={m.url} controls preload="metadata"></audio></div>
                {/each}
                {#each post.media.filter((m: any) => m.type !== 'image' && m.type !== 'video' && m.type !== 'audio') as m}
                  <a href={m.url} target="_blank" rel="noopener" class="pr-media-doc">
                    <span>📄</span>
                    <div class="pr-media-doc-info"><div class="pr-media-doc-name">{m.filename || 'File'}</div>{#if m.size}<div class="pr-media-doc-size">{formatFileSize(m.size)}</div>{/if}</div>
                    <span class="pr-media-doc-dl">↓</span>
                  </a>
                {/each}
              </div>
            {/if}
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
      {:else if activeTab === 'media'}
        <div class="pr-media-grid">
          {#if mediaImages.length === 0}
            <div class="pr-media-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <p>{status === 'self' ? 'Photos you share will appear here.' : 'No photos yet.'}</p>
            </div>
          {:else}
            {#each mediaImages as img}
              <a href="/wisers/{profile.username}" class="pr-media-item" onclick={(e) => { e.preventDefault(); activeTab = 'posts'; }}>
                <img src={img.url} alt="" loading="lazy" />
              </a>
            {/each}
          {/if}
        </div>

      {:else if activeTab === 'about'}
        <div class="pr-about-section">
          <!-- Bio -->
          <div class="pr-about-card">
            <h4>Bio</h4>
            {#if profile.bio}
              <p class="pr-about-bio">{profile.bio}</p>
            {:else}
              <p class="pr-about-empty">{status === 'self' ? 'Tell the world about yourself.' : 'No bio yet.'}</p>
              {#if status === 'self'}<button class="pr-about-add" onclick={startEdit}>Add bio</button>{/if}
            {/if}
          </div>

          <!-- Details -->
          <div class="pr-about-card">
            <h4>Details</h4>
            <div class="pr-about-details">
              {#if profile.company}<div class="pr-about-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span>{profile.company}</span></div>{/if}
              {#if profile.city || profile.country}<div class="pr-about-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span></div>{/if}
              {#if profile.website}<div class="pr-about-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><a href={profile.website} target="_blank" rel="noopener">{profile.website.replace(/https?:\/\//, '')}</a></div>{/if}
              <div class="pr-about-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span></div>
            </div>
            {#if !profile.company && !profile.city && !profile.country && !profile.website && status === 'self'}
              <button class="pr-about-add" onclick={startEdit}>Add details</button>
            {/if}
          </div>

          <!-- Social links -->
          <div class="pr-about-card">
            <h4>Links</h4>
            {#if profile.github_url || profile.linkedin_url || profile.twitter_url}
              <div class="pr-about-links">
                {#if profile.github_url}<a href={profile.github_url} target="_blank" rel="noopener" class="pr-about-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> GitHub</a>{/if}
                {#if profile.linkedin_url}<a href={profile.linkedin_url} target="_blank" rel="noopener" class="pr-about-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> LinkedIn</a>{/if}
                {#if profile.twitter_url}<a href={profile.twitter_url} target="_blank" rel="noopener" class="pr-about-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X</a>{/if}
              </div>
            {:else}
              <p class="pr-about-empty">{status === 'self' ? 'Connect your social accounts.' : 'No links added.'}</p>
              {#if status === 'self'}<button class="pr-about-add" onclick={startEdit}>Add links</button>{/if}
            {/if}
          </div>

          <!-- Skills -->
          <div class="pr-about-card">
            <h4>Skills</h4>
            {#if parseList(profile.skills).length > 0}
              <div class="pr-tags">{#each parseList(profile.skills) as skill}<span class="pr-tag">{skill}</span>{/each}</div>
            {:else}
              <p class="pr-about-empty">{status === 'self' ? 'Showcase your expertise.' : 'No skills listed.'}</p>
              {#if status === 'self'}<button class="pr-about-add" onclick={startEdit}>Add skills</button>{/if}
            {/if}
          </div>

          <!-- Experience -->
          <div class="pr-about-card">
            <h4>Experience</h4>
            {#if parseEntries(profile.work_history).length > 0}
              {#each parseEntries(profile.work_history) as entry}<div class="pr-entry"><span class="pr-entry-dot"></span><div>{entry}</div></div>{/each}
            {:else}
              <p class="pr-about-empty">{status === 'self' ? 'Add your work experience.' : 'No experience listed.'}</p>
              {#if status === 'self'}<button class="pr-about-add" onclick={startEdit}>Add experience</button>{/if}
            {/if}
          </div>

          <!-- Education -->
          <div class="pr-about-card">
            <h4>Education</h4>
            {#if parseEntries(profile.education).length > 0}
              {#each parseEntries(profile.education) as entry}<div class="pr-entry"><span class="pr-entry-dot ed"></span><div>{entry}</div></div>{/each}
            {:else}
              <p class="pr-about-empty">{status === 'self' ? 'Add your education.' : 'No education listed.'}</p>
              {#if status === 'self'}<button class="pr-about-add" onclick={startEdit}>Add education</button>{/if}
            {/if}
          </div>

          <!-- Certifications -->
          {#if parseEntries(profile.certifications).length > 0}
            <div class="pr-about-card">
              <h4>Certifications</h4>
              {#each parseEntries(profile.certifications) as cert}<div class="pr-entry"><span class="pr-entry-dot cert"></span><div>{cert}</div></div>{/each}
            </div>
          {/if}

          <!-- Languages -->
          {#if parseList(profile.languages).length > 0 || status === 'self'}
            <div class="pr-about-card">
              <h4>Languages</h4>
              {#if parseList(profile.languages).length > 0}
                <div class="pr-tags">{#each parseList(profile.languages) as lang}<span class="pr-tag lang">{lang}</span>{/each}</div>
              {:else}
                <p class="pr-about-empty">Add languages you speak.</p>
                <button class="pr-about-add" onclick={startEdit}>Add languages</button>
              {/if}
            </div>
          {/if}

          <!-- Interests -->
          {#if parseList(profile.interests).length > 0 || status === 'self'}
            <div class="pr-about-card">
              <h4>Interests</h4>
              {#if parseList(profile.interests).length > 0}
                <div class="pr-tags">{#each parseList(profile.interests) as i}<span class="pr-tag int">{i}</span>{/each}</div>
              {:else}
                <p class="pr-about-empty">What are you passionate about?</p>
                <button class="pr-about-add" onclick={startEdit}>Add interests</button>
              {/if}
            </div>
          {/if}
        </div>

      {:else if activeTab === 'journey'}
        <div class="pr-journey">
          <!-- Goals Section -->
          <div class="pr-j-section">
            <div class="pr-j-section-header">
              <h4 class="pr-j-heading">Goals</h4>
              {#if status === 'self'}<button class="pr-j-add-btn" onclick={() => showGoalForm = true}>+ Set Goal</button>{/if}
            </div>
            {#if journeyData.goals.length > 0}
              {#each journeyData.goals as goal}
                <div class="pr-j-goal">
                  <div class="pr-j-goal-top">
                    <span class="pr-j-goal-title">{goal.title}</span>
                    <span class="pr-j-goal-status" class:achieved={goal.status === 'achieved'}>{goal.status}</span>
                  </div>
                  <div class="pr-j-progress-bar"><div class="pr-j-progress-fill" style="width:{goal.target_value ? Math.min(100, (goal.current_value / goal.target_value) * 100) : 0}%"></div></div>
                  <div class="pr-j-goal-bottom">
                    <span class="pr-j-goal-nums">{goal.current_value ?? 0} / {goal.target_value} {goal.unit}</span>
                    {#if goal.deadline}<span class="pr-j-goal-deadline">Due {new Date(goal.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>{/if}
                  </div>
                  {#if status === 'self'}
                    <div class="pr-j-goal-actions">
                      {#if editingGoalId === goal.id}
                        <div class="pr-j-inline-edit">
                          <input type="number" class="pr-j-inline-input" placeholder="New value" bind:value={editGoalValue} onkeydown={(e) => { if (e.key === 'Enter') saveGoalProgress(goal.id); }} />
                          <button class="pr-j-inline-save" onclick={() => saveGoalProgress(goal.id)}>Save</button>
                          <button class="pr-j-inline-cancel" onclick={() => { editingGoalId = null; editGoalValue = ''; }}>Cancel</button>
                        </div>
                      {:else}
                        <button class="pr-j-action-btn" onclick={() => { editingGoalId = goal.id; editGoalValue = String(goal.current_value ?? 0); }}>Update Progress</button>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            {:else}
              <div class="pr-j-empty-card">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <p>{status === 'self' ? 'Set your first goal to track progress.' : 'No goals set yet.'}</p>
                {#if status === 'self'}<button class="pr-j-add-btn" onclick={() => showGoalForm = true}>Set a Goal</button>{/if}
              </div>
            {/if}
          </div>

          <!-- Timeline Section -->
          <div class="pr-j-section">
            <div class="pr-j-section-header">
              <h4 class="pr-j-heading">Timeline</h4>
              {#if status === 'self'}<button class="pr-j-add-btn" onclick={() => showEntryForm = true}>+ Add Entry</button>{/if}
            </div>
            {#if journeyData.entries.length > 0}
              <div class="pr-j-timeline">
                {#each journeyData.entries as entry}
                  <div class="pr-j-entry">
                    <div class="pr-j-entry-dot"></div>
                    <div class="pr-j-entry-body">
                      <div class="pr-j-entry-top">
                        <div class="pr-j-entry-title">{entry.title}</div>
                        {#if status === 'self'}<button class="pr-j-del-btn" title="Delete entry" onclick={() => deleteEntry(entry.id)}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z"/></svg>
                        </button>{/if}
                      </div>
                      {#if entry.description}<p class="pr-j-entry-desc">{entry.description}</p>{/if}
                      {#if entry.metric_name}<div class="pr-j-metric">{entry.metric_name}: {entry.metric_value} {entry.metric_unit}</div>{/if}
                      <span class="pr-j-entry-time">{new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="pr-j-empty-card">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                <p>{status === 'self' ? 'Record milestones, wins, and lessons learned.' : 'No journey entries yet.'}</p>
                {#if status === 'self'}<button class="pr-j-add-btn" onclick={() => showEntryForm = true}>Add Entry</button>{/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Add Entry Modal -->
        {#if showEntryForm}
          <div class="pr-modal-overlay" role="button" tabindex="0" aria-label="Close entry form" onclick={() => showEntryForm = false} onkeydown={(e) => { if (e.key === 'Enter') showEntryForm = false; }}></div>
          <div class="pr-modal pr-j-modal">
            <div class="pr-modal-header">
              <button class="pr-modal-close" onclick={() => showEntryForm = false} aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <h3>Add Journey Entry</h3>
              <button class="pr-modal-save" onclick={submitEntry} disabled={journeySaving || !entryForm.title.trim()}>{journeySaving ? 'Saving...' : 'Add'}</button>
            </div>
            <div class="pr-modal-body">
              <div class="pr-j-form">
                <label class="pr-j-label">Title *
                  <input type="text" class="pr-j-input" placeholder="e.g. Hit 100 customers" bind:value={entryForm.title} />
                </label>
                <label class="pr-j-label">Description
                  <textarea class="pr-j-textarea" rows="3" placeholder="What happened? What did you learn?" bind:value={entryForm.description}></textarea>
                </label>
                <label class="pr-j-label">Type
                  <select class="pr-j-input" bind:value={entryForm.entry_type}>
                    <option value="milestone">Milestone</option>
                    <option value="lesson">Lesson Learned</option>
                    <option value="win">Win</option>
                    <option value="challenge">Challenge</option>
                    <option value="update">Update</option>
                  </select>
                </label>
                <div class="pr-j-metric-group">
                  <label class="pr-j-label pr-j-flex1">Metric Name
                    <input type="text" class="pr-j-input" placeholder="e.g. Revenue" bind:value={entryForm.metric_name} />
                  </label>
                  <label class="pr-j-label pr-j-flex1">Value
                    <input type="number" class="pr-j-input" placeholder="0" bind:value={entryForm.metric_value} />
                  </label>
                  <label class="pr-j-label" style="flex:0.6">Unit
                    <input type="text" class="pr-j-input" placeholder="GBP" bind:value={entryForm.metric_unit} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Add Goal Modal -->
        {#if showGoalForm}
          <div class="pr-modal-overlay" role="button" tabindex="0" aria-label="Close goal form" onclick={() => showGoalForm = false} onkeydown={(e) => { if (e.key === 'Enter') showGoalForm = false; }}></div>
          <div class="pr-modal pr-j-modal">
            <div class="pr-modal-header">
              <button class="pr-modal-close" onclick={() => showGoalForm = false} aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <h3>Set a Goal</h3>
              <button class="pr-modal-save" onclick={submitGoal} disabled={journeySaving || !goalForm.title.trim()}>{journeySaving ? 'Setting...' : 'Set'}</button>
            </div>
            <div class="pr-modal-body">
              <div class="pr-j-form">
                <label class="pr-j-label">Goal Title *
                  <input type="text" class="pr-j-input" placeholder="e.g. Reach 1000 monthly revenue" bind:value={goalForm.title} />
                </label>
                <div class="pr-j-metric-group">
                  <label class="pr-j-label pr-j-flex1">Target Value
                    <input type="number" class="pr-j-input" placeholder="1000" bind:value={goalForm.target_value} />
                  </label>
                  <label class="pr-j-label" style="flex:0.6">Unit
                    <input type="text" class="pr-j-input" placeholder="GBP" bind:value={goalForm.unit} />
                  </label>
                </div>
                <label class="pr-j-label">Deadline
                  <input type="date" class="pr-j-input" bind:value={goalForm.deadline} />
                </label>
              </div>
            </div>
          </div>
        {/if}

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
        <div class="pr-activity">
          <div class="pr-activity-grid">
            <div class="pr-activity-card">
              <div class="pr-activity-card-icon pr-ac-scan">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div class="pr-activity-card-value">{profile.stats?.total_scans || 0}</div>
              <div class="pr-activity-card-label">Scans</div>
            </div>
            <div class="pr-activity-card">
              <div class="pr-activity-card-icon pr-ac-score">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
              </div>
              <div class="pr-activity-card-value">{profile.stats?.avg_score || 0}</div>
              <div class="pr-activity-card-label">Avg Score</div>
            </div>
            <div class="pr-activity-card">
              <div class="pr-activity-card-icon pr-ac-network">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div class="pr-activity-card-value">{followersCount}<span class="pr-ac-slash">/</span>{followingCount}</div>
              <div class="pr-activity-card-label">Followers / Following</div>
            </div>
            <div class="pr-activity-card">
              <div class="pr-activity-card-icon pr-ac-friends">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
              </div>
              <div class="pr-activity-card-value">{profile.stats?.friends || 0}</div>
              <div class="pr-activity-card-label">Friends</div>
            </div>
          </div>
          {#if posts.length > 0}
            <div class="pr-activity-recent">
              <h4 class="pr-activity-heading">Recent Activity</h4>
              {#each posts.slice(0, 3) as post}
                <div class="pr-activity-item">
                  <div class="pr-activity-item-icon">
                    {#if post.post_type === 'milestone'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    {:else}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    {/if}
                  </div>
                  <div class="pr-activity-item-body">
                    <span class="pr-activity-item-text">{post.content.length > 80 ? post.content.slice(0, 80) + '...' : post.content}</span>
                    <span class="pr-activity-item-time">{timeAgo(post.created_at)}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/if}

  </div>
{/if}

<!-- Avatar toast notification -->
{#if avatarToast}
  <div class="pr-avatar-toast" class:success={avatarToast.type === 'success'} class:error={avatarToast.type === 'error'}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      {#if avatarToast.type === 'success'}<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      {:else}<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>{/if}
    </svg>
    <span>{avatarToast.msg}</span>
  </div>
{/if}

<!-- Post to feed confirmation -->
{#if showAvatarConfirm}
  <div class="pr-confirm-overlay" role="button" tabindex="0" aria-label="Skip avatar post" onclick={skipAvatarPost} onkeydown={(e) => { if (e.key === 'Enter') skipAvatarPost(); }}></div>
  <div class="pr-confirm-dialog">
    <div class="pr-confirm-preview">
      {#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{/if}
    </div>
    <h3>Post to your feed?</h3>
    <p>Let your followers know you updated your profile picture.</p>
    <div class="pr-confirm-actions">
      <button class="pr-confirm-skip" onclick={skipAvatarPost}>Skip</button>
      <button class="pr-confirm-post" onclick={postAvatarToFeed}>Post</button>
    </div>
  </div>
{/if}
</div>


<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  .pr { --bg:#0a0a0f;--card:#111117;--t1:#e4e6ea;--t2:#8a8d91;--t3:#606770;--bd:#1e1e2a;--gold:#f5a623;--hv:rgba(255,255,255,0.04);
    font-family:'DM Sans',-apple-system,sans-serif;color:var(--t1);background:var(--bg);min-height:100vh; }
  .pr.light { --bg:#ffffff;--card:#ffffff;--t1:#1c1e21;--t2:#606770;--t3:#8a8d91;--bd:#dddfe2;--gold:#d4a017;--hv:rgba(0,0,0,0.04); }
  .pr-banner { height:180px;background:linear-gradient(135deg,#1a1520 0%,#1e1a2e 25%,#16213e 50%,#0f3460 75%,#1a1520 100%);position:relative;overflow:hidden; }
  .pr-banner::before { content:'';position:absolute;top:-50%;right:-20%;width:60%;height:200%;background:radial-gradient(ellipse at center,rgba(245,166,35,0.08) 0%,transparent 70%);pointer-events:none; }
  .pr-banner::after { content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,var(--bg) 100%); }
  .pr-back-link { position:absolute;top:12px;left:12px;z-index:3;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;transition:background 0.15s; }
  .pr-back-link:hover { background:rgba(0,0,0,0.7); }
  .pr-wrap { max-width:680px;margin:0 auto;padding:0 20px 80px; }
  .pr-top { margin-top:-50px;position:relative;z-index:2; }
  .pr-av { width:110px;height:110px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:40px;border:4px solid var(--bg);overflow:hidden;flex-shrink:0; }
  .pr-av img { width:100%;height:100%;object-fit:cover; }
  .pr-actions { display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap; }
  .pr-btn { padding:10px 20px;border-radius:20px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;border:none;text-decoration:none;display:inline-flex;align-items:center;gap:6px; }
  .pr-btn-p { background:var(--gold);color:#000; } .pr-btn-p:hover { filter:brightness(1.1); }
  .pr-btn-o { background:transparent;border:1px solid var(--bd);color:var(--t1); } .pr-btn-o:hover { border-color:var(--t2); }
  .pr-btn-g { border:1px solid #10b981;color:#10b981;background:transparent; }
  .pr-btn:disabled { opacity:0.4;cursor:default; }

  .pr-identity { margin-top:14px; }
  .pr-name-row { display:flex;align-items:center;gap:6px; }
  .pr-name-row h1 { font-size:26px;font-weight:800;margin:0; }
  .pr-badge { display:inline-flex; }
  .pr-handle { font-size:17px;color:var(--t2); }
  .pr-headline { font-size:17px;color:var(--t1);margin-top:6px;font-weight:500; }
  .pr-bio { font-size:16px;line-height:1.6;margin-top:10px;white-space:pre-wrap;color:var(--t2); }
  .pr-meta { display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:15px;color:var(--t2); }
  .pr-meta a { color:var(--gold);text-decoration:none; } .pr-meta a:hover { text-decoration:underline; }
  .pr-socials { display:flex;gap:8px;margin-top:10px; }
  .pr-social { padding:6px 14px;border-radius:14px;font-size:13px;font-weight:700;border:1px solid var(--bd);color:var(--t2);text-decoration:none; }
  .pr-social:hover { border-color:var(--gold);color:var(--gold); }
  .pr-toast { margin-top:8px;font-size:14px;color:#10b981; }

  .pr-stats { display:flex;gap:0;margin-top:16px;padding:0;border-bottom:1px solid var(--bd); }
  .pr-stat-item { flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:16px 8px;background:none;border:none;cursor:pointer;font-family:inherit;border-bottom:2px solid transparent;transition:background 0.15s; }
  .pr-stat-item:hover { background:var(--hv); }
  .pr-stat-num { font-size:20px;font-weight:800;color:var(--t1); }
  .pr-stat-label { font-size:15px;color:var(--t2);font-weight:500; }

  /* Sections */
  .pr-tags { display:flex;flex-wrap:wrap;gap:6px; }
  .pr-tag { padding:6px 14px;border-radius:14px;font-size:14px;font-weight:600;background:rgba(245,166,35,0.08);color:var(--gold);border:1px solid rgba(245,166,35,0.15); }
  .pr-tag.lang { background:rgba(59,130,246,0.08);color:#3b82f6;border-color:rgba(59,130,246,0.15); }
  .pr-tag.int { background:rgba(16,185,129,0.08);color:#10b981;border-color:rgba(16,185,129,0.15); }
  .pr-entry { display:flex;align-items:flex-start;gap:10px;padding:8px 0;font-size:16px;line-height:1.5; }
  .pr-entry-dot { width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:6px; }
  .pr-entry-dot.ed { background:#3b82f6; }
  .pr-entry-dot.cert { background:#10b981; }

  /* Edit form */
  .pr-edit-grid { display:flex;flex-direction:column;gap:12px; }
  .pr-edit-field { display:flex;flex-direction:column;gap:4px; }
  .pr-edit-field label, .pr-edit-field-label { font-size:13px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.05em; }
  .pr-edit-field input, .pr-edit-field textarea { padding:14px 16px;border-radius:10px;border:1px solid var(--bd);background:var(--bg);color:var(--t1);font-size:16px;font-family:inherit;outline:none;resize:vertical; }
  .pr-edit-field input:focus, .pr-edit-field textarea:focus { border-color:var(--gold); }

  /* Tabs */
  .pr-tabs-scroll { overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:8px;scrollbar-width:none; }
  .pr-tabs-scroll::-webkit-scrollbar { display:none; }
  .pr-tabs { display:flex;border-bottom:1px solid var(--bd);min-width:max-content;width:100%; }
  .pr-tab { padding:14px 16px;text-align:center;font-size:16px;font-weight:600;color:var(--t2);background:none;border:none;cursor:pointer;border-bottom:3px solid transparent;font-family:inherit;white-space:nowrap;transition:all 0.15s;position:relative; }
  .pr-tab:hover { color:var(--t1);background:var(--hv); }
  .pr-tab.active { color:var(--gold);border-bottom-color:var(--gold); }

  .pr-empty { padding:40px;text-align:center;color:var(--t3);font-size:16px; }
  .pr-post { padding:16px 0;border-bottom:1px solid var(--bd); }
  .pr-post-head { display:flex;align-items:center;gap:10px;margin-bottom:8px; }
  .pr-post-av { width:36px;height:36px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;overflow:hidden;flex-shrink:0; }
  .pr-post-av img { width:100%;height:100%;object-fit:cover; }
  .pr-post-name { font-weight:700;font-size:16px; } .pr-post-h { font-size:15px;color:var(--t2);margin-left:4px; }
  .pr-post-body { font-size:17px;line-height:1.5;white-space:pre-wrap;word-break:break-word; }
  .pr-post-ft { display:flex;flex-wrap:wrap;gap:4px;margin-top:10px;font-size:15px;color:var(--t2); }
  .pr-edit-box { width:100%;background:#1a1a2a;border:1px solid #f5a623;border-radius:8px;color:#e4e6ea;padding:14px;font-size:16px;resize:vertical;margin-bottom:6px; }
  .w-comments { margin-top:10px;padding-top:10px;border-top:1px solid var(--bd,#1e1e2a); }
  .w-comment { display:flex;gap:8px;align-items:baseline;margin-bottom:6px;font-size:15px; }
  .w-comment-author { color:#f5a623;font-weight:600;text-decoration:none; }
  .w-comment-text { color:#c0c0c8; }
  .w-comment-time { color:#555;margin-left:auto; }
  .w-comment-form { margin-top:8px; }
  .w-comment-input { width:100%;background:#1a1a2a;border:1px solid #2a2a3a;border-radius:20px;color:#e4e6ea;padding:14px 16px;font-size:15px; }
  .w-action { display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:#8a8d91;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:15px;transition:color 0.15s; }
  .w-action:hover { color:#e4e6ea; }
  .w-liked svg,.w-liked { color:#f43f5e; }
  .w-rocketed svg,.w-rocketed { color:#f97316; }
  .w-bookmarked svg { color:#eab308; }

  .pr-center { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px;color:var(--t3); }
  .pr-center a { color:var(--gold);text-decoration:none; }
  .pr-spin { width:28px;height:28px;border:3px solid var(--bd);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media(max-width:600px) {
    .pr-banner { height:140px; }
    .pr-av { width:86px;height:86px;font-size:30px;border-width:3px; }
    .pr-top { margin-top:-43px; }
    .pr-actions { margin-top:10px; }
    .pr-name-row h1 { font-size:20px; }
    .pr-btn { padding:8px 14px;font-size:14px; }
    .pr-activity-grid { gap:8px; }
    .pr-activity-card { padding:14px 10px; }
    .pr-activity-card-value { font-size:20px; }
    .pr-wrap { padding:0 16px 80px; }
    .pr-more-dropdown { right:auto;left:0; }
  }
  .pr-btn-block { background: transparent !important; border: 1px solid rgba(239,68,68,0.3) !important; color: #ef4444 !important; font-size: 14px !important; }
  /* Activity tab */
  .pr-activity { padding:16px 0; }
  .pr-activity-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px; }
  .pr-activity-card { background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;transition:border-color 0.15s; }
  .pr-activity-card:hover { border-color:rgba(245,166,35,0.3); }
  .pr-activity-card-icon { width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center; }
  .pr-ac-scan { background:rgba(245,166,35,0.1);color:var(--gold); }
  .pr-ac-score { background:rgba(59,130,246,0.1);color:#3b82f6; }
  .pr-ac-network { background:rgba(16,185,129,0.1);color:#10b981; }
  .pr-ac-friends { background:rgba(168,85,247,0.1);color:#a855f7; }
  .pr-activity-card-value { font-size:24px;font-weight:800;color:var(--t1);letter-spacing:-0.5px; }
  .pr-ac-slash { font-size:16px;font-weight:400;color:var(--t3);margin:0 2px; }
  .pr-activity-card-label { font-size:14px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:0.05em; }
  .pr-activity-recent { border-top:1px solid var(--bd);padding-top:16px; }
  .pr-activity-heading { font-size:17px;font-weight:700;color:var(--t1);margin:0 0 12px; }
  .pr-activity-item { display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--bd); }
  .pr-activity-item:last-child { border-bottom:none; }
  .pr-activity-item-icon { width:32px;height:32px;border-radius:50%;background:var(--card);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--t3); }
  .pr-activity-item-body { flex:1;min-width:0; }
  .pr-activity-item-text { font-size:16px;color:var(--t1);display:block;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .pr-activity-item-time { font-size:14px;color:var(--t3);margin-top:2px;display:block; }
  .pr-privacy-toggle { display:flex;gap:8px;margin-top:8px; }
  .pr-privacy-opt { display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;border:1px solid var(--bd,#1e1e2a);background:transparent;color:var(--t2,#8a8d91);font-size:15px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.15s; }
  .pr-privacy-opt.active { border-color:#f5a623;background:rgba(245,166,35,0.1);color:#f5a623; }
  .pr-privacy-opt:hover:not(.active) { border-color:#555;color:var(--t1,#e4e6ea); }
  /* Theme */
  .pr { --pr-bg: #0a0a0f; --pr-card: #111117; --pr-t: #e4e6ea; --pr-t2: #8a8d91; --pr-t3: #606770; --pr-bd: #1e1e2a; --pr-gold: #f5a623; }
  .pr.light { --pr-bg: #ffffff; --pr-card: #ffffff; --pr-t: #1c1e21; --pr-t2: #606770; --pr-t3: #8a8d91; --pr-bd: #dddfe2; --pr-gold: #d4a017; --hv:rgba(0,0,0,0.04); }
  .pr.light .pr-banner { background:linear-gradient(135deg,#f0ebe3 0%,#e8ddd0 25%,#d4c5b0 50%,#c4a97d 75%,#f0ebe3 100%); }
  .pr.light .pr-banner::before { background:radial-gradient(ellipse at center,rgba(212,160,23,0.12) 0%,transparent 70%); }
  .pr.light .pr-back-link { background:rgba(255,255,255,0.7);color:#1c1e21; }
  .pr.light .pr-back-link:hover { background:rgba(255,255,255,0.9); }
  .pr.light .pr-more-dropdown { background:#fff;border-color:#dddfe2;box-shadow:0 4px 24px rgba(0,0,0,0.12); }
  .pr.light .pr-more-item { color:#1c1e21; }
  .pr.light .pr-more-item:hover { background:rgba(0,0,0,0.04); }
  .pr.light .pr-activity-card { background:#fafafa;border-color:#e8e8e8; }
  .pr.light .pr-activity-card:hover { border-color:rgba(212,160,23,0.4); }
  .pr.light .pr-activity-item-icon { background:#f5f5f5;border-color:#e8e8e8; }

  /* Full bleed */
  :global(body) { margin: 0; }
  :global(.page) { padding: 0 !important; }

  /* Back link is now on the banner — see .pr-back-link above */

  /* Post image */
  .pr-post-img { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .pr-post-img img { width: 100%; max-height: 500px; object-fit: cover; display: block; border-radius: 12px; }

  /* Media grid & rendering */
  .pr-post-media { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .pr-grid-item { overflow: hidden; border-radius: 12px; }
  .pr-grid-item img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in; }
  .pr-media-video { border-radius: 12px; overflow: hidden; margin-top: 6px; }
  .pr-media-video video { width: 100%; max-height: 500px; background: #000; }
  .pr-media-audio { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--wcard, #111117); border: 1px solid var(--wbd, #1e1e2a); border-radius: 12px; margin-top: 6px; }
  .pr-media-audio audio { flex: 1; min-width: 0; height: 32px; }
  .pr-media-doc { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--wcard, #111117); border: 1px solid var(--wbd, #1e1e2a); border-radius: 12px; text-decoration: none; color: var(--wt, #e4e6ea); margin-top: 6px; transition: border-color 0.15s; }
  .pr-media-doc:hover { border-color: var(--wgold, #f5a623); }
  .pr-media-doc-info { flex: 1; min-width: 0; }
  .pr-media-doc-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pr-media-doc-size { font-size: 12px; color: var(--wt2, #8a8d91); }
  .pr-media-doc-dl { color: var(--wt2, #8a8d91); font-size: 18px; }

  /* About section */
  .pr-about-section { display: flex; flex-direction: column; gap: 16px; }
  .pr-about-card { background: var(--pr-card); border: 1px solid var(--pr-bd); border-radius: 14px; padding: 18px; }
  .pr-about-card h4 { margin: 0 0 12px; font-size: 17px; font-weight: 600; color: var(--pr-gold); }

  /* Journey */
  .pr-journey { display: flex; flex-direction: column; gap: 12px; }
  .pr-j-heading { margin: 8px 0; font-size: 17px; font-weight: 600; color: var(--pr-gold); }
  .pr-j-goal { background: var(--pr-card); border: 1px solid var(--pr-bd); border-radius: 14px; padding: 16px; }
  .pr-j-goal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .pr-j-goal-title { font-weight: 600; font-size: 16px; }
  .pr-j-goal-status { font-size: 14px; color: var(--pr-t3); text-transform: capitalize; padding: 3px 10px; border-radius: 12px; border: 1px solid var(--pr-bd); }
  .pr-j-goal-status.achieved { color: #10b981; border-color: rgba(16,185,129,0.3); }
  .pr-j-progress-bar { height: 6px; background: var(--pr-bd); border-radius: 3px; overflow: hidden; }
  .pr-j-progress-fill { height: 100%; background: var(--pr-gold); border-radius: 3px; transition: width 0.3s; }
  .pr-j-goal-nums { font-size: 14px; color: var(--pr-t3); margin-top: 6px; }
  .pr-j-entry { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--pr-bd); }
  .pr-j-entry:last-child { border-bottom: none; }
  .pr-j-entry-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pr-gold); margin-top: 5px; flex-shrink: 0; }
  .pr-j-entry-body { flex: 1; }
  .pr-j-entry-title { font-weight: 600; font-size: 16px; }
  .pr-j-entry-desc { font-size: 15px; color: var(--pr-t2); margin: 4px 0; line-height: 1.5; }
  .pr-j-metric { font-size: 15px; color: var(--pr-gold); font-weight: 600; margin: 4px 0; }
  .pr-j-entry-time { font-size: 14px; color: var(--pr-t3); }

  /* Journey enhancements */
  .pr-j-section { margin-bottom: 20px; }
  .pr-j-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .pr-j-section-header .pr-j-heading { margin: 0; }
  .pr-j-add-btn { background: none; border: 1px solid var(--pr-gold); color: var(--pr-gold); padding: 8px 16px; border-radius: 20px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .pr-j-add-btn:hover { background: var(--pr-gold); color: #000; }
  .pr-j-empty-card { text-align: center; padding: 32px 20px; background: var(--pr-card); border: 1px solid var(--pr-bd); border-radius: 14px; color: var(--pr-t3); }
  .pr-j-empty-card svg { margin-bottom: 12px; opacity: 0.4; }
  .pr-j-empty-card p { font-size: 16px; margin: 0 0 14px; }
  .pr-j-goal-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
  .pr-j-goal-deadline { font-size: 14px; color: var(--pr-t3); }
  .pr-j-goal-actions { margin-top: 10px; }
  .pr-j-action-btn { background: none; border: 1px solid var(--pr-bd); color: var(--pr-t2); padding: 7px 14px; border-radius: 16px; font-size: 14px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .pr-j-action-btn:hover { border-color: var(--pr-gold); color: var(--pr-gold); }
  .pr-j-inline-edit { display: flex; gap: 8px; align-items: center; }
  .pr-j-inline-input { width: 100px; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--pr-bd); background: var(--pr-bg); color: var(--pr-t); font-size: 15px; font-family: inherit; }
  .pr-j-inline-save { background: var(--pr-gold); color: #000; border: none; padding: 7px 14px; border-radius: 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .pr-j-inline-cancel { background: none; border: 1px solid var(--pr-bd); color: var(--pr-t3); padding: 7px 14px; border-radius: 16px; font-size: 14px; cursor: pointer; font-family: inherit; }
  .pr-j-entry-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .pr-j-del-btn { background: none; border: none; color: var(--pr-t3); cursor: pointer; padding: 2px; opacity: 0; transition: opacity 0.15s, color 0.15s; }
  .pr-j-entry:hover .pr-j-del-btn { opacity: 1; }
  .pr-j-del-btn:hover { color: #ef4444; }
  .pr-j-timeline { border-left: 2px solid var(--pr-bd); margin-left: 4px; padding-left: 0; }
  .pr-j-timeline .pr-j-entry { border-bottom: none; padding: 0 0 16px 0; margin-left: -6px; }
  .pr-j-timeline .pr-j-entry:last-child { padding-bottom: 0; }

  /* Journey modal/form */
  .pr-j-modal { max-width: 480px; }
  .pr-j-form { display: flex; flex-direction: column; gap: 14px; padding: 20px; }
  .pr-j-label { display: flex; flex-direction: column; gap: 5px; font-size: 15px; font-weight: 600; color: var(--pr-t2); }
  .pr-j-input { padding: 14px 16px; border-radius: 10px; border: 1px solid var(--pr-bd); background: var(--pr-bg); color: var(--pr-t); font-size: 16px; font-family: inherit; transition: border-color 0.15s; }
  .pr-j-input:focus { border-color: var(--pr-gold); outline: none; }
  .pr-j-textarea { padding: 14px 16px; border-radius: 10px; border: 1px solid var(--pr-bd); background: var(--pr-bg); color: var(--pr-t); font-size: 16px; font-family: inherit; resize: vertical; transition: border-color 0.15s; }
  .pr-j-textarea:focus { border-color: var(--pr-gold); outline: none; }
  .pr-j-metric-group { display: flex; gap: 10px; }
  .pr-j-flex1 { flex: 1; }

  /* Communities */
  .pr-communities { display: flex; flex-direction: column; gap: 10px; }
  .pr-comm-card { display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--pr-card); border: 1px solid var(--pr-bd); border-radius: 14px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
  .pr-comm-card:hover { border-color: var(--pr-gold); }
  .pr-comm-icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, var(--pr-gold), #e09100); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 18px; flex-shrink: 0; }
  .pr-comm-info { flex: 1; }
  .pr-comm-name { font-weight: 600; font-size: 16px; }
  .pr-comm-meta { font-size: 14px; color: var(--pr-t3); margin-top: 2px; }

  /* More button (X standard "...") */
  .pr-more-wrap { position:relative; }
  .pr-more-btn { width:34px;height:34px;border-radius:50%;background:none;border:1px solid var(--bd);color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s; }
  .pr-more-btn:hover { border-color:var(--t2);color:var(--t1);background:var(--hv); }
  .pr-more-dropdown { position:absolute;top:calc(100% + 6px);right:0;min-width:240px;background:var(--card);border:1px solid var(--bd);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:4px 0;z-index:200; }
  .pr-more-item { display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;background:none;border:none;color:var(--t1);font-size:16px;cursor:pointer;font-family:inherit;text-align:left; }
  .pr-more-item:hover { background:var(--hv); }
  .pr-more-item.pr-more-danger { color:#ef4444; }
  .pr-more-divider { height:1px;background:var(--bd);margin:4px 0; }

  /* Follow button (X standard) */
  .pr-btn-follow { background:var(--gold);color:#000;border:2px solid var(--gold);font-weight:700; }
  .pr-btn-follow:hover { filter:brightness(1.1); }
  .pr-btn-follow.following { background:transparent;color:var(--t2);border-color:var(--bd); }
  .pr-btn-follow.following:hover { border-color:rgba(239,68,68,0.5);color:#ef4444; }

  /* About section cards */
  .pr-about-bio { font-size:17px;line-height:1.6;color:var(--t1);margin:0;white-space:pre-wrap; }
  .pr-about-empty { font-size:16px;color:var(--t3);margin:0 0 8px; }
  .pr-about-add { background:none;border:none;color:var(--gold);font-size:15px;font-weight:600;cursor:pointer;padding:0;font-family:inherit; }
  .pr-about-add:hover { text-decoration:underline; }
  .pr-about-details { display:flex;flex-direction:column;gap:12px; }
  .pr-about-row { display:flex;align-items:center;gap:10px;font-size:16px;color:var(--t2); }
  .pr-about-row svg { color:var(--t3);flex-shrink:0; }
  .pr-about-row a { color:var(--gold);text-decoration:none; }
  .pr-about-row a:hover { text-decoration:underline; }
  .pr-about-links { display:flex;flex-direction:column;gap:10px; }
  .pr-about-link { display:flex;align-items:center;gap:10px;font-size:16px;color:var(--t1);text-decoration:none;padding:10px 14px;border-radius:10px;border:1px solid var(--bd);transition:border-color 0.15s; }
  .pr-about-link:hover { border-color:var(--gold); }
  .pr-about-link svg { color:var(--t2);flex-shrink:0; }

  /* Edit profile modal (X standard) */
  .pr-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1000; }
  .pr-modal { position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;max-width:calc(100vw - 32px);max-height:90vh;background:var(--card,#111117);border-radius:16px;z-index:1001;display:flex;flex-direction:column;overflow:hidden; }
  .pr-modal-header { display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--bd,#1e1e2a);flex-shrink:0; }
  .pr-modal-header h3 { flex:1;font-size:20px;font-weight:800;margin:0; }
  .pr-modal-close { width:34px;height:34px;border-radius:50%;background:none;border:none;color:var(--t1,#e4e6ea);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s; }
  .pr-modal-close:hover { background:rgba(255,255,255,0.1); }
  .pr-modal-save { padding:10px 18px;border-radius:20px;background:var(--gold,#f5a623);color:#000;font-weight:700;font-size:16px;border:none;cursor:pointer;font-family:inherit; }
  .pr-modal-save:disabled { opacity:0.5;cursor:not-allowed; }
  .pr-modal-save:hover:not(:disabled) { filter:brightness(1.1); }
  .pr-modal-body { flex:1;overflow-y:auto;padding:20px; }
  .pr-edit-avatar-wrap { display:flex;justify-content:center;margin-bottom:20px; }
  .pr-edit-avatar { width:100px;height:100px;border-radius:50%;background:var(--gold,#f5a623);position:relative;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:#000; }
  .pr-edit-avatar img { width:100%;height:100%;object-fit:cover; }
  .pr-edit-avatar-overlay { position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:24px;opacity:0;transition:opacity 0.15s; }
  .pr-edit-avatar:hover .pr-edit-avatar-overlay { opacity:1; }
  .pr-field-count { font-size:13px;color:var(--t3,#606770);text-align:right;margin-top:2px; }
  .pr-edit-details { margin-top:16px;border:1px solid var(--bd,#1e1e2a);border-radius:12px;overflow:hidden; }
  .pr-edit-details summary { padding:12px 16px;font-size:16px;font-weight:600;color:var(--t2,#8a8d91);cursor:pointer;list-style:none; }
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

  /* Media gallery (X/Facebook standard) */
  .pr-media-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px; }
  .pr-media-item { aspect-ratio:1;overflow:hidden;border-radius:4px;cursor:pointer;position:relative; }
  .pr-media-item img { width:100%;height:100%;object-fit:cover;transition:transform 0.2s; }
  .pr-media-item:hover img { transform:scale(1.05); }
  .pr-media-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:var(--t3);text-align:center; }
  .pr-media-empty svg { color:var(--bd);margin-bottom:12px; }
  .pr-media-empty p { font-size:14px;margin:0; }

  /* Avatar toast */
  .pr-avatar-toast { position:fixed;bottom:32px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:2000;animation:toastIn 0.3s ease;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:inherit; }
  .pr-avatar-toast.success { background:#10b981;color:#fff; }
  .pr-avatar-toast.error { background:#ef4444;color:#fff; }
  @keyframes toastIn { from { opacity:0;transform:translateX(-50%) translateY(20px); } to { opacity:1;transform:translateX(-50%) translateY(0); } }

  /* Avatar post confirmation dialog */
  .pr-confirm-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1500; }
  .pr-confirm-dialog { position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:340px;max-width:calc(100vw - 32px);background:var(--card,#111117);border-radius:20px;z-index:1501;text-align:center;padding:28px 24px;box-shadow:0 12px 48px rgba(0,0,0,0.5); }
  .pr-confirm-preview { width:80px;height:80px;border-radius:50%;overflow:hidden;margin:0 auto 16px;border:3px solid var(--gold,#f5a623); }
  .pr-confirm-preview img { width:100%;height:100%;object-fit:cover; }
  .pr-confirm-dialog h3 { font-size:18px;font-weight:800;margin:0 0 8px;color:var(--t1,#e4e6ea); }
  .pr-confirm-dialog p { font-size:14px;color:var(--t2,#8a8d91);margin:0 0 20px;line-height:1.5; }
  .pr-confirm-actions { display:flex;gap:10px;justify-content:center; }
  .pr-confirm-skip { padding:10px 24px;border-radius:20px;border:1px solid var(--bd,#1e1e2a);background:none;color:var(--t2,#8a8d91);font-weight:600;font-size:14px;cursor:pointer;font-family:inherit; }
  .pr-confirm-skip:hover { border-color:var(--t2,#8a8d91);color:var(--t1,#e4e6ea); }
  .pr-confirm-post { padding:10px 24px;border-radius:20px;border:none;background:var(--gold,#f5a623);color:#000;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit; }
  .pr-confirm-post:hover { filter:brightness(1.1); }

  @media(max-width:600px) {
    .pr-modal { width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0;top:0;left:0;transform:none; }
    .w-post-menu-btn { opacity:1; }
    .pr-media-grid { grid-template-columns:repeat(3,1fr);gap:2px; }
  }

  </style>