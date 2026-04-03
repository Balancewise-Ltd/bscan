<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { connectWS, wsNotifCount, wsUnreadDMs } from '$lib/stores/wisers-ws';
  import { goto } from '$app/navigation';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';
  import { timeAgo } from '$lib/utils/time';
  import ImageLightbox from '$lib/components/ImageLightbox.svelte';
  import OnboardingWizard from '$lib/components/OnboardingWizard.svelte';
  import WisersLanding from '$lib/components/WisersLanding.svelte';
  import { sponsoredAd } from '$lib/ad-config';

  let profileStats = $state<{ posts: number; followers: number; following: number }>({ posts: 0, followers: 0, following: 0 });

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
  let feedLoading = $state(false);
  let feedError = $state('');
  let feedPage = $state(1);
  let hasMore = $state(true);
  let loadingMore = $state(false);
  let newPost = $state('');
  let postImage = $state<File | null>(null);
  let postImagePreview = $state('');
  let uploading = $state(false);

  // Multi-media upload state
  interface MediaAttachment {
    file: File;
    preview: string;
    status: 'uploading' | 'done' | 'failed';
    mediaId: string;
    mediaUrl: string;
    mediaType: string;
    filename: string;
    size: number;
  }
  let mediaAttachments = $state<MediaAttachment[]>([]);
  const MAX_MEDIA_FILES = 4;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const ACCEPTED_TYPES = 'image/*,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

  function getMediaCategory(file: File): string {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async function handleMediaSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    const remaining = MAX_MEDIA_FILES - mediaAttachments.length;
    if (remaining <= 0) { alert('Max ' + MAX_MEDIA_FILES + ' files'); input.value = ''; return; }
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      if (file.size > MAX_FILE_SIZE) { alert(file.name + ' exceeds 50MB limit'); continue; }
      const category = getMediaCategory(file);
      const preview = category === 'image' ? URL.createObjectURL(file) : '';
      const attachment: MediaAttachment = {
        file,
        preview,
        status: 'uploading',
        mediaId: '',
        mediaUrl: '',
        mediaType: category,
        filename: file.name,
        size: file.size,
      };
      mediaAttachments = [...mediaAttachments, attachment];
      const idx = mediaAttachments.length - 1;
      api.uploadMedia(file).then((res) => {
        mediaAttachments = mediaAttachments.map((a, i) =>
          i === idx ? { ...a, status: 'done' as const, mediaId: res.id, mediaUrl: res.url } : a
        );
      }).catch(() => {
        mediaAttachments = mediaAttachments.map((a, i) =>
          i === idx ? { ...a, status: 'failed' as const } : a
        );
      });
    }
    input.value = '';
  }

  function removeMediaAttachment(idx: number) {
    const a = mediaAttachments[idx];
    if (a && a.preview) URL.revokeObjectURL(a.preview);
    mediaAttachments = mediaAttachments.filter((_, i) => i !== idx);
  }

  function retryMediaUpload(idx: number) {
    const a = mediaAttachments[idx];
    if (!a || a.status !== 'failed') return;
    mediaAttachments = mediaAttachments.map((att, i) =>
      i === idx ? { ...att, status: 'uploading' as const } : att
    );
    api.uploadMedia(a.file).then((res) => {
      mediaAttachments = mediaAttachments.map((att, i) =>
        i === idx ? { ...att, status: 'done' as const, mediaId: res.id, mediaUrl: res.url } : att
      );
    }).catch(() => {
      mediaAttachments = mediaAttachments.map((att, i) =>
        i === idx ? { ...att, status: 'failed' as const } : att
      );
    });
  }

  let isMilestone = $state(false);
  let milestoneType = $state('revenue');
  let milestoneValue = $state('');
  let posting = $state(false);
  let showEmoji = $state(false);
  const emojis = ['😀','😂','🤣','😍','🥰','😎','🤩','🥳','😭','😤','🔥','💯','👏','🙌','💪','🚀','⭐','💡','✅','❌','👀','💬','❤️','💙','💚','💛','🧡','💜','🖤','🤍','👍','👎','🎉','🎊','🏆','💎','🌟','⚡','🎯','🔑','📈','📉','🛠️','💻','🌐','🔍','📱','🤖','🧠','💭','📌','📎','✨','🙏','🤝','👋','✌️','🤞','💀','🤡','👑','🦾'];
  let commentInputs = $state<Record<number, string>>({});
  let expandedComments = $state<Set<number>>(new Set());
  let postComments = $state<Record<number, any[]>>({});
  let actionMsg = $state('');
  let openPostMenu = $state<number | null>(null);
  let showUserMenu = $state(false);
  let showCreateSheet = $state(false);
  let toast = $state('');
  let toastTimer: any = null;
  function showToast(msg: string) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast = ''; }, 2500);
  }
  let showPwaPrompt = $state(false);
  let mobileTab = $state('home');
  let bookmarkedPosts = $state<Set<number>>(new Set());
  let editingPost = $state<number | null>(null);
  let editContent = $state('');
  let heartAnim = $state<number | null>(null);
  let lightboxSrc = $state('');
  let showOnboarding = $state(false);
  let followStates = $state<Record<string, boolean>>({});
  let lastTap = $state<{ id: number; time: number }>({ id: 0, time: 0 });
  let trendingTags = $state<any[]>([]);
  let showScheduler = $state(false);
  let scheduleContent = $state('');
  let scheduleDate = $state('');
  let activeTab = $state<'feed' | 'bookmarks' | 'activity'>('feed');
  let bookmarkedList = $state<any[]>([]);
  let activityList = $state<any[]>([]);
  let theme = $state<'dark' | 'light'>('dark');
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
    // Layered profile completion check:
    // 1. No username → full onboarding wizard (new user from any source)
    // 2. DOB handled by layout-level DobPrompt
    // 3. Both set → normal feed
    if ($auth.token && $auth.user) {
      if (!$auth.user.username) {
        showOnboarding = true;
      }
      // Load follow states for feed posts
      loadFollowStates();
      // Load profile stats
      try {
        const me = await api.getMe();
        profileStats = { posts: (me as any).post_count || 0, followers: (me as any).followers_count || 0, following: (me as any).following_count || 0 };
      } catch {}
    }
    loading = false;
    if (typeof document !== 'undefined') {
      document.body.classList.add('wisers-page');
      const clickHandler = () => { openPostMenu = null; showUserMenu = false; showCreateSheet = false; };
      document.addEventListener('click', clickHandler);

      // Infinite scroll
      let scrollTicking = false;
      const scrollHandler = () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
            loadMore();
          }
          scrollTicking = false;
        });
      };
      window.addEventListener('scroll', scrollHandler);
      const createHandler = () => { showCreateSheet = true; };
      window.addEventListener('wisers:create', createHandler);
      cleanupListeners = () => { document.removeEventListener('click', clickHandler); window.removeEventListener('scroll', scrollHandler); window.removeEventListener('wisers:create', createHandler); };

      // Show PWA install prompt for iOS Safari (not standalone)
      const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
      const isStandalone = ('standalone' in navigator && (navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches;
      const dismissed = localStorage.getItem('wisers-pwa-dismissed');
      if (isIos && !isStandalone && !dismissed) {
        setTimeout(() => { showPwaPrompt = true; }, 5000);
      }
    }
    if ($auth.token) { connectWS($auth.token); }
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-wisers-theme', theme);
    localStorage.setItem('wisers-theme', theme);
  }

  onDestroy(() => { if (typeof document !== 'undefined') document.body.classList.remove('wisers-page'); if (cleanupListeners) cleanupListeners(); });

  let cleanupListeners: (() => void) | null = null;


  function handleLogout() {
    auth.logout();
    if (typeof window !== 'undefined') window.location.href = '/wisers';
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    feedPage += 1;
    try {
      const res = feedType === 'friends'
        ? await api.getFriendsFeed(feedPage)
        : await api.getFeed(feedPage);
      const newPosts = (res.posts || []).map(p => ({ ...p, _liked: !!p.my_liked, my_rocket: !!p.my_rocketed, my_repost: !!p.my_reposted }));
      const existingKeys = new Set(posts.map((p, i) => `${p.id}-${p.reposted_by || ''}`));
      const unique = newPosts.filter(p => !existingKeys.has(`${p.id}-${p.reposted_by || ''}`));
      posts = [...posts, ...unique];
      hasMore = newPosts.length >= 20;
    } catch {}
    loadingMore = false;
  }

  async function loadFeed(showSkeleton = false) {
    if (showSkeleton) { feedLoading = true; feedPage = 1; hasMore = true; }
    feedError = '';
    try {
      const res = feedType === 'friends' && $auth.token
        ? await api.getFriendsFeed(1)
        : await api.getCommunityFeed(1);
      posts = (res.posts || []).map(p => ({ ...p, _liked: !!p.my_liked, my_rocket: !!p.my_rocketed, my_repost: !!p.my_reposted }));
    } catch (err) {
      posts = [];
      feedError = err instanceof Error ? err.message : 'Unable to load feed right now.';
      console.error('loadFeed failed:', err);
    }
    feedLoading = false;
  }

  async function loadUsers() {
    try { allUsers = (await api.getAllUsers(1)).users || []; } catch {}
  }

  async function submitPost() {
    const hasMedia = mediaAttachments.length > 0;
    const hasLegacyImage = !!postImage;
    if ((!newPost.trim() && !hasLegacyImage && !hasMedia && !(isMilestone && milestoneValue.trim())) || posting) return;
    // Block if any media is still uploading
    if (hasMedia && mediaAttachments.some(a => a.status === 'uploading')) { alert('Please wait for uploads to finish'); return; }
    // Block if any media failed
    if (hasMedia && mediaAttachments.some(a => a.status === 'failed')) { alert('Some uploads failed. Remove or retry them.'); return; }
    posting = true;
    try {
      let imageUrl = '';
      // Legacy single image path (backward compat)
      if (hasLegacyImage && !hasMedia) {
        uploading = true;
        const res = await api.uploadPostImage(postImage!);
        imageUrl = res.url;
        uploading = false;
      }
      const mediaIds = hasMedia ? mediaAttachments.filter(a => a.status === 'done' && a.mediaId).map(a => a.mediaId) : [];
      const defaultContent = hasMedia ? '' : (hasLegacyImage ? '📷' : '');
      if (isMilestone && milestoneValue.trim()) {
        await api.createMilestone({ content: newPost.trim() || milestoneValue, milestone_type: milestoneType, milestone_value: milestoneValue, image_url: imageUrl });
      } else {
        await api.createPost(newPost.trim() || defaultContent, 'text', '', 0, imageUrl, mediaIds);
      }
      // Clean up previews
      for (const a of mediaAttachments) { if (a.preview) URL.revokeObjectURL(a.preview); }
      newPost = ''; postImage = null; postImagePreview = ''; isMilestone = false; milestoneValue = ''; mediaAttachments = [];
      showToast('Post created');
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

  function removeImage() { if (postImagePreview) URL.revokeObjectURL(postImagePreview); postImage = null; postImagePreview = ''; }

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
    goto(`/wisers/search?q=${encodeURIComponent(searchQuery)}`);
    return;
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

  async function loadFollowStates() {
    const usernames = [...new Set(posts.map(p => p.username).filter(u => u && u !== $auth.user?.username))];
    for (const u of usernames.slice(0, 30)) {
      try {
        const fs = await api.getFollowStatus(u);
        followStates[u] = fs.i_follow;
      } catch {}
    }
    followStates = { ...followStates };
  }

  async function toggleFeedFollow(username: string) {
    if (!$auth.token || !username) return;
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

  function openLightbox(src: string) { lightboxSrc = src; }

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
      const rocketed = res.rocketed;
      // Rocket also reposts
      let reposted = false;
      if (rocketed && !post.my_repost) {
        try {
          const rr = await api.toggleRepost(post.id);
          reposted = rr.reposted;
        } catch (e) { /* repost failed */ }
      }
      posts = posts.map(p => p.id === post.id ? {
        ...p,
        rockets_count: (p.rockets_count || 0) + (rocketed ? 1 : -1),
        my_rocket: rocketed,
        reposts_count: (p.reposts_count || 0) + (reposted ? 1 : 0),
        my_repost: reposted || p.my_repost
      } : p);
      if (rocketed) launchRockets();
    } catch { /* rocket failed */ }
  }

  async function handleShare(post: any) {
    const url = 'https://wisrs.com/wisers/' + (post.username || '') + '/post/' + post.id;
    if (navigator.share) {
      try { await navigator.share({ title: 'Wisers', text: post.content?.substring(0, 100), url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    }
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

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderContent(text: string): string {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/#(\w{2,30})/g, '<a href="/wisers?tag=$1" class="w-hashtag">#$1</a>');
    html = html.replace(/@(\w{2,30})/g, '<a href="/wisers/$1" class="w-mention">@$1</a>');
    return html;
  }

  function handleDoubleTap(e: MouseEvent, post: any) {
    const now = Date.now();
    if (lastTap.id === post.id && now - lastTap.time < 400) {
      // Double tap — like
      if (!post._liked) handleLike(post);
      heartAnim = post.id;
      setTimeout(() => { heartAnim = null; }, 800);
      lastTap = { id: 0, time: 0 };
    } else {
      lastTap = { id: post.id, time: now };
    }
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

  // ═══ LINK PREVIEWS ═══
  let linkPreviews = $state<Record<number, { title?: string; description?: string; image?: string; url: string } | null>>({});
  const urlRegex = /https?:\/\/[^\s<]+/g;

  async function fetchLinkPreview(postId: number, content: string) {
    if (linkPreviews[postId] !== undefined) return;
    const urls = content.match(urlRegex);
    if (!urls || !urls[0]) return;
    linkPreviews[postId] = null; // loading
    try {
      const preview = await api.getLinkPreview(urls[0]);
      if (preview.title || preview.image) {
        linkPreviews = { ...linkPreviews, [postId]: preview };
      }
    } catch { linkPreviews = { ...linkPreviews, [postId]: null }; }
  }

  $effect(() => {
    for (const post of posts) {
      if (post.content && urlRegex.test(post.content) && linkPreviews[post.id] === undefined) {
        fetchLinkPreview(post.id, post.content);
      }
    }
  });

  // ═══ POLL CREATION ═══
  let showPollForm = $state(false);
  let pollQuestion = $state('');
  let pollOptions = $state(['', '']);
  let pollEndsAt = $state('');

  function addPollOption() { if (pollOptions.length < 6) pollOptions = [...pollOptions, '']; }
  function removePollOption(i: number) { if (pollOptions.length > 2) pollOptions = pollOptions.filter((_, idx) => idx !== i); }

  async function submitPoll() {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    try {
      await api.createPoll(pollQuestion, pollOptions.filter(o => o.trim()), newPost.trim() || undefined, pollEndsAt || undefined);
      pollQuestion = ''; pollOptions = ['', '']; pollEndsAt = ''; showPollForm = false; newPost = '';
      showToast('Poll created');
      await loadFeed();
    } catch (e: any) { showToast(e.detail || 'Failed to create poll'); }
  }

  // ═══ POST ANALYTICS ═══
  let analyticsPost = $state<number | null>(null);
  let analyticsData = $state<any>(null);

  async function showAnalytics(postId: number) {
    analyticsPost = postId;
    try {
      analyticsData = await api.getPostAnalytics(postId);
    } catch { analyticsData = { views: 0, unique_views: 0, engagement_rate: 0 }; }
  }

  // ═══ LIKES LIST ═══
  let likesPostId = $state<number | null>(null);
  let likesList = $state<any[]>([]);

  async function showLikes(postId: number) {
    likesPostId = postId;
    try {
      const res = await api.getPostLikes(postId);
      likesList = res.users || [];
    } catch { likesList = []; }
  }

  // ═══ MENTIONS ═══
  let mentionsList = $state<any[]>([]);
  async function loadMentions() {
    try { const res = await api.getMentions(); mentionsList = res.posts || []; } catch {}
  }

  async function handleLike(post: any) { await toggleLike(post.id); }
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

{#if !$auth.token}
  <WisersLanding />
{:else}
<div class="w" class:light={theme === 'light'}>
  <!-- TOP BAR -->
  <header class="w-topbar">
    <div class="w-topbar-inner">
      <a href="/wisers" class="w-logo">W<span>isers</span></a>
      <div class="w-search-wrap">
        <input type="text" class="w-search" placeholder="Search wisers..." bind:value={searchQuery} onkeydown={(e) => e.key === 'Enter' && search()} />
      </div>
      <div class="w-topbar-right">
        <a href="/wisers/messages" class="w-topbar-btn w-msg-topbar-btn" title="Messages" >
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
                <a href="/wisers/mentorship" class="w-ud-item" onclick={() => showUserMenu = false}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
                  Mentorship
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
          <div class="w-profile-stats">
            <div class="w-stat"><span class="w-stat-num">{profileStats.posts}</span><span class="w-stat-label">Posts</span></div>
            <div class="w-stat-sep"></div>
            <div class="w-stat"><span class="w-stat-num">{profileStats.followers}</span><span class="w-stat-label">Followers</span></div>
            <div class="w-stat-sep"></div>
            <div class="w-stat"><span class="w-stat-num">{profileStats.following}</span><span class="w-stat-label">Following</span></div>
          </div>
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
        {#if $auth.token}<a href="/wisers/mentorship" class="w-sidebar-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
            Mentorship
          </a>
          <a href="/wisers/communities" class="w-sidebar-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Communities
          </a>
          <a href="/wisers/messages" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Messages
          {#if $wsUnreadDMs > 0}<span class="w-count w-badge-amber">{$wsUnreadDMs > 9 ? '9+' : $wsUnreadDMs}</span>{/if}
        </a>
        <a href="/notifications" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
          Notifications
          {#if $wsNotifCount > 0}<span class="w-count w-badge-amber">{$wsNotifCount > 9 ? '9+' : $wsNotifCount}</span>{/if}
        </a>{/if}
      </nav>
      <div class="w-sidebar-divider"></div>
      <nav class="w-sidebar-nav">
        <a href="/wisers/discover" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
          Discover
        </a>
        <a href="/wisers/groups" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>
          Group Chats
        </a>
        <a href="/wisers/leaderboard" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 8 12 8s5-4 7.5-4a2.5 2.5 0 0 1 0 5H18"/><path d="M6 9v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/></svg>
          Leaderboard
        </a>
        <a href="/wisers/ai-coach" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27a7 7 0 0 1-12.46 0H7a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/></svg>
          AI Coach
        </a>
      </nav>
      <div class="w-sidebar-divider"></div>
      <a href="https://balancewises.io" class="w-sidebar-back" target="_blank">Balancewise Technologies</a>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="w-main">
      {#if actionMsg}<div class="w-toast">{actionMsg}</div>{/if}

      <!-- MOBILE QUICK LINKS (hidden on desktop) -->
      <div class="w-quick-links">
        <a href="/wisers/discover" class="w-ql-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
          Discover
        </a>
        <a href="/wisers/ai-coach" class="w-ql-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27a7 7 0 0 1-12.46 0H7a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>
          AI Coach
        </a>
        <a href="/wisers/leaderboard" class="w-ql-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 8 12 8s5-4 7.5-4a2.5 2.5 0 0 1 0 5H18"/><path d="M6 9v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/></svg>
          Leaderboard
        </a>
        <a href="/wisers/mentorship" class="w-ql-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
          Mentorship
        </a>
        <a href="/wisers/groups" class="w-ql-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Group Chats
        </a>
        <a href="/notifications" class="w-ql-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
          Notifications
          {#if $wsNotifCount > 0}<span class="w-ql-badge">{$wsNotifCount}</span>{/if}
        </a>
      </div>

      <!-- FEED VIEW -->
      {#if activeView === 'feed'}
        {#if $auth.token}
          <div class="w-composer">
            <div class="w-composer-top">
              <div class="w-avatar-sm w-avatar-gold">{initial($auth.user?.name || '')}</div>
              <textarea bind:value={newPost} placeholder={isMilestone ? "Share your milestone story..." : "What's on your mind?"} maxlength="2000" rows="2"></textarea>
            </div>
            {#if isMilestone}
            <div class="w-milestone-form">
              <div class="w-milestone-badge">🏆 Milestone Post</div>
              <div class="w-milestone-row">
                <select bind:value={milestoneType} class="w-milestone-select">
                  <option value="revenue">Revenue</option>
                  <option value="users">Users/Customers</option>
                  <option value="launch">Product Launch</option>
                  <option value="funding">Funding</option>
                  <option value="growth">Growth</option>
                  <option value="personal">Personal Win</option>
                  <option value="custom">Custom</option>
                </select>
                <input type="text" bind:value={milestoneValue} class="w-milestone-input" placeholder="e.g. Hit £1,000 MRR" maxlength="100" />
              </div>
            </div>
            {/if}
            {#if showPollForm}
            <div class="w-poll-form">
              <div class="w-poll-badge">📊 Create Poll</div>
              <input type="text" bind:value={pollQuestion} class="w-poll-q" placeholder="Ask a question..." maxlength="200" />
              {#each pollOptions as opt, i}
                <div class="w-poll-opt-row">
                  <input type="text" bind:value={pollOptions[i]} class="w-poll-opt" placeholder="Option {i + 1}" maxlength="100" />
                  {#if pollOptions.length > 2}<button class="w-poll-opt-rm" onclick={() => removePollOption(i)} type="button">✕</button>{/if}
                </div>
              {/each}
              {#if pollOptions.length < 6}<button class="w-poll-add" onclick={addPollOption} type="button">+ Add option</button>{/if}
              <div class="w-poll-footer">
                <label class="w-poll-ends">Ends: <input type="datetime-local" bind:value={pollEndsAt} /></label>
                <button class="w-post-btn" onclick={submitPoll} disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}>Create Poll</button>
              </div>
            </div>
            {/if}
            {#if showScheduler}
            <div class="w-schedule-form">
              <div class="w-poll-badge">🕐 Schedule Post</div>
              <textarea bind:value={scheduleContent} placeholder="Write your scheduled post..." maxlength="2000" rows="2" class="w-sched-textarea"></textarea>
              <div class="w-poll-footer">
                <input type="datetime-local" bind:value={scheduleDate} class="w-sched-date" />
                <button class="w-post-btn" onclick={handleSchedulePost} disabled={!scheduleContent.trim() || !scheduleDate}>Schedule</button>
              </div>
            </div>
            {/if}
            {#if postImagePreview}<div class="w-img-preview"><img src={postImagePreview} alt="Preview" /><button class="w-img-remove" onclick={removeImage}>✕</button></div>{/if}
            {#if mediaAttachments.length > 0}
            <div class="w-media-previews">
              {#each mediaAttachments as att, idx}
                <div class="w-media-thumb" class:w-media-uploading={att.status === 'uploading'} class:w-media-failed={att.status === 'failed'}>
                  {#if att.mediaType === 'image' && att.preview}
                    <img src={att.preview} alt={att.filename} class="w-media-thumb-img" />
                  {:else if att.mediaType === 'video'}
                    <div class="w-media-thumb-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <span class="w-media-thumb-name">{att.filename}</span>
                    </div>
                  {:else if att.mediaType === 'audio'}
                    <div class="w-media-thumb-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      <span class="w-media-thumb-name">{att.filename}</span>
                    </div>
                  {:else}
                    <div class="w-media-thumb-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span class="w-media-thumb-name">{att.filename}</span>
                      <span class="w-media-thumb-size">{formatFileSize(att.size)}</span>
                    </div>
                  {/if}
                  {#if att.status === 'uploading'}
                    <div class="w-media-thumb-overlay"><div class="w-media-spinner"></div></div>
                  {/if}
                  {#if att.status === 'failed'}
                    <div class="w-media-thumb-overlay w-media-fail-overlay">
                      <button class="w-media-retry-btn" onclick={() => retryMediaUpload(idx)} type="button">Retry</button>
                    </div>
                  {/if}
                  <button class="w-img-remove" onclick={() => removeMediaAttachment(idx)} type="button">✕</button>
                </div>
              {/each}
            </div>
            {/if}
            <div class="w-composer-bottom">
              <div class="w-feed-tabs">
                <button class:active={feedType === 'all'} onclick={() => { feedType = 'all'; loadFeed(); }}>Everyone</button>
                <button class:active={feedType === 'friends'} onclick={() => { feedType = 'friends'; loadFeed(); }}>Friends</button>
              </div>
              <button class="w-milestone-btn" class:active={isMilestone} onclick={() => isMilestone = !isMilestone} type="button" title="Milestone post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isMilestone ? '#f5a623' : 'none'} stroke={isMilestone ? '#f5a623' : 'currentColor'} stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 8 12 8s5-4 7.5-4a2.5 2.5 0 0 1 0 5H18"/><path d="M6 9v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M12 8v13"/></svg>
              </button>
              <button class="w-poll-btn" class:active={showPollForm} onclick={() => showPollForm = !showPollForm} type="button" title="Create poll">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={showPollForm ? '#f5a623' : 'none'} stroke={showPollForm ? '#f5a623' : 'currentColor'} stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="9" width="7" height="12" rx="1"/></svg>
              </button>
              <button class="w-sched-btn" class:active={showScheduler} onclick={() => showScheduler = !showScheduler} type="button" title="Schedule post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={showScheduler ? '#f5a623' : 'currentColor'} stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </button>
              <button class="w-img-btn" onclick={() => document.getElementById('post-media-input')?.click()} type="button" title="Add media">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                {#if mediaAttachments.length > 0}<span class="w-media-count">{mediaAttachments.length}/{MAX_MEDIA_FILES}</span>{/if}
              </button>
              <input id="post-media-input" type="file" accept={ACCEPTED_TYPES} onchange={handleMediaSelect} multiple style="display:none" />
              <input id="post-img-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif" onchange={handleImageSelect} style="display:none" />
              <div class="w-emoji-wrap">
              <button class="w-emoji-btn" onclick={() => showEmoji = !showEmoji} type="button">😀</button>
              {#if showEmoji}
                <div class="w-emoji-backdrop" onclick={() => showEmoji = false} role="presentation"></div>
                <div class="w-emoji-picker">
                  {#each emojis as e}
                    <button class="w-emoji-item" onclick={() => { newPost += e; showEmoji = false; }} type="button">{e}</button>
                  {/each}
                </div>
              {/if}
            </div>
            <span class="w-char">{newPost.length}/2000</span>
              <button class="w-post-btn" onclick={submitPost} disabled={posting || uploading || mediaAttachments.some(a => a.status === 'uploading') || (!newPost.trim() && !postImage && mediaAttachments.length === 0 && !(isMilestone && milestoneValue.trim()))}>{mediaAttachments.some(a => a.status === 'uploading') ? 'Uploading...' : uploading ? 'Uploading...' : posting ? 'Posting...' : 'Post'}</button>
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

        {#if feedError}
          <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{feedError}</div>
        {/if}

        {#if feedLoading}
              {#each [1,2,3] as _}
                <div class="w-skel-post">
                  <div class="w-skel-row"><div class="w-skel w-skel-av"></div><div class="w-skel-col"><div class="w-skel w-skel-name"></div><div class="w-skel w-skel-handle"></div></div></div>
                  <div class="w-skel w-skel-body"></div>
                  <div class="w-skel w-skel-body short"></div>
                  <div class="w-skel-actions"><div class="w-skel w-skel-act"></div><div class="w-skel w-skel-act"></div><div class="w-skel w-skel-act"></div></div>
                </div>
              {/each}
            {:else}{#each posts as post, idx (`${post.id}-${post.reposted_by || 'orig'}-${idx}`)}
          <article class="w-post">
            {#if post.reposted_by}
              <div class="w-repost-banner">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
                <span>{post.reposted_by} rocketed</span>
              </div>
            {/if}
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
                  {#if post.edited}<span class="w-post-edited">Edited</span>{/if}
                </div>
                {#if $auth.token && post.username !== $auth.user?.username && post.user_id !== $auth.user?.id}
                  <button class="w-follow-inline" class:following={followStates[post.username]} onclick={() => toggleFeedFollow(post.username)}>
                    {followStates[post.username] ? 'Following' : 'Follow'}
                  </button>
                {/if}
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
                          <button onclick={() => { showAnalytics(post.id); openPostMenu = null; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                            Analytics
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
              {#if post.milestone_type && post.milestone_value}
              <div class="w-milestone-card">
                <span class="w-milestone-icon">🏆</span>
                <span class="w-milestone-val">{post.milestone_value}</span>
                <span class="w-milestone-type">{post.milestone_type}</span>
              </div>
              {/if}
              <div class="w-post-body" onclick={(e) => handleDoubleTap(e, post)} role="presentation">{@html renderContent(post.content)}</div>
              {#if heartAnim === post.id}<div class="w-heart-anim"><svg width="64" height="64" viewBox="0 0 24 24" fill="#f43f5e" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>{/if}
              {#if post.image_url && post.image_url.trim()}<div class="w-post-img"><img src={post.image_url} alt="" loading="lazy" onclick={() => openLightbox(post.image_url)} onerror={(e) => { const el = e.currentTarget as HTMLImageElement; if (el.parentElement) el.parentElement.style.display = 'none'; }} role="button" tabindex="0" style="cursor:zoom-in" /></div>{/if}
              {#if post.media?.filter((m: any) => m.url && m.url.trim()).length}
                <div class="w-post-media" class:w-media-grid-2={post.media.filter((m: any) => m.type === 'image' && m.url).length === 2} class:w-media-grid-3={post.media.filter((m: any) => m.type === 'image' && m.url).length === 3} class:w-media-grid-4={post.media.filter((m: any) => m.type === 'image' && m.url).length >= 4}>
                  {#each post.media.filter((m: any) => m.url && m.url.trim()) as m}
                    {#if m.type === 'image'}
                      <div class="w-media-item"><img src={m.url} alt="" loading="lazy" onclick={() => openLightbox(m.url)} onerror={(e) => { const item = e.currentTarget.parentElement; if (item) { item.style.display = 'none'; const container = item.parentElement; if (container && !container.querySelector('.w-media-item:not([style*="display: none"])')) container.style.display = 'none'; } }} style="cursor:zoom-in" /></div>
                    {:else if m.type === 'video'}
                      <div class="w-media-item w-media-video"><video src={m.url} poster={m.thumbnail_url} controls preload="metadata" playsinline></video></div>
                    {:else if m.type === 'document'}
                      <a href={m.url} target="_blank" rel="noopener" class="w-media-doc">
                        <span class="w-doc-icon">📄</span>
                        <span class="w-doc-info"><span class="w-doc-name">{m.filename}</span><span class="w-doc-size">{formatFileSize(m.size)}</span></span>
                        <span class="w-doc-dl">↓</span>
                      </a>
                    {:else if m.type === 'audio'}
                      <div class="w-media-audio">
                        <span class="w-audio-icon">🎵</span>
                        <span class="w-audio-name">{m.filename}</span>
                        <audio src={m.url} controls preload="metadata"></audio>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
              {#if post.post_type === 'scan_share' && post.scan_url}
                <div class="w-scan-card">
                  <span>{post.scan_url}</span>
                  <span class="w-scan-score" class:good={post.scan_score >= 70} class:warn={post.scan_score >= 40 && post.scan_score < 70} class:bad={post.scan_score < 40}>{post.scan_score}</span>
                </div>
              {/if}
              {#if linkPreviews[post.id]?.title || linkPreviews[post.id]?.image}
                <a href={linkPreviews[post.id]?.url} target="_blank" rel="noopener" class="w-link-preview">
                  {#if linkPreviews[post.id]?.image}<img src={linkPreviews[post.id]?.image} alt="" class="w-lp-img" onerror={(e) => { e.currentTarget.style.display = 'none'; }} />{/if}
                  <div class="w-lp-text">
                    <div class="w-lp-title">{linkPreviews[post.id]?.title || ''}</div>
                    {#if linkPreviews[post.id]?.description}<div class="w-lp-desc">{linkPreviews[post.id]?.description}</div>{/if}
                    <div class="w-lp-domain">{new URL(linkPreviews[post.id]?.url || '').hostname}</div>
                  </div>
                </a>
              {/if}
              <div class="w-post-actions">
                <button class="w-action" class:w-liked={post._liked} onclick={() => toggleLike(post.id)} title="Like">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={post._liked ? '#f43f5e' : 'none'} stroke={post._liked ? '#f43f5e' : 'currentColor'} stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  <span class="w-likes-clickable" onclick={(e) => { e.stopPropagation(); if (post.likes_count > 0) showLikes(post.id); }}>{post.likes_count || 0}</span>
                </button>
                <button class="w-action w-rocket-btn" class:w-rocketed={post.my_rocket} onclick={() => handleRocket(post)} title="Rocket & Share">
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
        {#if loadingMore}
        <div style="display:flex;justify-content:center;padding:20px;">
            <div style="width:24px;height:24px;border:2px solid var(--wbd);border-top-color:var(--wgold);border-radius:50%;animation:spin 0.6s linear infinite;"></div>
        </div>
        {/if}
        {/if}

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
        {/if}

      {:else if activeView === 'bookmarks'}
        <h2 class="w-section-title">Saved Posts</h2>
        {#if bookmarkedList.length === 0}
          <div class="w-empty">No saved posts yet. Bookmark posts to find them here.</div>
        {:else}
          {#each bookmarkedList as post, idx (`bm-${post.id}-${idx}`)}
            <article class="w-post">
              <div class="w-post-left">
                <a href="/wisers/{post.username}" class="w-avatar-md">{#if avatarSrc(post.avatar_url)}<img src={avatarSrc(post.avatar_url)} alt="" class="w-av-img" />{:else}{initial(post.display_name || post.user_name)}{/if}</a>
              </div>
              <div class="w-post-right">
                <div class="w-post-meta">
                  <div class="w-post-meta-left">
                    <a href="/wisers/{post.username}" class="w-post-author">{post.display_name || post.user_name}</a>
                    <span class="w-post-handle">@{post.username}</span>
                    <span class="w-post-dot">·</span>
                    <span class="w-post-time">{timeAgo(post.created_at)}</span>
                    {#if post.edited}<span class="w-post-edited">Edited</span>{/if}
                  </div>
                </div>
                {#if post.milestone_type && post.milestone_value}
              <div class="w-milestone-card">
                <span class="w-milestone-icon">🏆</span>
                <span class="w-milestone-val">{post.milestone_value}</span>
                <span class="w-milestone-type">{post.milestone_type}</span>
              </div>
              {/if}
              <div class="w-post-body" onclick={(e) => handleDoubleTap(e, post)} role="presentation">{@html renderContent(post.content)}</div>
              {#if heartAnim === post.id}<div class="w-heart-anim"><svg width="64" height="64" viewBox="0 0 24 24" fill="#f43f5e" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>{/if}
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
            {#each trendingTags.slice(0, 8) as tag, i}
              <a href="/wisers?tag={tag.tag}" class="w-trending-item">
                <span class="w-trending-rank">{i + 1}</span>
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
              <button class="w-connect-sm w-follow-sm" onclick={() => sendRequest(u.username)}>Follow</button>
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
      {#if sponsoredAd.active}
        <div class="w-widget w-ad-block">
          <div class="w-ad-label">Sponsored</div>
          {#if sponsoredAd.image_url}<img src={sponsoredAd.image_url} alt="" class="w-ad-img" />{/if}
          <h4 class="w-ad-title">{sponsoredAd.title}</h4>
          <p class="w-ad-desc">{sponsoredAd.description}</p>
          <a href={sponsoredAd.cta_url} target="_blank" rel="noopener" class="w-ad-cta">{sponsoredAd.cta_text}</a>
        </div>
      {/if}
      <div class="w-widget w-footer">
        <a href="/">Scanner</a> · <a href="/seo">SEO</a> · <a href="/compare">Compare</a> · <a href="/support">Support</a>
        <div class="w-copyright">Balancewise Technologies &copy; 2026</div>
      </div>
    </aside>
  </div>
</div>

  <!-- PWA INSTALL PROMPT -->
  {#if showPwaPrompt}
    <div class="w-pwa-prompt">
      <button class="w-pwa-close" onclick={() => { showPwaPrompt = false; localStorage.setItem('wisers-pwa-dismissed', '1'); }} aria-label="Dismiss">✕</button>
      <div class="w-pwa-content">
        <div class="w-pwa-icon">W</div>
        <div>
          <div class="w-pwa-title">Add Wisers to Home Screen</div>
          <div class="w-pwa-desc">Tap <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then "Add to Home Screen"</div>
        </div>
      </div>
    </div>
  {/if}

  <!-- TOAST -->
  {#if toast}
    <div class="w-toast">{toast}</div>
  {/if}

  <!-- MOBILE BOTTOM NAV -->
  <nav class="w-mobile-nav">
    <button class="w-mn-item" class:active={mobileTab === 'home'} onclick={() => { mobileTab = 'home'; activeView = 'feed'; loadFeed(); }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill={mobileTab === 'home' ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span>Home</span>
    </button>
    <a href="/wisers/communities" class="w-mn-item">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span>Groups</span>
    </a>
    <button class="w-mn-create" onclick={(e) => { e.stopPropagation(); e.preventDefault(); showCreateSheet = !showCreateSheet; }} aria-label="Create">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
    <a href="/wisers/messages" class="w-mn-item">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>Inbox</span>
      {#if $wsUnreadDMs > 0}<span class="w-mn-badge">{$wsUnreadDMs > 9 ? '9+' : $wsUnreadDMs}</span>{/if}
    </a>
    <a href="/wisers/{$auth.user?.username || 'me'}" class="w-mn-item">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>Profile</span>
    </a>
  </nav>

  <!-- CREATE BOTTOM SHEET -->
  {#if showCreateSheet}
    <div class="w-sheet-overlay" onclick={() => showCreateSheet = false} role="presentation"></div>
    <div class="w-create-sheet">
      <div class="w-sheet-handle"></div>
      <div class="w-sheet-title">Create</div>
      <button class="w-sheet-item" onclick={() => { showCreateSheet = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        <div class="w-sheet-icon" style="background:rgba(59,130,246,0.12)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
        <div class="w-sheet-label"><div class="w-sheet-name">Post</div><div class="w-sheet-desc">Share an update with your network</div></div>
      </button>
      <button class="w-sheet-item" onclick={() => { showCreateSheet = false; isMilestone = true; window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        <div class="w-sheet-icon" style="background:rgba(245,166,35,0.12)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 8 12 8s5-4 7.5-4a2.5 2.5 0 0 1 0 5H18"/><path d="M6 9v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M12 8v13"/></svg></div>
        <div class="w-sheet-label"><div class="w-sheet-name">Milestone</div><div class="w-sheet-desc">Celebrate an achievement</div></div>
      </button>
      <a href="/wisers/communities" class="w-sheet-item" onclick={() => showCreateSheet = false}>
        <div class="w-sheet-icon" style="background:rgba(16,185,129,0.12)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="w-sheet-label"><div class="w-sheet-name">Community Post</div><div class="w-sheet-desc">Post in a community group</div></div>
      </a>
      <a href="/wisers/mentorship" class="w-sheet-item" onclick={() => showCreateSheet = false}>
        <div class="w-sheet-icon" style="background:rgba(124,58,237,0.12)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg></div>
        <div class="w-sheet-label"><div class="w-sheet-name">Find a Mentor</div><div class="w-sheet-desc">Connect with someone who has been there</div></div>
      </a>
    </div>
  {/if}

{#if lightboxSrc}
  <ImageLightbox src={lightboxSrc} onclose={() => lightboxSrc = ''} />
{/if}

{#if showOnboarding}
  <OnboardingWizard onfinish={() => showOnboarding = false} />
{/if}

<!-- Analytics Modal -->
{#if analyticsPost !== null}
  <div class="w-modal-overlay" onclick={() => analyticsPost = null} role="presentation">
    <div class="w-modal" onclick={(e) => e.stopPropagation()}>
      <div class="w-modal-header">
        <h3>Post Analytics</h3>
        <button class="w-modal-close" onclick={() => analyticsPost = null}>✕</button>
      </div>
      {#if analyticsData}
        <div class="w-analytics-grid">
          <div class="w-analytics-stat">
            <div class="w-analytics-num">{analyticsData.views ?? 0}</div>
            <div class="w-analytics-label">Views</div>
          </div>
          <div class="w-analytics-stat">
            <div class="w-analytics-num">{analyticsData.unique_views ?? 0}</div>
            <div class="w-analytics-label">Unique Views</div>
          </div>
          <div class="w-analytics-stat">
            <div class="w-analytics-num">{analyticsData.likes ?? 0}</div>
            <div class="w-analytics-label">Likes</div>
          </div>
          <div class="w-analytics-stat">
            <div class="w-analytics-num">{analyticsData.comments ?? 0}</div>
            <div class="w-analytics-label">Comments</div>
          </div>
          <div class="w-analytics-stat">
            <div class="w-analytics-num">{analyticsData.rockets ?? 0}</div>
            <div class="w-analytics-label">Rockets</div>
          </div>
          <div class="w-analytics-stat">
            <div class="w-analytics-num">{((analyticsData.engagement_rate ?? 0) * 100).toFixed(1)}%</div>
            <div class="w-analytics-label">Engagement</div>
          </div>
        </div>
      {:else}
        <div class="w-modal-loading">Loading...</div>
      {/if}
    </div>
  </div>
{/if}

<!-- Likes List Modal -->
{#if likesPostId !== null}
  <div class="w-modal-overlay" onclick={() => likesPostId = null} role="presentation">
    <div class="w-modal" onclick={(e) => e.stopPropagation()}>
      <div class="w-modal-header">
        <h3>Liked by</h3>
        <button class="w-modal-close" onclick={() => likesPostId = null}>✕</button>
      </div>
      <div class="w-likes-list">
        {#if likesList.length === 0}
          <div class="w-modal-empty">No likes yet</div>
        {:else}
          {#each likesList as user}
            <a href="/wisers/{user.username}" class="w-likes-user" onclick={() => likesPostId = null}>
              <div class="w-avatar-sm">{#if avatarSrc(user.avatar_url)}<img src={avatarSrc(user.avatar_url)} alt="" class="w-av-img" />{:else}{initial(user.display_name || user.name || user.username)}{/if}</div>
              <div class="w-likes-info">
                <span class="w-likes-name">{user.display_name || user.name}</span>
                <span class="w-likes-handle">@{user.username}</span>
              </div>
            </a>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

  :global([data-wisers-theme="light"]) { --wb: #ffffff; --wc: #f0f2f5; --wt: #1c1e21; --wt2: #606770; --wt3: #8a8d91; --wbd: #dddfe2; --wcard: #ffffff; --wgold: #d4a017; --whover: rgba(0,0,0,0.04); }

  .w { margin-top: 0; padding-top: 0; --wb: #0a0a0f; --wc: #111117; --wt: #e4e6ea; --wt2: #8a8d91; --wt3: #606770; --wbd: #1e1e2a; --wcard: #16161f; --wgold: #f5a623; --whover: rgba(255,255,255,0.04);
    font-family: 'DM Sans', -apple-system, sans-serif; color: var(--wt); background: var(--wb); min-height: 100vh; position: relative; }
  .w.light { --wb: #ffffff; --wc: #f0f2f5; --wt: #1c1e21; --wt2: #606770; --wt3: #8a8d91; --wbd: #dddfe2; --wcard: #ffffff; --wgold: #d4a017; --whover: rgba(0,0,0,0.04); }

  .w-topbar { position: sticky; top: 0; z-index: 100; background: var(--wcard); border-bottom: 1px solid var(--wbd); height: 56px; }
  .w-topbar-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; height: 100%; padding: 0 16px; gap: 12px; }
  .w-logo { font-size: 26px; font-weight: 800; color: var(--wgold); text-decoration: none; letter-spacing: -1px; flex-shrink: 0; }
  .w-logo span { color: var(--wt); }
  .w-search-wrap { flex: 1; max-width: 400px; }
  .w-search { width: 100%; padding: 12px 16px; border-radius: 20px; border: none; background: var(--wc); color: var(--wt); font-size: 16px; outline: none; font-family: inherit; }
  .w-search::placeholder { color: var(--wt3); }
  .w-search:focus { box-shadow: 0 0 0 2px var(--wgold); }
  .w-topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .w-topbar-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--wc); border: none; color: var(--wt2); display: flex; align-items: center; justify-content: center; cursor: pointer; text-decoration: none; }
  .w-topbar-btn:hover { background: var(--wbd); color: var(--wt); }
  .w-avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; text-decoration: none; flex-shrink: 0; }
  .w-avatar-md { width: 40px; height: 40px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; text-decoration: none; flex-shrink: 0; }
  .w-avatar-lg { width: 48px; height: 48px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; flex-shrink: 0; }
  .w-avatar-gold { background: var(--wgold); }
  .w-av-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .w-av-img-lg { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
  .w-av-img-sm { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .w-login-btn { padding: 10px 18px; border-radius: 8px; background: var(--wgold); color: #000; font-weight: 700; font-size: 15px; text-decoration: none; white-space: nowrap; }

  .w-body { display: flex; max-width: 1280px; margin: 0 auto; height: calc(100vh - 56px); overflow: hidden; }

  .w-sidebar-left { width: 240px; padding: 16px 12px; height: 100%; overflow-y: auto; flex-shrink: 0; }
  .w-profile-card { display: flex; flex-direction: column; align-items: center; padding: 20px 12px; border-radius: 12px; background: var(--wcard); border: 1px solid var(--wbd); text-decoration: none; color: var(--wt); margin-bottom: 16px; }
  .w-profile-card:hover { border-color: var(--wgold); }
  .w-profile-name { font-weight: 700; font-size: 17px; margin-top: 10px; }
  .w-profile-handle { font-size: 14px; color: var(--wt2); }
  .w-sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
  .w-sidebar-nav button, .w-sidebar-link { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; border: none; background: none; color: var(--wt2); font-size: 16px; font-weight: 500; cursor: pointer; width: 100%; text-align: left; text-decoration: none; font-family: inherit; }
  .w-sidebar-nav button:hover, .w-sidebar-link:hover { background: var(--whover); color: var(--wt); }
  .w-sidebar-nav button.active { background: rgba(245,166,35,0.1); color: var(--wgold); font-weight: 700; }
  .w-count { font-size: 13px; padding: 1px 6px; border-radius: 99px; margin-left: auto; }
  .w-sidebar-divider { height: 1px; background: var(--wbd); margin: 12px 0; }
  .w-sidebar-back { font-size: 14px; color: var(--wt3); text-decoration: none; padding: 10px 14px; }
  .w-sidebar-back:hover { color: var(--wgold); }

  .w-profile-stats { display: flex; align-items: center; gap: 0; margin-top: 12px; width: 100%; justify-content: center; }
  .w-stat { display: flex; flex-direction: column; align-items: center; flex: 1; }
  .w-stat-num { font-size: 16px; font-weight: 800; color: var(--wt); }
  .w-stat-label { font-size: 12px; color: var(--wt3); margin-top: 1px; }
  .w-stat-sep { width: 1px; height: 24px; background: var(--wbd); }
  .w-badge-amber { background: #e8940c !important; color: #0f1724 !important; font-weight: 700; font-size: 12px; min-width: 20px; text-align: center; }

  .w-main { flex: 1; min-width: 0; padding: 16px; border-left: 1px solid var(--wbd); border-right: 1px solid var(--wbd); overflow-y: auto; height: 100%; }

  .w-sidebar-right { width: 280px; padding: 16px 12px; height: 100%; overflow-y: auto; flex-shrink: 0; }

  .w-composer { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .w-composer-top { display: flex; gap: 12px; align-items: flex-start; }
  .w-composer-top .w-avatar-sm { width: 40px; height: 40px; font-size: 17px; }
  .w-composer textarea { flex: 1; border: none; background: transparent; color: var(--wt); font-size: 17px; resize: none; outline: none; font-family: inherit; min-height: 50px; }
  .w-composer textarea::placeholder { color: var(--wt3); }
  .w-composer-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--wbd); }
  .w-feed-tabs { display: flex; gap: 2px; }
  .w-feed-tabs button { padding: 7px 14px; border-radius: 16px; border: 1px solid var(--wbd); background: none; color: var(--wt3); font-size: 14px; cursor: pointer; font-family: inherit; font-weight: 600; }
  .w-feed-tabs button.active { background: var(--wgold); color: #000; border-color: var(--wgold); }
  .w-emoji-wrap { position: relative; }
  .w-emoji-btn { background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 6px; line-height: 1; }
  .w-emoji-btn:hover { background: var(--whover); }
  .w-emoji-picker { position: absolute; bottom: calc(100% + 8px); right: 0; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 14px; padding: 10px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 0; width: 300px; max-height: 220px; overflow-y: auto; z-index: 50; box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
  .w-emoji-item { background: none; border: none; font-size: 22px; cursor: pointer; padding: 6px 2px; border-radius: 8px; text-align: center; line-height: 1; transition: background 0.1s, transform 0.1s; }
  .w-emoji-item:hover { background: var(--whover); transform: scale(1.2); }
  .w-emoji-item:active { transform: scale(0.95); }
  .w-char { font-size: 13px; color: var(--wt3); }
  .w-post-btn { padding: 10px 22px; border-radius: 20px; border: none; background: var(--wgold); color: #000; font-weight: 700; font-size: 15px; cursor: pointer; font-family: inherit; }
  .w-post-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .w-join-cta { text-align: center; padding: 40px 20px; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; margin-bottom: 16px; }
  .w-join-cta h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
  .w-join-cta p { color: var(--wt2); font-size: 16px; margin-bottom: 16px; }
  .w-join-btn { display: inline-block; padding: 12px 28px; border-radius: 20px; background: var(--wgold); color: #000; font-weight: 700; font-size: 16px; text-decoration: none; }

  .w-post { display: flex; flex-wrap: wrap; gap: 0 12px; padding: 16px; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; margin-bottom: 10px; }
  .w-post:hover { border-color: rgba(245,166,35,0.2); }
  .w-repost-banner { width: 100%; display: flex; align-items: center; gap: 6px; padding: 0 0 8px 44px; font-size: 15px; color: #f97316; font-weight: 500; }
  .w-repost-banner svg { flex-shrink: 0; stroke: #f97316; }
  .w-post-right { flex: 1; min-width: 0; }
  .w-post-meta { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px; position: relative; }
  .w-post-meta-left { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; flex-wrap: wrap; }
  .w-post-author { font-weight: 700; font-size: 16px; color: var(--wt); text-decoration: none; }
  .w-post-author:hover { text-decoration: underline; }
  .w-post-handle { font-size: 15px; color: var(--wt2); }
  .w-post-dot { color: var(--wt3); }
  .w-post-time { font-size: 14px; color: var(--wt3); }
  .w-post-edited { font-size: 13px; color: var(--wt3); font-style: italic; }
  .w-verify { width: 16px; height: 16px; flex-shrink: 0; display: inline-flex; }
  .w-verify svg { width: 16px; height: 16px; }
  .w-verify.v-free svg { fill: #555; }
  .w-verify.v-pro svg { fill: #3b82f6; }
  .w-verify.v-agency svg { fill: #f5a623; }
  .w-plan-badge { font-size: 13px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; background: rgba(245,166,35,0.15); color: var(--wgold); }
  .w-post-body { font-size: 17px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .w-scan-card { margin-top: 10px; padding: 12px; border-radius: 8px; background: var(--wc); border: 1px solid var(--wbd); display: flex; justify-content: space-between; align-items: center; }
  .w-scan-score { font-size: 20px; font-weight: 800; }
  .w-scan-score.good { color: #10b981; } .w-scan-score.warn { color: #f59e0b; } .w-scan-score.bad { color: #ef4444; }
  .w-post-actions { display: flex; gap: 16px; margin-top: 10px; }
  .w-action { -webkit-tap-highlight-color: transparent; display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--wt3); font-size: 15px; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-family: inherit; }
  .w-action:hover { background: var(--whover); color: var(--wt); }
  .w-action-del { margin-left: auto; }
  .w-action-del:hover { color: #ef4444; }
  .w-follow-inline {
    padding: 3px 12px; border-radius: 16px; border: 1px solid var(--wgold); background: none;
    color: var(--wgold); font-size: 14px; font-weight: 700; cursor: pointer;
    font-family: inherit; white-space: nowrap; flex-shrink: 0; transition: all 0.15s;
    margin-left: auto;
  }
  .w-follow-inline:hover { background: var(--wgold); color: #000; }
  .w-follow-inline.following { border-color: var(--wbd); color: var(--wt3); }
  .w-follow-inline.following:hover { border-color: #ef4444; color: #ef4444; background: none; }
  .w-post-menu-wrap { position: relative; flex-shrink: 0; }
  .w-post-menu-btn { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--wt3); background: none; border: none; cursor: pointer; transition: background 0.15s, color 0.15s; opacity: 0; font-family: inherit; }
  .w-post:hover .w-post-menu-btn, .w-post-menu-btn:focus { opacity: 1; }
  .w-post-menu-btn:hover { background: rgba(29,155,240,0.1); color: #1d9bf0; }
  .w-post-menu-dropdown { position: absolute; right: 0; top: 34px; background: #16161e; border: 1px solid #2a2a3a; border-radius: 12px; min-width: 260px; z-index: 100; box-shadow: 0 0 8px rgba(0,0,0,0.3), 0 12px 36px rgba(0,0,0,0.5); overflow: hidden; padding: 4px 0; }
  .w-post-menu-dropdown button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; background: none; border: none; color: var(--wt1); font-size: 16px; cursor: pointer; text-align: left; font-family: inherit; transition: background 0.12s; }
  .w-post-menu-dropdown button:hover { background: rgba(255,255,255,0.06); }
  .w-post-menu-dropdown .w-menu-danger { color: #ef4444; }
  .w-post-menu-dropdown .w-menu-danger:hover { background: rgba(239,68,68,0.08); }
  .w-menu-divider { height: 1px; background: #2a2a3a; margin: 4px 0; }
  .w.light .w-post-menu-dropdown { background: #ffffff; border: 1px solid #dddfe2; box-shadow: 0 0 8px rgba(0,0,0,0.08), 0 12px 36px rgba(0,0,0,0.12); }
  .w.light .w-post-menu-dropdown button { color: #1c1e21; }
  .w.light .w-post-menu-dropdown button:hover { background: rgba(0,0,0,0.04); }
  .w.light .w-menu-divider { background: #dddfe2; }

  .w-comments { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--wbd); }
  .w-comment { padding: 6px 0; font-size: 15px; }
  .w-comment-author { color: var(--wgold); font-weight: 600; text-decoration: none; font-size: 14px; }
  .w-comment-text { color: var(--wt2); margin-left: 6px; }
  .w-comment-time { font-size: 13px; color: var(--wt3); margin-left: 6px; }
  .w-comment-input { display: flex; gap: 6px; margin-top: 8px; }
  .w-comment-input input { flex: 1; padding: 10px 14px; border: 1px solid var(--wbd); border-radius: 20px; background: var(--wc); color: var(--wt); font-size: 14px; outline: none; font-family: inherit; }
  .w-comment-input button { padding: 10px 16px; border: none; background: var(--wgold); color: #000; font-weight: 700; font-size: 13px; border-radius: 20px; cursor: pointer; font-family: inherit; }

  .w-section-title { font-size: 20px; font-weight: 800; margin-bottom: 16px; }
  .w-user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .w-user-card { padding: 20px; border-radius: 12px; background: var(--wcard); border: 1px solid var(--wbd); display: flex; flex-direction: column; align-items: center; text-align: center; }
  .w-user-card:hover { border-color: var(--wgold); }
  .w-user-name { font-weight: 700; color: var(--wgold); text-decoration: none; font-size: 16px; margin-top: 8px; }
  .w-user-real { font-size: 14px; color: var(--wt2); margin-top: 2px; }
  .w-user-bio { font-size: 13px; color: var(--wt3); margin-top: 6px; line-height: 1.3; }
  .w-user-foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .w-add-btn, .w-msg-btn { padding: 8px 16px; border-radius: 16px; border: none; background: var(--wgold); color: #000; font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; font-family: inherit; }
  .w-remove-btn { padding: 8px 16px; border-radius: 16px; border: 1px solid rgba(239,68,68,0.3); background: none; color: #ef4444; font-size: 13px; cursor: pointer; font-family: inherit; }
  .w-accept-btn { padding: 9px 18px; border-radius: 16px; border: none; background: #10b981; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit; }
  .w-decline-btn { padding: 9px 18px; border-radius: 16px; border: 1px solid var(--wbd); background: none; color: var(--wt3); font-size: 14px; cursor: pointer; font-family: inherit; }
  .w-req-actions { display: flex; gap: 8px; margin-top: 12px; }
  .w-request-card { border-color: #10b981; }

  .w-widget { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .w-widget h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
  .w-suggest-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
  .w-suggest-info { flex: 1; min-width: 0; }
  .w-suggest-name { font-size: 14px; font-weight: 600; color: var(--wgold); text-decoration: none; }
  .w-suggest-real { font-size: 13px; color: var(--wt3); }
  .w-connect-sm { padding: 8px 20px; border-radius: 20px; border: none; background: #e8940c; color: #0f1724; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; white-space: nowrap; font-family: inherit; }
  .w-connect-sm:hover { background: #d07e0a; }
  .w-accept-sm { border-color: #10b981; color: #10b981; font-size: 13px; width: auto; padding: 6px 12px; border-radius: 12px; }
  .w-footer { font-size: 13px; color: var(--wt3); }
  .w-footer a { color: var(--wt3); text-decoration: none; }
  .w-footer a:hover { color: var(--wgold); }
  .w-copyright { margin-top: 8px; font-size: 13px; }

  .w-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--wgold); color: #000; padding: 12px 26px; border-radius: 20px; font-weight: 700; font-size: 15px; z-index: 200; animation: slideUp 0.3s; }
  .w-empty { text-align: center; padding: 40px; color: var(--wt3); font-size: 16px; }

  @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

  
  

  @keyframes rocketUp {
    0% { transform: translateY(0) rotate(var(--rot, -20deg)); opacity: 1; }
    60% { opacity: 1; }
    100% { transform: translateY(-110vh) rotate(var(--rot, -20deg)); opacity: 0; }
  }





  @keyframes rxPop { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
  .w-bookmark-btn:hover { color: #eab308; }
  .w-bookmarked { color: #eab308 !important; }
  .w-edit-btn:hover { color: #10b981; }
  .w-edit-textarea { width: 100%; background: var(--wc); border: 1px solid var(--wbd); border-radius: 8px; color: var(--wt); padding: 12px; font: inherit; resize: vertical; }
  .w-edited-tag { font-size: 13px; color: var(--wt3); margin-left: 6px; }
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
  .w-trending-tag { color: var(--wgold); font-weight: 600; font-size: 16px; }
  .w-trending-count { color: var(--wt3); font-size: 14px; }
  .w-trending-rank { font-size: 11px; font-weight: 700; color: #3d4554; min-width: 16px; }
  .w-follow-sm { font-weight: 700; }
  .w-ad-block { border: 1px solid rgba(232,148,12,0.2); }
  .w-ad-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--wt3); margin-bottom: 8px; }
  .w-ad-img { width: 100%; border-radius: 8px; margin-bottom: 10px; }
  .w-ad-title { font-size: 15px; font-weight: 700; color: var(--wt); margin: 0 0 6px; }
  .w-ad-desc { font-size: 13px; color: var(--wt2); margin: 0 0 12px; line-height: 1.4; }
  .w-ad-cta { display: inline-block; padding: 8px 20px; border-radius: 20px; background: #e8940c; color: #0f1724; font-weight: 700; font-size: 14px; text-decoration: none; }
  .w-ad-cta:hover { background: #d07e0a; }
  .w-activity-header { display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px; }
  .w-activity-count { font-size:14px;color:var(--wt3,#606770); }
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
  .w-activity-action { font-size:15px;font-weight:600;color:var(--wt1,#e4e6ea); }
  .w-activity-preview { font-size:14px;color:var(--wt2,#8a8d91);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .w-activity-time { font-size:13px;color:var(--wt3,#606770);white-space:nowrap;flex-shrink:0; }
  .w-badge-count { background:var(--wgold);color:#000;font-size:13px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px; }
  .w-pending-label { font-size:13px;color:var(--wt3);border:1px solid var(--wbd);padding:4px 10px;border-radius:12px;white-space:nowrap; }
  .w-widget-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:12px; }
  .w-widget-head h3 { margin:0; }
  .w-show-more { background:none;border:none;color:var(--wgold);font-size:14px;font-weight:600;cursor:pointer;padding:0;font-family:inherit; }
  .w-show-more:hover { text-decoration:underline; }
  .w-pending-badge { font-size:13px;color:var(--wt3);border:1px solid var(--wbd);padding:5px 12px;border-radius:12px; }
  .w-notif-btn { position: relative; }
  .w-notif-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 3px; pointer-events: none; }
  .w-img-btn { background: none; border: none; color: var(--wt2); cursor: pointer; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; }
  .w-img-btn:hover { color: var(--wgold); background: rgba(255,255,255,0.06); }
  .w-img-preview { position: relative; margin: 8px 0; border-radius: 12px; overflow: hidden; max-height: 200px; }
  .w-img-preview img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; border: 1px solid var(--wbd); }
  .w-img-remove { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff; border: none; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
  .w-img-remove:hover { background: #ef4444; }

  /* Multi-media upload previews */
  .w-media-previews { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
  .w-media-thumb { position: relative; width: 100px; height: 100px; border-radius: 10px; overflow: hidden; border: 1px solid var(--wbd); background: var(--wcard); flex-shrink: 0; }
  .w-media-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .w-media-thumb-icon { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 8px; text-align: center; color: var(--wt2); gap: 4px; }
  .w-media-thumb-icon svg { opacity: 0.7; flex-shrink: 0; }
  .w-media-thumb-name { font-size: 10px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-all; color: var(--wt); }
  .w-media-thumb-size { font-size: 9px; color: var(--wt3); }
  .w-media-thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; border-radius: 10px; }
  .w-media-fail-overlay { background: rgba(239,68,68,0.3); }
  .w-media-spinner { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); border-top-color: var(--wgold); border-radius: 50%; animation: mediaSpin 0.7s linear infinite; }
  @keyframes mediaSpin { to { transform: rotate(360deg); } }
  .w-media-retry-btn { background: rgba(255,255,255,0.9); color: #ef4444; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .w-media-retry-btn:hover { background: #fff; }
  .w-media-uploading { opacity: 0.7; }
  .w-media-failed { border-color: #ef4444; }
  .w-media-count { font-size: 10px; color: var(--wgold); font-weight: 700; margin-left: 2px; }
  .w.light .w-media-thumb { border-color: var(--wbd); background: #f5f5f5; }
  .w.light .w-media-retry-btn { background: rgba(0,0,0,0.8); color: #fff; }
  .w.light .w-media-retry-btn:hover { background: #000; }

  .w-post-img { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .w-post-img img { width: 100%; max-height: 500px; object-fit: cover; border-radius: 12px; display: block; }

  /* ═══ MULTI-MEDIA RENDERING ═══ */
  .w-post-media { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .w-media-item { overflow: hidden; border-radius: 12px; }
  .w-media-item img { width: 100%; max-height: 500px; object-fit: cover; display: block; cursor: zoom-in; }

  /* 2-image grid: side by side */
  .w-media-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .w-media-grid-2 .w-media-item img { max-height: 300px; }

  /* 3-image grid: large left, two stacked right */
  .w-media-grid-3 { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; gap: 4px; }
  .w-media-grid-3 .w-media-item:first-child { grid-row: 1 / 3; }
  .w-media-grid-3 .w-media-item img { width: 100%; height: 100%; max-height: 400px; object-fit: cover; }

  /* 4+ image grid: 2x2 */
  .w-media-grid-4 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4px; }
  .w-media-grid-4 .w-media-item img { max-height: 240px; }

  /* Video */
  .w-media-video { border-radius: 12px; overflow: hidden; }
  .w-media-video video { width: 100%; max-height: 500px; border-radius: 12px; display: block; background: #000; }

  /* Document card */
  .w-media-doc { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 14px 16px; background: var(--wc, #111117); border: 1px solid var(--wbd); border-radius: 12px; text-decoration: none; color: var(--wt); transition: border-color 0.15s; }
  .w-media-doc:hover { border-color: var(--wgold); }
  .w-doc-icon { font-size: 28px; flex-shrink: 0; }
  .w-doc-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .w-doc-name { font-size: 15px; font-weight: 600; color: var(--wt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .w-doc-size { font-size: 13px; color: var(--wt2); margin-top: 2px; }
  .w-doc-dl { font-size: 22px; color: var(--wgold); flex-shrink: 0; font-weight: 700; }

  /* Audio player */
  .w-media-audio { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 12px 16px; background: var(--wc, #111117); border: 1px solid var(--wbd); border-radius: 12px; }
  .w-audio-icon { font-size: 22px; flex-shrink: 0; }
  .w-audio-name { font-size: 14px; font-weight: 600; color: var(--wt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 1; }
  .w-media-audio audio { flex: 1; min-width: 0; height: 36px; }

  /* Light theme overrides for media */
  .w.light .w-media-doc { background: #f0f2f5; border-color: #dddfe2; }
  .w.light .w-media-doc:hover { border-color: #d4a017; }
  .w.light .w-media-audio { background: #f0f2f5; border-color: #dddfe2; }
  .w.light .w-media-spinner { border-color: rgba(0,0,0,0.15); }

  .wc-sidebar-link { display: block; background: #141420; border: 1px solid #1e293b; border-radius: 14px; padding: 14px 16px; color: #f5a623; text-decoration: none; font-weight: 700; font-size: 16px; margin-bottom: 12px; text-align: center; transition: border-color 0.15s; }
  .wc-sidebar-link:hover { border-color: #f5a623; }
  .w-user-menu-wrap { position: relative; }
  .w-avatar-btn { cursor: pointer; border: none; background: linear-gradient(135deg, var(--wgold), #e09100); font-family: inherit; }
  .w-user-dropdown { position: absolute; right: 0; top: 44px; background: var(--wcard); border: 1px solid var(--wbd); border-radius: 14px; min-width: 200px; z-index: 200; box-shadow: 0 8px 32px rgba(0,0,0,0.4); overflow: hidden; }
  .w-ud-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; background: none; border: none; color: var(--wt); font-size: 16px; cursor: pointer; text-decoration: none; font-family: inherit; }
  .w-ud-item:hover { background: var(--whover); }
  .w-ud-divider { height: 1px; background: var(--wbd); margin: 4px 0; }
  .w-ud-danger { color: #ef4444 !important; }
  .w-ud-danger:hover { background: rgba(239,68,68,0.06) !important; }
  /* Milestone toggle */
  .w-milestone-btn { background: none; border: none; color: var(--wt2); cursor: pointer; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; }
  .w-milestone-btn:hover { color: var(--wgold); background: rgba(255,255,255,0.06); }
  .w-milestone-btn.active { color: var(--wgold); }

  /* Milestone form */
  .w-milestone-form { background: linear-gradient(135deg, rgba(245,166,35,0.08), rgba(245,166,35,0.02)); border: 1px solid rgba(245,166,35,0.2); border-radius: 12px; padding: 12px; margin: 8px 0; }
  .w-milestone-badge { font-size: 14px; font-weight: 700; color: var(--wgold); margin-bottom: 8px; }
  .w-milestone-row { display: flex; gap: 8px; }
  .w-milestone-select { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 8px; padding: 10px 12px; color: var(--wt); font-size: 15px; font-family: inherit; flex-shrink: 0; }
  .w-milestone-input { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 8px; padding: 10px 14px; color: var(--wt); font-size: 16px; font-family: inherit; flex: 1; }
  .w-milestone-input:focus, .w-milestone-select:focus { outline: none; border-color: var(--wgold); }
  .w-milestone-input::placeholder { color: var(--wt3); }

  /* Milestone card in feed */
  .w-milestone-card { display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, rgba(245,166,35,0.12), rgba(245,166,35,0.04)); border: 1px solid rgba(245,166,35,0.25); border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; }
  .w-milestone-icon { font-size: 22px; }
  .w-milestone-val { font-weight: 700; font-size: 18px; color: var(--wgold); flex: 1; }
  .w-milestone-type { font-size: 13px; color: var(--wt3); text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border: 1px solid var(--wbd); border-radius: 6px; }
  .w-emoji-backdrop { position: fixed; inset: 0; z-index: 49; }
  .w-emoji-picker { z-index: 50; }

  /* ============================================ */
  /* QUICK LINKS (mobile-only scrollable strip)   */
  /* ============================================ */
  .w-quick-links { display: none; }

  /* ============================================ */
  /* MOBILE BOTTOM NAV                            */
  /* ============================================ */
  .w-mobile-nav { display: none; }
  .w-create-sheet, .w-sheet-overlay { display: none; }

  /* ============================================ */
  /* TABLET                                       */
  /* ============================================ */
  @media (max-width: 1024px) {
    .w-sidebar-right { display: none; }
  }

  /* ============================================ */
  /* MOBILE FIRST — 768px and below               */
  /* ============================================ */
  @media (max-width: 768px) {
    /* Hide desktop elements */
    .w-sidebar-left { display: none; }
    .w-sidebar-right { display: none; }

    /* Quick links strip — scrollable chips */
    .w-quick-links {
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      border-bottom: 1px solid var(--wbd);
      background: var(--wbg);
    }
    .w-quick-links::-webkit-scrollbar { display: none; }
    .w-ql-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 8px 14px;
      border-radius: 20px;
      background: var(--whover);
      color: var(--wt2);
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      border: 1px solid var(--wbd);
      -webkit-tap-highlight-color: transparent;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .w-ql-chip:active { background: rgba(245,166,35,0.15); color: var(--wgold); border-color: var(--wgold); }
    .w-ql-badge {
      background: #ef4444;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      min-width: 14px;
      height: 14px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      margin-left: 2px;
    }

    /* Layout */
    .w-body { flex-direction: column; padding-bottom: 72px; height: auto; overflow: visible; }
    .w-main { border: none; padding: 0; min-width: 0; width: 100%; overflow-y: visible; height: auto; }

    /* Topbar — simplified */
    .w-topbar { position: sticky; top: 0; z-index: 100; }
    .w-topbar-inner { padding: 0 12px; gap: 8px; height: 50px; }
    .w-logo { font-size: 20px; font-weight: 800; }
    .w-logo span { display: none; }
    .w-search-wrap { flex: 1; max-width: none; }
    .w-search-wrap input { font-size: 14px; padding: 8px 12px 8px 34px; border-radius: 20px; height: 36px; }
    .w-topbar-btn { width: 34px; height: 34px; flex-shrink: 0; }
    .w-msg-topbar-btn { display: none; }
    .w-avatar-sm, .w-avatar-btn { width: 30px; height: 30px; font-size: 12px; }
    .w-user-dropdown { right: -4px; top: 40px; min-width: 200px; }

    /* Composer — full width, card style */
    .w-composer { margin: 0; border-radius: 0; border-left: none; border-right: none; padding: 12px 14px; }
    .w-composer-top { gap: 10px; }
    .w-composer-top .w-avatar-sm { display: none; }
    .w-composer-top textarea { font-size: 17px; min-height: 48px; padding: 8px 0; -webkit-appearance: none; -webkit-text-size-adjust: 100%; touch-action: manipulation; }
    .w-composer-bottom { gap: 6px; flex-wrap: nowrap; align-items: center; }
    .w-feed-tabs { order: -1; }
    .w-feed-tabs button { font-size: 14px; padding: 7px 14px; border-radius: 16px; }
    .w-post-btn { padding: 10px 20px; font-size: 15px; border-radius: 18px; margin-left: auto; }
    .w-char { display: none; }
    .w-img-btn, .w-milestone-btn, .w-emoji-btn { padding: 6px; }
    .w-img-preview { border-radius: 10px; margin: 8px 0; }
    .w-img-preview img { max-height: 200px; }

    /* Milestone form */
    .w-milestone-form { margin: 8px 0; padding: 10px; border-radius: 10px; }
    .w-milestone-row { flex-direction: column; gap: 8px; }
    .w-milestone-select { width: 100%; }

    /* Posts — edge to edge, no border radius */
    .w-post { border-radius: 0; border-left: none; border-right: none; margin-bottom: 0; border-bottom: 1px solid var(--wbd); padding: 14px 14px; }
    .w-post:hover { background: transparent; }
    .w-post-header { gap: 10px; }
    .w-avatar-md { width: 40px; height: 40px; font-size: 15px; }
    .w-post-body { font-size: 17px; line-height: 1.55; }
    .w-post-img img { border-radius: 10px; max-height: 400px; }
    .w-post-media { border-radius: 10px; }
    .w-media-item { border-radius: 10px; }
    .w-media-item img { max-height: 400px; }
    .w-media-video video { border-radius: 10px; max-height: 400px; }
    .w-media-grid-3 .w-media-item img { max-height: 300px; }
    .w-media-grid-4 .w-media-item img { max-height: 200px; }
    .w-media-doc { padding: 12px 14px; }
    .w-media-audio { padding: 10px 14px; }
    .w-milestone-card { padding: 10px 14px; border-radius: 10px; margin-bottom: 6px; }
    .w-milestone-val { font-size: 17px; }

    /* Post actions — spread evenly */
    .w-post-actions { padding: 8px 0 0; gap: 0; justify-content: space-around; }
    .w-action { -webkit-tap-highlight-color: transparent; padding: 8px 12px; border-radius: 8px; gap: 6px; font-size: 15px; }
    .w-action span { font-size: 15px; }

    /* Three-dot menu */
    .w-post-menu-wrap { position: static; }
    .w-post-menu { right: 14px; top: auto; min-width: 200px; }

    /* Comments */
    .w-comments { padding: 8px 0; }
    .w-comment-input { font-size: 16px; }

    /* Join CTA */
    .w-join-cta { margin: 0; border-radius: 0; padding: 32px 20px; }

    /* Hide emoji picker on mobile — native keyboard has emojis */
    .w-emoji-wrap { display: none; }

    /* Hide nav when keyboard open */
    .w:has(textarea:focus) .w-mobile-nav,
    .w:has(input:focus) .w-mobile-nav { opacity: 0; pointer-events: none; transition: opacity 0.15s; }
    .w:has(textarea:focus) .w-body,
    .w:has(input:focus) .w-body { padding-bottom: 0; }

    /* ================================ */
    /* MOBILE BOTTOM NAV               */
    /* ================================ */
    .w-mobile-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: #0a0a0f;
      border-top: 1px solid #1e1e2a;
      z-index: 200;
      align-items: center;
      justify-content: space-around;
      padding: 0 4px;
      padding-bottom: env(safe-area-inset-bottom, 0);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    .w-mn-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      color: var(--wt3);
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 8px;
      border: none;
      background: none;
      cursor: pointer;
      font-family: inherit;
      position: relative;
      -webkit-tap-highlight-color: transparent;
    }
    .w-mn-item.active { color: var(--wgold); }
    .w-mn-item:active { background: var(--whover); }
    .w-mn-badge {
      position: absolute;
      top: 2px;
      right: 4px;
      background: #ef4444;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }

    /* Centre create button */
    .w-mn-create {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--wgold);
      border: 3px solid #0a0a0f;
      color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      margin-top: -20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 2px 8px rgba(245,166,35,0.25);
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.15s;
    }
    .w-mn-create:active { transform: scale(0.92); }
    .w.light .w-mobile-nav { background: #ffffff; border-top: 1px solid #dddfe2; }
    .w.light .w-mn-create { border: 3px solid #ffffff; }

    /* ================================ */
    /* CREATE BOTTOM SHEET             */
    /* ================================ */
    .w-sheet-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      z-index: 300;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .w-create-sheet {
      display: flex;
      flex-direction: column;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--wcard);
      border-top-left-radius: 20px;
      border-top-right-radius: 20px;
      z-index: 301;
      padding: 8px 16px 24px;
      padding-bottom: calc(24px + env(safe-area-inset-bottom, 0));
      animation: sheetUp 0.25s ease-out;
    }
    @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .w-sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--wbd); margin: 4px auto 12px; }
    .w-sheet-title { font-size: 18px; font-weight: 700; margin-bottom: 12px; padding: 0 4px; }
    .w-sheet-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 8px;
      border-radius: 14px;
      text-decoration: none;
      color: inherit;
      background: none;
      border: none;
      width: 100%;
      font-family: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      text-align: left;
    }
    .w-sheet-item:active { background: var(--whover); }
    .w-sheet-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .w-sheet-label { flex: 1; }
    .w-sheet-name { font-weight: 600; font-size: 17px; }
    .w-sheet-desc { font-size: 14px; color: var(--wt3); margin-top: 2px; }
  }

  /* PWA install prompt */
    .w-pwa-prompt {
      position: fixed;
      bottom: 72px;
      left: 12px;
      right: 12px;
      background: var(--wcard);
      border: 1px solid var(--wbd);
      border-radius: 16px;
      padding: 14px 16px;
      z-index: 199;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      animation: sheetUp 0.3s ease-out;
    }
    .w-pwa-close { position: absolute; top: 10px; right: 12px; background: none; border: none; color: var(--wt3); font-size: 16px; cursor: pointer; }
    .w-pwa-content { display: flex; align-items: center; gap: 14px; }
    .w-pwa-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--wgold); color: #000; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .w-pwa-title { font-weight: 600; font-size: 16px; }
    .w-pwa-desc { font-size: 14px; color: var(--wt3); margin-top: 2px; }

  /* ============================================ */
  /* SMALL PHONES — 380px and below               */
  /* ============================================ */
  @media (max-width: 380px) {
    .w-topbar-inner { padding: 0 8px; }
    .w-logo { font-size: 18px; }
    .w-search-wrap input { font-size: 15px; height: 32px; }
    .w-post { padding: 12px 10px; }
    .w-post-body { font-size: 16px; }
    .w-action { -webkit-tap-highlight-color: transparent; padding: 6px 8px; }
    .w-mn-item { padding: 6px 8px; font-size: 11px; }
    .w-mn-create { width: 44px; height: 44px; }
  }

  /* Toast */
  .w-toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--wgold); color: #000; padding: 12px 26px; border-radius: 24px; font-size: 15px; font-weight: 600; z-index: 500; animation: toastIn 0.25s ease-out; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
  @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* Double-tap heart */
  .w-heart-anim { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; pointer-events: none; animation: heartPop 0.8s ease-out forwards; }
  @keyframes heartPop { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 30% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; } 60% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0; } }
  .w-post { position: relative; }

  /* Share button */
  .w-share-btn:hover { color: #3b82f6; }

  /* Loading skeletons */
  .w-skel-post { padding: 16px; border-bottom: 1px solid var(--wbd); }
  .w-skel-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
  .w-skel-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .w-skel { background: var(--wbd); border-radius: 6px; animation: shimmer 1.5s infinite; }
  .w-skel-av { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
  .w-skel-name { height: 14px; width: 120px; }
  .w-skel-handle { height: 10px; width: 80px; }
  .w-skel-body { height: 14px; width: 100%; margin-bottom: 8px; }
  .w-skel-body.short { width: 60%; }
  .w-skel-actions { display: flex; gap: 24px; margin-top: 12px; }
  .w-skel-act { height: 14px; width: 40px; }
  @keyframes shimmer { 0% { opacity: 0.3; } 50% { opacity: 0.6; } 100% { opacity: 0.3; } }

  /* Load more / feed end */
  .w-load-more { text-align: center; padding: 20px; color: var(--wt3); font-size: 15px; }
  .w-feed-end { text-align: center; padding: 24px; color: var(--wt3); font-size: 15px; font-weight: 500; border-top: 1px solid var(--wbd); }

  /* Empty state */
  .w-empty-state { text-align: center; padding: 48px 20px; }
  .w-empty-icon { color: var(--wt3); margin-bottom: 16px; }
  .w-empty-state h3 { font-size: 24px; font-weight: 600; margin: 0 0 8px; }
  .w-empty-state p { font-size: 16px; color: var(--wt3); margin: 0 0 24px; }
  .w-empty-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .w-empty-btn { padding: 12px 26px; border-radius: 24px; background: var(--wgold); color: #000; font-weight: 600; font-size: 15px; text-decoration: none; }
  .w-empty-btn.secondary { background: none; border: 1px solid var(--wbd); color: var(--wt2); }
  .w-empty-btn.secondary:hover { border-color: var(--wgold); color: var(--wgold); }

  /* ═══ LINK PREVIEWS ═══ */
  .w-link-preview { display: block; margin-top: 10px; border: 1px solid var(--wbd); border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; transition: border-color 0.15s; }
  .w-link-preview:hover { border-color: var(--wgold); }
  .w-lp-img { width: 100%; max-height: 200px; object-fit: cover; display: block; }
  .w-lp-text { padding: 10px 14px; }
  .w-lp-title { font-weight: 600; font-size: 16px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .w-lp-desc { font-size: 15px; color: var(--wt2); margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .w-lp-domain { font-size: 14px; color: var(--wt3); margin-top: 6px; }

  /* ═══ POLL FORM ═══ */
  .w-poll-form, .w-schedule-form { padding: 12px 0; border-top: 1px solid var(--wbd); margin-top: 10px; }
  .w-poll-badge { font-size: 15px; font-weight: 600; color: var(--wgold); margin-bottom: 10px; }
  .w-poll-q, .w-poll-opt, .w-sched-textarea, .w-sched-date { width: 100%; padding: 12px 14px; border: 1px solid var(--wbd); border-radius: 8px; background: var(--wb); color: var(--wt); font-size: 16px; font-family: inherit; box-sizing: border-box; }
  .w-poll-q { margin-bottom: 8px; }
  .w-poll-opt-row { display: flex; gap: 6px; margin-bottom: 6px; }
  .w-poll-opt { flex: 1; }
  .w-poll-opt-rm { background: none; border: none; color: var(--wt3); cursor: pointer; font-size: 16px; padding: 0 6px; }
  .w-poll-add { background: none; border: none; color: var(--wgold); cursor: pointer; font-size: 15px; font-weight: 500; padding: 6px 0; }
  .w-poll-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; gap: 10px; }
  .w-poll-ends { font-size: 15px; color: var(--wt2); display: flex; align-items: center; gap: 6px; }
  .w-poll-ends input { padding: 8px 10px; border: 1px solid var(--wbd); border-radius: 6px; background: var(--wb); color: var(--wt); font-size: 15px; }
  .w-poll-btn, .w-sched-btn { background: none; border: none; color: var(--wt2); cursor: pointer; padding: 4px; border-radius: 6px; transition: color 0.15s; }
  .w-poll-btn:hover, .w-sched-btn:hover { color: var(--wgold); }
  .w-poll-btn.active, .w-sched-btn.active { color: var(--wgold); }
  .w-sched-textarea { min-height: 50px; resize: none; margin-bottom: 8px; }

  /* ═══ MODALS ═══ */
  .w-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 500; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
  .w-modal { background: var(--wcard, #16161f); border: 1px solid var(--wbd, #1e1e2a); border-radius: 16px; width: 90%; max-width: 420px; max-height: 80vh; overflow-y: auto; }
  .w-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--wbd); }
  .w-modal-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: var(--wt, #e4e6ea); }
  .w-modal-close { background: none; border: none; color: var(--wt3); cursor: pointer; font-size: 18px; padding: 4px 8px; }
  .w-modal-loading, .w-modal-empty { padding: 32px; text-align: center; color: var(--wt3); font-size: 16px; }

  /* ═══ ANALYTICS ═══ */
  .w-analytics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--wbd); }
  .w-analytics-stat { padding: 20px 16px; text-align: center; background: var(--wcard, #16161f); }
  .w-analytics-num { font-size: 28px; font-weight: 700; color: var(--wgold); }
  .w-analytics-label { font-size: 14px; color: var(--wt3); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* ═══ LIKES LIST ═══ */
  .w-likes-list { padding: 8px 0; max-height: 400px; overflow-y: auto; }
  .w-likes-user { display: flex; align-items: center; gap: 12px; padding: 10px 20px; text-decoration: none; color: inherit; transition: background 0.1s; }
  .w-likes-user:hover { background: var(--whover); }
  .w-likes-info { display: flex; flex-direction: column; }
  .w-likes-name { font-weight: 600; font-size: 16px; }
  .w-likes-handle { font-size: 15px; color: var(--wt3); }
  .w-likes-clickable { cursor: pointer; }
  .w-likes-clickable:hover { text-decoration: underline; }

  /* ═══ REPOST BANNER ═══ */
  .w-repost-banner { width: 100%; display: flex; align-items: center; gap: 6px; padding: 0 0 8px 44px; font-size: 15px; color: #f97316; font-weight: 500; }
  .w-repost-banner svg { flex-shrink: 0; stroke: #f97316; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>