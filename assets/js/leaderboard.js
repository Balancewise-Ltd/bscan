/* ══════════════════════════════════════════════════════════
   BSCAN Leaderboard — JavaScript
   ══════════════════════════════════════════════════════════ */

var API = 'https://api-bscan.balancewises.io';

function scoreColor(s) { return s >= 80 ? 'green' : s >= 60 ? 'blue' : s >= 40 ? 'gold' : 'red'; }
function rankClass(r) { return r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : 'normal'; }

async function loadBoard(period) {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('.tab[onclick*="' + period + '"]').classList.add('active');
    var body = document.getElementById('board-body');
    body.innerHTML = '<div class="empty">Loading...</div>';

    try {
        var r = await fetch(API + '/api/scans/leaderboard?period=' + period + '&limit=25');
        var d = await r.json();
        if (!d.leaderboard || !d.leaderboard.length) {
            body.innerHTML = '<div class="empty">No scans yet this period. Be the first! <a href="/">Scan now →</a></div>';
            return;
        }

        body.innerHTML = d.leaderboard.map(function(s, i) {
            var rank = i + 1;
            var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
            var favicon = 'https://www.google.com/s2/favicons?domain=' + s.domain + '&sz=32';
            return '<div class="row" onclick="window.open(\'/\',\'_self\')">'
                + '<div class="rank ' + rankClass(rank) + '">' + (medal || rank) + '</div>'
                + '<div class="site"><div class="site-icon"><img src="' + favicon + '" alt="" onerror="this.style.display=\'none\'"></div><div class="site-name">' + s.domain + '</div></div>'
                + '<div class="score-cell ' + scoreColor(s.overall_score) + '">' + s.overall_score + '</div>'
                + '<div class="mini-score">' + (s.seo_score || '-') + '</div>'
                + '<div class="mini-score">' + (s.security_score || '-') + '</div>'
                + '</div>';
        }).join('');
    } catch (e) {
        body.innerHTML = '<div class="empty">Could not load leaderboard. Please try again.</div>';
    }
}

loadBoard('week');


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
        var p = new URLSearchParams(location.search);
        if (p.get('challenge')) return p.get('challenge');
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

        var userDiv = document.createElement('div'); userDiv.className = 'chat-msg user';
        userDiv.innerHTML = '<div style="max-width:85%;background:#3b82f6;border-radius:12px 12px 4px 12px;padding:10px 14px;margin-left:auto;"><div style="font-size:13px;color:#fff;line-height:1.5;">' + escHtml(text) + '</div></div>';
        msgs.appendChild(userDiv);

        var typingDiv = document.createElement('div'); typingDiv.className = 'chat-msg bot'; typingDiv.id = 'chat-typing';
        typingDiv.innerHTML = '<div style="max-width:85%;background:#141d33;border:1px solid #1e2d4a;border-radius:12px 12px 12px 4px;padding:12px 14px;"><div style="display:flex;gap:4px;align-items:center;"><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite;"></span><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite .2s;"></span><span style="width:6px;height:6px;border-radius:50%;background:#64748b;animation:pulse 1s infinite .4s;"></span></div></div>';
        msgs.appendChild(typingDiv); msgs.scrollTop = msgs.scrollHeight;
        chatHistory.push({ role: 'user', content: text });

        fetch(API_BASE + '/api/scan/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, scan_id: currentScanId || getScanId(), conversation_history: chatHistory.slice(-10) }) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var typing = document.getElementById('chat-typing'); if (typing) typing.remove();
            var reply = d.reply || 'Sorry, I could not generate a response.';
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
