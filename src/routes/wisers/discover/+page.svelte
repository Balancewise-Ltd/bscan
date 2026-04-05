<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';
  import { timeAgo } from '$lib/utils/time';

  type Tab = 'for-you' | 'people' | 'content' | 'mentors';

  let theme = $state<'dark' | 'light'>('dark');
  let activeTab = $state<Tab>('for-you');
  let loading = $state(true);
  let loadingMore = $state(false);

  // Data
  let rankedPosts = $state<any[]>([]);
  let people = $state<any[]>([]);
  let contentPosts = $state<any[]>([]);
  let mentors = $state<any[]>([]);

  // Pagination
  let forYouPage = $state(1);
  let peoplePage = $state(1);
  let contentPage = $state(1);
  let mentorsPage = $state(1);

  // End of list flags
  let forYouEnd = $state(false);
  let peopleEnd = $state(false);
  let contentEnd = $state(false);
  let mentorsEnd = $state(false);

  // Follow states
  let followStates = $state<Record<string, boolean>>({});

  function initial(name: string): string {
    return (name || '?')[0].toUpperCase();
  }

  function avatarSrc(url: string | null | undefined): string | null {
    if (!url || url === '' || url === 'null') return null;
    if (url.startsWith('http')) return url;
    return 'https://api-bscan.balancewises.io/avatars/' + url;
  }

  function renderContent(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/#(\w+)/g, '<a href="/wisers/hashtag?tag=$1" class="dc-hashtag">#$1</a>')
      .replace(/@(\w+)/g, '<a href="/wisers/$1" class="dc-mention">@$1</a>');
  }

  function planLabel(plan: string | null | undefined): string {
    if (!plan) return '';
    const labels: Record<string, string> = {
      free: 'Free',
      starter: 'Starter',
      pro: 'Starter',
      enterprise: 'Enterprise'
    };
    return labels[plan] || plan;
  }

  onMount(async () => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) {
      theme = 'light';
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-wisers-theme', theme);
      document.body.style.background = theme === 'light' ? '#ffffff' : '#0a0a0f';
    }

    await loadTabData('for-you');
    loading = false;
  });

  async function loadTabData(tab: Tab, append = false) {
    if (!append) loading = true;
    else loadingMore = true;

    try {
      switch (tab) {
        case 'for-you': {
          const res = await api.getRankedFeed(forYouPage);
          const posts = res.posts || [];
          if (posts.length === 0) forYouEnd = true;
          rankedPosts = append ? [...rankedPosts, ...posts] : posts;
          break;
        }
        case 'people': {
          const res = await api.discoverPeople(peoplePage);
          const users = res.users || [];
          if (users.length === 0) peopleEnd = true;
          people = append ? [...people, ...users] : users;
          break;
        }
        case 'content': {
          const res = await api.discoverContent(contentPage);
          const posts = res.posts || [];
          if (posts.length === 0) contentEnd = true;
          contentPosts = append ? [...contentPosts, ...posts] : posts;
          break;
        }
        case 'mentors': {
          const res = await api.discoverMentors(mentorsPage);
          const list = res.mentors || [];
          if (list.length === 0) mentorsEnd = true;
          mentors = append ? [...mentors, ...list] : list;
          break;
        }
      }
    } catch (e) {
      console.error('Failed to load discover data:', e);
    }

    loading = false;
    loadingMore = false;
  }

  async function switchTab(tab: Tab) {
    if (activeTab === tab) return;
    activeTab = tab;

    // Only load if empty (first visit to tab)
    const isEmpty =
      (tab === 'for-you' && rankedPosts.length === 0) ||
      (tab === 'people' && people.length === 0) ||
      (tab === 'content' && contentPosts.length === 0) ||
      (tab === 'mentors' && mentors.length === 0);

    if (isEmpty) {
      await loadTabData(tab);
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    switch (activeTab) {
      case 'for-you':
        if (forYouEnd) return;
        forYouPage += 1;
        await loadTabData('for-you', true);
        break;
      case 'people':
        if (peopleEnd) return;
        peoplePage += 1;
        await loadTabData('people', true);
        break;
      case 'content':
        if (contentEnd) return;
        contentPage += 1;
        await loadTabData('content', true);
        break;
      case 'mentors':
        if (mentorsEnd) return;
        mentorsPage += 1;
        await loadTabData('mentors', true);
        break;
    }
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

  function formatNumber(n: number | null | undefined): string {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
  }
</script>

<svelte:head>
  <title>Discover | Wisers</title>
  <meta name="description" content="Discover new people, content, and mentors on Wisers." />
</svelte:head>

<div class="dc" class:light={theme === 'light'}>
  <!-- Header -->
  <header class="dc-header">
    <a href="/wisers" class="dc-back" aria-label="Back to feed">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <h1 class="dc-title">Discover</h1>
    <a href="/wisers/search" class="dc-search-btn" aria-label="Search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </a>
  </header>

  <!-- Tab Bar -->
  <div class="dc-tabs" role="tablist">
    <button class="dc-tab" class:active={activeTab === 'for-you'} onclick={() => switchTab('for-you')} role="tab" aria-selected={activeTab === 'for-you'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      For You
    </button>
    <button class="dc-tab" class:active={activeTab === 'people'} onclick={() => switchTab('people')} role="tab" aria-selected={activeTab === 'people'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      People
    </button>
    <button class="dc-tab" class:active={activeTab === 'content'} onclick={() => switchTab('content')} role="tab" aria-selected={activeTab === 'content'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      Content
    </button>
    <button class="dc-tab" class:active={activeTab === 'mentors'} onclick={() => switchTab('mentors')} role="tab" aria-selected={activeTab === 'mentors'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
      Mentors
    </button>
  </div>

  <!-- Content Area -->
  <div class="dc-body">
    {#if loading}
      <!-- Loading Skeletons -->
      <div class="dc-skeletons">
        {#each [1, 2, 3, 4, 5] as _}
          {#if activeTab === 'people' || activeTab === 'mentors'}
            <div class="dc-skel-card">
              <div class="dc-skel-row">
                <div class="dc-skel dc-skel-avatar"></div>
                <div class="dc-skel-col">
                  <div class="dc-skel dc-skel-name"></div>
                  <div class="dc-skel dc-skel-handle"></div>
                </div>
                <div class="dc-skel dc-skel-btn"></div>
              </div>
              <div class="dc-skel dc-skel-bio"></div>
              <div class="dc-skel dc-skel-bio-short"></div>
            </div>
          {:else}
            <div class="dc-skel-card">
              <div class="dc-skel-row">
                <div class="dc-skel dc-skel-avatar-sm"></div>
                <div class="dc-skel-col">
                  <div class="dc-skel dc-skel-name"></div>
                  <div class="dc-skel dc-skel-handle"></div>
                </div>
              </div>
              <div class="dc-skel dc-skel-text"></div>
              <div class="dc-skel dc-skel-text-short"></div>
              <div class="dc-skel dc-skel-text-shorter"></div>
              <div class="dc-skel-row dc-skel-stats">
                <div class="dc-skel dc-skel-stat"></div>
                <div class="dc-skel dc-skel-stat"></div>
                <div class="dc-skel dc-skel-stat"></div>
              </div>
            </div>
          {/if}
        {/each}
      </div>

    {:else if activeTab === 'for-you'}
      <!-- For You Feed -->
      {#if rankedPosts.length === 0}
        <div class="dc-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <p class="dc-empty-title">Nothing here yet</p>
          <p class="dc-empty-sub">Your personalised feed will populate as more people join Wisers.</p>
        </div>
      {:else}
        {#each rankedPosts as post}
          <a href="/wisers/{post.username}" class="dc-post-card">
            <div class="dc-post-header">
              <div class="dc-avatar-sm">
                {#if avatarSrc(post.avatar_url)}
                  <img src={avatarSrc(post.avatar_url)} alt="" />
                {:else}
                  {initial(post.display_name || post.username)}
                {/if}
              </div>
              <div class="dc-post-meta">
                <span class="dc-post-name">{post.display_name || post.username}</span>
                <span class="dc-post-handle">@{post.username}</span>
              </div>
              <span class="dc-post-dot">·</span>
              <span class="dc-post-time">{timeAgo(post.created_at)}</span>
            </div>
            <div class="dc-post-content">{@html renderContent(post.content)}</div>
            {#if post.image_url}
              <img src={post.image_url} alt="" class="dc-post-image" loading="lazy" />
            {/if}
            <div class="dc-post-stats">
              <span class="dc-stat">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                {formatNumber(post.like_count)}
              </span>
              <span class="dc-stat">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {formatNumber(post.comment_count)}
              </span>
              <span class="dc-stat">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
                {formatNumber(post.rocket_count)}
              </span>
            </div>
          </a>
        {/each}

        {#if !forYouEnd}
          <div class="dc-load-more-wrap">
            <button class="dc-load-more" onclick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        {/if}
      {/if}

    {:else if activeTab === 'people'}
      <!-- People Discovery -->
      {#if people.length === 0}
        <div class="dc-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p class="dc-empty-title">No suggestions yet</p>
          <p class="dc-empty-sub">We'll recommend people as the community grows.</p>
        </div>
      {:else}
        <div class="dc-people-grid">
          {#each people as user}
            <div class="dc-user-card">
              <a href="/wisers/{user.username}" class="dc-user-card-link">
                <div class="dc-user-top">
                  <div class="dc-avatar">
                    {#if avatarSrc(user.avatar_url)}
                      <img src={avatarSrc(user.avatar_url)} alt="" />
                    {:else}
                      {initial(user.display_name || user.name || user.username)}
                    {/if}
                  </div>
                  <div class="dc-user-info">
                    <div class="dc-user-name-row">
                      <span class="dc-user-name">{user.display_name || user.name || user.username}</span>
                      {#if user.plan && user.plan !== 'free'}
                        <span class="dc-plan-badge">{planLabel(user.plan)}</span>
                      {/if}
                    </div>
                    <span class="dc-user-handle">@{user.username}</span>
                  </div>
                </div>
                {#if user.bio}
                  <p class="dc-user-bio">{user.bio}</p>
                {/if}
              </a>
              <div class="dc-user-bottom">
                <div class="dc-user-meta">
                  {#if user.mutual_friends > 0}
                    <span class="dc-mutual">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      {user.mutual_friends} mutual{user.mutual_friends === 1 ? '' : 's'}
                    </span>
                  {/if}
                  {#if user.shared_communities > 0}
                    <span class="dc-mutual">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {user.shared_communities} shared group{user.shared_communities === 1 ? '' : 's'}
                    </span>
                  {/if}
                </div>
                {#if $auth.token && user.username !== $auth.user?.username}
                  <button
                    class="dc-follow-btn"
                    class:following={followStates[user.username]}
                    onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(user.username); }}
                  >
                    {followStates[user.username] ? 'Following' : 'Follow'}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if !peopleEnd}
          <div class="dc-load-more-wrap">
            <button class="dc-load-more" onclick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        {/if}
      {/if}

    {:else if activeTab === 'content'}
      <!-- Content Discovery -->
      {#if contentPosts.length === 0}
        <div class="dc-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <p class="dc-empty-title">No content to discover</p>
          <p class="dc-empty-sub">Posts from outside your network will appear here.</p>
        </div>
      {:else}
        {#each contentPosts as post}
          <a href="/wisers/{post.username}" class="dc-post-card">
            <div class="dc-post-header">
              <div class="dc-avatar-sm">
                {#if avatarSrc(post.avatar_url)}
                  <img src={avatarSrc(post.avatar_url)} alt="" />
                {:else}
                  {initial(post.display_name || post.username)}
                {/if}
              </div>
              <div class="dc-post-meta">
                <span class="dc-post-name">{post.display_name || post.username}</span>
                <span class="dc-post-handle">@{post.username}</span>
              </div>
              <span class="dc-post-dot">·</span>
              <span class="dc-post-time">{timeAgo(post.created_at)}</span>
            </div>
            <div class="dc-post-content">{@html renderContent(post.content)}</div>
            {#if post.image_url}
              <img src={post.image_url} alt="" class="dc-post-image" loading="lazy" />
            {/if}
            <div class="dc-post-stats">
              <span class="dc-stat">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                {formatNumber(post.like_count)}
              </span>
              <span class="dc-stat">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {formatNumber(post.comment_count)}
              </span>
              <span class="dc-stat">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
                {formatNumber(post.rocket_count)}
              </span>
            </div>
          </a>
        {/each}

        {#if !contentEnd}
          <div class="dc-load-more-wrap">
            <button class="dc-load-more" onclick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        {/if}
      {/if}

    {:else if activeTab === 'mentors'}
      <!-- Mentor Discovery -->
      {#if mentors.length === 0}
        <div class="dc-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
          <p class="dc-empty-title">No mentors available</p>
          <p class="dc-empty-sub">Check back soon or create your own mentorship profile.</p>
          <a href="/wisers/mentorship" class="dc-cta-link">Go to Mentorship</a>
        </div>
      {:else}
        <div class="dc-mentors-grid">
          {#each mentors as mentor}
            <div class="dc-mentor-card">
              <div class="dc-mentor-top">
                <div class="dc-avatar">
                  {#if avatarSrc(mentor.avatar_url)}
                    <img src={avatarSrc(mentor.avatar_url)} alt="" />
                  {:else}
                    {initial(mentor.display_name || mentor.username)}
                  {/if}
                </div>
                <div class="dc-mentor-info">
                  <a href="/wisers/{mentor.username}" class="dc-mentor-name">{mentor.display_name || mentor.username}</a>
                  <span class="dc-mentor-handle">@{mentor.username}</span>
                </div>
                {#if mentor.available !== false}
                  <span class="dc-available-badge">Available</span>
                {/if}
              </div>

              {#if mentor.expertise}
                <div class="dc-mentor-field">
                  <span class="dc-mentor-label">Expertise</span>
                  <span class="dc-mentor-value">{mentor.expertise}</span>
                </div>
              {/if}

              {#if mentor.experience_level}
                <div class="dc-mentor-field">
                  <span class="dc-mentor-label">Level</span>
                  <span class="dc-level-pill">{mentor.experience_level}</span>
                </div>
              {/if}

              {#if mentor.monthly_revenue}
                <div class="dc-mentor-field">
                  <span class="dc-mentor-label">Revenue</span>
                  <span class="dc-mentor-value">{mentor.monthly_revenue}</span>
                </div>
              {/if}

              {#if mentor.bio}
                <p class="dc-mentor-bio">{mentor.bio}</p>
              {/if}

              <div class="dc-mentor-actions">
                {#if $auth.token && mentor.user_id !== $auth.user?.id}
                  <a href="/wisers/mentorship" class="dc-request-btn">Request</a>
                  <a href="/wisers/messages?user={mentor.username}" class="dc-message-btn">Message</a>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if !mentorsEnd}
          <div class="dc-load-more-wrap">
            <button class="dc-load-more" onclick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  /* ── Base ── */
  .dc {
    --dc-bg: #0a0a0f;
    --dc-card: #111117;
    --dc-t: #e4e6ea;
    --dc-t2: #8a8d91;
    --dc-t3: #606770;
    --dc-bd: #1e1e2a;
    --dc-gold: #f5a623;
    --dc-gold-dim: rgba(245, 166, 35, 0.12);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--dc-t);
    background: var(--dc-bg);
    min-height: 100vh;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  .dc.light {
    --dc-bg: #ffffff;
    --dc-card: #ffffff;
    --dc-t: #1c1e21;
    --dc-t2: #606770;
    --dc-t3: #8a8d91;
    --dc-bd: #dddfe2;
    --dc-gold: #d4a017;
    --dc-gold-dim: rgba(212, 160, 23, 0.1);
  }
  :global(body) { margin: 0; }
  :global(.page) { padding: 0 !important; }

  /* ── Header ── */
  .dc-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--dc-card);
    border-bottom: 1px solid var(--dc-bd);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    height: 56px;
  }
  .dc-back {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--dc-t2);
    text-decoration: none;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .dc-back:hover { background: var(--dc-gold-dim); color: var(--dc-t); }
  .dc-title {
    flex: 1;
    font-size: 24px;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.3px;
  }
  .dc-search-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--dc-t2);
    text-decoration: none;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .dc-search-btn:hover { background: var(--dc-gold-dim); color: var(--dc-t); }

  /* ── Tab Bar ── */
  .dc-tabs {
    display: flex;
    border-bottom: 1px solid var(--dc-bd);
    background: var(--dc-card);
    position: sticky;
    top: 56px;
    z-index: 90;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .dc-tabs::-webkit-scrollbar { display: none; }
  .dc-tab {
    flex: 1;
    min-width: 0;
    padding: 12px 8px;
    background: none;
    border: none;
    border-bottom: 2.5px solid transparent;
    color: var(--dc-t3);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .dc-tab:hover { color: var(--dc-t); background: rgba(255, 255, 255, 0.03); }
  .dc-tab.active {
    color: var(--dc-gold);
    border-bottom-color: var(--dc-gold);
  }
  .dc-tab.active svg { stroke: var(--dc-gold); }

  /* ── Body ── */
  .dc-body {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 12px 80px;
  }

  /* ── Empty States ── */
  .dc-empty {
    text-align: center;
    padding: 64px 24px;
    color: var(--dc-t3);
  }
  .dc-empty svg { margin-bottom: 16px; }
  .dc-empty-title {
    font-size: 19px;
    font-weight: 600;
    color: var(--dc-t2);
    margin: 0 0 6px;
  }
  .dc-empty-sub {
    font-size: 16px;
    color: var(--dc-t3);
    margin: 0;
    line-height: 1.5;
  }
  .dc-cta-link {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 24px;
    background: var(--dc-gold);
    color: #000;
    font-weight: 700;
    font-size: 16px;
    border-radius: 24px;
    text-decoration: none;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .dc-cta-link:hover { opacity: 0.9; }

  /* ── Avatar ── */
  .dc-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--dc-gold), #e09100);
    color: #000;
    font-weight: 800;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .dc-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .dc-avatar-sm {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--dc-gold), #e09100);
    color: #000;
    font-weight: 800;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .dc-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }

  /* ── Post Cards ── */
  .dc-post-card {
    display: block;
    padding: 16px;
    border-bottom: 1px solid var(--dc-bd);
    text-decoration: none;
    color: inherit;
    transition: background 0.1s;
  }
  .dc-post-card:hover { background: rgba(255, 255, 255, 0.02); }
  .dc-post-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .dc-post-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
  }
  .dc-post-name { font-weight: 700; font-size: 17px; color: var(--dc-t); }
  .dc-post-handle { font-size: 15px; color: var(--dc-t3); }
  .dc-post-dot { color: var(--dc-t3); font-size: 14px; }
  .dc-post-time { font-size: 14px; color: var(--dc-t3); }
  .dc-post-content {
    font-size: 16px;
    line-height: 1.6;
    color: var(--dc-t);
    white-space: pre-wrap;
    word-break: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .dc-post-image {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
    border-radius: 12px;
    margin-top: 10px;
  }
  .dc-post-stats {
    display: flex;
    gap: 20px;
    margin-top: 12px;
    padding-top: 8px;
  }
  .dc-stat {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 15px;
    color: var(--dc-t3);
  }
  .dc-stat svg { opacity: 0.7; }

  :global(.dc-hashtag) { color: var(--dc-gold, #f5a623); text-decoration: none; font-weight: 600; }
  :global(.dc-hashtag:hover) { text-decoration: underline; }
  :global(.dc-mention) { color: #3b82f6; text-decoration: none; font-weight: 600; }
  :global(.dc-mention:hover) { text-decoration: underline; }

  /* ── People Cards ── */
  .dc-people-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding-top: 16px;
  }
  .dc-user-card {
    background: var(--dc-card);
    border: 1px solid var(--dc-bd);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .dc-user-card:hover { border-color: var(--dc-t3); }
  .dc-user-card-link {
    display: block;
    padding: 16px 16px 8px;
    text-decoration: none;
    color: inherit;
  }
  .dc-user-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .dc-user-info { flex: 1; min-width: 0; }
  .dc-user-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .dc-user-name {
    font-weight: 700;
    font-size: 17px;
    color: var(--dc-t);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dc-user-handle {
    font-size: 15px;
    color: var(--dc-t3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dc-plan-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--dc-gold);
    background: var(--dc-gold-dim);
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }
  .dc-user-bio {
    font-size: 15px;
    color: var(--dc-t2);
    line-height: 1.45;
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .dc-user-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 14px;
    gap: 8px;
  }
  .dc-user-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .dc-mutual {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--dc-t3);
  }
  .dc-mutual svg { opacity: 0.6; flex-shrink: 0; }

  /* ── Follow Button ── */
  .dc-follow-btn {
    padding: 7px 18px;
    border-radius: 20px;
    border: none;
    background: var(--dc-gold);
    color: #000;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .dc-follow-btn:hover { opacity: 0.9; }
  .dc-follow-btn.following {
    background: transparent;
    border: 1px solid var(--dc-bd);
    color: var(--dc-t2);
  }
  .dc-follow-btn.following:hover {
    border-color: #ef4444;
    color: #ef4444;
  }

  /* ── Mentor Cards ── */
  .dc-mentors-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding-top: 16px;
  }
  .dc-mentor-card {
    background: var(--dc-card);
    border: 1px solid var(--dc-bd);
    border-radius: 12px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 0.15s;
  }
  .dc-mentor-card:hover { border-color: var(--dc-t3); }
  .dc-mentor-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dc-mentor-info { flex: 1; min-width: 0; }
  .dc-mentor-name {
    font-weight: 700;
    font-size: 17px;
    color: var(--dc-t);
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dc-mentor-name:hover { color: var(--dc-gold); }
  .dc-mentor-handle {
    font-size: 15px;
    color: var(--dc-t3);
    display: block;
  }
  .dc-available-badge {
    font-size: 11px;
    font-weight: 600;
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    padding: 3px 10px;
    border-radius: 12px;
    flex-shrink: 0;
  }
  .dc-mentor-field {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 15px;
  }
  .dc-mentor-label {
    color: var(--dc-t3);
    font-weight: 500;
    flex-shrink: 0;
  }
  .dc-mentor-value {
    color: var(--dc-t2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dc-level-pill {
    font-size: 11px;
    color: var(--dc-gold);
    background: var(--dc-gold-dim);
    padding: 3px 10px;
    border-radius: 10px;
    text-transform: capitalize;
    font-weight: 500;
  }
  .dc-mentor-bio {
    font-size: 15px;
    color: var(--dc-t2);
    line-height: 1.45;
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .dc-mentor-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .dc-request-btn {
    background: var(--dc-gold);
    color: #000;
    border: none;
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
    text-align: center;
    transition: opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .dc-request-btn:hover { opacity: 0.9; }
  .dc-message-btn {
    background: none;
    border: 1px solid var(--dc-bd);
    color: var(--dc-t2);
    padding: 8px 18px;
    border-radius: 20px;
    font-size: 15px;
    font-family: inherit;
    text-decoration: none;
    text-align: center;
    transition: border-color 0.15s, color 0.15s;
  }
  .dc-message-btn:hover { border-color: var(--dc-t3); color: var(--dc-t); }

  /* ── Load More ── */
  .dc-load-more-wrap {
    display: flex;
    justify-content: center;
    padding: 24px 0 16px;
  }
  .dc-load-more {
    padding: 10px 32px;
    border-radius: 24px;
    border: 1px solid var(--dc-bd);
    background: none;
    color: var(--dc-t2);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .dc-load-more:hover { border-color: var(--dc-gold); color: var(--dc-gold); }
  .dc-load-more:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Loading Skeletons ── */
  .dc-skeletons { padding: 16px 0; }
  .dc-skel-card {
    padding: 16px;
    border-bottom: 1px solid var(--dc-bd);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dc-skel-row { display: flex; align-items: center; gap: 10px; }
  .dc-skel-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .dc-skel {
    background: var(--dc-bd);
    border-radius: 6px;
    animation: dcShimmer 1.5s ease-in-out infinite;
  }
  .dc-skel-avatar { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; }
  .dc-skel-avatar-sm { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
  .dc-skel-name { height: 14px; width: 120px; }
  .dc-skel-handle { height: 10px; width: 80px; }
  .dc-skel-btn { height: 32px; width: 72px; border-radius: 16px; flex-shrink: 0; }
  .dc-skel-bio { height: 12px; width: 100%; }
  .dc-skel-bio-short { height: 12px; width: 65%; }
  .dc-skel-text { height: 12px; width: 100%; }
  .dc-skel-text-short { height: 12px; width: 85%; }
  .dc-skel-text-shorter { height: 12px; width: 50%; }
  .dc-skel-stats { margin-top: 4px; gap: 16px; }
  .dc-skel-stat { height: 12px; width: 40px; }

  @keyframes dcShimmer {
    0% { opacity: 0.25; }
    50% { opacity: 0.5; }
    100% { opacity: 0.25; }
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .dc-body {
      padding: 0 0 calc(80px + env(safe-area-inset-bottom, 0));
    }
    .dc-post-card {
      padding: 14px 16px;
    }
    .dc-people-grid {
      grid-template-columns: 1fr;
      padding: 12px 12px 0;
      gap: 10px;
    }
    .dc-mentors-grid {
      grid-template-columns: 1fr;
      padding: 12px 12px 0;
      gap: 10px;
    }
    .dc-header {
      padding: 0 12px;
    }
    .dc-tab {
      font-size: 12px;
      padding: 11px 6px;
      gap: 4px;
    }
    .dc-tab svg { width: 14px; height: 14px; }
    .dc-skeletons { padding: 12px; }
    .dc-skel-card { padding: 14px 4px; }
    .dc-load-more-wrap { padding: 20px 12px; }
  }

  @media (max-width: 380px) {
    .dc-tab svg { display: none; }
    .dc-tab { font-size: 12px; padding: 11px 4px; }
    .dc-user-bottom { flex-direction: column; align-items: flex-start; gap: 10px; }
    .dc-follow-btn { width: 100%; text-align: center; }
  }

  /* ── iOS safe inputs ── */
  :global(input, textarea, select) { font-size: 16px !important; -webkit-text-size-adjust: 100%; }
</style>
