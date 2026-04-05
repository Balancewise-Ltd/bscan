<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';
  import { timeAgo } from '$lib/utils/time';

  type MilestonePost = {
    id: number;
    content: string;
    milestone_type: string;
    milestone_value: string;
    created_at: string;
    user: {
      id: string;
      name: string;
      username: string;
      avatar_url?: string;
    };
  };

  type LeaderboardEntry = {
    userId: string;
    name: string;
    username: string;
    avatar_url?: string;
    milestoneCount: number;
    latestType: string;
    latestValue: string;
    latestDate: string;
    bestValue: number;
  };

  let theme = $state<'dark' | 'light'>('dark');
  let loading = $state(true);
  let milestonePosts = $state<MilestonePost[]>([]);
  let leaderboard = $state<LeaderboardEntry[]>([]);
  let recentMilestones = $state<MilestonePost[]>([]);
  let activeFilter = $state<'all' | 'month' | 'week'>('all');
  let feedPage = $state(1);
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let toast = $state('');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(msg: string) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast = ''; }, 2500);
  }

  const milestoneLabels: Record<string, string> = {
    revenue: 'Revenue',
    followers: 'Followers',
    savings: 'Savings',
    investment: 'Investment',
    clients: 'Clients',
    sales: 'Sales'
  };

  const milestoneIcons: Record<string, string> = {
    revenue: '\u{1F4B0}',
    followers: '\u{1F465}',
    savings: '\u{1F3E6}',
    investment: '\u{1F4C8}',
    clients: '\u{1F91D}',
    sales: '\u{1F6D2}'
  };

  function getRankDisplay(rank: number): string {
    if (rank === 1) return '\u{1F451}';
    if (rank === 2) return '\u{1F948}';
    if (rank === 3) return '\u{1F949}';
    return '#' + rank;
  }

  function getRankClass(rank: number): string {
    if (rank === 1) return 'lb-rank-gold';
    if (rank === 2) return 'lb-rank-silver';
    if (rank === 3) return 'lb-rank-bronze';
    return '';
  }

  function formatMilestoneValue(type: string, value: string): string {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (type === 'revenue' || type === 'savings' || type === 'investment' || type === 'sales') {
      if (num >= 1000000) return '\u{00A3}' + (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return '\u{00A3}' + (num / 1000).toFixed(1) + 'K';
      return '\u{00A3}' + num.toLocaleString();
    }
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  }

  function getFilteredPosts(posts: MilestonePost[], filter: string): MilestonePost[] {
    if (filter === 'all') return posts;
    const now = new Date();
    const cutoff = new Date();
    if (filter === 'month') {
      cutoff.setMonth(now.getMonth() - 1);
    } else if (filter === 'week') {
      cutoff.setDate(now.getDate() - 7);
    }
    return posts.filter(p => {
      const d = new Date(p.created_at.endsWith('Z') || p.created_at.includes('+') ? p.created_at : p.created_at + 'Z');
      return d >= cutoff;
    });
  }

  function buildLeaderboard(posts: MilestonePost[]): LeaderboardEntry[] {
    const userMap = new Map<string, LeaderboardEntry>();

    for (const post of posts) {
      if (!post.user || !post.milestone_type) continue;

      const existing = userMap.get(post.user.id);
      const numVal = parseFloat(post.milestone_value) || 0;

      if (existing) {
        existing.milestoneCount++;
        const existingDate = new Date(existing.latestDate);
        const postDate = new Date(post.created_at);
        if (postDate > existingDate) {
          existing.latestType = post.milestone_type;
          existing.latestValue = post.milestone_value;
          existing.latestDate = post.created_at;
        }
        if (numVal > existing.bestValue) {
          existing.bestValue = numVal;
        }
      } else {
        userMap.set(post.user.id, {
          userId: post.user.id,
          name: post.user.name || post.user.username,
          username: post.user.username,
          avatar_url: post.user.avatar_url,
          milestoneCount: 1,
          latestType: post.milestone_type,
          latestValue: post.milestone_value,
          latestDate: post.created_at,
          bestValue: numVal
        });
      }
    }

    return Array.from(userMap.values()).sort((a, b) => {
      if (b.bestValue !== a.bestValue) return b.bestValue - a.bestValue;
      return b.milestoneCount - a.milestoneCount;
    });
  }

  let filteredLeaderboard = $derived(() => {
    const filtered = getFilteredPosts(milestonePosts, activeFilter);
    return buildLeaderboard(filtered);
  });

  let filteredRecent = $derived(() => {
    const filtered = getFilteredPosts(milestonePosts, activeFilter);
    return filtered.slice(0, 6);
  });

  async function loadMilestones() {
    loading = true;
    try {
      const allPosts: MilestonePost[] = [];
      let page = 1;
      let keepGoing = true;
      while (keepGoing && page <= 10) {
        const res = await api.getMilestoneFeed(page);
        const posts = res.posts || [];
        if (posts.length === 0) {
          keepGoing = false;
        } else {
          allPosts.push(...posts);
          page++;
          if (posts.length < 20) keepGoing = false;
        }
      }
      milestonePosts = allPosts;
      leaderboard = buildLeaderboard(allPosts);
      recentMilestones = allPosts.slice(0, 6);
    } catch (err) {
      console.error('Failed to load milestones:', err);
    }
    loading = false;
  }

  function handleRowClick(username: string) {
    goto('/wisers/' + username);
  }

  function handleRowKeydown(e: KeyboardEvent, username: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goto('/wisers/' + username);
    }
  }

  function getInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  onMount(async () => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') {
      theme = 'light';
      document.documentElement.setAttribute('data-wisers-theme', 'light');
    }
    await loadMilestones();
  });
</script>

<svelte:head>
  <title>Revenue Milestone Leaderboard | Wisers</title>
  <meta name="description" content="See the top wealth builders on Wisers ranked by their revenue milestones and achievements." />
</svelte:head>

<div class="lb {theme === 'light' ? 'light' : ''}" data-wisers-theme={theme}>
  <!-- Top Bar -->
  <div class="lb-topbar">
    <div class="lb-topbar-inner">
      <a href="/wisers" class="lb-back-btn" aria-label="Back to feed">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
      </a>
      <h1 class="lb-title">{'\u{1F3C6}'} Milestone Leaderboard</h1>
      {#if $auth.token}
        <button class="lb-share-cta" onclick={() => goto('/wisers')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Share Milestone
        </button>
      {/if}
    </div>
  </div>

  <div class="lb-container">
    <!-- Filter Tabs -->
    <div class="lb-filters">
      <button
        class="lb-filter-tab {activeFilter === 'all' ? 'active' : ''}"
        onclick={() => { activeFilter = 'all'; }}
      >All Time</button>
      <button
        class="lb-filter-tab {activeFilter === 'month' ? 'active' : ''}"
        onclick={() => { activeFilter = 'month'; }}
      >This Month</button>
      <button
        class="lb-filter-tab {activeFilter === 'week' ? 'active' : ''}"
        onclick={() => { activeFilter = 'week'; }}
      >This Week</button>
    </div>

    {#if loading}
      <!-- Skeleton Loading -->
      <div class="lb-card">
        <div class="lb-card-header">
          <div class="lb-skel lb-skel-title"></div>
        </div>
        {#each Array(5) as _}
          <div class="lb-row-skel">
            <div class="lb-skel lb-skel-rank"></div>
            <div class="lb-skel lb-skel-avatar"></div>
            <div class="lb-skel-info">
              <div class="lb-skel lb-skel-name"></div>
              <div class="lb-skel lb-skel-handle"></div>
            </div>
            <div class="lb-skel lb-skel-badge"></div>
          </div>
        {/each}
      </div>
    {:else if filteredLeaderboard().length === 0}
      <div class="lb-card">
        <div class="lb-empty">
          <span class="lb-empty-icon">{'\u{1F3C6}'}</span>
          <p class="lb-empty-title">No milestones yet</p>
          <p class="lb-empty-desc">Be the first to share a revenue milestone and claim the top spot!</p>
          {#if $auth.token}
            <button class="lb-empty-cta" onclick={() => goto('/wisers')}>Share Your First Milestone</button>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Podium (Top 3) -->
      {#if filteredLeaderboard().length >= 3}
        <div class="lb-podium">
          <!-- 2nd Place -->
          <div class="lb-podium-slot lb-podium-silver" onclick={() => handleRowClick(filteredLeaderboard()[1].username)} role="button" tabindex="0" onkeydown={(e) => handleRowKeydown(e, filteredLeaderboard()[1].username)}>
            <div class="lb-podium-rank">{'\u{1F948}'}</div>
            <div class="lb-podium-avatar lb-avatar-silver">
              {#if filteredLeaderboard()[1].avatar_url}
                <img src={filteredLeaderboard()[1].avatar_url} alt={filteredLeaderboard()[1].name} />
              {:else}
                {getInitial(filteredLeaderboard()[1].name)}
              {/if}
            </div>
            <div class="lb-podium-name">{filteredLeaderboard()[1].name}</div>
            <div class="lb-podium-value">{formatMilestoneValue(filteredLeaderboard()[1].latestType, filteredLeaderboard()[1].latestValue)}</div>
            <div class="lb-podium-type">{milestoneIcons[filteredLeaderboard()[1].latestType] || '\u{1F4B0}'} {milestoneLabels[filteredLeaderboard()[1].latestType] || filteredLeaderboard()[1].latestType}</div>
            <div class="lb-podium-bar lb-bar-silver"></div>
          </div>

          <!-- 1st Place -->
          <div class="lb-podium-slot lb-podium-gold" onclick={() => handleRowClick(filteredLeaderboard()[0].username)} role="button" tabindex="0" onkeydown={(e) => handleRowKeydown(e, filteredLeaderboard()[0].username)}>
            <div class="lb-podium-rank">{'\u{1F451}'}</div>
            <div class="lb-podium-avatar lb-avatar-gold">
              {#if filteredLeaderboard()[0].avatar_url}
                <img src={filteredLeaderboard()[0].avatar_url} alt={filteredLeaderboard()[0].name} />
              {:else}
                {getInitial(filteredLeaderboard()[0].name)}
              {/if}
            </div>
            <div class="lb-podium-name">{filteredLeaderboard()[0].name}</div>
            <div class="lb-podium-value">{formatMilestoneValue(filteredLeaderboard()[0].latestType, filteredLeaderboard()[0].latestValue)}</div>
            <div class="lb-podium-type">{milestoneIcons[filteredLeaderboard()[0].latestType] || '\u{1F4B0}'} {milestoneLabels[filteredLeaderboard()[0].latestType] || filteredLeaderboard()[0].latestType}</div>
            <div class="lb-podium-bar lb-bar-gold"></div>
          </div>

          <!-- 3rd Place -->
          <div class="lb-podium-slot lb-podium-bronze" onclick={() => handleRowClick(filteredLeaderboard()[2].username)} role="button" tabindex="0" onkeydown={(e) => handleRowKeydown(e, filteredLeaderboard()[2].username)}>
            <div class="lb-podium-rank">{'\u{1F949}'}</div>
            <div class="lb-podium-avatar lb-avatar-bronze">
              {#if filteredLeaderboard()[2].avatar_url}
                <img src={filteredLeaderboard()[2].avatar_url} alt={filteredLeaderboard()[2].name} />
              {:else}
                {getInitial(filteredLeaderboard()[2].name)}
              {/if}
            </div>
            <div class="lb-podium-name">{filteredLeaderboard()[2].name}</div>
            <div class="lb-podium-value">{formatMilestoneValue(filteredLeaderboard()[2].latestType, filteredLeaderboard()[2].latestValue)}</div>
            <div class="lb-podium-type">{milestoneIcons[filteredLeaderboard()[2].latestType] || '\u{1F4B0}'} {milestoneLabels[filteredLeaderboard()[2].latestType] || filteredLeaderboard()[2].latestType}</div>
            <div class="lb-podium-bar lb-bar-bronze"></div>
          </div>
        </div>
      {/if}

      <!-- Full Leaderboard Table -->
      <div class="lb-card">
        <div class="lb-card-header">
          <h2 class="lb-card-title">{'\u{1F4CA}'} Rankings</h2>
          <span class="lb-card-count">{filteredLeaderboard().length} builders</span>
        </div>

        <div class="lb-table">
          <div class="lb-table-head">
            <span class="lb-th lb-th-rank">Rank</span>
            <span class="lb-th lb-th-user">Builder</span>
            <span class="lb-th lb-th-milestone">Latest Milestone</span>
            <span class="lb-th lb-th-count">Total</span>
          </div>

          {#each filteredLeaderboard() as entry, i}
            <div
              class="lb-row {getRankClass(i + 1)}"
              onclick={() => handleRowClick(entry.username)}
              onkeydown={(e) => handleRowKeydown(e, entry.username)}
              role="button"
              tabindex="0"
            >
              <span class="lb-cell lb-cell-rank">
                <span class="lb-rank-badge {getRankClass(i + 1)}">{getRankDisplay(i + 1)}</span>
              </span>

              <span class="lb-cell lb-cell-user">
                <span class="lb-user-avatar {i < 3 ? getRankClass(i + 1) + '-border' : ''}">
                  {#if entry.avatar_url}
                    <img src={entry.avatar_url} alt={entry.name} />
                  {:else}
                    {getInitial(entry.name)}
                  {/if}
                </span>
                <span class="lb-user-info">
                  <span class="lb-user-name">{entry.name}</span>
                  <span class="lb-user-handle">@{entry.username}</span>
                </span>
              </span>

              <span class="lb-cell lb-cell-milestone">
                <span class="lb-milestone-badge">
                  <span class="lb-milestone-icon">{milestoneIcons[entry.latestType] || '\u{1F4B0}'}</span>
                  <span class="lb-milestone-info">
                    <span class="lb-milestone-val">{formatMilestoneValue(entry.latestType, entry.latestValue)}</span>
                    <span class="lb-milestone-type">{milestoneLabels[entry.latestType] || entry.latestType}</span>
                  </span>
                </span>
              </span>

              <span class="lb-cell lb-cell-count">
                <span class="lb-count-num">{entry.milestoneCount}</span>
                <span class="lb-count-label">{entry.milestoneCount === 1 ? 'milestone' : 'milestones'}</span>
              </span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Recent Milestones Cards -->
      {#if filteredRecent().length > 0}
        <div class="lb-recent-section">
          <h2 class="lb-section-title">{'\u{2728}'} Recent Milestones</h2>
          <div class="lb-recent-grid">
            {#each filteredRecent() as post}
              <div class="lb-recent-card" onclick={() => handleRowClick(post.user.username)} role="button" tabindex="0" onkeydown={(e) => handleRowKeydown(e, post.user.username)}>
                <div class="lb-recent-header">
                  <span class="lb-recent-avatar">
                    {#if post.user.avatar_url}
                      <img src={post.user.avatar_url} alt={post.user.name} />
                    {:else}
                      {getInitial(post.user.name)}
                    {/if}
                  </span>
                  <span class="lb-recent-user">
                    <span class="lb-recent-name">{post.user.name}</span>
                    <span class="lb-recent-time">{timeAgo(post.created_at)}</span>
                  </span>
                </div>
                <div class="lb-recent-milestone-badge">
                  <span class="lb-recent-icon">{milestoneIcons[post.milestone_type] || '\u{1F4B0}'}</span>
                  <span class="lb-recent-val">{formatMilestoneValue(post.milestone_type, post.milestone_value)}</span>
                  <span class="lb-recent-type">{milestoneLabels[post.milestone_type] || post.milestone_type}</span>
                </div>
                {#if post.content}
                  <p class="lb-recent-content">{post.content.length > 120 ? post.content.slice(0, 120) + '...' : post.content}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>

  {#if toast}
    <div class="lb-toast">{toast}</div>
  {/if}
</div>

<style>
  /* Theme Variables */
  .lb {
    --lbg: #0a0a0f;
    --lcard: #16161f;
    --lt: #e4e6ea;
    --lt2: #8a8d91;
    --lt3: #606770;
    --lbd: #1e1e2a;
    --lgold: #f5a623;
    --lhover: rgba(255,255,255,0.04);
    --lsilver: #c0c0c0;
    --lbronze: #cd7f32;

    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--lt);
    background: var(--lbg);
    min-height: 100vh;
    padding-bottom: 80px;
  }

  .lb.light {
    --lbg: #ffffff;
    --lcard: #ffffff;
    --lt: #1c1e21;
    --lt2: #606770;
    --lt3: #8a8d91;
    --lbd: #dddfe2;
    --lgold: #d4a017;
    --lhover: rgba(0,0,0,0.04);
    --lsilver: #a8a8a8;
    --lbronze: #b5651d;
  }

  :global([data-wisers-theme="light"]) .lb {
    --lbg: #ffffff;
    --lcard: #ffffff;
    --lt: #1c1e21;
    --lt2: #606770;
    --lt3: #8a8d91;
    --lbd: #dddfe2;
    --lgold: #d4a017;
    --lhover: rgba(0,0,0,0.04);
    --lsilver: #a8a8a8;
    --lbronze: #b5651d;
  }

  /* Top Bar */
  .lb-topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--lcard);
    border-bottom: 1px solid var(--lbd);
    backdrop-filter: blur(12px);
  }

  .lb-topbar-inner {
    max-width: 800px;
    margin: 0 auto;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .lb-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: none;
    border: none;
    color: var(--lt2);
    cursor: pointer;
    text-decoration: none;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }

  .lb-back-btn:hover {
    background: var(--lhover);
    color: var(--lt);
  }

  .lb-title {
    font-size: 24px;
    font-weight: 800;
    margin: 0;
    flex: 1;
    letter-spacing: -0.3px;
  }

  .lb-share-cta {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 24px;
    border: none;
    background: var(--lgold);
    color: #000;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: opacity 0.15s, transform 0.15s;
  }

  .lb-share-cta:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }

  .lb-share-cta:active {
    transform: scale(0.98);
  }

  /* Container */
  .lb-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px 16px;
  }

  /* Filter Tabs */
  .lb-filters {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .lb-filters::-webkit-scrollbar {
    display: none;
  }

  .lb-filter-tab {
    padding: 8px 20px;
    border-radius: 24px;
    border: 1px solid var(--lbd);
    background: none;
    color: var(--lt2);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .lb-filter-tab:hover {
    border-color: var(--lgold);
    color: var(--lgold);
  }

  .lb-filter-tab.active {
    background: var(--lgold);
    border-color: var(--lgold);
    color: #000;
  }

  /* Podium */
  .lb-podium {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
    padding: 20px 0 0;
  }

  .lb-podium-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s;
    flex: 1;
    max-width: 180px;
  }

  .lb-podium-slot:hover {
    transform: translateY(-4px);
  }

  .lb-podium-rank {
    font-size: 28px;
    margin-bottom: 8px;
    line-height: 1;
  }

  .lb-podium-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 20px;
    color: #000;
    overflow: hidden;
    margin-bottom: 8px;
    border: 3px solid var(--lbd);
    background: var(--lgold);
  }

  .lb-podium-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lb-avatar-gold {
    border-color: var(--lgold);
    box-shadow: 0 0 20px rgba(245, 166, 35, 0.35);
  }

  .lb-avatar-silver {
    border-color: var(--lsilver);
    box-shadow: 0 0 16px rgba(192, 192, 192, 0.25);
  }

  .lb-avatar-bronze {
    border-color: var(--lbronze);
    box-shadow: 0 0 16px rgba(205, 127, 50, 0.25);
  }

  .lb-podium-gold .lb-podium-avatar {
    width: 68px;
    height: 68px;
    font-size: 24px;
  }

  .lb-podium-name {
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    margin-bottom: 2px;
  }

  .lb-podium-value {
    font-size: 18px;
    font-weight: 800;
    color: var(--lgold);
    text-align: center;
  }

  .lb-podium-type {
    font-size: 11px;
    color: var(--lt3);
    text-align: center;
    margin-bottom: 12px;
  }

  .lb-podium-bar {
    width: 100%;
    border-radius: 8px 8px 0 0;
    min-height: 20px;
  }

  .lb-bar-gold {
    background: linear-gradient(180deg, rgba(245, 166, 35, 0.3), rgba(245, 166, 35, 0.08));
    height: 80px;
    border: 1px solid rgba(245, 166, 35, 0.3);
    border-bottom: none;
  }

  .lb-bar-silver {
    background: linear-gradient(180deg, rgba(192, 192, 192, 0.2), rgba(192, 192, 192, 0.05));
    height: 56px;
    border: 1px solid rgba(192, 192, 192, 0.2);
    border-bottom: none;
  }

  .lb-bar-bronze {
    background: linear-gradient(180deg, rgba(205, 127, 50, 0.2), rgba(205, 127, 50, 0.05));
    height: 40px;
    border: 1px solid rgba(205, 127, 50, 0.2);
    border-bottom: none;
  }

  /* Card */
  .lb-card {
    background: var(--lcard);
    border: 1px solid var(--lbd);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .lb-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--lbd);
  }

  .lb-card-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .lb-card-count {
    font-size: 15px;
    color: var(--lt3);
    font-weight: 500;
  }

  /* Table */
  .lb-table {
    display: flex;
    flex-direction: column;
  }

  .lb-table-head {
    display: flex;
    align-items: center;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--lbd);
  }

  .lb.light .lb-table-head {
    background: rgba(0, 0, 0, 0.02);
  }

  .lb-th {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--lt3);
  }

  .lb-th-rank { width: 60px; flex-shrink: 0; }
  .lb-th-user { flex: 1; min-width: 0; }
  .lb-th-milestone { width: 160px; flex-shrink: 0; }
  .lb-th-count { width: 80px; flex-shrink: 0; text-align: center; }

  /* Row */
  .lb-row {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .lb.light .lb-row {
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  }

  .lb-row:last-child {
    border-bottom: none;
  }

  .lb-row:hover {
    background: var(--lhover);
  }

  .lb-row.lb-rank-gold {
    background: rgba(245, 166, 35, 0.04);
  }
  .lb-row.lb-rank-gold:hover {
    background: rgba(245, 166, 35, 0.08);
  }

  .lb-row.lb-rank-silver {
    background: rgba(192, 192, 192, 0.03);
  }
  .lb-row.lb-rank-silver:hover {
    background: rgba(192, 192, 192, 0.06);
  }

  .lb-row.lb-rank-bronze {
    background: rgba(205, 127, 50, 0.03);
  }
  .lb-row.lb-rank-bronze:hover {
    background: rgba(205, 127, 50, 0.06);
  }

  .lb-cell { display: flex; align-items: center; }
  .lb-cell-rank { width: 60px; flex-shrink: 0; }
  .lb-cell-user { flex: 1; min-width: 0; gap: 10px; }
  .lb-cell-milestone { width: 160px; flex-shrink: 0; }
  .lb-cell-count { width: 80px; flex-shrink: 0; flex-direction: column; align-items: center; justify-content: center; }

  /* Rank Badge */
  .lb-rank-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 14px;
    font-weight: 800;
    color: var(--lt3);
    background: rgba(255, 255, 255, 0.04);
  }

  .lb.light .lb-rank-badge {
    background: rgba(0, 0, 0, 0.04);
  }

  .lb-rank-badge.lb-rank-gold {
    font-size: 20px;
    background: rgba(245, 166, 35, 0.12);
  }

  .lb-rank-badge.lb-rank-silver {
    font-size: 20px;
    background: rgba(192, 192, 192, 0.12);
  }

  .lb-rank-badge.lb-rank-bronze {
    font-size: 20px;
    background: rgba(205, 127, 50, 0.12);
  }

  /* User Avatar */
  .lb-user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--lgold);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 15px;
    flex-shrink: 0;
    overflow: hidden;
    border: 2px solid transparent;
  }

  .lb-user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lb-rank-gold-border {
    border-color: var(--lgold);
    box-shadow: 0 0 8px rgba(245, 166, 35, 0.3);
  }

  .lb-rank-silver-border {
    border-color: var(--lsilver);
    box-shadow: 0 0 8px rgba(192, 192, 192, 0.2);
  }

  .lb-rank-bronze-border {
    border-color: var(--lbronze);
    box-shadow: 0 0 8px rgba(205, 127, 50, 0.2);
  }

  .lb-user-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .lb-user-name {
    font-size: 16px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lb-user-handle {
    font-size: 14px;
    color: var(--lt3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Milestone Badge */
  .lb-milestone-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(245, 166, 35, 0.08);
    border: 1px solid rgba(245, 166, 35, 0.15);
  }

  .lb-milestone-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .lb-milestone-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .lb-milestone-val {
    font-size: 15px;
    font-weight: 800;
    color: var(--lgold);
    white-space: nowrap;
  }

  .lb-milestone-type {
    font-size: 10px;
    color: var(--lt3);
    text-transform: capitalize;
    white-space: nowrap;
  }

  /* Count */
  .lb-count-num {
    font-size: 18px;
    font-weight: 800;
    color: var(--lgold);
    line-height: 1;
  }

  .lb-count-label {
    font-size: 10px;
    color: var(--lt3);
  }

  /* Recent Milestones Section */
  .lb-recent-section {
    margin-top: 8px;
  }

  .lb-section-title {
    font-size: 22px;
    font-weight: 800;
    margin: 0 0 16px;
  }

  .lb-recent-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .lb-recent-card {
    background: var(--lcard);
    border: 1px solid var(--lbd);
    border-radius: 14px;
    padding: 16px;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
  }

  .lb-recent-card:hover {
    border-color: var(--lgold);
    transform: translateY(-2px);
  }

  .lb-recent-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .lb-recent-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--lgold);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .lb-recent-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lb-recent-user {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .lb-recent-name {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lb-recent-time {
    font-size: 11px;
    color: var(--lt3);
  }

  .lb-recent-milestone-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(245, 166, 35, 0.12), rgba(245, 166, 35, 0.04));
    border: 1px solid rgba(245, 166, 35, 0.2);
    margin-bottom: 10px;
  }

  .lb-recent-icon {
    font-size: 18px;
  }

  .lb-recent-val {
    font-size: 18px;
    font-weight: 800;
    color: var(--lgold);
  }

  .lb-recent-type {
    font-size: 14px;
    color: var(--lt2);
    text-transform: capitalize;
  }

  .lb-recent-content {
    font-size: 15px;
    color: var(--lt2);
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Empty State */
  .lb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    text-align: center;
  }

  .lb-empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .lb-empty-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .lb-empty-desc {
    font-size: 16px;
    color: var(--lt3);
    margin: 0 0 20px;
    max-width: 320px;
  }

  .lb-empty-cta {
    padding: 10px 24px;
    border-radius: 24px;
    border: none;
    background: var(--lgold);
    color: #000;
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }

  .lb-empty-cta:hover {
    opacity: 0.9;
  }

  /* Skeleton Loading */
  .lb-row-skel {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .lb-skel {
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    animation: lbShimmer 1.5s infinite;
    border-radius: 6px;
  }

  .lb.light .lb-skel {
    background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%);
    background-size: 200% 100%;
  }

  .lb-skel-title { width: 140px; height: 20px; margin: 16px 20px; }
  .lb-skel-rank { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; }
  .lb-skel-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
  .lb-skel-info { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .lb-skel-name { width: 120px; height: 14px; }
  .lb-skel-handle { width: 80px; height: 12px; }
  .lb-skel-badge { width: 100px; height: 28px; border-radius: 8px; flex-shrink: 0; }

  @keyframes lbShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Toast */
  .lb-toast {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--lgold);
    color: #000;
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 15px;
    z-index: 200;
    animation: lbSlideUp 0.3s;
    white-space: nowrap;
  }

  @keyframes lbSlideUp {
    from { transform: translateX(-50%) translateY(20px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .lb-topbar-inner {
      padding: 10px 14px;
    }

    .lb-title {
      font-size: 16px;
    }

    .lb-share-cta {
      padding: 6px 12px;
      font-size: 12px;
    }

    .lb-share-cta svg {
      display: none;
    }

    .lb-container {
      padding: 14px 10px;
    }

    .lb-podium {
      gap: 6px;
      padding: 12px 0 0;
    }

    .lb-podium-rank {
      font-size: 22px;
    }

    .lb-podium-avatar {
      width: 44px;
      height: 44px;
      font-size: 16px;
    }

    .lb-podium-gold .lb-podium-avatar {
      width: 54px;
      height: 54px;
      font-size: 20px;
    }

    .lb-podium-name {
      font-size: 12px;
    }

    .lb-podium-value {
      font-size: 14px;
    }

    .lb-podium-type {
      font-size: 10px;
    }

    .lb-bar-gold { height: 60px; }
    .lb-bar-silver { height: 40px; }
    .lb-bar-bronze { height: 28px; }

    .lb-table-head {
      display: none;
    }

    .lb-row {
      padding: 12px 14px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .lb-cell-rank {
      width: 36px;
    }

    .lb-cell-user {
      flex: 1;
      min-width: 0;
    }

    .lb-cell-milestone {
      width: auto;
      margin-left: 46px;
    }

    .lb-cell-count {
      width: auto;
      flex-direction: row;
      gap: 4px;
      margin-left: auto;
    }

    .lb-count-num {
      font-size: 14px;
    }

    .lb-count-label {
      font-size: 11px;
    }

    .lb-user-avatar {
      width: 36px;
      height: 36px;
      font-size: 14px;
    }

    .lb-user-name {
      font-size: 13px;
    }

    .lb-recent-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .lb-recent-card {
      padding: 14px;
    }
  }

  @media (max-width: 380px) {
    .lb-title {
      font-size: 14px;
    }

    .lb-share-cta {
      padding: 5px 10px;
      font-size: 11px;
    }

    .lb-podium-avatar {
      width: 38px;
      height: 38px;
      font-size: 14px;
    }

    .lb-podium-gold .lb-podium-avatar {
      width: 46px;
      height: 46px;
      font-size: 17px;
    }

    .lb-milestone-badge {
      padding: 3px 6px;
      gap: 4px;
    }

    .lb-milestone-val {
      font-size: 12px;
    }
  }

  /* Tap feedback for mobile */
  .lb-row:active,
  .lb-podium-slot:active,
  .lb-recent-card:active {
    opacity: 0.85;
  }

  /* Accessibility */
  .lb-row:focus-visible,
  .lb-podium-slot:focus-visible,
  .lb-recent-card:focus-visible {
    outline: 2px solid var(--lgold);
    outline-offset: -2px;
  }

  /* No text selection on interactive elements */
  .lb-row,
  .lb-podium-slot,
  .lb-recent-card {
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
</style>
