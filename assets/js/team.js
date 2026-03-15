/* ══════════════════════════════════════════════════════════
   BSCAN Team Management — JavaScript
   ══════════════════════════════════════════════════════════ */

var A = 'https://api-bscan.balancewises.io';
var T = localStorage.getItem('bscan_token') || '';
var U = null;

async function init() {
    var p = new URLSearchParams(location.search);
    var inv = p.get('invite');

    if (!T) { document.getElementById('auth-gate').style.display = 'block'; return; }

    try {
        var r = await fetch(A + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + T } });
        if (!r.ok) throw new Error();
        U = await r.json();

        // Accept invite if token present
        if (inv) {
            await acceptInvite(inv);
            var r2 = await fetch(A + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + T } });
            if (r2.ok) U = await r2.json();
        }

        if (U.plan !== 'agency') { document.getElementById('upgrade-gate').style.display = 'block'; return; }
        document.getElementById('team-dash').style.display = 'block';
        loadTeam();
    } catch (e) {
        localStorage.removeItem('bscan_token');
        document.getElementById('auth-gate').style.display = 'block';
    }
}

async function loadTeam() {
    try {
        var r = await fetch(A + '/api/team', { headers: { 'Authorization': 'Bearer ' + T } });
        var d = await r.json();
        var tm = d.team || [];
        document.getElementById('team-count').textContent = tm.length + ' / ' + (d.max_members || 5) + ' seats';
        var list = document.getElementById('team-list');

        if (!tm.length) {
            list.innerHTML = '<div class="empty"><div class="empty-icon">&#128101;</div><h3>No team members yet</h3><p>Invite your first colleague to get started.</p></div>';
            return;
        }

        var colors = ['blue', 'gold', 'green'];
        list.innerHTML = tm.map(function(m, i) {
            var init = (m.name || m.email)[0].toUpperCase();
            var col = colors[i % colors.length];
            var name = m.name ? '<strong>' + m.name + '</strong> &middot; ' : '';
            var role = m.role === 'admin' ? '<span style="color:var(--accent-gold);">Admin</span>' : 'Member';
            var joined = m.joined_at
                ? 'Joined ' + new Date(m.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Invited ' + new Date(m.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            return '<div class="member"><div class="member-av ' + col + '">' + init + '</div><div class="member-info"><div class="member-email">' + m.email + '</div><div class="member-meta">' + name + role + ' &middot; ' + joined + '</div></div><span class="status ' + m.status + '">' + m.status + '</span>' + (m.status !== 'removed' ? '<button class="btn-d" onclick="removeMember(\'' + m.id + '\')">Remove</button>' : '') + '</div>';
        }).join('');
    } catch (e) {
        document.getElementById('team-list').innerHTML = '<div class="empty"><h3>Could not load team</h3><p>Please refresh the page.</p></div>';
    }
}

async function invite() {
    var email = document.getElementById('inv-email').value.trim();
    var role = document.getElementById('inv-role').value;
    var btn = document.getElementById('inv-btn');
    if (!email || !email.includes('@')) { document.getElementById('inv-email').focus(); return; }

    btn.disabled = true; btn.textContent = 'Sending...';
    document.getElementById('t-er').classList.remove('on');
    document.getElementById('t-ok').classList.remove('on');

    try {
        var r = await fetch(A + '/api/team/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + T },
            body: JSON.stringify({ email: email, role: role }),
        });
        var d = await r.json();
        if (!r.ok) throw new Error(d.detail || 'Invite failed');
        document.getElementById('t-ok-msg').textContent = d.message || 'Invitation sent to ' + email;
        document.getElementById('t-ok').classList.add('on');
        document.getElementById('inv-email').value = '';
        loadTeam();
    } catch (e) {
        document.getElementById('t-er-msg').textContent = e.message;
        document.getElementById('t-er').classList.add('on');
    }
    btn.disabled = false; btn.textContent = 'Send Invite';
}

document.getElementById('inv-email').addEventListener('keydown', function(e) { if (e.key === 'Enter') invite(); });

async function removeMember(id) {
    if (!confirm('Remove this team member? They will be downgraded to the Free plan.')) return;
    try {
        await fetch(A + '/api/team/members/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + T } });
        document.getElementById('t-ok-msg').textContent = 'Team member removed.';
        document.getElementById('t-ok').classList.add('on');
        loadTeam();
    } catch (e) {}
}

async function acceptInvite(token2) {
    try {
        var r = await fetch(A + '/api/team/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + T },
            body: JSON.stringify({ token: token2 }),
        });
        var d = await r.json();
        if (r.ok) {
            document.getElementById('t-ok-msg').textContent = d.message || 'You have joined the team!';
            document.getElementById('t-ok').classList.add('on');
            history.replaceState({}, '', location.pathname);
        } else {
            document.getElementById('t-er-msg').textContent = d.detail || 'Could not accept invitation.';
            document.getElementById('t-er').classList.add('on');
        }
    } catch (e) {}
}

init();


/* ══════════════════════════════════════════════════════════
   Chat Widget
   ══════════════════════════════════════════════════════════ */
(function() {
    var API_BASE = 'https://api-bscan.balancewises.io';
    var chatOpen = false; var chatHistory = []; var currentScanId = null;
    function getScanId() { if (window._lastScanId) return window._lastScanId; var p = new URLSearchParams(location.search); if (p.get('challenge')) return p.get('challenge'); return null; }
    window.toggleChat = function() { chatOpen = !chatOpen; document.getElementById('chat-window').style.display = chatOpen ? 'block' : 'none'; document.getElementById('chat-btn-icon').textContent = chatOpen ? '✕' : '💬'; document.getElementById('chat-unread').style.display = 'none'; if (window.innerWidth <= 768) document.body.style.overflow = chatOpen ? 'hidden' : ''; if (chatOpen) { document.getElementById('chat-input').focus(); currentScanId = getScanId(); } };
    window.sendQuick = function(text) { document.getElementById('chat-quick').style.display = 'none'; document.getElementById('chat-input').value = text; sendChat(); };
    window.sendChat = function() { var input = document.getElementById('chat-input'); var text = input.value.trim(); if (!text) return; input.value = ''; var msgs = document.getElementById('chat-messages'); var userDiv = document.createElement('div'); userDiv.className = 'chat-msg user'; userDiv.innerHTML = '<div style="max-width:85%;background:#3b82f6;border-radius:12px 12px 4px 12px;padding:10px 14px;margin-left:auto;"><div style="font-size:13px;color:#fff;line-height:1.5;">' + escHtml(text) + '</div></div>'; msgs.appendChild(userDiv); var typingDiv = document.createElement('div'); typingDiv.className = 'chat-msg bot'; typingDiv.id = 'chat-typing'; typingDiv.innerHTML = '<div style="max-width:85%;background:#141d33;border:1px solid #1e2d4a;border-radius:12px 12px 12px 4px;padding:12px 14px;"><div style="display:flex;gap:4px;align-items:center;"><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite;"></span><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite .2s;"></span><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite .4s;"></span></div></div>'; msgs.appendChild(typingDiv); msgs.scrollTop = msgs.scrollHeight; chatHistory.push({ role: 'user', content: text }); fetch(API_BASE + '/api/scan/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, scan_id: currentScanId || getScanId(), conversation_history: chatHistory.slice(-10) }) }).then(function(r) { return r.json(); }).then(function(d) { var typing = document.getElementById('chat-typing'); if (typing) typing.remove(); var reply = d.reply || 'Sorry, I could not generate a response.'; chatHistory.push({ role: 'assistant', content: reply }); var botDiv = document.createElement('div'); botDiv.className = 'chat-msg bot'; botDiv.innerHTML = '<div style="max-width:85%;background:#141d33;border:1px solid #1e2d4a;border-radius:12px 12px 12px 4px;padding:12px 14px;"><div style="font-size:13px;color:#e2e8f0;line-height:1.6;">' + escHtml(reply) + '</div></div>'; msgs.appendChild(botDiv); msgs.scrollTop = msgs.scrollHeight; if (d.scan_id) currentScanId = d.scan_id; }).catch(function() { var typing = document.getElementById('chat-typing'); if (typing) typing.remove(); var errDiv = document.createElement('div'); errDiv.className = 'chat-msg bot'; errDiv.innerHTML = '<div style="max-width:85%;background:#141d33;border:1px solid rgba(239,68,68,.2);border-radius:12px 12px 12px 4px;padding:12px 14px;"><div style="font-size:13px;color:#ef4444;line-height:1.5;">Connection error. Please try again.</div></div>'; msgs.appendChild(errDiv); msgs.scrollTop = msgs.scrollHeight; }); };
    function escHtml(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
    setTimeout(function() { if (!chatOpen) document.getElementById('chat-unread').style.display = 'flex'; }, 8000);
})();


/* ══════════════════════════════════════════════════════════
   Mobile Menu
   ══════════════════════════════════════════════════════════ */
(function() {
    var menuOpen = false;
    window.toggleMobileMenu = function() { menuOpen = !menuOpen; var menu = document.getElementById('mobile-menu'); var iconOpen = document.getElementById('menu-icon-open'); var iconClose = document.getElementById('menu-icon-close'); if (menuOpen) { menu.classList.add('open'); iconOpen.style.display = 'none'; iconClose.style.display = 'block'; } else { menu.classList.remove('open'); iconOpen.style.display = 'block'; iconClose.style.display = 'none'; } };
    window.closeMobileMenu = function() { menuOpen = false; var menu = document.getElementById('mobile-menu'); var iconOpen = document.getElementById('menu-icon-open'); var iconClose = document.getElementById('menu-icon-close'); if (menu) menu.classList.remove('open'); if (iconOpen) iconOpen.style.display = 'block'; if (iconClose) iconClose.style.display = 'none'; };
    window.addEventListener('resize', function() { if (window.innerWidth > 640) closeMobileMenu(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeMobileMenu(); });
})();
