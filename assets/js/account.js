/* ══════════════════════════════════════════════════════════
   BSCAN Account Dashboard — JavaScript
   ══════════════════════════════════════════════════════════ */

const API = 'https://api-bscan.balancewises.io';
let token = localStorage.getItem('bscan_token') || '';
let currentUser = null;
let isRegisterMode = false;

// ── Change Password ─────────────────────────────────────
function openPwModal() {
    document.getElementById('pw-modal').classList.add('active');
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-confirm').value = '';
    document.getElementById('pw-error').classList.remove('active');
    document.getElementById('pw-success').classList.remove('active');
}

function closePwModal() {
    document.getElementById('pw-modal').classList.remove('active');
}

async function changePassword() {
    const current = document.getElementById('pw-current').value;
    const newPw = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    const errorEl = document.getElementById('pw-error');
    const successEl = document.getElementById('pw-success');
    const btn = document.getElementById('pw-submit');

    errorEl.classList.remove('active');
    successEl.classList.remove('active');

    if (!current || !newPw || !confirm) { errorEl.textContent = 'All fields are required.'; errorEl.classList.add('active'); return; }
    if (newPw.length < 8) { errorEl.textContent = 'New password must be at least 8 characters.'; errorEl.classList.add('active'); return; }
    if (newPw !== confirm) { errorEl.textContent = 'New passwords do not match.'; errorEl.classList.add('active'); return; }

    btn.disabled = true; btn.textContent = 'Updating...';

    try {
        const res = await fetch(API + '/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ current_password: current, new_password: newPw }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to change password');
        successEl.textContent = 'Password changed successfully!';
        successEl.classList.add('active');
        setTimeout(() => closePwModal(), 2000);
    } catch (e) {
        errorEl.textContent = e.message;
        errorEl.classList.add('active');
    }

    btn.disabled = false; btn.textContent = 'Update Password';
}

// ── Forgot Password ─────────────────────────────────────
function showForgotPassword() {
    const card = document.querySelector('.auth-card');
    card.innerHTML = '<h2>Reset your <span class="gold">password</span></h2>'
        + '<p class="auth-sub">Enter your email and we\'ll send you a reset link.</p>'
        + '<div class="auth-field"><label for="reset-email">Email address</label>'
        + '<input type="email" id="reset-email" placeholder="you@company.com" autocomplete="email"></div>'
        + '<div class="auth-error" id="reset-error"></div>'
        + '<div class="modal-success" id="reset-success"></div>'
        + '<button class="auth-submit" id="reset-submit" onclick="sendResetEmail()">Send Reset Link</button>'
        + '<div class="auth-toggle" style="margin-top:16px;"><a onclick="location.reload()" style="color:var(--accent-blue);cursor:pointer;">&larr; Back to sign in</a></div>';
    var savedEmail = localStorage.getItem('bscan_email') || '';
    if (savedEmail) document.getElementById('reset-email').value = savedEmail;
}

async function sendResetEmail() {
    const email = document.getElementById('reset-email').value.trim();
    const errorEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');
    const btn = document.getElementById('reset-submit');

    errorEl.classList.remove('active'); successEl.classList.remove('active');
    if (!email) { errorEl.textContent = 'Please enter your email.'; errorEl.classList.add('active'); return; }

    btn.disabled = true; btn.textContent = 'Sending...';
    try {
        const res = await fetch(API + '/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        const data = await res.json();
        successEl.textContent = data.message || 'If that email exists, a reset link has been sent.';
        successEl.classList.add('active');
    } catch (e) { errorEl.textContent = 'Network error. Please try again.'; errorEl.classList.add('active'); }
    btn.disabled = false; btn.textContent = 'Send Reset Link';
}

// ── Handle reset token in URL ───────────────────────────
function checkResetToken() {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset_token');
    if (!resetToken) return false;
    window.history.replaceState({}, '', window.location.pathname);
    const card = document.querySelector('.auth-card');
    card.innerHTML = '<h2>Set new <span class="gold">password</span></h2>'
        + '<p class="auth-sub">Choose a new password for your BSCAN account.</p>'
        + '<div class="auth-field"><label>New Password</label><input type="password" id="new-pw" placeholder="Minimum 8 characters"></div>'
        + '<div class="auth-field"><label>Confirm Password</label><input type="password" id="confirm-pw" placeholder="Re-enter new password"></div>'
        + '<div class="auth-error" id="reset-error"></div><div class="modal-success" id="reset-success"></div>'
        + '<button class="auth-submit" onclick="submitNewPassword(\'' + resetToken + '\')">Reset Password</button>';
    return true;
}

async function submitNewPassword(resetToken) {
    const newPw = document.getElementById('new-pw').value;
    const confirmPw = document.getElementById('confirm-pw').value;
    const errorEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');
    errorEl.classList.remove('active'); successEl.classList.remove('active');
    if (!newPw || !confirmPw) { errorEl.textContent = 'Please fill in both fields.'; errorEl.classList.add('active'); return; }
    if (newPw.length < 8) { errorEl.textContent = 'Password must be at least 8 characters.'; errorEl.classList.add('active'); return; }
    if (newPw !== confirmPw) { errorEl.textContent = 'Passwords do not match.'; errorEl.classList.add('active'); return; }
    try {
        const res = await fetch(API + '/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, new_password: newPw }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Reset failed');
        successEl.textContent = 'Password reset! Redirecting to sign in...'; successEl.classList.add('active');
        setTimeout(() => location.reload(), 2000);
    } catch (e) { errorEl.textContent = e.message; errorEl.classList.add('active'); }
}

// ── Init ─────────────────────────────────────────────────
async function init() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (checkResetToken()) { showAuth(); return; }

    if (token) {
        try {
            const res = await fetch(API + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.ok) {
                currentUser = await res.json();
                showDashboard();
                if (sessionId) checkSuccessRedirect();
                loadHistory();
                return;
            }
        } catch (e) {}
        localStorage.removeItem('bscan_token'); token = '';
    }

    if (sessionId) {
        showAuth();
        document.getElementById('success-banner').classList.add('active');
        var savedEmail = localStorage.getItem('bscan_email') || '';
        if (savedEmail) document.getElementById('auth-email').value = savedEmail;
        isRegisterMode = true;
        document.getElementById('name-field').style.display = 'block';
        document.getElementById('auth-submit').textContent = 'Create Account';
        document.getElementById('auth-toggle-text').textContent = 'Already have an account?';
        document.getElementById('auth-toggle-link').textContent = 'Sign in';
        document.getElementById('success-msg').textContent = 'Create your account below to access your dashboard, scan history, and start auditing.';
        window.history.replaceState({}, '', window.location.pathname);
        return;
    }
    showAuth();
}

// ── Auth UI ──────────────────────────────────────────────
function showAuth() {
    document.getElementById('auth-section').classList.add('active');
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('nav-user').style.display = 'none';
    document.getElementById('nav-logout').style.display = 'none';
}

function showDashboard() {
    document.getElementById('auth-section').classList.remove('active');
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('nav-user').style.display = 'flex';
    document.getElementById('nav-logout').style.display = 'block';
    document.getElementById('nav-email').textContent = currentUser.email;
    document.getElementById('nav-avatar').textContent = (currentUser.name || currentUser.email)[0].toUpperCase();
    document.getElementById('user-name').textContent = currentUser.name || 'User';

    const plan = currentUser.plan || 'free';
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    document.getElementById('stat-plan').textContent = planLabel;
    const badge = document.getElementById('plan-badge');
    badge.textContent = plan.toUpperCase();
    badge.className = 'plan-badge ' + plan;
    document.getElementById('stat-scans').textContent = currentUser.scans_this_month || 0;

    if (plan === 'free') document.getElementById('stat-scans-sub').innerHTML = 'of 3 free scans &middot; <a href="/#pricing">Upgrade</a>';
    else if (plan === 'pro') document.getElementById('stat-scans-sub').textContent = 'of 30 scans this month';
    else document.getElementById('stat-scans-sub').textContent = 'unlimited scans';

    const created = new Date(currentUser.created_at);
    document.getElementById('stat-date').textContent = created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('name-field').style.display = isRegisterMode ? 'block' : 'none';
    document.getElementById('auth-title').innerHTML = isRegisterMode ? 'Create your <span class="gold">BSCAN</span> account' : 'Sign in to <span class="gold">BSCAN</span>';
    document.getElementById('auth-sub').textContent = isRegisterMode ? 'Get started with free website audits.' : 'Access your dashboard, scan history, and subscription.';
    document.getElementById('auth-submit').textContent = isRegisterMode ? 'Create Account' : 'Sign In';
    document.getElementById('auth-toggle-text').textContent = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
    document.getElementById('auth-toggle-link').textContent = isRegisterMode ? 'Sign in' : 'Create one';
    document.getElementById('auth-error').classList.remove('active');
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();
    const errorEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit');

    if (!email || !password) { errorEl.textContent = 'Please fill in all fields.'; errorEl.classList.add('active'); return; }
    if (isRegisterMode && !name) { errorEl.textContent = 'Please enter your name.'; errorEl.classList.add('active'); return; }

    btn.disabled = true; btn.textContent = isRegisterMode ? 'Creating account...' : 'Signing in...'; errorEl.classList.remove('active');

    try {
        const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
        const body = isRegisterMode ? { email, password, name } : { email, password };
        const res = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Authentication failed');
        token = data.access_token;
        localStorage.setItem('bscan_token', token);
        currentUser = data.user;
        showDashboard(); checkSuccessRedirect(); loadHistory();
    } catch (e) { errorEl.textContent = e.message; errorEl.classList.add('active'); }

    btn.disabled = false; btn.textContent = isRegisterMode ? 'Create Account' : 'Sign In';
}

['auth-email', 'auth-password', 'auth-name'].forEach(function(id) {
    document.getElementById(id).addEventListener('keydown', function(e) { if (e.key === 'Enter') handleAuth(); });
});

function logout() {
    localStorage.removeItem('bscan_token'); token = ''; currentUser = null; location.reload();
}

// ── Stripe ───────────────────────────────────────────────
function checkSuccessRedirect() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session_id')) {
        document.getElementById('success-banner').classList.add('active');
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(async function() {
            try {
                const res = await fetch(API + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) { currentUser = await res.json(); showDashboard(); }
            } catch(e) {}
        }, 3000);
    }
}

async function openPortal() {
    try {
        const res = await fetch(API + '/api/billing/portal', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.portal_url) window.location = data.portal_url;
        else alert(data.detail || 'No active subscription found. Purchase a plan first.');
    } catch (e) { alert('Could not open subscription portal.'); }
}

// ── Scan History ─────────────────────────────────────────
async function loadHistory() {
    const list = document.getElementById('history-list');
    const countEl = document.getElementById('history-count');
    const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 31);

    try {
        const res = await fetch(API + '/api/scans/history?from_date=' + from.toISOString().split('T')[0] + '&to_date=' + to.toISOString().split('T')[0] + '&limit=20', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128202;</div><h3>No scans yet</h3><p>Run your first scan above to see results here.</p></div>'; return; }

        const data = await res.json();
        const items = data.items || [];
        countEl.textContent = items.length + ' scan' + (items.length !== 1 ? 's' : '');

        if (items.length === 0) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128202;</div><h3>No scans yet</h3><p>Run your first scan above to see results here.</p></div>'; return; }

        list.innerHTML = items.map(function(scan) {
            var s = scan.overall_score || 0;
            var lev = s >= 80 ? 'excellent' : s >= 60 ? 'good' : s >= 40 ? 'warning' : 'poor';
            var date = new Date(scan.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            var url = scan.url.replace('https://', '').replace('http://', '').split('/')[0];
            var cats = [{ v: scan.seo_score, l: 'SEO' }, { v: scan.performance_score, l: 'Perf' }, { v: scan.accessibility_score, l: 'A11y' }, { v: scan.security_score, l: 'Sec' }];
            var catHtml = cats.map(function(c) { var cl = (c.v||0) >= 80 ? 'excellent' : (c.v||0) >= 60 ? 'good' : (c.v||0) >= 40 ? 'warning' : 'poor'; return '<span class="scan-cat ' + cl + '">' + c.l + ' ' + (c.v||0) + '</span>'; }).join('');
            return '<div class="scan-row" onclick="viewScan(\'' + scan.id + '\')"><div class="scan-score ' + lev + '">' + s + '</div><div class="scan-info"><div class="scan-url">' + url + '</div><div class="scan-date">' + date + '</div></div><div class="scan-cats">' + catHtml + '</div><span class="scan-arrow">&rsaquo;</span></div>';
        }).join('');
    } catch (e) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128202;</div><h3>Could not load history</h3><p>Please try refreshing the page.</p></div>'; }
}

function viewScan(id) { /* Future: open scan detail */ }

// ── Dashboard Scan ───────────────────────────────────────
document.getElementById('scan-url').addEventListener('keydown', function(e) { if (e.key === 'Enter') runDashScan(); });

async function runDashScan() {
    var url = document.getElementById('scan-url').value.trim();
    if (!url) return document.getElementById('scan-url').focus();
    if (!url.startsWith('http')) url = 'https://' + url;

    var btn = document.getElementById('scan-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Scanning...';
    document.getElementById('inline-results').classList.remove('active');

    var terminal = document.getElementById('dash-terminal');
    var wrap = document.getElementById('dash-terminal-wrap');
    var bar = document.getElementById('dash-progress');
    terminal.innerHTML = ''; wrap.classList.add('active'); bar.style.width = '0%';

    var steps = [
        { t: 'Initialising BSCAN...', p: 5 }, { t: 'Resolving ' + url + '...', p: 12 },
        { t: 'Checking SSL certificate...', p: 20 }, { t: 'Fetching page content...', p: 30 },
        { t: 'Parsing HTML structure...', p: 38 }, { t: 'Scanning meta tags...', p: 45 },
        { t: 'Analysing heading hierarchy...', p: 52 }, { t: 'Crawling links...', p: 60 },
        { t: 'Auditing image alt text...', p: 68 }, { t: 'Measuring performance...', p: 75 },
        { t: 'Running accessibility checks...', p: 82 }, { t: 'Checking mobile readiness...', p: 88 },
        { t: 'Scanning security headers...', p: 94 },
    ];

    var lineIndex = 0;
    var lineInterval = setInterval(function() {
        if (lineIndex >= steps.length) { clearInterval(lineInterval); return; }
        addLine(terminal, lineIndex + 1, steps[lineIndex].t, 'ok');
        bar.style.width = steps[lineIndex].p + '%'; lineIndex++;
    }, 280);

    try {
        var res = await fetch(API + '/api/scan', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ url: url, email: currentUser.email }),
        });
        clearInterval(lineInterval);
        if (!res.ok) { var err = await res.json().catch(function() { return {}; }); throw new Error(err.detail || 'Scan failed (' + res.status + ')'); }
        var data = await res.json();
        while (lineIndex < steps.length) { addLine(terminal, lineIndex + 1, steps[lineIndex].t, 'ok'); lineIndex++; }
        addLine(terminal, lineIndex + 1, 'Report generated ✓', 'ok'); bar.style.width = '100%';
        setTimeout(function() { wrap.classList.remove('active'); showInlineResults(data); loadHistory(); }, 500);
    } catch (err) {
        clearInterval(lineInterval);
        addLine(terminal, lineIndex + 1, 'Error: ' + err.message, 'fail'); bar.style.width = '100%';
    }

    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> BSCAN It';
}

function addLine(terminal, num, text, status) {
    var line = document.createElement('div'); line.className = 't-line';
    var cls = status === 'ok' ? 't-ok' : 't-fail';
    var icon = status === 'ok' ? '✓' : '✗';
    line.innerHTML = '<span class="t-prefix">[' + String(num).padStart(2, '0') + ']</span> <span class="t-text">' + text + '</span> <span class="' + cls + '">' + icon + '</span>';
    terminal.appendChild(line); terminal.scrollTop = terminal.scrollHeight;
}

// ── Show Inline Results ──────────────────────────────────
function showInlineResults(data) {
    var overall = data.overall_score || 0;
    var color = overall >= 80 ? 'var(--success)' : overall >= 60 ? 'var(--accent-blue)' : overall >= 40 ? 'var(--warning)' : 'var(--danger)';
    var circ = 240.33;
    var offset = circ - (overall / 100) * circ;
    var title = overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : overall >= 40 ? 'Needs work' : 'Critical';
    var desc = overall >= 80 ? 'Only minor tweaks needed.' : overall >= 60 ? 'Solid foundation, some issues.' : overall >= 40 ? 'Several issues affecting performance.' : 'Major issues — immediate action needed.';

    document.getElementById('dash-overall').innerHTML = '<div class="ring-wrap"><svg class="ring-svg" viewBox="0 0 90 90"><circle class="ring-bg" cx="45" cy="45" r="38"/><circle class="ring-fg" cx="45" cy="45" r="38" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" style="stroke:' + color + '"/></svg><div class="ring-label"><span class="ring-num" style="color:' + color + '">' + overall + '</span><span class="ring-sub">Overall</span></div></div><div class="overall-text"><h3>' + title + '</h3><p>' + desc + '</p></div>';

    var cats = [{ k: 'seo_score', l: 'SEO' }, { k: 'performance_score', l: 'Performance' }, { k: 'accessibility_score', l: 'Accessibility' }, { k: 'security_score', l: 'Security' }, { k: 'mobile_score', l: 'Mobile' }, { k: 'links_score', l: 'Links' }];
    document.getElementById('dash-scores').innerHTML = cats.map(function(c) {
        var s = data[c.k] || 0; var lev = s >= 80 ? 'excellent' : s >= 60 ? 'good' : s >= 40 ? 'warning' : 'poor';
        return '<div class="s-card ' + lev + '"><div class="s-num">' + s + '</div><div class="s-label">' + c.l + '</div></div>';
    }).join('');

    var issues = data.issues || [];
    var box = document.getElementById('dash-issues'); box.innerHTML = '';
    var groups = [
        { items: issues.filter(function(i) { return i.severity === 'critical'; }), type: 'crit', title: 'Critical Issues', icon: '✗' },
        { items: issues.filter(function(i) { return i.severity === 'warning'; }), type: 'warn', title: 'Warnings', icon: '⚠' },
        { items: issues.filter(function(i) { return i.severity === 'pass'; }), type: 'pass', title: 'Passed', icon: '✓' },
    ];
    groups.forEach(function(g) {
        if (g.items.length === 0) return;
        var section = document.createElement('div'); section.className = 'issues-group';
        section.innerHTML = '<h3>' + g.title + ' <span class="count-badge ' + g.type + '">' + g.items.length + '</span></h3>';
        g.items.forEach(function(item) {
            var fix = item.fix ? '<div class="issue-fix">Fix: ' + item.fix + '</div>' : '';
            section.innerHTML += '<div class="issue"><div class="issue-icon ' + g.type + '">' + g.icon + '</div><div class="issue-body"><div class="issue-title">' + item.title + '</div><div class="issue-desc">' + item.description + '</div>' + fix + '</div></div>';
        });
        box.appendChild(section);
    });
    document.getElementById('inline-results').classList.add('active');
}

// ── Boot ─────────────────────────────────────────────────
init();


/* ══════════════════════════════════════════════════════════
   Chat Widget
   ══════════════════════════════════════════════════════════ */
(function() {
    var API_BASE = 'https://api-bscan.balancewises.io';
    var chatOpen = false;
    var chatHistory = [];
    var currentScanId = null;

    function getScanId() {
        if (window._lastScanId) return window._lastScanId;
        var params = new URLSearchParams(location.search);
        if (params.get('challenge')) return params.get('challenge');
        return null;
    }

    window.toggleChat = function() {
        chatOpen = !chatOpen;
        document.getElementById('chat-window').style.display = chatOpen ? 'block' : 'none';
        document.getElementById('chat-btn-icon').textContent = chatOpen ? '✕' : '💬';
        document.getElementById('chat-unread').style.display = 'none';
        if (window.innerWidth <= 768) document.body.style.overflow = chatOpen ? 'hidden' : '';
        if (chatOpen) { document.getElementById('chat-input').focus(); currentScanId = getScanId(); }
    };

    window.sendQuick = function(text) {
        document.getElementById('chat-quick').style.display = 'none';
        document.getElementById('chat-input').value = text;
        sendChat();
    };

    window.sendChat = function() {
        var input = document.getElementById('chat-input');
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        var msgs = document.getElementById('chat-messages');

        var userDiv = document.createElement('div');
        userDiv.className = 'chat-msg user';
        userDiv.innerHTML = '<div style="max-width:85%;background:#3b82f6;border-radius:12px 12px 4px 12px;padding:10px 14px;margin-left:auto;"><div style="font-size:13px;color:#fff;line-height:1.5;">' + escHtml(text) + '</div></div>';
        msgs.appendChild(userDiv);

        var typingDiv = document.createElement('div');
        typingDiv.className = 'chat-msg bot'; typingDiv.id = 'chat-typing';
        typingDiv.innerHTML = '<div style="max-width:85%;background:#141d33;border:1px solid #1e2d4a;border-radius:12px 12px 12px 4px;padding:12px 14px;"><div style="display:flex;gap:4px;align-items:center;"><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite;"></span><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite .2s;"></span><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite .4s;"></span></div></div>';
        msgs.appendChild(typingDiv); msgs.scrollTop = msgs.scrollHeight;
        chatHistory.push({ role: 'user', content: text });

        fetch(API_BASE + '/api/scan/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, scan_id: currentScanId || getScanId(), conversation_history: chatHistory.slice(-10) })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var typing = document.getElementById('chat-typing'); if (typing) typing.remove();
            var reply = d.reply || 'Sorry, I could not generate a response. Please try again.';
            chatHistory.push({ role: 'assistant', content: reply });
            var botDiv = document.createElement('div'); botDiv.className = 'chat-msg bot';
            botDiv.innerHTML = '<div style="max-width:85%;background:#141d33;border:1px solid #1e2d4a;border-radius:12px 12px 12px 4px;padding:12px 14px;"><div style="font-size:13px;color:#e2e8f0;line-height:1.6;">' + escHtml(reply) + '</div></div>';
            msgs.appendChild(botDiv); msgs.scrollTop = msgs.scrollHeight;
            if (d.scan_id) currentScanId = d.scan_id;
        })
        .catch(function() {
            var typing = document.getElementById('chat-typing'); if (typing) typing.remove();
            var errDiv = document.createElement('div'); errDiv.className = 'chat-msg bot';
            errDiv.innerHTML = '<div style="max-width:85%;background:#141d33;border:1px solid rgba(239,68,68,.2);border-radius:12px 12px 12px 4px;padding:12px 14px;"><div style="font-size:13px;color:#ef4444;line-height:1.5;">Connection error. Please try again.</div></div>';
            msgs.appendChild(errDiv); msgs.scrollTop = msgs.scrollHeight;
        });
    };

    function escHtml(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }

    setTimeout(function() { if (!chatOpen) document.getElementById('chat-unread').style.display = 'flex'; }, 8000);
})();


/* ══════════════════════════════════════════════════════════
   Mobile Menu
   ══════════════════════════════════════════════════════════ */
(function() {
    var menuOpen = false;

    window.toggleMobileMenu = function() {
        menuOpen = !menuOpen;
        var menu = document.getElementById('mobile-menu');
        var iconOpen = document.getElementById('menu-icon-open');
        var iconClose = document.getElementById('menu-icon-close');
        if (menuOpen) { menu.classList.add('open'); iconOpen.style.display = 'none'; iconClose.style.display = 'block'; }
        else { menu.classList.remove('open'); iconOpen.style.display = 'block'; iconClose.style.display = 'none'; }
    };

    window.closeMobileMenu = function() {
        menuOpen = false;
        var menu = document.getElementById('mobile-menu');
        var iconOpen = document.getElementById('menu-icon-open');
        var iconClose = document.getElementById('menu-icon-close');
        if (menu) menu.classList.remove('open');
        if (iconOpen) iconOpen.style.display = 'block';
        if (iconClose) iconClose.style.display = 'none';
    };

    window.addEventListener('resize', function() { if (window.innerWidth > 640) closeMobileMenu(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeMobileMenu(); });
})();
