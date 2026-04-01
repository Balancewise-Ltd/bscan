<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { connectWS, wsNotifCount, wsUnreadDMs } from '$lib/stores/wisers-ws';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let activeView = $state<'feed' | 'explore' | 'friends' | 'messages' | 'bookmarks' | 'activity'>('feed');
  let friends = $state<any[]>([]);
  let incoming = $state<any[]>([]);
  let outgoing = $state<any[]>([]);
  let posts = $state<any[]>([]);
  let allUsers = $state<any[]>([]);
  let suggested = $state<any[]>([]);
  let feedType = $state<'all' | 'friends'>('all');
  let searchQuery = $state('');
  let searchResults = $state<any[]>([]);
  let loading = $state(true);
  let newPost = $state('');
  let postImage = $state<File | null>(null);
  let postImagePreview = $state('');
  let uploading = $state(false);
  let posting = $state(false);
  let showEmoji = $state(false);
  const emojis = ['😀','😂','🤣','😍','🥰','😎','🤩','🥳','😭','😤','🔥','💯','👏','🙌','💪','🚀','⭐','💡','✅','❌','👀','💬','❤️','💙','💚','💛','🧡','💜','🖤','🤍','👍','👎','🎉','🎊','🏆','💎','🌟','⚡','🎯','🔑','📈','📉','🛠️','💻','🌐','🔍','📱','🤖','🧠','💭','📌','📎','✨','🙏','🤝','👋','✌️','🤞','💀','🤡','👑','🦾'];
  let commentInputs = $state<Record<number, string>>({});
  let expandedComments = $state<Set<number>>(new Set());
  let postComments = $state<Record<number, any[]>>({});
  let actionMsg = $state('');
  let openPostMenu = $state<number | null>(null);
  let showUserMenu = $state(false);
  let bookmarkedPosts = $state<Set<number>>(new Set());
  let editingPost = $state<number | null>(null);
  let editContent = $state('');
  let trendingTags = $state<any[]>([]);
  let showScheduler = $state(false);
  let scheduleContent = $state('');
  let scheduleDate = $state('');
  let activeTab = $state<'feed' | 'bookmarks' | 'activity'>('feed');
  let bookmarkedList = $state<any[]>([]);
  let activityList = $state<any[]>([]);
  let theme = $state<'dark' | 'light'>('dark');
  let notifCount = $state(0);
  let prevNotifCount = $state(0);

  onMount(async () => {
    // Load theme preference
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; if (typeof document !== 'undefined') document.documentElement.setAttribute('data-wisers-theme', 'light'); }

    await loadFeed();
    loadUsers();
    loadTrending();
    if ($auth.token) {
      try {
        const [fr, req, sg] = await Promise.all([
          api.getFriends().catch(() => ({ friends: [] })),
          api.getFriendRequests().catch(() => ({ incoming: [], outgoing: [] })),
          api.getSuggestedUsers().catch(() => ({ users: [] }))
        ]);
        friends = fr.friends || [];
        incoming = req.incoming || [];
        outgoing = req.outgoing || [];
        suggested = sg.users || [];
      } catch {}
      try { const bk = await api.getBookmarks(); bookmarkedPosts = new Set((bk.posts || []).map((p: any) => p.id)); } catch {}
    }
    loading = false;
    if (typeof document !== 'undefined') {
      document.body.classList.add('wisers-page');
      document.addEventListener('click', () => { openPostMenu = null; showUserMenu = false; });
    }
    if ($auth.token) { await pollNotifs(); notifInterval = setInterval(pollNotifs, 30000); connectWS($auth.token); }
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-wisers-theme', theme);
    localStorage.setItem('wisers-theme', theme);
  }

  onDestroy(() => { if (typeof document !== 'undefined') document.body.classList.remove('wisers-page'); if (notifInterval) clearInterval(notifInterval); });

  let notifInterval: any;

  function playPing() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  async function pollNotifs() {
    if (!$auth.token) return;
    try {
      const res = await api.getNotificationCount();
      const count = res.count || 0;
      if (count > prevNotifCount && prevNotifCount !== 0) playPing();
      prevNotifCount = count;
      notifCount = count;
    } catch {}
  }

  function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    auth.set({ token: null, user: null });
    if (typeof window !== 'undefined') window.location.href = '/wisers';
  }

  async function loadFeed() {
    try {
      const res = feedType === 'friends' && $auth.token
        ? await api.getFriendsFeed(1)
        : await api.getCommunityFeed(1);
      posts = (res.posts || []).map(p => ({ ...p, _liked: !!p.my_liked, my_rocket: !!p.my_rocketed, my_repost: !!p.my_reposted }));
    } catch {}
  }

  async function loadUsers() {
    try { allUsers = (await api.getAllUsers(1)).users || []; } catch {}
  }

  async function submitPost() {
    if ((!newPost.trim() && !postImage) || posting) return;
    posting = true;
    try {
      let imageUrl = '';
      if (postImage) {
        uploading = true;
        const res = await api.uploadPostImage(postImage);
        imageUrl = res.url;
        uploading = false;
      }
      await api.createPost(newPost.trim() || '📷', 'text', '', 0, imageUrl);
      newPost = ''; postImage = null; postImagePreview = '';
      await loadFeed();
    } catch { uploading = false; }
    posting = false;
  }

  function handleImageSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    if (!['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',''].includes(file.type)) { alert('JPG, PNG, GIF, or WebP only'); return; }
    postImage = file;
    postImagePreview = URL.createObjectURL(file);
  }

  function removeImage() { postImage = null; postImagePreview = ''; }

  async function toggleLike(postId: number) {
    if (!$auth.token) return;
    try {
      const res = await api.likePost(postId);
      posts = posts.map(p => p.id === postId ? { ...p, likes_count: res.liked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1), _liked: res.liked } : p);
    } catch {}
  }

  async function toggleComments(postId: number) {
    const s = new Set(expandedComments);
    if (s.has(postId)) { s.delete(postId); } else {
      s.add(postId);
      if (!postComments[postId]) {
        try {
          const res = await api.getPost(postId);
          postComments = { ...postComments, [postId]: res.comments || [] };
        } catch (e) { console.error('Failed to load comments', e); postComments = { ...postComments, [postId]: [] }; }
      }
    }
    expandedComments = s;
  }

  async function submitComment(postId: number) {
    const t = (commentInputs[postId] || '').trim();
    if (!t) return;
    try {
      await api.addComment(postId, t);
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
    try { searchResults = (await api.searchWisers(searchQuery)).users || []; } catch {}
  }

  async function sendRequest(username: string) {
    try {
      const res = await api.sendFriendRequest(username);
      actionMsg = res.message || 'Sent!';
      setTimeout(() => actionMsg = '', 3000);
      if ($auth.token) {
        const [fr, req] = await Promise.all([api.getFriends(), api.getFriendRequests()]);
        friends = fr.friends || []; incoming = req.incoming || []; outgoing = req.outgoing || [];
        suggested = suggested.filter(u => u.username !== username);
      }
    } catch (e: any) { actionMsg = e.message || 'Error'; setTimeout(() => actionMsg = '', 3000); }
  }

  async function accept(id: number) {
    try { await api.acceptFriendRequest(id); friends = (await api.getFriends()).friends || []; incoming = (await api.getFriendRequests()).incoming || []; } catch {}
  }
  async function decline(id: number) {
    try { await api.declineFriendRequest(id); incoming = (await api.getFriendRequests()).incoming || []; } catch {}
  }
  async function removeFriend(username: string) {
    if (!confirm('Unfriend @' + username + '?')) return;
    try { await api.unfriend(username); friends = (await api.getFriends()).friends || []; } catch {}
  }

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

  function launchRockets() {
    if (typeof document === 'undefined') return;
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;';
    document.body.appendChild(container);
    const rockets = ['🚀','🚀','🚀','🚀','🚀','🚀','🚀','🚀','🚀','🚀','🚀','🚀','✨','⭐','💫','🌟'];
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        const x = Math.random() * 100;
        const size = 20 + Math.random() * 24;
        const dur = 1.2 + Math.random() * 1.5;
        const rot = -30 + Math.random() * 60;
        el.textContent = rockets[Math.floor(Math.random() * rockets.length)];
        el.style.cssText = 'position:absolute;bottom:-60px;left:' + x + '%;font-size:' + size + 'px;animation:rocketUp ' + dur + 's ease-out forwards;transform:rotate(' + rot + 'deg);';
        container.appendChild(el);
      }, i * 80);
    }
    setTimeout(() => container.remove(), 4000);
  }

  async function handleRocket(post: any) {
    if (!$auth.token) return;
    try {
      const res = await api.toggleRocket(post.id);
      post.rockets_count = (post.rockets_count || 0) + (res.rocketed ? 1 : -1);
      post.my_rocket = res.rocketed;
      if (res.rocketed) launchRockets();
    } catch {}
  }

  async function handleBookmark(post: any) {
    if (!$auth.token) return;
    try {
      const res = await api.toggleBookmark(post.id);
      if (res.bookmarked) { bookmarkedPosts.add(post.id); } else { bookmarkedPosts.delete(post.id); }
      bookmarkedPosts = new Set(bookmarkedPosts);
    } catch {}
  }

  async function handleEditPost(post: any) {
    if (editingPost === post.id) {
      if (editContent.trim() && editContent !== post.content) {
        try {
          await api.editPost(post.id, editContent);
          post.content = editContent;
          post.edited = 1;
          posts = [...posts];
        } catch {}
      }
      editingPost = null;
    } else {
      editingPost = post.id;
      editContent = post.content;
    }
  }

  async function handleSchedulePost() {
    if (!scheduleContent.trim() || !scheduleDate) return;
    try {
      await api.schedulePost(scheduleContent, scheduleDate);
      scheduleContent = '';
      scheduleDate = '';
      showScheduler = false;
      actionMsg = 'Post scheduled!';
      setTimeout(() => actionMsg = '', 2000);
    } catch {}
  }

  async function loadBookmarks() {
    try { const res = await api.getBookmarks(); bookmarkedList = res.posts || []; bookmarkedPosts = new Set((res.posts || []).map((p: any) => p.id)); } catch {}
  }

  async function loadActivity() {
    try { const res = await api.getActivity(); activityList = res.activities || []; } catch {}
  }

  async function loadTrending() {
    try { const res = await api.getTrendingHashtags(); trendingTags = res.hashtags || []; } catch {}
  }

  function renderContent(text: string): string {
    if (!text) return '';
    // Convert #hashtags to links
    let html = text.replace(/#(\w{2,30})/g, '<a href="/wisers?tag=$1" class="w-hashtag">#$1</a>');
    // Convert @mentions to profile links
    html = html.replace(/@(\w{2,30})/g, '<a href="/wisers/$1" class="w-mention">@$1</a>');
    return html;
  }

  async function handleRepost(post: any) {
    if (!$auth.token) return;
    try {
      const res = await api.toggleRepost(post.id);
      posts = posts.map(p => p.id === post.id ? { ...p, reposts_count: (p.reposts_count || 0) + (res.reposted ? 1 : -1), my_repost: res.reposted } : p);
      if (res.reposted) launchRockets();
    } catch {}
  }

  function initial(name: string) { return (name || '?')[0].toUpperCase(); }

  function avatarSrc(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return 'https://api-bscan.balancewises.io/avatars/' + url;
  }
</script>

<svelte:head>
  <title>Wisers — BSCAN Community</title>
  <meta name="description" content="Join the BSCAN Wisers community. Connect with web professionals, share insights, and grow together." />
  <meta property="og:title" content="Wisers — BSCAN Community" />
  <meta property="og:description" content="Connect with web professionals, share insights, and grow your web presence together." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://bscan.balancewises.io/wisers" />
  <meta name="twitter:card" content="summary" />
  <meta name="robots" content="index, follow" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="w" class:light={theme === 'light'}>
  <!-- TOP BAR -->
  <header class="w-topbar">
    <div class="w-topbar-inner">
      <a href="/wisers" class="w-logo">W<span>isers</span></a>
      <div class="w-search-wrap">
        <input type="text" class="w-search" placeholder="Search wisers..." bind:value={searchQuery} onkeydown={(e) => e.key === 'Enter' && search()} />
      </div>
      <div class="w-topbar-right">
        <a href="/wisers/messages" class="w-topbar-btn w-notif-btn" title="Messages" >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {#if $wsUnreadDMs > 0}<span class="w-notif-badge">{$wsUnreadDMs > 9 ? '9+' : $wsUnreadDMs}</span>{/if}
        </a>
        <a href="/notifications" class="w-topbar-btn w-notif-btn" title="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {#if $wsNotifCount > 0}<span class="w-notif-badge">{$wsNotifCount > 9 ? '9+' : $wsNotifCount}</span>{/if}
        </a>
        <button class="w-topbar-btn" onclick={toggleTheme} title="Toggle theme">
          {#if theme === 'dark'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          {/if}
        </button>
        {#if $auth.user}
          <div class="w-user-menu-wrap">
            <button class="w-avatar-sm w-avatar-btn" onclick={(e) => { e.stopPropagation(); showUserMenu = !showUserMenu; }} aria-label="User menu">
              {initial($auth.user.name || $auth.user.email)}
            </button>
            {#if showUserMenu}
              <div class="w-user-dropdown" role="menu">
                <a href="/wisers/{$auth.user.username || 'me'}" class="w-ud-item" onclick={() => showUserMenu = false}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profile
                </a>
                <a href="/account" class="w-ud-item" onclick={() => showUserMenu = false}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </a>
                <a href="/wisers/communities" class="w-ud-item" onclick={() => showUserMenu = false}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Communities
                </a>
                <div class="w-ud-divider"></div>
                <button class="w-ud-item w-ud-danger" onclick={() => { showUserMenu = false; handleLogout(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Log out
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <a href="/account" class="w-login-btn">Join Wisers</a>
        {/if}
      </div>
    </div>
  </header>

  <div class="w-body">
    <!-- LEFT SIDEBAR -->
    <aside class="w-sidebar-left">
      {#if $auth.user}
        <a href="/wisers/{$auth.user.username || 'me'}" class="w-profile-card">
          <div class="w-avatar-lg">{initial($auth.user.name || $auth.user.email)}</div>
          <div class="w-profile-name">{$auth.user.name}</div>
          <div class="w-profile-handle">@{$auth.user.username || 'you'}</div>
        </a>
      {/if}
      <nav class="w-sidebar-nav">
        <button class:active={activeView === 'feed'} onclick={() => { activeView = 'feed'; loadFeed(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          Feed
        </button>
        <button class:active={activeView === 'explore'} onclick={() => activeView = 'explore'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Explore
        </button>
        {#if $auth.token}<button class:active={activeView === 'friends'} onclick={() => activeView = 'friends'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Friends <span class="w-count">{friends.length}</span>
        </button>{/if}
        {#if $auth.token}
        <button class:w-sidebar-active={activeView === 'bookmarks'} onclick={() => { activeView = 'bookmarks'; loadBookmarks(); }} class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Saved
        </button>
        <button class:w-sidebar-active={activeView === 'activity'} onclick={() => { activeView = 'activity'; loadActivity(); }} class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Activity
        </button>
        {/if}
        {#if $auth.token}<a href="/wisers/communities" class="w-sidebar-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Communities
          </a>
          <a href="/wisers/messages" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Messages
          {#if $wsUnreadDMs > 0}<span class="w-count" style="background:#ef4444;color:#fff;">{$wsUnreadDMs > 9 ? '9+' : $wsUnreadDMs}</span>{/if}
        </a>
        <a href="/notifications" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
          Notifications
          {#if $wsNotifCount > 0}<span class="w-count" style="background:#ef4444;color:#fff;">{$wsNotifCount > 9 ? '9+' : $wsNotifCount}</span>{/if}
        </a>{/if}
      </nav>
      <div class="w-sidebar-divider"></div>
      <a href="https://balancewises.io" class="w-sidebar-back" target="_blank">Balancewise Technologies</a>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="w-main">
      {#if actionMsg}<div class="w-toast">{actionMsg}</div>{/if}

      <!-- FEED VIEW -->
      {#if activeView === 'feed'}
        {#if $auth.token}
          <div class="w-composer">
            <div class="w-composer-top">
              <div class="w-avatar-sm w-avatar-gold">{initial($auth.user?.name || '')}</div>
              <textarea bind:value={newPost} placeholder="What's on your mind?" maxlength="2000" rows="2"></textarea>
            </div>
            {#if postImagePreview}<div class="w-img-preview"><img src={postImagePreview} alt="Preview" /><button class="w-img-remove" onclick={removeImage}>✕</button></div>{/if}
            <div class="w-composer-bottom">
              <div class="w-feed-tabs">
                <button class:active={feedType === 'all'} onclick={() => { feedType = 'all'; loadFeed(); }}>Everyone</button>
                <button class:active={feedType === 'friends'} onclick={() => { feedType = 'friends'; loadFeed(); }}>Friends</button>
              </div>
              <button class="w-img-btn" onclick={() => document.getElementById('post-img-input')?.click()} type="button" title="Add image">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              </button>
              <input id="post-img-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif" onchange={handleImageSelect} style="display:none" />
              <div class="w-emoji-wrap">
              <button class="w-emoji-btn" onclick={() => showEmoji = !showEmoji} type="button">😀</button>
              {#if showEmoji}
                <div class="w-emoji-picker">
                  {#each emojis as e}
                    <button class="w-emoji-item" onclick={() => { newPost += e; showEmoji = false; }} type="button">{e}</button>
                  {/each}
                </div>
              {/if}
            </div>
            <span class="w-char">{newPost.length}/2000</span>
              <button class="w-post-btn" onclick={submitPost} disabled={posting || (!newPost.trim() && !postImage)}>{uploading ? 'Uploading...' : posting ? 'Posting...' : 'Post'}</button>
            </div>
          </div>
        {:else}
          <div class="w-join-cta">
            <h2>Join the conversation</h2>
            <p>Create an account to post, like, comment, and connect with other wisers.</p>
            <a href="/account" class="w-join-btn">Join Wisers</a>
          </div>
        {/if}

        {#if posts.length === 0}
          <div class="w-empty">No posts yet. Be the first to share something!</div>
        {/if}

        {#each posts as post (post.id)}
          <article class="w-post">
            <div class="w-post-left">
              <a href="/wisers/{post.username}" class="w-avatar-md">{#if avatarSrc(post.avatar_url)}<img src={avatarSrc(post.avatar_url)} alt="" class="w-av-img" />{:else}{initial(post.display_name || post.user_name)}{/if}</a>
            </div>
            <div class="w-post-right">
              <!-- Header row: author info + ··· menu top-right (X standard) -->
              <div class="w-post-meta">
                <div class="w-post-meta-left">
                  <a href="/wisers/{post.username}" class="w-post-author">{post.display_name || post.user_name}</a>
                  <span class="w-verify" class:v-free={post.plan === 'free'} class:v-pro={post.plan === 'pro'} class:v-agency={post.plan === 'agency'}><svg viewBox="0 0 22 22"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg></span>
                  <span class="w-post-handle">@{post.username}</span>
                  <span class="w-post-dot">·</span>
                  <span class="w-post-time">{timeAgo(post.created_at)}</span>
                </div>
                {#if $auth.token}
                  <div class="w-post-menu-wrap" onclick={(e) => e.stopPropagation()}>
                    <button class="w-post-menu-btn" onclick={() => openPostMenu = openPostMenu === post.id ? null : post.id} title="More" aria-label="More options">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                    </button>
                    {#if openPostMenu === post.id}
                      <div class="w-post-menu-dropdown">
                        {#if $auth.user?.id === post.user_id}
                          <button onclick={() => { handleEditPost(post); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            {editingPost === post.id ? 'Save edit' : 'Edit post'}
                          </button>
                          <button class="w-menu-danger" onclick={() => { removePost(post.id); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Delete post
                          </button>
                          <div class="w-menu-divider"></div>
                          <button onclick={() => { navigator.clipboard?.writeText(window.location.origin + '/wisers?post=' + post.id); actionMsg = 'Link copied!'; setTimeout(() => actionMsg = '', 2000); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            Copy link
                          </button>
                        {:else}
                          <button onclick={() => { api.followUser(post.username).then(() => { actionMsg = 'Following @' + post.username; setTimeout(() => actionMsg = '', 2000); }).catch(() => {}); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                            Follow @{post.username}
                          </button>
                          <button onclick={() => { api.muteUser(post.username).then(() => { actionMsg = '@' + post.username + ' muted'; setTimeout(() => actionMsg = '', 2000); posts = posts.filter(p => p.username !== post.username); }).catch(() => {}); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            Mute @{post.username}
                          </button>
                          <button class="w-menu-danger" onclick={() => { api.blockUser(post.username).then(() => { actionMsg = '@' + post.username + ' blocked'; setTimeout(() => actionMsg = '', 2000); posts = posts.filter(p => p.username !== post.username); }).catch(() => {}); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            Block @{post.username}
                          </button>
                          <div class="w-menu-divider"></div>
                          <button onclick={() => { navigator.clipboard?.writeText(window.location.origin + '/wisers?post=' + post.id); actionMsg = 'Link copied!'; setTimeout(() => actionMsg = '', 2000); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            Copy link
                          </button>
                          <button class="w-menu-danger" onclick={() => { const r = prompt('Why are you reporting this post?'); if (r) api.reportContent('post', post.id, r).then(() => { actionMsg = 'Report submitted'; setTimeout(() => actionMsg = '', 2000); }).catch(() => {}); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                            Report post
                          </button>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="w-post-body">{@html renderContent(post.content)}</div>
              {#if post.image_url}<div class="w-post-img"><img src={post.image_url} alt="" loading="lazy" /></div>{/if}
              {#if post.post_type === 'scan_share' && post.scan_url}
                <div class="w-scan-card">
                  <span>{post.scan_url}</span>
                  <span class="w-scan-score" class:good={post.scan_score >= 70} class:warn={post.scan_score >= 40 && post.scan_score < 70} class:bad={post.scan_score < 40}>{post.scan_score}</span>
                </div>
              {/if}
              <div class="w-post-actions">
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
                    <div class="w-comment-input">
                      <input type="text" placeholder="Reply..." bind:value={commentInputs[post.id]} onkeydown={(e) => e.key === 'Enter' && submitComment(post.id)} />
                      <button onclick={() => submitComment(post.id)}>Reply</button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </article>
        {/each}

      <!-- EXPLORE VIEW -->
      {:else if activeView === 'explore'}
        {#if !$auth.token}
          <div class="w-join-cta"><h2>Sign in to explore</h2><p>Discover and connect with web professionals.</p><a href="/account" class="w-join-btn">Join Wisers</a></div>
        {:else}
        <h2 class="w-section-title">Discover Wisers</h2>
        {#if searchResults.length > 0}
          <div class="w-user-grid">
            {#each searchResults.filter(u => u.username !== $auth.user?.username && !friends.some(fr => fr.username === u.username) && !outgoing.some(o => o.username === u.username)) as u}
              <div class="w-user-card">
                <div class="w-avatar-lg">{#if avatarSrc(u.avatar_url)}<img src={avatarSrc(u.avatar_url)} alt="" class="w-av-img-lg" />{:else}{initial(u.display_name || u.name)}{/if}</div>
                <a href="/wisers/{u.username}" class="w-user-name">@{u.username}</a>
                <div class="w-user-real">{u.display_name || u.name}</div>
                {#if u.bio}<div class="w-user-bio">{u.bio}</div>{/if}
                <div class="w-user-foot">
                  <span class="w-verify" class:v-free={u.plan === 'free'} class:v-pro={u.plan === 'pro'} class:v-agency={u.plan === 'agency'}><svg viewBox="0 0 22 22"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg></span>
                  {#if $auth.token}<button class="w-add-btn" onclick={() => sendRequest(u.username)}>Connect</button>{/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="w-user-grid">
            {#each allUsers.filter(u => u.username !== $auth.user?.username && !friends.some(fr => fr.username === u.username) && !outgoing.some(o => o.username === u.username)) as u}
              <div class="w-user-card">
                <div class="w-avatar-lg">{#if avatarSrc(u.avatar_url)}<img src={avatarSrc(u.avatar_url)} alt="" class="w-av-img-lg" />{:else}{initial(u.display_name || u.name)}{/if}</div>
                <a href="/wisers/{u.username}" class="w-user-name">@{u.username}</a>
                <div class="w-user-real">{u.display_name || u.name}</div>
                {#if u.bio}<div class="w-user-bio">{u.bio}</div>{/if}
                <div class="w-user-foot">
                  <span class="w-verify" class:v-free={u.plan === 'free'} class:v-pro={u.plan === 'pro'} class:v-agency={u.plan === 'agency'}><svg viewBox="0 0 22 22"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg></span>
                  {#if $auth.token}<button class="w-add-btn" onclick={() => sendRequest(u.username)}>Connect</button>{/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

      <!-- FRIENDS VIEW -->
      {/if}

      {:else if activeView === 'bookmarks'}
        <h2 class="w-section-title">Saved Posts</h2>
        {#if bookmarkedList.length === 0}
          <div class="w-empty">No saved posts yet. Bookmark posts to find them here.</div>
        {:else}
          {#each bookmarkedList as post (post.id)}
            <article class="w-post">
              <div class="w-post-left">
                <a href="/wisers/{post.username}" class="w-avatar-md">{#if avatarSrc(post.avatar_url)}<img src={avatarSrc(post.avatar_url)} alt="" class="w-av-img" />{:else}{initial(post.display_name || post.user_name)}{/if}</a>
              </div>
              <div class="w-post-right">
                <div class="w-post-meta">
                  <a href="/wisers/{post.username}" class="w-post-author">{post.display_name || post.user_name}</a>
                  <span class="w-post-handle">@{post.username}</span>
                  <span class="w-post-dot">·</span>
                  <span class="w-post-time">{timeAgo(post.created_at)}</span>
                </div>
                <div class="w-post-body">{post.content}</div>
                <div class="w-post-actions">
                  <button class="w-action" class:w-liked={post._liked} onclick={() => toggleLike(post.id)} title="Like">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={post._liked ? '#f43f5e' : 'none'} stroke={post._liked ? '#f43f5e' : 'currentColor'} stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <span>{post.likes_count || 0}</span>
                  </button>
                  <button class="w-action" onclick={() => toggleComments(post.id)} title="Comment">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>{post.comments_count || 0}</span>
                  </button>
                  <button class="w-action w-bookmark-btn w-bookmarked" onclick={() => handleBookmark(post)} title="Remove bookmark">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
              </div>
            </article>
          {/each}
        {/if}

      {:else if activeView === 'activity'}
        <div class="w-activity-header">
          <h2 class="w-section-title">Activity</h2>
          <span class="w-activity-count">{activityList.length} recent actions</span>
        </div>
        {#if activityList.length === 0}
          <div class="w-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <p>No recent activity yet</p>
          </div>
        {:else}
          <div class="w-activity-list">
            {#each activityList as item}
              <div class="w-activity-item">
                <div class="w-activity-badge w-activity-badge--{item.type}">
                  {#if item.type === 'like'}<svg width="14" height="14" viewBox="0 0 24 24" fill="#f43f5e" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  {:else if item.type === 'rocket'}<svg width="14" height="14" viewBox="0 0 24 24" fill="#f97316" stroke="none"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
                  {:else if item.type === 'repost'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  {:else if item.type === 'comment'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {:else if item.type === 'post'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  {:else}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{/if}
                </div>
                <div class="w-activity-body">
                  <span class="w-activity-action">
                    {#if item.type === 'like'}You liked a post
                    {:else if item.type === 'rocket'}You rocketed a post
                    {:else if item.type === 'repost'}You reposted
                    {:else if item.type === 'comment'}You commented
                    {:else if item.type === 'post'}You posted
                    {:else}Activity{/if}
                  </span>
                  <span class="w-activity-preview">"{(item.text || '').slice(0, 80)}{(item.text || '').length > 80 ? '...' : ''}"</span>
                </div>
                <span class="w-activity-time">{timeAgo(item.at || item.created_at)}</span>
              </div>
            {/each}
          </div>
        {/if}

      {:else if activeView === 'friends'}
        {#if incoming.length > 0}
          <h2 class="w-section-title">Friend Requests ({incoming.length})</h2>
          <div class="w-user-grid">
            {#each incoming as req}
              <div class="w-user-card w-request-card">
                <div class="w-avatar-lg">{initial(req.display_name || req.name)}</div>
                <a href="/wisers/{req.username}" class="w-user-name">@{req.username}</a>
                <div class="w-user-real">{req.display_name || req.name}</div>
                <div class="w-req-actions">
                  <button class="w-accept-btn" onclick={() => accept(req.id)}>Accept</button>
                  <button class="w-decline-btn" onclick={() => decline(req.id)}>Decline</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        {#if outgoing.length > 0}
          <h2 class="w-section-title">Sent Requests ({outgoing.length})</h2>
          <div class="w-user-grid">
            {#each outgoing as req}
              <div class="w-user-card">
                <div class="w-avatar-lg">{#if avatarSrc(req.avatar_url)}<img src={avatarSrc(req.avatar_url)} alt="" class="w-av-img-lg" />{:else}{initial(req.display_name || req.name)}{/if}</div>
                <a href="/wisers/{req.username}" class="w-user-name">@{req.username}</a>
                <div class="w-user-real">{req.display_name || req.name}</div>
                <div class="w-user-foot">
                  <span class="w-pending-badge">Pending</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        <h2 class="w-section-title">Your Friends ({friends.length})</h2>
        {#if friends.length === 0}
          <div class="w-empty">No friends yet. Explore wisers to connect!</div>
        {:else}
          <div class="w-user-grid">
            {#each friends as f}
              <div class="w-user-card">
                <div class="w-avatar-lg">{#if avatarSrc(f.avatar_url)}<img src={avatarSrc(f.avatar_url)} alt="" class="w-av-img-lg" />{:else}{initial(f.display_name || f.name)}{/if}</div>
                <a href="/wisers/{f.username}" class="w-user-name">@{f.username}</a>
                <div class="w-user-real">{f.display_name || f.name}</div>
                <div class="w-user-foot">
                  <a href="/wisers/messages?user={f.username}" class="w-msg-btn">Message</a>
                  <button class="w-remove-btn" onclick={() => removeFriend(f.username)}>Remove</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </main>

    <!-- RIGHT SIDEBAR -->
    <aside class="w-sidebar-right">
        {#if trendingTags.length > 0}
          <div class="w-card w-trending">
            <h3 class="w-card-title">Trending</h3>
            {#each trendingTags.slice(0, 8) as tag}
              <a href="/wisers?tag={tag.tag}" class="w-trending-item">
                <span class="w-trending-tag">#{tag.tag}</span>
                <span class="w-trending-count">{tag.post_count} posts</span>
              </a>
            {/each}
          </div>
        {/if}
      {#if $auth.token && suggested.filter(u => u.username !== $auth.user?.username && !friends.some(fr => fr.username === u.username) && !outgoing.some(o => o.username === u.username) && !incoming.some(i => i.username === u.username)).length > 0}
        <div class="w-widget">
          <div class="w-widget-head"><h3>People you may know</h3><button class="w-show-more" onclick={() => activeView = 'explore'}>See all</button></div>
          {#each suggested.filter(u => u.username !== $auth.user?.username && !friends.some(fr => fr.username === u.username) && !outgoing.some(o => o.username === u.username) && !incoming.some(i => i.username === u.username)).slice(0, 5) as u}
            <div class="w-suggest-item">
              <div class="w-avatar-sm">{#if avatarSrc(u.avatar_url)}<img src={avatarSrc(u.avatar_url)} alt="" class="w-av-img-sm" />{:else}{initial(u.display_name || u.name)}{/if}</div>
              <div class="w-suggest-info">
                <a href="/wisers/{u.username}" class="w-suggest-name">@{u.username}</a>
                <div class="w-suggest-real">{u.display_name || u.name}</div>
              </div>
              <button class="w-connect-sm" onclick={() => sendRequest(u.username)}>Add</button>
            </div>
          {/each}
        </div>
      {/if}
      {#if incoming.length > 0}
        <div class="w-widget">
          <div class="w-widget-head"><h3>Requests for you <span class="w-badge-count">{incoming.length}</span></h3><button class="w-show-more" onclick={() => activeView = 'friends'}>See all</button></div>
          {#each incoming as req}
            <div class="w-suggest-item">
              <div class="w-avatar-sm">{#if avatarSrc(req.avatar_url)}<img src={avatarSrc(req.avatar_url)} alt="" class="w-av-img-sm" />{:else}{initial(req.display_name || req.name)}{/if}</div>
              <div class="w-suggest-info">
                <a href="/wisers/{req.username}" class="w-suggest-name">@{req.username}</a>
                <div class="w-suggest-real">{req.display_name || req.name}</div>
              </div>
              <button class="w-connect-sm w-accept-sm" onclick={() => accept(req.id)}>✓</button>
            </div>
          {/each}
        </div>
      {/if}
      {#if outgoing.length > 0}
        <div class="w-widget">
          <div class="w-widget-head"><h3>Sent requests <span class="w-badge-count">{outgoing.length}</span></h3><button class="w-show-more" onclick={() => activeView = 'friends'}>See all</button></div>
          {#each outgoing as req}
            <div class="w-suggest-item">
              <div class="w-avatar-sm">{#if avatarSrc(req.avatar_url)}<img src={avatarSrc(req.avatar_url)} alt="" class="w-av-img-sm" />{:else}{initial(req.display_name || req.name)}{/if}</div>
              <div class="w-suggest-info">
                <a href="/wisers/{req.username}" class="w-suggest-name">@{req.username}</a>
                <div class="w-suggest-real">{req.display_name || req.name}</div>
              </div>
              <span class="w-pending-label">Pending</span>
            </div>
          {/each}
        </div>
      {/if}
      <div class="w-widget w-footer">
        <a href="/">Scanner</a> · <a href="/seo">SEO</a> · <a href="/compare">Compare</a> · <a href="/support">Support</a>
        <div class="w-copyright">Balancewise Technologies &copy; 2026</div>
      </div>
    </aside>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

  :global([data-wisers-theme="light"]) { --wb: #ffffff; --wc: #f0f2f5; --wt: #1c1e21; --wt2: #606770; --wt3: #8a8d91; --wbd: #dddfe2; --wcard: #ffffff; --wgold: #d4a017; --whover: rgba(0,0,0,0.04); }

  .w { margin-top: 0; padding-top: 0; --wb: #0a0a0f; --wc: #111117; --wt: #e4e6ea; --wt2: #8a8d91; --wt3: #606770; --wbd: #1e1e2a; --wcard: #16161f; --wgold: #f5a623; --whover: rgba(255,255,255,0.04);
    font-family: 'DM Sans', -apple-system, sans-serif; color: var(--wt); background: var(--wb); min-height: 100vh; position: relative; }
  .w.light { --wb: #ffffff; --wc: #f0f2f5; --wt: #1c1e21; --wt2: #606770; --wt3: #8a8d91; --wbd: #dddfe2; --wcard: #ffffff; --wgold: #d4a017; --whover: rgba(0,0,0,0.04); }

  .w-topbar { position: sticky; top: 0; z-index: 100; background: var(--wcard); border-bottom: 1px solid var(--wbd); height: 56px; }
  .w-topbar-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; height: 100%; padding: 0 16px; gap: 12px; }
  .w-logo { font-size: 24px; font-weight: 800; color: var(--wgold); text-decoration: none; letter-spacing: -1px; flex-shrink: 0; }
  .w-logo span { color: var(--wt); }
  .w-search-wrap { flex: 1; max-width: 400px; }
  .w-search { width: 100%; padding: 8px 16px; border-radius: 20px; border: none; background: var(--wc); color: var(--wt); font-size: 14px; outline: none; font-family: inherit; }
  .w-search::placeholder { color: var(--wt3); }
  .w-search:focus { box-shadow: 0 0 0 2px var(--wgold); }
  .w-topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .w-topbar-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--wc); border: none; color: var(--wt2); display: flex; align-items: center; justify-content: center; cursor: pointer; text-decoration: none; }
  .w-topbar-btn:hover { background: var(--wbd); color: var(--wt); }
  .w-avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; text-decoration: none; flex-shrink: 0; }
  .w-avatar-md { width: 40px; height: 40px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; text-decoration: none; flex-shrink: 0; }
  .w-avatar-lg { width: 48px; height: 48px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex-shrink: 0; }
  .w-avatar-gold { background: var(--wgold); }
  .w-av-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .w-av-img-lg { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
  .w-av-img-sm { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .w-login-btn { padding: 7px 16px; border-radius: 8px; background: var(--wgold); color: #000; font-weight: 700; font-size: 13px; text-decoration: none; white-space: nowrap; }

  .w-body { display: flex; max-width: 1280px; margin: 0 auto; min-height: calc(100vh - 56px); }

  .w-sidebar-left { width: 240px; padding: 16px 12px; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; flex-shrink: 0; }
  .w-profile-card { display: flex; flex-direction: column; align-items: center; padding: 20px 12px; border-radius: 12px; background: var(--wcard); border: 1px solid var(--wbd); text-decoration: none; color: var(--wt); margin-bottom: 16px; }
  .w-profile-card:hover { border-color: var(--wgold); }
  .w-profile-name { font-weight: 700; font-size: 15px; margin-top: 10px; }
  .w-profile-handle { font-size: 12px; color: var(--wt2); }
  .w-sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
  .w-sidebar-nav button, .w-sidebar-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; border: none; background: none; color: var(--wt2); font-size: 14px; font-weight: 500; cursor: pointer; width: 100%; text-align: left; text-decoration: none; font-family: inherit; }
  .w-sidebar-nav button:hover, .w-sidebar-link:hover { background: var(--whover); color: var(--wt); }
  .w-sidebar-nav button.active { background: rgba(245,166,35,0.1); color: var(--wgold); font-weight: 700; }
  .w-count { font-size: 11px; padding: 1px 6px; border-radius: 99px; margin-left: auto; }
  .w-sidebar-divider { height: 1px; background: var(--wbd); margin: 12px 0; }
  .w-sidebar-back { font-size: 12px; color: var(--wt3); text-decoration: none; padding: 8px 12px; }
  .w-sidebar-back:hover { color: var(--wgold); }

  .w-main { flex: 1; min-width: 0; padding: 16px; border-left: 1px solid var(--wbd); border-right: 1px solid var(--wbd); }

  .w-sidebar-right { width: 280px; padding: 16px 12px; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; flex-shrink: 0; }

  .w-composer { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .w-composer-top { display: flex; gap: 10px; }
  .w-composer textarea { flex: 1; border: none; background: transparent; color: var(--wt); font-size: 15px; resize: none; outline: none; font-family: inherit; min-height: 50px; }
  .w-composer textarea::placeholder { color: var(--wt3); }
  .w-composer-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--wbd); }
  .w-feed-tabs { display: flex; gap: 2px; }
  .w-feed-tabs button { padding: 5px 12px; border-radius: 16px; border: 1px solid var(--wbd); background: none; color: var(--wt3); font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 600; }
  .w-feed-tabs button.active { background: var(--wgold); color: #000; border-color: var(--wgold); }
  .w-emoji-wrap { position: relative; }
  .w-emoji-btn { background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 6px; }
  .w-emoji-btn:hover { background: var(--whover); }
  .w-emoji-picker { position: absolute; bottom: 40px; left: 0; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; padding: 8px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; width: 280px; max-height: 200px; overflow-y: auto; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
  .w-emoji-item { background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px; border-radius: 6px; text-align: center; }
  .w-emoji-item:hover { background: var(--whover); }
  .w-char { font-size: 11px; color: var(--wt3); }
  .w-post-btn { padding: 7px 20px; border-radius: 20px; border: none; background: var(--wgold); color: #000; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
  .w-post-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .w-join-cta { text-align: center; padding: 40px 20px; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; margin-bottom: 16px; }
  .w-join-cta h2 { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
  .w-join-cta p { color: var(--wt2); font-size: 14px; margin-bottom: 16px; }
  .w-join-btn { display: inline-block; padding: 10px 28px; border-radius: 20px; background: var(--wgold); color: #000; font-weight: 700; font-size: 14px; text-decoration: none; }

  .w-post { display: flex; gap: 12px; padding: 16px; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; margin-bottom: 10px; }
  .w-post:hover { border-color: rgba(245,166,35,0.2); }
  .w-post-right { flex: 1; min-width: 0; }
  .w-post-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
  .w-post-author { font-weight: 700; font-size: 14px; color: var(--wt); text-decoration: none; }
  .w-post-author:hover { text-decoration: underline; }
  .w-post-handle { font-size: 13px; color: var(--wt2); }
  .w-post-dot { color: var(--wt3); }
  .w-post-time { font-size: 12px; color: var(--wt3); }
  .w-verify { width: 16px; height: 16px; flex-shrink: 0; display: inline-flex; }
  .w-verify svg { width: 16px; height: 16px; }
  .w-verify.v-free svg { fill: #555; }
  .w-verify.v-pro svg { fill: #3b82f6; }
  .w-verify.v-agency svg { fill: #f5a623; }
  .w-plan-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 99px; background: rgba(245,166,35,0.15); color: var(--wgold); }
  .w-post-body { font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .w-scan-card { margin-top: 10px; padding: 12px; border-radius: 8px; background: var(--wc); border: 1px solid var(--wbd); display: flex; justify-content: space-between; align-items: center; }
  .w-scan-score { font-size: 18px; font-weight: 800; }
  .w-scan-score.good { color: #10b981; } .w-scan-score.warn { color: #f59e0b; } .w-scan-score.bad { color: #ef4444; }
  .w-post-actions { display: flex; gap: 16px; margin-top: 10px; }
  .w-action { display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--wt3); font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: 6px; font-family: inherit; }
  .w-action:hover { background: var(--whover); color: var(--wt); }
  .w-action-del { margin-left: auto; }
  .w-action-del:hover { color: #ef4444; }
  .w-post-menu-wrap { position: relative; margin-left: auto; }
  .w-post-menu-btn { color: var(--wt3); }
  .w-post-menu-btn:hover { color: var(--wt1); }
  .w-post-menu-dropdown { position: absolute; right: 0; top: 28px; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 10px; min-width: 140px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.4); overflow: hidden; }
  .w-post-menu-dropdown button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; background: none; border: none; color: var(--wt1); font-size: 13px; cursor: pointer; text-align: left; font-family: inherit; }
  .w-post-menu-dropdown button:hover { background: rgba(255,255,255,0.06); }
  .w-post-menu-dropdown .w-menu-danger { color: #ef4444; }
  .w-post-menu-dropdown .w-menu-danger:hover { background: rgba(239,68,68,0.08); }

  .w-comments { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--wbd); }
  .w-comment { padding: 6px 0; font-size: 13px; }
  .w-comment-author { color: var(--wgold); font-weight: 600; text-decoration: none; font-size: 12px; }
  .w-comment-text { color: var(--wt2); margin-left: 6px; }
  .w-comment-time { font-size: 10px; color: var(--wt3); margin-left: 6px; }
  .w-comment-input { display: flex; gap: 6px; margin-top: 8px; }
  .w-comment-input input { flex: 1; padding: 7px 12px; border: 1px solid var(--wbd); border-radius: 20px; background: var(--wc); color: var(--wt); font-size: 12px; outline: none; font-family: inherit; }
  .w-comment-input button { padding: 7px 14px; border: none; background: var(--wgold); color: #000; font-weight: 700; font-size: 11px; border-radius: 20px; cursor: pointer; font-family: inherit; }

  .w-section-title { font-size: 18px; font-weight: 800; margin-bottom: 16px; }
  .w-user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .w-user-card { padding: 20px; border-radius: 12px; background: var(--wcard); border: 1px solid var(--wbd); display: flex; flex-direction: column; align-items: center; text-align: center; }
  .w-user-card:hover { border-color: var(--wgold); }
  .w-user-name { font-weight: 700; color: var(--wgold); text-decoration: none; font-size: 14px; margin-top: 8px; }
  .w-user-real { font-size: 12px; color: var(--wt2); margin-top: 2px; }
  .w-user-bio { font-size: 11px; color: var(--wt3); margin-top: 6px; line-height: 1.3; }
  .w-user-foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .w-add-btn, .w-msg-btn { padding: 5px 14px; border-radius: 16px; border: none; background: var(--wgold); color: #000; font-weight: 700; font-size: 11px; cursor: pointer; text-decoration: none; font-family: inherit; }
  .w-remove-btn { padding: 5px 14px; border-radius: 16px; border: 1px solid rgba(239,68,68,0.3); background: none; color: #ef4444; font-size: 10px; cursor: pointer; font-family: inherit; }
  .w-accept-btn { padding: 6px 16px; border-radius: 16px; border: none; background: #10b981; color: #fff; font-weight: 700; font-size: 12px; cursor: pointer; font-family: inherit; }
  .w-decline-btn { padding: 6px 16px; border-radius: 16px; border: 1px solid var(--wbd); background: none; color: var(--wt3); font-size: 12px; cursor: pointer; font-family: inherit; }
  .w-req-actions { display: flex; gap: 8px; margin-top: 12px; }
  .w-request-card { border-color: #10b981; }

  .w-widget { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .w-widget h3 { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
  .w-suggest-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
  .w-suggest-info { flex: 1; min-width: 0; }
  .w-suggest-name { font-size: 12px; font-weight: 600; color: var(--wgold); text-decoration: none; }
  .w-suggest-real { font-size: 10px; color: var(--wt3); }
  .w-connect-sm { height: 28px; padding: 0 12px; border-radius: 14px; border: 1px solid var(--wgold); background: none; color: var(--wgold); font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; white-space: nowrap; font-family: inherit; }
  .w-connect-sm:hover { background: var(--wgold); color: #000; }
  .w-accept-sm { border-color: #10b981; color: #10b981; font-size: 10px; width: auto; padding: 4px 10px; border-radius: 12px; }
  .w-footer { font-size: 11px; color: var(--wt3); }
  .w-footer a { color: var(--wt3); text-decoration: none; }
  .w-footer a:hover { color: var(--wgold); }
  .w-copyright { margin-top: 8px; font-size: 10px; }

  .w-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--wgold); color: #000; padding: 10px 24px; border-radius: 20px; font-weight: 700; font-size: 13px; z-index: 200; animation: slideUp 0.3s; }
  .w-empty { text-align: center; padding: 40px; color: var(--wt3); font-size: 14px; }

  @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

  @media (max-width: 1024px) { .w-sidebar-right { display: none; } }
  @media (max-width: 768px) {
    .w-sidebar-left { display: none; }
    .w-body { flex-direction: column; }
    .w-main { border: none; }
    .w-topbar-inner { padding: 0 8px; }
    .w-search-wrap { max-width: 200px; }
  }

  @keyframes rocketUp {
    0% { transform: translateY(0) rotate(var(--rot, -20deg)); opacity: 1; }
    60% { opacity: 1; }
    100% { transform: translateY(-110vh) rotate(var(--rot, -20deg)); opacity: 0; }
  }





  @keyframes rxPop { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
  .w-bookmark-btn:hover { color: #eab308; }
  .w-bookmarked { color: #eab308 !important; }
  .w-edit-btn:hover { color: #10b981; }
  .w-edit-textarea { width: 100%; background: var(--wc); border: 1px solid var(--wbd); border-radius: 8px; color: var(--wt); padding: 8px; font: inherit; resize: vertical; }
  .w-edited-tag { font-size: 11px; color: var(--wt3); margin-left: 6px; }
  .w-hashtag { color: var(--wgold); text-decoration: none; font-weight: 600; }
  .w-hashtag:hover { text-decoration: underline; }
  .w-mention { color: #3b82f6; text-decoration: none; font-weight: 600; }
  .w-mention:hover { text-decoration: underline; }
  .w-sched-btn { background: none; border: none; color: var(--wt3); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; }
  .w-sched-btn:hover { color: var(--wgold); background: rgba(245,166,35,0.1); }
  .w-sidebar-active { background: rgba(245,166,35,0.12) !important; color: var(--wgold) !important; font-weight: 600 !important; }
  .w-trending { margin-bottom: 16px; }
  .w-trending-item { display: flex; justify-content: space-between; padding: 8px 12px; text-decoration: none; border-radius: 6px; }
  .w-trending-item:hover { background: rgba(255,255,255,0.04); }
  .w-trending-tag { color: var(--wgold); font-weight: 600; font-size: 14px; }
  .w-trending-count { color: var(--wt3); font-size: 12px; }
  .w-activity-header { display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px; }
  .w-activity-count { font-size:12px;color:var(--wt3,#606770); }
  .w-activity-list { display:flex;flex-direction:column; }
  .w-activity-item { display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--wbd,#1e1e2a); }
  .w-activity-item:last-child { border-bottom:none; }
  .w-activity-badge { width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
  .w-activity-badge--like { background:rgba(244,63,94,0.12); }
  .w-activity-badge--rocket { background:rgba(249,115,22,0.12); }
  .w-activity-badge--repost { background:rgba(16,185,129,0.12); }
  .w-activity-badge--comment { background:rgba(96,165,250,0.12); }
  .w-activity-badge--post { background:rgba(167,139,250,0.12); }
  .w-activity-body { display:flex;flex-direction:column;gap:2px;flex:1;min-width:0; }
  .w-activity-action { font-size:13px;font-weight:600;color:var(--wt1,#e4e6ea); }
  .w-activity-preview { font-size:12px;color:var(--wt2,#8a8d91);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .w-activity-time { font-size:11px;color:var(--wt3,#606770);white-space:nowrap;flex-shrink:0; }
  .w-badge-count { background:var(--wgold);color:#000;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:6px; }
  .w-pending-label { font-size:11px;color:var(--wt3);border:1px solid var(--wbd);padding:3px 8px;border-radius:12px;white-space:nowrap; }
  .w-widget-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:12px; }
  .w-widget-head h3 { margin:0; }
  .w-show-more { background:none;border:none;color:var(--wgold);font-size:12px;font-weight:600;cursor:pointer;padding:0;font-family:inherit; }
  .w-show-more:hover { text-decoration:underline; }
  .w-pending-badge { font-size:11px;color:var(--wt3);border:1px solid var(--wbd);padding:4px 10px;border-radius:12px; }
  .w-notif-btn { position: relative; }
  .w-notif-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 3px; pointer-events: none; }
  .w-img-btn { background: none; border: none; color: var(--wt2); cursor: pointer; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; }
  .w-img-btn:hover { color: var(--wgold); background: rgba(255,255,255,0.06); }
  .w-img-preview { position: relative; margin: 8px 0; border-radius: 12px; overflow: hidden; max-height: 200px; }
  .w-img-preview img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; border: 1px solid var(--wbd); }
  .w-img-remove { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff; border: none; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
  .w-img-remove:hover { background: #ef4444; }
  .w-post-img { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .w-post-img img { width: 100%; max-height: 500px; object-fit: cover; border-radius: 12px; display: block; }
  .wc-sidebar-link { display: block; background: #141420; border: 1px solid #1e293b; border-radius: 14px; padding: 14px 16px; color: #f5a623; text-decoration: none; font-weight: 700; font-size: 14px; margin-bottom: 12px; text-align: center; transition: border-color 0.15s; }
  .wc-sidebar-link:hover { border-color: #f5a623; }
  .w-user-menu-wrap { position: relative; }
  .w-avatar-btn { cursor: pointer; border: none; background: linear-gradient(135deg, var(--wgold), #e09100); font-family: inherit; }
  .w-user-dropdown { position: absolute; right: 0; top: 44px; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 14px; min-width: 200px; z-index: 200; box-shadow: 0 8px 32px rgba(0,0,0,0.4); overflow: hidden; }
  .w-ud-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 16px; background: none; border: none; color: var(--wt); font-size: 14px; cursor: pointer; text-decoration: none; font-family: inherit; }
  .w-ud-item:hover { background: var(--whover); }
  .w-ud-divider { height: 1px; background: var(--wbd); margin: 4px 0; }
  .w-ud-danger { color: #ef4444 !important; }
  .w-ud-danger:hover { background: rgba(239,68,68,0.06) !important; }
</style>