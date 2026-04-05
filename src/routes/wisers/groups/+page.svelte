<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';
  import { timeAgo } from '$lib/utils/time';
  import { goto } from '$app/navigation';

  let groups = $state<any[]>([]);
  let friendsList = $state<any[]>([]);
  let searchQuery = $state('');
  let activeGroup = $state<number | null>(null);
  let messages = $state<any[]>([]);
  let newMsg = $state('');
  let loading = $state(true);
  let loadingMessages = $state(false);
  let sending = $state(false);
  let showEmoji = $state(false);
  let showCreateModal = $state(false);
  let showAddMember = $state(false);
  let addMemberUsername = $state('');
  let addingMember = $state(false);
  let newGroupName = $state('');
  let selectedMembers = $state<string[]>([]);
  let creating = $state(false);
  let msgPage = $state(1);
  let hasMoreMessages = $state(false);
  let loadingMore = $state(false);
  let theme = $state<'dark' | 'light'>('dark');
  let pollInterval: any;

  const emojis = ['😀','😂','🤣','😍','🥰','😎','🤩','🥳','😭','😤','🔥','💯','👏','🙌','💪','🚀','⭐','💡','✅','❌','👀','💬','❤️','💙','💚','💛','🧡','💜','🖤','🤍','👍','👎','🎉','🎊','🏆','💎','🌟','⚡','🎯','🔑'];

  const filteredGroups = $derived(
    searchQuery.trim()
      ? groups.filter(g =>
          (g.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (g.members || []).some((m: any) =>
            (m.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
      : groups
  );

  const activeGroupData = $derived(groups.find(g => g.id === activeGroup) || null);

  const availableFriends = $derived(
    friendsList.filter(f =>
      !selectedMembers.includes(f.username) &&
      f.username !== $auth.user?.username
    )
  );

  const addableFriends = $derived(
    activeGroupData
      ? friendsList.filter(f => {
          const currentMembers = (activeGroupData.members || []).map((m: any) => m.username);
          return !currentMembers.includes(f.username);
        })
      : []
  );

  onMount(async () => {
    if (typeof document !== 'undefined') document.body.classList.add('wisers-page');
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') {
      theme = 'light';
      document.documentElement.setAttribute('data-wisers-theme', 'light');
    }
    await loadGroups();
    loading = false;

    pollInterval = setInterval(async () => {
      await loadGroups();
      if (activeGroup) await loadMessages(activeGroup, false);
    }, 10000);
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') document.body.classList.remove('wisers-page');
    if (pollInterval) clearInterval(pollInterval);
  });

  function scrollBottom() {
    setTimeout(() => {
      const el = document.getElementById('grp-msg-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 150);
  }

  async function loadGroups() {
    try {
      const res = await api.getGroupChats();
      groups = res.groups || [];
    } catch {}
    try {
      const res = await api.getFriends();
      friendsList = res.friends || [];
    } catch {}
  }

  async function loadMessages(groupId: number, scroll = true) {
    loadingMessages = true;
    try {
      const res = await api.getGroupMessages(groupId, 1);
      messages = res.messages || [];
      msgPage = 1;
      hasMoreMessages = (res.messages || []).length >= 20;
      if (scroll) scrollBottom();
    } catch {}
    loadingMessages = false;
  }

  async function loadMoreMessages() {
    if (!activeGroup || loadingMore || !hasMoreMessages) return;
    loadingMore = true;
    try {
      const nextPage = msgPage + 1;
      const res = await api.getGroupMessages(activeGroup, nextPage);
      const older = res.messages || [];
      if (older.length > 0) {
        messages = [...older, ...messages];
        msgPage = nextPage;
        hasMoreMessages = older.length >= 20;
      } else {
        hasMoreMessages = false;
      }
    } catch {}
    loadingMore = false;
  }

  async function selectGroup(groupId: number) {
    activeGroup = groupId;
    await loadMessages(groupId);
  }

  async function send() {
    if (!newMsg.trim() || sending || !activeGroup) return;
    sending = true;
    try {
      await api.sendGroupMessage(activeGroup, newMsg.trim());
      newMsg = '';
      showEmoji = false;
      await loadMessages(activeGroup);
    } catch {}
    sending = false;
  }

  async function createGroup() {
    if (!newGroupName.trim() || selectedMembers.length === 0 || creating) return;
    creating = true;
    try {
      const res = await api.createGroupChat(newGroupName.trim(), selectedMembers);
      showCreateModal = false;
      newGroupName = '';
      selectedMembers = [];
      await loadGroups();
      if (res?.id) await selectGroup(res.id);
    } catch (e: any) {
      alert(e.message || 'Could not create group');
    }
    creating = false;
  }

  function toggleMember(username: string) {
    if (selectedMembers.includes(username)) {
      selectedMembers = selectedMembers.filter(u => u !== username);
    } else {
      selectedMembers = [...selectedMembers, username];
    }
  }

  async function handleAddMember() {
    if (!addMemberUsername.trim() || !activeGroup || addingMember) return;
    addingMember = true;
    try {
      await api.addGroupMember(activeGroup, addMemberUsername.trim());
      addMemberUsername = '';
      showAddMember = false;
      await loadGroups();
    } catch (e: any) {
      alert(e.message || 'Could not add member');
    }
    addingMember = false;
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-wisers-theme', theme);
    localStorage.setItem('wisers-theme', theme);
  }

  function timeFull(d: string) {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function initial(name: string) {
    return (name || '?')[0].toUpperCase();
  }

  function groupInitials(group: any): string {
    const members = group.members || [];
    if (members.length === 0) return '?';
    if (members.length === 1) return initial(members[0].display_name || members[0].username);
    return initial(members[0].display_name || members[0].username) +
           initial(members[1].display_name || members[1].username);
  }

  function memberCount(group: any): number {
    return (group.members || []).length;
  }

  function closeEmojiOnOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.g-emoji-wrap')) {
      showEmoji = false;
    }
  }
</script>

<svelte:head>
  <title>Group Chats — Wisers</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="g" class:light={theme === 'light'} onclick={closeEmojiOnOutside}>
  <!-- Top bar -->
  <header class="g-top">
    <a href="/wisers" class="g-back" aria-label="Back to Wisers">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <a href="/wisers" class="g-logo">W<span>isers</span></a>
    <h1 class="g-title">Group Chats</h1>
    <div class="g-top-right">
      <button class="g-theme-btn" onclick={toggleTheme} aria-label="Toggle theme">
        {#if theme === 'dark'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        {/if}
      </button>
    </div>
  </header>

  <div class="g-body" class:has-active={activeGroup !== null}>
    <!-- Groups sidebar -->
    <div class="g-sidebar">
      <div class="g-sidebar-header">
        <input type="text" class="g-search" placeholder="Search groups..." bind:value={searchQuery} />
        <button class="g-new-btn" onclick={() => { showCreateModal = true; }} title="New group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div class="g-list">
        {#if loading}
          <div class="g-empty">
            <div class="g-skeleton"></div>
            <div class="g-skeleton short"></div>
            <div class="g-skeleton"></div>
          </div>
        {:else if groups.length === 0}
          <div class="g-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:0.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>No group chats yet</p>
            <p class="g-empty-sub">Create a group to start chatting with friends</p>
            <button class="g-create-empty-btn" onclick={() => { showCreateModal = true; }}>
              + New Group
            </button>
          </div>
        {:else}
          {#each filteredGroups as group (group.id)}
            <div
              class="g-item"
              class:active={activeGroup === group.id}
              role="button"
              tabindex="0"
              onclick={() => selectGroup(group.id)}
              onkeydown={(e) => { if (e.key === 'Enter') selectGroup(group.id); }}
            >
              <div class="g-item-avatar">
                <span class="g-item-initials">{groupInitials(group)}</span>
              </div>
              <div class="g-item-body">
                <div class="g-item-top">
                  <span class="g-item-name">{group.name}</span>
                  {#if group.created_at}
                    <span class="g-item-time">{timeAgo(group.created_at)}</span>
                  {/if}
                </div>
                <div class="g-item-meta">
                  {memberCount(group)} member{memberCount(group) !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          {/each}
          {#if filteredGroups.length === 0 && searchQuery.trim()}
            <div class="g-empty">
              <p>No groups match "{searchQuery}"</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Chat area -->
    <div class="g-chat">
      {#if !activeGroup}
        <div class="g-chat-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.12">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h2>Group Chats</h2>
          <p>Select a group or create a new one</p>
        </div>
      {:else}
        <!-- Chat header -->
        {#if activeGroupData}
          <div class="g-chat-header">
            <button class="g-chat-back" onclick={() => { activeGroup = null; messages = []; }} aria-label="Back to groups list">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="g-chat-avatar">
              <span>{groupInitials(activeGroupData)}</span>
            </div>
            <div class="g-chat-info">
              <div class="g-chat-name">{activeGroupData.name}</div>
              <div class="g-chat-members">
                {(activeGroupData.members || []).map((m: any) => m.display_name || m.username).join(', ')}
              </div>
            </div>
            <button class="g-add-member-btn" onclick={() => { showAddMember = !showAddMember; }} title="Add member">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            </button>
          </div>

          {#if showAddMember}
            <div class="g-add-member-bar">
              {#if addableFriends.length > 0}
                <div class="g-add-friends-list">
                  {#each addableFriends as friend}
                    <button
                      class="g-add-friend-item"
                      onclick={async () => {
                        if (!activeGroup || addingMember) return;
                        addingMember = true;
                        try {
                          await api.addGroupMember(activeGroup, friend.username);
                          showAddMember = false;
                          await loadGroups();
                        } catch (e: any) {
                          alert(e.message || 'Could not add member');
                        }
                        addingMember = false;
                      }}
                      disabled={addingMember}
                    >
                      <span class="g-add-friend-avatar">{initial(friend.display_name || friend.username)}</span>
                      <span class="g-add-friend-name">{friend.display_name || friend.username}</span>
                      <span class="g-add-friend-plus">+</span>
                    </button>
                  {/each}
                </div>
              {/if}
              <div class="g-add-member-row">
                <input
                  type="text"
                  bind:value={addMemberUsername}
                  placeholder="Or enter username..."
                  onkeydown={(e) => { if (e.key === 'Enter') handleAddMember(); }}
                />
                <button onclick={handleAddMember} disabled={addingMember || !addMemberUsername.trim()}>
                  {addingMember ? '...' : 'Add'}
                </button>
              </div>
            </div>
          {/if}
        {/if}

        <!-- Messages -->
        <div class="g-messages" id="grp-msg-scroll">
          {#if loadingMessages}
            <div class="g-msg-loading">Loading messages...</div>
          {:else if messages.length === 0}
            <div class="g-msg-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:0.15">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p>No messages yet. Start the conversation!</p>
            </div>
          {:else}
            {#if hasMoreMessages}
              <button class="g-load-more" onclick={loadMoreMessages} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load older messages'}
              </button>
            {/if}
            {#each messages as msg (msg.id)}
              <div class="g-msg" class:mine={msg.sender_id === $auth.user?.id || msg.username === $auth.user?.username}>
                {#if msg.sender_id !== $auth.user?.id && msg.username !== $auth.user?.username}
                  <div class="g-msg-sender-avatar">{initial(msg.display_name || msg.username)}</div>
                {/if}
                <div class="g-msg-content">
                  {#if msg.sender_id !== $auth.user?.id && msg.username !== $auth.user?.username}
                    <div class="g-msg-sender-name">{msg.display_name || msg.username}</div>
                  {/if}
                  <div class="g-msg-bubble">
                    <div class="g-msg-text">{msg.content}</div>
                    <span class="g-msg-time">{timeFull(msg.created_at)}</span>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <!-- Input bar -->
        <div class="g-input-bar">
          <div class="g-emoji-wrap">
            <button class="g-emoji-btn" onclick={(e) => { e.stopPropagation(); showEmoji = !showEmoji; }} type="button">😀</button>
            {#if showEmoji}
              <div class="g-emoji-picker">
                {#each emojis as e}
                  <button class="g-emoji-item" onclick={() => { newMsg += e; showEmoji = false; }} type="button">{e}</button>
                {/each}
              </div>
            {/if}
          </div>
          <input
            type="text"
            class="g-input"
            bind:value={newMsg}
            placeholder="Type a message..."
            onkeydown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <button class="g-send" onclick={send} disabled={sending || !newMsg.trim()} aria-label="Send message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Create group modal -->
{#if showCreateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="g-modal-overlay" class:light={theme === 'light'} onclick={() => { showCreateModal = false; newGroupName = ''; selectedMembers = []; }}>
    <div class="g-modal" onclick={(e) => { e.stopPropagation(); }}>
      <div class="g-modal-header">
        <h2>Create Group Chat</h2>
        <button class="g-modal-close" onclick={() => { showCreateModal = false; newGroupName = ''; selectedMembers = []; }} aria-label="Close modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="g-modal-body">
        <label class="g-modal-label" for="group-name-input">Group Name</label>
        <input
          id="group-name-input"
          type="text"
          class="g-modal-input"
          bind:value={newGroupName}
          placeholder="e.g. Side Hustle Squad"
          maxlength="50"
        />

        <span class="g-modal-label">Select Members</span>
        {#if selectedMembers.length > 0}
          <div class="g-selected-members">
            {#each selectedMembers as username}
              <span class="g-selected-tag">
                @{username}
                <button aria-label="Remove {username}" onclick={() => toggleMember(username)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            {/each}
          </div>
        {/if}

        <div class="g-friends-list">
          {#if friendsList.length === 0}
            <div class="g-no-friends">
              <p>No friends found. Add friends first to create a group.</p>
            </div>
          {:else}
            {#each availableFriends as friend}
              <button class="g-friend-row" onclick={() => toggleMember(friend.username)}>
                <div class="g-friend-check">
                  {#if selectedMembers.includes(friend.username)}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="9 12 11 14 15 10" fill="none" stroke="#000" stroke-width="2.5"/></svg>
                  {:else}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                  {/if}
                </div>
                <div class="g-friend-avatar">{initial(friend.display_name || friend.username)}</div>
                <div class="g-friend-info">
                  <span class="g-friend-name">{friend.display_name || friend.username}</span>
                  <span class="g-friend-handle">@{friend.username}</span>
                </div>
              </button>
            {/each}
            {#if availableFriends.length === 0 && friendsList.length > 0}
              <div class="g-no-friends">
                <p>All friends have been selected.</p>
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <div class="g-modal-footer">
        <button class="g-modal-cancel" onclick={() => { showCreateModal = false; newGroupName = ''; selectedMembers = []; }}>
          Cancel
        </button>
        <button
          class="g-modal-create"
          onclick={createGroup}
          disabled={creating || !newGroupName.trim() || selectedMembers.length === 0}
        >
          {#if creating}
            Creating...
          {:else}
            Create Group ({selectedMembers.length})
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

  /* ═══ Variables ═══ */
  .g {
    --gb: #0a0a0f;
    --gc: #111117;
    --gt: #e4e6ea;
    --gt2: #8a8d91;
    --gt3: #606770;
    --gbd: #1e1e2a;
    --gcard: #16161f;
    --ggold: #f5a623;
    --ghover: rgba(255,255,255,0.04);
    --gmine: rgba(245,166,35,0.12);
    --gmine-bd: rgba(245,166,35,0.25);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--gt);
    background: var(--gb);
    height: calc(100vh - 56px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .g.light {
    --gb: #ffffff;
    --gc: #f0f2f5;
    --gt: #1c1e21;
    --gt2: #606770;
    --gt3: #8a8d91;
    --gbd: #dddfe2;
    --gcard: #ffffff;
    --ggold: #d4a017;
    --ghover: rgba(0,0,0,0.04);
    --gmine: rgba(245,166,35,0.08);
    --gmine-bd: rgba(245,166,35,0.2);
  }

  /* ═══ Top Bar ═══ */
  .g-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    height: 52px;
    background: var(--gcard);
    border-bottom: 1px solid var(--gbd);
    flex-shrink: 0;
  }

  .g-back {
    color: var(--gt2);
    display: flex;
    text-decoration: none;
  }

  .g-back:hover {
    color: var(--gt);
  }

  .g-logo {
    font-size: 20px;
    font-weight: 800;
    color: var(--ggold);
    text-decoration: none;
    letter-spacing: -1px;
  }

  .g-logo span {
    color: var(--gt);
  }

  .g-title {
    font-size: 17px;
    font-weight: 600;
    margin-left: 8px;
  }

  .g-top-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .g-theme-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--gc);
    color: var(--gt2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
  }

  .g-theme-btn:hover {
    background: var(--ghover);
    color: var(--gt);
  }

  /* ═══ Body Layout ═══ */
  .g-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ═══ Sidebar ═══ */
  .g-sidebar {
    width: 300px;
    border-right: 1px solid var(--gbd);
    display: flex;
    flex-direction: column;
    background: var(--gcard);
    flex-shrink: 0;
  }

  .g-sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--gbd);
  }

  .g-search {
    flex: 1;
    padding: 8px 14px;
    border-radius: 20px;
    border: none;
    background: var(--gc);
    color: var(--gt);
    font-size: 15px;
    outline: none;
    font-family: inherit;
  }

  .g-search::placeholder {
    color: var(--gt3);
  }

  .g-new-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: var(--ggold);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: filter 0.15s;
  }

  .g-new-btn:hover {
    filter: brightness(1.1);
  }

  .g-list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  /* ═══ Empty State ═══ */
  .g-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: var(--gt3);
    font-size: 16px;
    gap: 10px;
    min-height: calc(100vh - 220px);
  }

  .g-empty svg {
    margin-bottom: 4px;
  }

  .g-empty p {
    margin: 0;
  }

  .g-empty-sub {
    font-size: 14px;
    color: var(--gt3);
    opacity: 0.7;
  }

  .g-create-empty-btn {
    margin-top: 8px;
    padding: 8px 20px;
    border-radius: 20px;
    border: none;
    background: var(--ggold);
    color: #000;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    font-family: inherit;
    transition: filter 0.15s;
  }

  .g-create-empty-btn:hover {
    filter: brightness(1.1);
  }

  /* ═══ Loading Skeleton ═══ */
  .g-skeleton {
    height: 60px;
    margin: 8px 12px;
    border-radius: 12px;
    background: linear-gradient(90deg, var(--gc) 25%, var(--gbd) 50%, var(--gc) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .g-skeleton.short {
    height: 60px;
    width: 75%;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ═══ Group Item ═══ */
  .g-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.02);
    background: transparent;
    color: var(--gt);
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s;
  }

  .g.light .g-item {
    border-bottom-color: rgba(0,0,0,0.04);
  }

  .g-item:hover {
    background: var(--ghover);
  }

  .g-item.active {
    background: rgba(245,166,35,0.06);
  }

  .g-item-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--ggold), #e8941a);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    flex-shrink: 0;
    letter-spacing: -1px;
  }

  .g-item-initials {
    line-height: 1;
  }

  .g-item-body {
    flex: 1;
    min-width: 0;
  }

  .g-item-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .g-item-name {
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .g-item-time {
    font-size: 11px;
    color: var(--gt3);
    flex-shrink: 0;
    margin-left: 8px;
  }

  .g-item-meta {
    font-size: 14px;
    color: var(--gt2);
    margin-top: 2px;
  }

  /* ═══ Chat Area ═══ */
  .g-chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--gb);
    min-height: 0;
  }

  .g-chat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
  }

  .g-chat-empty h2 {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }

  .g-chat-empty p {
    color: var(--gt3);
    font-size: 16px;
    margin: 0;
  }

  /* ═══ Chat Header ═══ */
  .g-chat-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
    border-bottom: 1px solid var(--gbd);
    background: var(--gcard);
    flex-shrink: 0;
  }

  .g-chat-back {
    display: none;
    background: none;
    border: none;
    color: var(--gt2);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
  }

  .g-chat-back:hover {
    color: var(--gt);
    background: var(--ghover);
  }

  .g-chat-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--ggold), #e8941a);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 12px;
    flex-shrink: 0;
    letter-spacing: -1px;
  }

  .g-chat-info {
    flex: 1;
    min-width: 0;
  }

  .g-chat-name {
    font-size: 16px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .g-chat-members {
    font-size: 11px;
    color: var(--gt2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  .g-add-member-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--gbd);
    background: transparent;
    color: var(--gt2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .g-add-member-btn:hover {
    background: var(--ghover);
    color: var(--ggold);
    border-color: var(--ggold);
  }

  /* ═══ Add Member Bar ═══ */
  .g-add-member-bar {
    padding: 10px 16px;
    border-bottom: 1px solid var(--gbd);
    background: var(--gcard);
  }

  .g-add-friends-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .g-add-friend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 5px;
    border-radius: 20px;
    border: 1px solid var(--gbd);
    background: transparent;
    color: var(--gt);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    transition: all 0.15s;
  }

  .g-add-friend-item:hover {
    background: rgba(245,166,35,0.08);
    border-color: var(--ggold);
  }

  .g-add-friend-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .g-add-friend-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--ggold);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 10px;
  }

  .g-add-friend-name {
    font-weight: 500;
  }

  .g-add-friend-plus {
    color: var(--ggold);
    font-weight: 800;
    font-size: 14px;
    margin-left: 2px;
  }

  .g-add-member-row {
    display: flex;
    gap: 6px;
  }

  .g-add-member-row input {
    flex: 1;
    padding: 6px 12px;
    border-radius: 16px;
    border: 1px solid var(--gbd);
    background: var(--gc);
    color: var(--gt);
    font-size: 12px;
    outline: none;
    font-family: inherit;
  }

  .g-add-member-row input:focus {
    border-color: var(--ggold);
  }

  .g-add-member-row button {
    padding: 6px 14px;
    border-radius: 16px;
    border: none;
    background: var(--ggold);
    color: #000;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: filter 0.15s;
  }

  .g-add-member-row button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .g-add-member-row button:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  /* ═══ Messages ═══ */
  .g-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }

  .g-msg-loading {
    text-align: center;
    color: var(--gt3);
    font-size: 13px;
    padding: 40px;
  }

  .g-msg-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    text-align: center;
    color: var(--gt3);
    font-size: 13px;
  }

  .g-msg-empty p {
    margin: 0;
  }

  .g-load-more {
    align-self: center;
    padding: 6px 16px;
    border-radius: 16px;
    border: 1px solid var(--gbd);
    background: transparent;
    color: var(--gt2);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    margin-bottom: 12px;
    transition: all 0.15s;
  }

  .g-load-more:hover:not(:disabled) {
    background: var(--ghover);
    color: var(--gt);
  }

  .g-load-more:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .g-msg {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .g-msg.mine {
    justify-content: flex-end;
  }

  .g-msg-sender-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--gc);
    color: var(--gt2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11px;
    flex-shrink: 0;
  }

  .g-msg-content {
    max-width: 65%;
    display: flex;
    flex-direction: column;
  }

  .g-msg-sender-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--ggold);
    margin-bottom: 2px;
    padding-left: 4px;
  }

  .g-msg-bubble {
    padding: 10px 14px;
    border-radius: 18px;
    background: var(--gcard);
    border: 1px solid var(--gbd);
  }

  .g-msg.mine .g-msg-bubble {
    background: var(--gmine);
    border-color: var(--gmine-bd);
    border-bottom-right-radius: 4px;
  }

  .g-msg:not(.mine) .g-msg-bubble {
    border-bottom-left-radius: 4px;
  }

  .g-msg-text {
    font-size: 16px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .g-msg-time {
    font-size: 10px;
    color: var(--gt3);
    display: block;
    margin-top: 4px;
  }

  .g-msg.mine .g-msg-time {
    text-align: right;
  }

  /* ═══ Input Bar ═══ */
  .g-input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--gbd);
    background: var(--gcard);
    flex-shrink: 0;
  }

  .g-emoji-wrap {
    position: relative;
  }

  .g-emoji-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
  }

  .g-emoji-btn:hover {
    background: var(--ghover);
  }

  .g-emoji-picker {
    position: absolute;
    bottom: 44px;
    left: 0;
    background: var(--gcard);
    border: 1px solid var(--gbd);
    border-radius: 12px;
    padding: 8px;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
    width: 280px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 50;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }

  .g-emoji-item {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    text-align: center;
  }

  .g-emoji-item:hover {
    background: var(--ghover);
  }

  .g-input {
    flex: 1;
    padding: 12px 18px;
    border-radius: 24px;
    border: 1px solid var(--gbd);
    background: var(--gc);
    color: var(--gt);
    font-size: 16px;
    outline: none;
    font-family: inherit;
  }

  .g-input:focus {
    border-color: var(--ggold);
  }

  .g-input::placeholder {
    color: var(--gt3);
  }

  .g-send {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: var(--ggold);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: filter 0.15s;
  }

  .g-send:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .g-send:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  /* ═══ Create Group Modal ═══ */
  .g-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;

    --gc: #111117;
    --gt: #e4e6ea;
    --gt2: #8a8d91;
    --gt3: #606770;
    --gbd: #1e1e2a;
    --gcard: #16161f;
    --ggold: #f5a623;
    --ghover: rgba(255,255,255,0.04);
  }

  .g-modal-overlay.light {
    --gc: #f0f2f5;
    --gt: #1c1e21;
    --gt2: #606770;
    --gt3: #8a8d91;
    --gbd: #dddfe2;
    --gcard: #ffffff;
    --ggold: #d4a017;
    --ghover: rgba(0,0,0,0.04);
  }

  .g-modal {
    background: var(--gcard);
    border: 1px solid var(--gbd);
    border-radius: 16px;
    width: 100%;
    max-width: 440px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--gt);
  }

  .g-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--gbd);
  }

  .g-modal-header h2 {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
  }

  .g-modal-close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--gc);
    color: var(--gt2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .g-modal-close:hover {
    background: var(--ghover);
    color: var(--gt);
  }

  .g-modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .g-modal-label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: var(--gt2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    margin-top: 16px;
  }

  .g-modal-label:first-child {
    margin-top: 0;
  }

  .g-modal-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--gbd);
    background: var(--gc);
    color: var(--gt);
    font-size: 16px;
    outline: none;
    font-family: inherit;
    box-sizing: border-box;
  }

  .g-modal-input:focus {
    border-color: var(--ggold);
  }

  .g-modal-input::placeholder {
    color: var(--gt3);
  }

  .g-selected-members {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    margin-top: 8px;
  }

  .g-selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 16px;
    background: rgba(245,166,35,0.12);
    border: 1px solid rgba(245,166,35,0.25);
    color: var(--ggold);
    font-size: 12px;
    font-weight: 600;
  }

  .g-selected-tag button {
    background: none;
    border: none;
    color: var(--ggold);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .g-selected-tag button:hover {
    opacity: 1;
  }

  .g-friends-list {
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid var(--gbd);
    border-radius: 10px;
    margin-top: 8px;
  }

  .g-no-friends {
    padding: 20px;
    text-align: center;
    color: var(--gt3);
    font-size: 15px;
  }

  .g-no-friends p {
    margin: 0;
  }

  .g-friend-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    background: transparent;
    color: var(--gt);
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s;
  }

  .g-friend-row:last-child {
    border-bottom: none;
  }

  .g-friend-row:hover {
    background: var(--ghover);
  }

  .g-friend-check {
    display: flex;
    align-items: center;
    color: var(--ggold);
    flex-shrink: 0;
  }

  .g-friend-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--ggold), #e8941a);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    flex-shrink: 0;
  }

  .g-friend-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .g-friend-name {
    font-size: 15px;
    font-weight: 600;
  }

  .g-friend-handle {
    font-size: 11px;
    color: var(--gt3);
  }

  .g-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--gbd);
  }

  .g-modal-cancel {
    padding: 8px 18px;
    border-radius: 20px;
    border: 1px solid var(--gbd);
    background: transparent;
    color: var(--gt2);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .g-modal-cancel:hover {
    background: var(--ghover);
    color: var(--gt);
  }

  .g-modal-create {
    padding: 8px 20px;
    border-radius: 20px;
    border: none;
    background: var(--ggold);
    color: #000;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    font-family: inherit;
    transition: filter 0.15s;
  }

  .g-modal-create:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .g-modal-create:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  /* ═══ Mobile Responsive ═══ */
  @media (max-width: 768px) {
    .g {
      height: calc(100vh - 56px);
      padding-bottom: 80px;
    }

    .g-sidebar {
      width: 100%;
      border-right: none;
    }

    .g-chat {
      display: none;
    }

    .g-body.has-active .g-sidebar {
      display: none;
    }

    .g-body.has-active .g-chat {
      display: flex;
    }

    .g-chat-back {
      display: flex;
    }

    .g-emoji-picker {
      width: 250px;
      grid-template-columns: repeat(7, 1fr);
    }

    .g-msg-content {
      max-width: 80%;
    }

    .g-input-bar {
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    }

    .g-modal {
      max-height: 90vh;
      margin: 10px;
    }
  }

  @media (max-width: 380px) {
    .g-chat-name {
      font-size: 13px;
    }

    .g-chat-members {
      font-size: 10px;
    }

    .g-emoji-picker {
      width: 220px;
      grid-template-columns: repeat(6, 1fr);
    }

    .g-msg-content {
      max-width: 85%;
    }
  }

  /* ═══ Scrollbar Styling ═══ */
  .g-list::-webkit-scrollbar,
  .g-messages::-webkit-scrollbar,
  .g-friends-list::-webkit-scrollbar,
  .g-modal-body::-webkit-scrollbar {
    width: 4px;
  }

  .g-list::-webkit-scrollbar-track,
  .g-messages::-webkit-scrollbar-track,
  .g-friends-list::-webkit-scrollbar-track,
  .g-modal-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .g-list::-webkit-scrollbar-thumb,
  .g-messages::-webkit-scrollbar-thumb,
  .g-friends-list::-webkit-scrollbar-thumb,
  .g-modal-body::-webkit-scrollbar-thumb {
    background: var(--gbd);
    border-radius: 4px;
  }

  /* ═══ Force 16px on inputs (prevent iOS zoom) ═══ */
  :global(.g input, .g textarea, .g select) {
    font-size: 16px !important;
    -webkit-text-size-adjust: 100%;
  }
</style>
