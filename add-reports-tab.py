#!/usr/bin/env python3
"""
BSCAN — Add Reports Tab to Account Page + API Functions
Run from ~/Downloads/bscan:
  python3 add-reports-tab.py
  cp .env.example .env && npm run build && npx gh-pages -d build -t
"""

import os

BSCAN = os.path.expanduser("~/Downloads/bscan")
ACCOUNT = f"{BSCAN}/src/routes/account/+page.svelte"
CLIENT = f"{BSCAN}/src/lib/api/client.ts"

# ═══════════════════════════════════════════
# 1. Add API functions to client.ts
# ═══════════════════════════════════════════

c = open(CLIENT).read()
if "getReportSchedules" not in c:
    c += """

// ══════════════════════════════════════════════════════════
// REPORTS — scheduled client reports (Agency only)
// ══════════════════════════════════════════════════════════

export interface ReportSchedule {
\tid: string; url: string; recipient_email: string; recipient_name: string;
\tfrequency: string; include_ai_fixes: boolean; include_comparison: boolean;
\tbranding_company: string; branding_color: string; status: string;
\tlast_run_at: string | null; last_score: number | null;
\tnext_run_at: string | null; total_sent: number; created_at: string;
}

export interface ReportHistory {
\tid: string; url: string; recipient_email: string;
\toverall_score: number | null; previous_score: number | null;
\tscore_change: number | null; status: string; sent_at: string;
}

export interface ReportStats {
\ttotal_schedules: number; active_schedules: number;
\ttotal_reports_sent: number; reports_this_month: number;
\tavg_client_score: number | null;
}

export async function getReportSchedules(): Promise<{ schedules: ReportSchedule[]; total: number }> {
\treturn request('/api/reports/schedules');
}

export async function createReportSchedule(data: Record<string, any>): Promise<{ id: string; status: string; next_run_at: string }> {
\treturn request('/api/reports/schedules', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateReportSchedule(id: string, data: Record<string, any>): Promise<{ status: string }> {
\treturn request('/api/reports/schedules/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteReportSchedule(id: string): Promise<{ status: string }> {
\treturn request('/api/reports/schedules/' + id, { method: 'DELETE' });
}

export async function sendReportNow(id: string): Promise<{ status: string; message: string }> {
\treturn request('/api/reports/schedules/' + id + '/send-now', { method: 'POST' });
}

export async function getReportHistory(id: string): Promise<{ history: ReportHistory[]; total: number }> {
\treturn request('/api/reports/schedules/' + id + '/history');
}

export async function getReportStats(): Promise<ReportStats> {
\treturn request('/api/reports/stats');
}
"""
    open(CLIENT, "w").write(c)
    print("+ Added report API functions to client.ts")
else:
    print("  Report API already in client.ts")


# ═══════════════════════════════════════════
# 2. Modify account page
# ═══════════════════════════════════════════

a = open(ACCOUNT).read()

if "'reports'" in a:
    print("  Reports tab already exists")
    exit(0)

# 2a. Add 'reports' to Tab type
a = a.replace(
    "type Tab = 'overview' | 'profile' | 'billing' | 'history' | 'api-keys' | 'security' | 'branding';",
    "type Tab = 'overview' | 'profile' | 'billing' | 'history' | 'api-keys' | 'security' | 'branding' | 'reports';"
)
print("+ Updated Tab type")

# 2b. Add reports tab entry
a = a.replace(
    "{ key: 'branding', label: 'Branding', icon: Palette, show: () => isAgency },",
    "{ key: 'branding', label: 'Branding', icon: Palette, show: () => isAgency },\n\t\t{ key: 'reports', label: 'Reports', icon: Target, show: () => isAgency },"
)
print("+ Added tab entry")

# 2c. Add state variables (after the last $state block)
state_vars = """
\t// ── Report Scheduling ─────────────────────────────
\tlet reportSchedules = $state<any[]>([]);
\tlet reportStats = $state<any>(null);
\tlet reportLoading = $state(true);
\tlet reportSaving = $state(false);
\tlet reportMsg = $state('');
\tlet reportError = $state('');
\tlet showNewSchedule = $state(false);
\tlet sendingNow = $state<string | null>(null);
\tlet newSched = $state({ url: '', recipient_email: '', recipient_name: '', frequency: 'monthly', branding_company: '', branding_color: '#D4AF37', include_ai_fixes: true, include_comparison: true });
"""

# Insert after brandingSaving line
a = a.replace(
    "let brandingSaving",
    state_vars + "\n\tlet brandingSaving"
)
print("+ Added state variables")

# 2d. Add functions (before the tabs const)
functions = """
\t// ── Report Functions ──────────────────────────────
\tasync function loadReports() {
\t\treportLoading = true;
\t\ttry {
\t\t\tconst [sched, stats] = await Promise.all([api.getReportSchedules(), api.getReportStats()]);
\t\t\treportSchedules = sched.schedules;
\t\t\treportStats = stats;
\t\t} catch (e: any) { reportError = e.message || 'Failed to load'; }
\t\treportLoading = false;
\t}

\tasync function createScheduleReport() {
\t\tif (!newSched.url || !newSched.recipient_email) { reportError = 'URL and email required'; return; }
\t\treportSaving = true; reportError = '';
\t\ttry {
\t\t\tawait api.createReportSchedule(newSched);
\t\t\treportMsg = 'Schedule created'; showNewSchedule = false;
\t\t\tnewSched = { url: '', recipient_email: '', recipient_name: '', frequency: 'monthly', branding_company: '', branding_color: '#D4AF37', include_ai_fixes: true, include_comparison: true };
\t\t\tawait loadReports();
\t\t\tsetTimeout(() => reportMsg = '', 3000);
\t\t} catch (e: any) { reportError = e.message || 'Failed'; }
\t\treportSaving = false;
\t}

\tasync function toggleSched(id: string, cur: string) {
\t\ttry { await api.updateReportSchedule(id, { status: cur === 'active' ? 'paused' : 'active' }); await loadReports(); } catch (e: any) { reportError = e.message; }
\t}

\tasync function deleteSched(id: string) {
\t\tif (!confirm('Delete this scheduled report?')) return;
\t\ttry { await api.deleteReportSchedule(id); await loadReports(); } catch (e: any) { reportError = e.message; }
\t}

\tasync function sendReportNow(id: string) {
\t\tsendingNow = id;
\t\ttry { const r = await api.sendReportNow(id); reportMsg = r.message || 'Queued'; setTimeout(() => reportMsg = '', 5000); } catch (e: any) { reportError = e.message; }
\t\tsendingNow = null;
\t}

"""

a = a.replace(
    "\tconst tabs: Array<{ key: Tab;",
    functions + "\n\tconst tabs: Array<{ key: Tab;"
)
print("+ Added report functions")

# 2e. Add the UI section (before branding tab)
ui_section = """
\t\t{#if activeTab === 'reports'}
\t\t<!-- ══════ REPORTS ══════ -->
\t\t<div class="tab-content animate-fade-up" use:reportInit>
\t\t\t<div class="reports-wrap">

\t\t\t\t<!-- Stats -->
\t\t\t\t{#if reportStats}
\t\t\t\t<div class="rpt-stats">
\t\t\t\t\t<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.active_schedules}</div><div class="rpt-stat-lbl">Active</div></div>
\t\t\t\t\t<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.total_reports_sent}</div><div class="rpt-stat-lbl">Sent</div></div>
\t\t\t\t\t<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.reports_this_month}</div><div class="rpt-stat-lbl">This Month</div></div>
\t\t\t\t\t<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.avg_client_score ?? '—'}</div><div class="rpt-stat-lbl">Avg Score</div></div>
\t\t\t\t</div>
\t\t\t\t{/if}

\t\t\t\t{#if reportMsg}<div style="padding: 12px 16px; border-radius: var(--radius-sm); background: rgba(16,185,129,0.1); color: var(--clr-success); font-size: 13px; margin-bottom: 16px;">{reportMsg}</div>{/if}
\t\t\t\t{#if reportError}<div style="padding: 12px 16px; border-radius: var(--radius-sm); background: rgba(239,68,68,0.1); color: var(--clr-danger); font-size: 13px; margin-bottom: 16px;">{reportError} <button style="float:right; background:none; border:none; cursor:pointer; color:inherit;" onclick={() => reportError = ''}>✕</button></div>{/if}

\t\t\t\t<!-- Header -->
\t\t\t\t<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
\t\t\t\t\t<h3 class="section-title" style="margin: 0;">Scheduled Reports</h3>
\t\t\t\t\t<button class="btn btn-gold btn-sm" onclick={() => showNewSchedule = !showNewSchedule}>
\t\t\t\t\t\t{showNewSchedule ? 'Cancel' : '+ New Schedule'}
\t\t\t\t\t</button>
\t\t\t\t</div>

\t\t\t\t<!-- New Schedule Form -->
\t\t\t\t{#if showNewSchedule}
\t\t\t\t<div class="card" style="padding: 20px; margin-bottom: 20px; border: 1px solid var(--clr-gold-dim);">
\t\t\t\t\t<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
\t\t\t\t\t\t<div><label class="label">Website URL *</label><input class="input" type="url" placeholder="https://client-site.com" bind:value={newSched.url} /></div>
\t\t\t\t\t\t<div><label class="label">Recipient Email *</label><input class="input" type="email" placeholder="client@company.com" bind:value={newSched.recipient_email} /></div>
\t\t\t\t\t\t<div><label class="label">Recipient Name</label><input class="input" type="text" placeholder="John Smith" bind:value={newSched.recipient_name} /></div>
\t\t\t\t\t\t<div><label class="label">Frequency</label><select class="input" bind:value={newSched.frequency}><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option></select></div>
\t\t\t\t\t\t<div><label class="label">Brand Name</label><input class="input" type="text" placeholder="Your Company" bind:value={newSched.branding_company} /></div>
\t\t\t\t\t\t<div><label class="label">Brand Colour</label><div style="display: flex; gap: 8px; align-items: center;"><input type="color" bind:value={newSched.branding_color} style="width: 40px; height: 36px; border: none; cursor: pointer; border-radius: 6px;" /><input class="input" type="text" bind:value={newSched.branding_color} style="flex: 1; font-family: var(--font-mono);" /></div></div>
\t\t\t\t\t</div>
\t\t\t\t\t<div style="display: flex; gap: 16px; margin-top: 16px; align-items: center;">
\t\t\t\t\t\t<label style="font-size: 12px; display: flex; align-items: center; gap: 6px;"><input type="checkbox" bind:checked={newSched.include_ai_fixes} /> AI Fixes</label>
\t\t\t\t\t\t<label style="font-size: 12px; display: flex; align-items: center; gap: 6px;"><input type="checkbox" bind:checked={newSched.include_comparison} /> Score Comparison</label>
\t\t\t\t\t\t<div style="margin-left: auto;"><button class="btn btn-gold" onclick={createScheduleReport} disabled={reportSaving}>{reportSaving ? 'Creating...' : 'Create Schedule'}</button></div>
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t\t{/if}

\t\t\t\t<!-- Schedule Cards -->
\t\t\t\t{#if reportSchedules.length === 0 && !reportLoading}
\t\t\t\t\t<div style="padding: 48px; text-align: center; background: var(--clr-bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--clr-border);">
\t\t\t\t\t\t<div style="font-size: 36px; margin-bottom: 8px;">📊</div>
\t\t\t\t\t\t<p style="font-size: 14px; color: var(--clr-text-muted); max-width: 320px; margin: 0 auto;">No scheduled reports yet. Add your first client site to start sending automated reports.</p>
\t\t\t\t\t</div>
\t\t\t\t{:else}
\t\t\t\t\t{#each reportSchedules as s}
\t\t\t\t\t<div class="rpt-card" class:rpt-paused={s.status === 'paused'}>
\t\t\t\t\t\t<div class="rpt-card-top">
\t\t\t\t\t\t\t<div style="flex: 1; min-width: 0;">
\t\t\t\t\t\t\t\t<div class="rpt-url">{s.url.replace('https://', '')}</div>
\t\t\t\t\t\t\t\t<div class="rpt-recip">{s.recipient_name || s.recipient_email} · {s.frequency}{s.branding_company ? ' · ' + s.branding_company : ''}</div>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div class="rpt-score" style="color: {s.last_score >= 80 ? 'var(--clr-success)' : s.last_score >= 60 ? 'var(--clr-blue)' : s.last_score ? 'var(--clr-warning)' : 'var(--clr-text-muted)'};">{s.last_score ?? '—'}</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="rpt-card-btm">
\t\t\t\t\t\t\t<div class="rpt-info">
\t\t\t\t\t\t\t\t<span class="rpt-badge" class:rpt-active={s.status === 'active'} class:rpt-paused-badge={s.status === 'paused'}>{s.status}</span>
\t\t\t\t\t\t\t\t<span class="text-muted" style="font-size: 11px;">Sent {s.total_sent}x</span>
\t\t\t\t\t\t\t\t{#if s.next_run_at}<span class="text-muted" style="font-size: 11px;">Next: {new Date(s.next_run_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>{/if}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div style="display: flex; gap: 6px;">
\t\t\t\t\t\t\t\t<button class="btn btn-ghost btn-sm" onclick={() => sendReportNow(s.id)} disabled={sendingNow === s.id}>{sendingNow === s.id ? '...' : 'Send Now'}</button>
\t\t\t\t\t\t\t\t<button class="btn btn-ghost btn-sm" onclick={() => toggleSched(s.id, s.status)}>{s.status === 'active' ? 'Pause' : 'Resume'}</button>
\t\t\t\t\t\t\t\t<button class="btn btn-ghost btn-sm" style="color: var(--clr-danger);" onclick={() => deleteSched(s.id)}>Delete</button>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t\t{/each}
\t\t\t\t{/if}
\t\t\t</div>
\t\t</div>
\t\t{/if}

"""

# Insert before the branding section
a = a.replace(
    "\t\t{#if activeTab === 'branding'}",
    ui_section + "\t\t{#if activeTab === 'branding'}"
)
print("+ Added reports UI section")

# 2f. Add Svelte action for loading reports on tab switch
action_code = """
\tfunction reportInit(node: HTMLElement) {
\t\tloadReports();
\t\treturn { destroy() {} };
\t}
"""
a = a.replace(
    "\tconst tabs: Array<{ key: Tab;",
    action_code + "\n\tconst tabs: Array<{ key: Tab;"
)
print("+ Added reportInit action")

# 2g. Add CSS styles
css_block = """
<style>
\t/* ── Report Scheduling ─────────────────── */
\t.rpt-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
\t.rpt-stat { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-md); padding: 16px; text-align: center; transition: border-color 0.2s; }
\t.rpt-stat:hover { border-color: var(--clr-gold-dim); }
\t.rpt-stat-val { font-size: 28px; font-weight: 800; font-family: var(--font-mono); color: var(--clr-gold); line-height: 1; }
\t.rpt-stat-lbl { font-size: 10px; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; }

\t.rpt-card { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 10px; transition: all 0.2s; }
\t.rpt-card:hover { border-color: var(--clr-gold-dim); box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
\t.rpt-paused { opacity: 0.55; }

\t.rpt-card-top { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
\t.rpt-url { font-size: 14px; font-weight: 700; font-family: var(--font-mono); color: var(--clr-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
\t.rpt-recip { font-size: 12px; color: var(--clr-text-muted); margin-top: 3px; }
\t.rpt-score { font-size: 22px; font-weight: 800; font-family: var(--font-mono); flex-shrink: 0; }

\t.rpt-card-btm { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--clr-border); }
\t.rpt-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
\t.rpt-badge { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border-radius: var(--radius-full); }
\t.rpt-active { background: rgba(16,185,129,0.12); color: var(--clr-success); }
\t.rpt-paused-badge { background: rgba(245,158,11,0.12); color: var(--clr-warning); }

\t@media (max-width: 640px) {
\t\t.rpt-stats { grid-template-columns: repeat(2, 1fr); }
\t\t.rpt-card-btm { flex-direction: column; gap: 10px; align-items: flex-start; }
\t}
</style>
"""

# Append CSS at the end — Svelte supports multiple <style> blocks
a += css_block
print("+ Added CSS styles")

open(ACCOUNT, "w").write(a)
print("\n═══ Done ═══")
print("Build: cp .env.example .env && npm run build && npx gh-pages -d build -t")
