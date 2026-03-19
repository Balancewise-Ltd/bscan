<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { sanitize, safeGetStorage, safeSetStorage, safeJsonParse } from '$lib/utils/security';
	import * as api from '$lib/api/client';
	import Seo from '$lib/components/ui/Seo.svelte';

	type TeamTab = 'members' | 'activity' | 'notes';
	let activeTab = $state<TeamTab>('members');

	let team = $state<any[]>([]);
	let maxMembers = $state(5);
	let isOwner = $state(false);
	let loading = $state(true);

	// Invite
	let inviteEmail = $state('');
	let inviteRole = $state('member');
	let inviteError = $state('');
	let inviteSuccess = $state('');
	let inviteLoading = $state(false);

	// Team notes (API-backed, shared with team)
	let notes = $state<Array<{ id: string; author_name: string; author_email: string; content: string; created_at: string }>>([]);
	let newNote = $state('');
	let notesLoading = $state(false);

	// Team activity
	let activity = $state<Array<{ id: string; type: string; url?: string; score?: number; content?: string; author: string; created_at: string }>>([]);
	let activityLoading = $state(false);

	const isAgency = $derived($auth.user?.plan === 'agency');

	onMount(async () => {
		// Check for invite token in URL
		const params = new URLSearchParams(window.location.search);
		const inviteToken = params.get('invite');
		if (inviteToken && $auth.user) {
			try {
				const res = await api.acceptInvite(inviteToken);
				inviteSuccess = res.message;
				auth.refresh();
				window.history.replaceState({}, '', '/team');
			} catch (err) {
				inviteError = err instanceof Error ? err.message : 'Failed to accept invite.';
			}
		}

		if ($auth.user && isAgency) await loadTeam();
		loading = false;

		// Load notes + activity from API
		if (isAgency) {
			loadNotes();
			loadActivity();
		}
	});

	async function loadTeam() {
		try {
			const data = await api.getTeam();
			team = data.team || [];
			maxMembers = data.max_members || 5;
			isOwner = data.is_owner;
		} catch { team = []; }
	}

	async function invite() {
		inviteError = ''; inviteSuccess = '';
		if (!inviteEmail || !inviteEmail.includes('@')) { inviteError = 'Enter a valid email.'; return; }
		inviteLoading = true;
		try {
			const result = await api.inviteTeamMember(inviteEmail, inviteRole);
			inviteSuccess = result.message;
			inviteEmail = '';
			loadTeam();
		} catch (err) {
			inviteError = err instanceof Error ? err.message : 'Failed to send invite.';
		}
		inviteLoading = false;
	}

	async function removeMember(id: string) {
		if (!confirm('Remove this team member? They will lose Agency access.')) return;
		try { await api.removeTeamMember(id); loadTeam(); } catch {}
	}

	async function loadNotes() {
		notesLoading = true;
		try {
			const res = await api.getTeamNotes();
			notes = res.notes || [];
		} catch { notes = []; }
		notesLoading = false;
	}

	async function addNote() {
		if (!newNote.trim() || !$auth.user) return;
		try {
			const res = await api.createTeamNote(newNote.trim());
			if (res.note) notes = [res.note, ...notes];
			newNote = '';
		} catch { }
	}

	async function deleteNote(id: string) {
		try {
			await api.deleteTeamNote(id);
			notes = notes.filter(n => n.id !== id);
		} catch { }
	}

	async function loadActivity() {
		activityLoading = true;
		try {
			const res = await api.getTeamActivity();
			activity = res.activity || [];
		} catch { activity = []; }
		activityLoading = false;
	}

	function formatNoteTime(ts: string | number): string {
		const d = new Date(ts);
		const now = Date.now();
		const diff = now - d.getTime();
		if (diff < 60000) return 'Just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	const avatarColors = ['#3b82f6', '#f0a500', '#10b981', '#8b5cf6', '#ec4899'];
</script>

<Seo title="Team Management" description="Manage your BSCAN Agency team. Invite members, assign roles, share scans, and collaborate on website audits." />

<div class="container" style="max-width: 900px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-blue">👥 Team</span>
		<h1>Team <span class="text-gold">Management</span></h1>
		<p class="text-secondary">Collaborate with your team, manage members, and share insights.</p>
	</div>

	{#if !$auth.user}
		<div class="gate-card card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 48px;">
				<div style="font-size: 32px; margin-bottom: 12px;">🔐</div>
				<h3>Sign in to manage your team</h3>
				<p class="text-secondary" style="margin: 8px 0 20px;">Team features are available on the Agency plan (£29/mo).</p>
				<a href="/account" class="btn btn-gold">Sign In</a>
			</div>
		</div>
	{:else if !isAgency}
		<div class="gate-card card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 48px;">
				<div style="font-size: 40px; margin-bottom: 12px;">👥</div>
				<h3>Team Collaboration</h3>
				<p class="text-secondary" style="margin: 8px 0 4px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.6;">
					Add up to 5 team members who all get Agency-level access. Share scan history, collaborate on audits, and manage API keys together.
				</p>
				<div class="features-mini">
					<span class="feat-tag">5 Team Members</span>
					<span class="feat-tag">Shared Scans</span>
					<span class="feat-tag">API Keys</span>
					<span class="feat-tag">White-label PDFs</span>
					<span class="feat-tag">Team Notes</span>
				</div>
				<button class="btn btn-blue" style="margin-top: 20px;" onclick={() => ui.openCheckout('agency')}>Go Agency — £29/mo</button>
			</div>
		</div>
	{:else}
		{#if inviteSuccess}
			<div class="msg-success" style="margin-bottom: 16px;">{inviteSuccess}</div>
		{/if}

		<!-- Tab Nav -->
		<div class="tabs-row animate-fade-up">
			<button class="team-tab" class:active={activeTab === 'members'} onclick={() => activeTab = 'members'}>👥 Members</button>
			<button class="team-tab" class:active={activeTab === 'notes'} onclick={() => activeTab = 'notes'}>💬 Team Notes</button>
			<button class="team-tab" class:active={activeTab === 'activity'} onclick={() => activeTab = 'activity'}>📋 Activity</button>
		</div>

		<!-- ── MEMBERS ─────────────────────────── -->
		{#if activeTab === 'members'}
			<div class="animate-fade-up">
				<!-- Invite -->
				{#if isOwner || (isAgency && team.length === 0)}
					<div class="card" style="margin-bottom: 20px;">
						<div class="card-header">
							<span>✉️</span>
							<span style="font-weight: 700;">Invite Member</span>
							<span class="text-muted font-mono" style="margin-left: auto; font-size: 11px;">{team.length} / {maxMembers} seats</span>
						</div>
						<div class="card-body">
							<div class="invite-row">
								<input class="input" type="email" placeholder="colleague@company.com" bind:value={inviteEmail} onkeydown={(e) => e.key === 'Enter' && invite()} style="flex: 1;" />
								<select class="input" bind:value={inviteRole} style="width: 120px; flex: none;">
									<option value="member">Member</option>
									<option value="admin">Admin</option>
								</select>
								<button class="btn btn-gold" disabled={inviteLoading} onclick={invite}>
									{#if inviteLoading}<span class="spinner spinner-sm"></span>{:else}Invite{/if}
								</button>
							</div>
							{#if inviteError}<div class="msg-error">{inviteError}</div>{/if}
						</div>
					</div>
				{/if}

				<!-- Members List -->
				<div class="card">
					<div class="card-header">
						<span>👥</span>
						<span style="font-weight: 700;">Team Members</span>
					</div>
					<div class="card-body" style="padding: 0;">
						{#if team.length === 0}
							<div style="text-align: center; padding: 40px;">
								<div style="font-size: 28px; margin-bottom: 8px;">👥</div>
								<h3 style="font-size: 16px;">No team members yet</h3>
								<p class="text-muted" style="margin-top: 4px;">Invite colleagues to share Agency access.</p>
							</div>
						{:else}
							{#each team as member, i}
								<div class="member-row">
									<div class="member-avatar" style="background: {avatarColors[i % avatarColors.length]}20; color: {avatarColors[i % avatarColors.length]}; border-color: {avatarColors[i % avatarColors.length]}40;">
										{(member.name || member.email)[0].toUpperCase()}
									</div>
									<div class="member-info">
										<div class="member-name">{member.name || member.email.split('@')[0]}</div>
										<div class="member-email text-muted">{member.email}</div>
									</div>
									<span class="role-badge" class:role-owner={member.role === 'owner'} class:role-admin={member.role === 'admin'}>
										{member.role}
									</span>
									<span class="status-badge" class:status-active={member.status === 'accepted'} class:status-pending={member.status === 'pending'}>
										{member.status === 'accepted' ? 'Active' : 'Pending'}
									</span>
									{#if isOwner && member.role !== 'owner'}
										<button class="btn btn-ghost btn-sm" style="color: var(--clr-danger);" onclick={() => removeMember(member.id)}>Remove</button>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── TEAM NOTES ──────────────────────── -->
		{#if activeTab === 'notes'}
			<div class="animate-fade-up">
				<div class="card">
					<div class="card-header">
						<span>💬</span>
						<span style="font-weight: 700;">Team Notes</span>
						<span class="text-muted" style="margin-left: auto; font-size: 11px;">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
					</div>
					<div class="card-body">
						<!-- New Note -->
						<div class="note-input-area">
							<textarea class="input note-textarea" placeholder="Share a note, link, or update with your team..." bind:value={newNote} rows="2" onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}></textarea>
							<button class="btn btn-gold btn-sm" style="align-self: flex-end;" onclick={addNote}>Post</button>
						</div>

						<!-- Notes Feed -->
						<div class="notes-feed">
							{#if notesLoading}
								<div class="empty-notes"><p class="text-muted">Loading notes...</p></div>
							{:else if notes.length === 0}
								<div class="empty-notes">
									<p class="text-muted">No notes yet. Share something with your team!</p>
								</div>
							{:else}
								{#each notes as note}
									<div class="note-item">
										<div class="note-avatar">{(note.author_name || note.author_email || '?')[0].toUpperCase()}</div>
										<div class="note-content">
											<div class="note-meta">
												<span class="note-author">{note.author_name || note.author_email}</span>
												<span class="note-time text-muted">{formatNoteTime(note.created_at)}</span>
												<button class="note-delete" title="Delete note" onclick={() => deleteNote(note.id)}>×</button>
											</div>
											<div class="note-text">{note.content}</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- ── ACTIVITY ────────────────────────── -->
		{#if activeTab === 'activity'}
			<div class="animate-fade-up">
				<div class="card">
					<div class="card-header">
						<span>📋</span>
						<span style="font-weight: 700;">Team Activity</span>
						<button class="btn btn-ghost btn-sm" style="margin-left: auto;" onclick={loadActivity}>Refresh</button>
					</div>
					<div class="card-body" style="padding: 0;">
						{#if activityLoading}
							<div class="empty-notes" style="padding: 32px;"><p class="text-muted">Loading activity...</p></div>
						{:else if activity.length === 0}
							<div class="empty-notes" style="padding: 32px;">
								<div style="font-size: 28px; margin-bottom: 8px;">📋</div>
								<p class="text-muted">No team activity yet. Start scanning to see your team's work here.</p>
							</div>
						{:else}
							{#each activity as item}
								<div class="activity-row">
									<div class="activity-icon">{item.type === 'scan' ? '🔍' : '💬'}</div>
									<div class="activity-body">
										<span class="activity-author">{item.author}</span>
										{#if item.type === 'scan'}
											<span class="text-muted">scanned</span>
											<span class="activity-url">{item.url?.replace('https://', '').replace('http://', '').split('/')[0]}</span>
											{#if item.score}
												<span class="activity-score" style="color: {item.score >= 80 ? 'var(--clr-success)' : item.score >= 60 ? 'var(--clr-warning)' : 'var(--clr-danger)'};">{item.score}</span>
											{/if}
										{:else}
											<span class="text-muted">noted:</span>
											<span class="activity-note">{item.content}</span>
										{/if}
									</div>
									<div class="activity-time text-muted">{formatNoteTime(item.created_at)}</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page-header { text-align: center; margin-bottom: var(--space-xl); }
	.page-header h1 { font-style: italic; margin: 8px 0; }

	.tabs-row { display: flex; gap: 4px; margin-bottom: var(--space-lg); background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-md); padding: 4px; }
	.team-tab { padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; background: transparent; color: var(--clr-text-secondary); transition: all var(--duration-fast); white-space: nowrap; }
	.team-tab.active { background: var(--clr-blue); color: white; }

	.invite-row { display: flex; gap: 8px; }
	.msg-error { margin-top: 8px; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--clr-danger-dim); color: var(--clr-danger); font-size: 12px; }
	.msg-success { padding: 10px 14px; border-radius: var(--radius-sm); background: var(--clr-success-dim); color: var(--clr-success); font-size: 12px; }

	.member-row { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--clr-border); }
	.member-row:last-child { border-bottom: none; }
	.member-avatar { width: 38px; height: 38px; border-radius: var(--radius-md); border: 1px solid; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; flex-shrink: 0; }
	.member-info { flex: 1; min-width: 0; }
	.member-name { font-weight: 600; font-size: 14px; }
	.member-email { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }

	.role-badge { font-size: 10px; padding: 2px 8px; border-radius: var(--radius-full); font-family: var(--font-mono); font-weight: 600; text-transform: uppercase; }
	.role-owner { background: var(--clr-gold-dim); color: var(--clr-gold); }
	.role-admin { background: var(--clr-blue-dim); color: var(--clr-blue); }

	.status-badge { font-size: 10px; padding: 2px 8px; border-radius: var(--radius-full); font-family: var(--font-mono); }
	.status-active { background: var(--clr-success-dim); color: var(--clr-success); }
	.status-pending { background: var(--clr-warning-dim); color: var(--clr-warning); }

	.features-mini { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 16px; }
	.feat-tag { font-size: 11px; padding: 4px 12px; border-radius: var(--radius-full); background: var(--clr-blue-dim); border: 1px solid rgba(59,130,246,0.15); color: var(--clr-blue); font-family: var(--font-mono); }

	/* ── Notes ─────────────────────────────── */
	.note-input-area { display: flex; flex-direction: column; gap: 8px; margin-bottom: var(--space-md); padding-bottom: var(--space-md); border-bottom: 1px solid var(--clr-border); }
	.note-textarea { resize: vertical; font-family: inherit; min-height: 60px; }

	.notes-feed { display: flex; flex-direction: column; gap: 12px; }
	.note-item { display: flex; gap: 10px; }
	.note-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--clr-blue-dim); color: var(--clr-blue); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
	.note-content { flex: 1; min-width: 0; }
	.note-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
	.note-author { font-weight: 600; font-size: 12px; }
	.note-time { font-size: 10px; }
	.note-text { font-size: 13px; color: var(--clr-text-secondary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }

	.empty-notes { text-align: center; padding: var(--space-xl); }

	/* Note delete button */
	.note-delete { background: none; border: none; color: var(--clr-text-muted); cursor: pointer; font-size: 16px; padding: 0 4px; margin-left: auto; opacity: 0; transition: opacity 0.15s, color 0.15s; }
	.note-item:hover .note-delete { opacity: 1; }
	.note-delete:hover { color: var(--clr-danger); }

	/* Activity feed */
	.activity-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--clr-border); transition: background 0.15s; }
	.activity-row:last-child { border-bottom: none; }
	.activity-row:hover { background: rgba(255,255,255,0.02); }
	.activity-icon { font-size: 16px; flex-shrink: 0; }
	.activity-body { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; font-size: 13px; min-width: 0; }
	.activity-author { font-weight: 600; color: var(--clr-text-primary); }
	.activity-url { font-family: var(--font-mono); color: var(--clr-blue); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
	.activity-score { font-weight: 800; font-size: 15px; }
	.activity-note { color: var(--clr-text-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px; }
	.activity-time { font-size: 10px; flex-shrink: 0; white-space: nowrap; }

	@media (max-width: 640px) {
		.invite-row { flex-direction: column; }
		.invite-row select { width: 100% !important; }
		.member-row { flex-wrap: wrap; gap: 8px; }
		.activity-body { font-size: 12px; }
		.activity-url, .activity-note { max-width: 140px; }
	}
</style>
