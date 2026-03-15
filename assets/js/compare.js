/* ══════════════════════════════════════════════════════════
   BSCAN Compare — JavaScript
   ══════════════════════════════════════════════════════════ */

var API = 'https://api-bscan.balancewises.io';

function sc(v) { return v >= 80 ? 'green' : v >= 60 ? 'blue' : v >= 40 ? 'gold' : 'red'; }
function gr(v) { return v >= 80 ? 'Excellent' : v >= 60 ? 'Good' : v >= 40 ? 'Warning' : 'Poor'; }
function grCol(v) { return v >= 80 ? 'var(--success)' : v >= 60 ? 'var(--accent-blue)' : v >= 40 ? 'var(--accent-gold)' : 'var(--danger)'; }

async function runCompare() {
    var a = document.getElementById('url-a').value.trim();
    var b = document.getElementById('url-b').value.trim();
    var err = document.getElementById('error-msg');
    err.classList.remove('active');
    if (!a || !b) { err.textContent = 'Please enter both URLs.'; err.classList.add('active'); return; }
    if (!a.startsWith('http')) a = 'https://' + a;
    if (!b.startsWith('http')) b = 'https://' + b;

    var email = localStorage.getItem('bscan_email') || '';
    if (!email) { err.textContent = 'Please scan a site first to set your email, or log in to your account.'; err.classList.add('active'); return; }

    var btn = document.getElementById('compare-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Comparing...';
    document.getElementById('results').classList.remove('active');
    var pw = document.getElementById('progress-wrap'); pw.classList.add('active');
    var pf = document.getElementById('progress-fill'); var pt = document.getElementById('progress-text');
    pf.style.width = '0%';

    var steps = ['Scanning ' + a.replace('https://', '').split('/')[0] + '...', 'Scanning ' + b.replace('https://', '').split('/')[0] + '...', 'Detecting tech stacks...', 'Checking SSL & security...', 'Analysing enrichment data...', 'Comparing scores...', 'Generating insights...'];
    var si = 0;
    var iv = setInterval(function() { if (si < steps.length) { pt.textContent = steps[si]; pf.style.width = Math.min(15 + si * 12, 90) + '%'; si++; } }, 2500);

    try {
        var r = await fetch(API + '/api/scan/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url_a: a, url_b: b, email: email }) });
        clearInterval(iv);
        if (!r.ok) { var e = await r.json().catch(function() { return {}; }); throw new Error(e.detail || 'Error ' + r.status); }
        var d = await r.json();
        pf.style.width = '100%'; pt.textContent = 'Comparison complete!';
        setTimeout(function() { pw.classList.remove('active'); renderComparison(d); }, 500);
    } catch (e) {
        clearInterval(iv); pw.classList.remove('active');
        err.textContent = e.message; err.classList.add('active');
    } finally {
        btn.disabled = false; btn.innerHTML = '⚔️ Compare Websites';
    }
}

function renderComparison(d) {
    var a = d.site_a, b = d.site_b, ins = d.insights || [];
    var da = a.domain, db = b.domain;
    var fa = 'https://www.google.com/s2/favicons?domain=' + da + '&sz=32';
    var fb = 'https://www.google.com/s2/favicons?domain=' + db + '&sz=32';
    var sa = a.scores, sb = b.scores;
    var winA = sa.overall >= sb.overall;

    var h = '';

    // Score header
    h += '<div class="score-compare">';
    h += '<div class="score-side' + (winA ? ' winner' : '') + '"><div class="domain"><img src="' + fa + '" alt="" onerror="this.style.display=\'none\'"> ' + da + '</div><div class="big-score ' + sc(sa.overall) + '">' + sa.overall + '</div><div class="grade" style="background:' + grCol(sa.overall) + '20;color:' + grCol(sa.overall) + '">' + gr(sa.overall) + '</div></div>';
    h += '<div class="score-divider">VS</div>';
    h += '<div class="score-side' + (!winA ? ' winner' : '') + '"><div class="domain"><img src="' + fb + '" alt="" onerror="this.style.display=\'none\'"> ' + db + '</div><div class="big-score ' + sc(sb.overall) + '">' + sb.overall + '</div><div class="grade" style="background:' + grCol(sb.overall) + '20;color:' + grCol(sb.overall) + '">' + gr(sb.overall) + '</div></div>';
    h += '</div>';

    // Category bars
    h += '<div class="cat-grid">';
    var cats = [['seo', 'SEO'], ['performance', 'Performance'], ['accessibility', 'Accessibility'], ['security', 'Security'], ['mobile', 'Mobile'], ['links', 'Links']];
    cats.forEach(function(c) {
        var key = c[0], label = c[1], va = sa[key], vb = sb[key];
        var ca = grCol(va), cb = grCol(vb);
        var aw = va > vb, bw = vb > va;
        h += '<div class="cat-row">';
        h += '<div class="cat-score left" style="color:' + ca + '">' + va + '</div>';
        h += '<div class="cat-bar left"><div class="cat-bar-fill" style="width:' + va + '%;background:' + ca + '"></div></div>';
        h += '<div class="cat-icon left">' + (aw ? '👑' : '') + '</div>';
        h += '<div class="cat-label">' + label + '</div>';
        h += '<div class="cat-icon right">' + (bw ? '👑' : '') + '</div>';
        h += '<div class="cat-bar right"><div class="cat-bar-fill" style="width:' + vb + '%;background:' + cb + '"></div></div>';
        h += '<div class="cat-score right" style="color:' + cb + '">' + vb + '</div>';
        h += '</div>';
    });
    h += '</div>';

    // Tech comparison
    var techA = new Set((a.enrichment || {}).tech_stack ? (a.enrichment.tech_stack.technologies || []) : []);
    var techB = new Set((b.enrichment || {}).tech_stack ? (b.enrichment.tech_stack.technologies || []) : []);
    var shared = new Set([...techA].filter(function(x) { return techB.has(x); }));
    var onlyA = new Set([...techA].filter(function(x) { return !techB.has(x); }));
    var onlyB = new Set([...techB].filter(function(x) { return !techA.has(x); }));

    if (techA.size || techB.size) {
        h += '<div class="tech-compare">';
        h += '<div class="tech-col"><div class="tech-col-head"><img src="' + fa + '" alt=""> ' + da + ' <span style="font-size:10px;color:var(--text-muted);margin-left:auto">' + techA.size + ' technologies</span></div><div class="tech-col-body">';
        [...techA].sort().forEach(function(t) { h += '<span class="tech-tag ' + (onlyA.has(t) ? 'unique' : 'shared') + '">' + t + (onlyA.has(t) ? ' ✓' : '') + '</span>'; });
        [...onlyB].sort().forEach(function(t) { h += '<span class="tech-tag missing">' + t + '</span>'; });
        h += '</div></div>';
        h += '<div class="tech-col"><div class="tech-col-head"><img src="' + fb + '" alt=""> ' + db + ' <span style="font-size:10px;color:var(--text-muted);margin-left:auto">' + techB.size + ' technologies</span></div><div class="tech-col-body">';
        [...techB].sort().forEach(function(t) { h += '<span class="tech-tag ' + (onlyB.has(t) ? 'unique' : 'shared') + '">' + t + (onlyB.has(t) ? ' ✓' : '') + '</span>'; });
        [...onlyA].sort().forEach(function(t) { h += '<span class="tech-tag missing">' + t + '</span>'; });
        h += '</div></div>';
        h += '</div>';
    }

    // Insights
    if (ins.length) {
        h += '<div class="insights"><div class="insights-head">💡 Key Insights <span style="font-size:12px;color:var(--text-muted);font-weight:400">' + ins.length + ' findings</span></div>';
        ins.forEach(function(i) {
            var wClass = i.winner === da ? 'a' : i.winner === db ? 'b' : 'tie';
            var wLabel = i.winner === da ? da : i.winner === db ? db : i.winner === 'tie' ? 'Tie' : 'Info';
            h += '<div class="insight"><div class="insight-icon">' + i.icon + '</div><div class="insight-body"><div class="insight-title">' + i.title + '</div><div class="insight-detail">' + i.detail + '</div>' + (i.winner ? '<span class="insight-winner ' + wClass + '">' + wLabel + '</span>' : '') + '</div></div>';
        });
        h += '</div>';
    }

    // CTA
    h += '<div class="cta-box"><h3>Want to beat your competitor?</h3><p>Our team can fix every issue found in this report — and build you a faster, more secure website.</p><a href="https://balancewises.io/#contact?compare=' + da + '+vs+' + db + '">Get a Free Quote →</a><a href="/" class="outline">Run Another Comparison</a></div>';

    document.getElementById('results').innerHTML = h;
    document.getElementById('results').classList.add('active');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Pre-fill from URL params
var params = new URLSearchParams(location.search);
if (params.get('a')) document.getElementById('url-a').value = params.get('a');
if (params.get('b')) document.getElementById('url-b').value = params.get('b');

document.getElementById('url-a').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('url-b').focus(); });
document.getElementById('url-b').addEventListener('keydown', function(e) { if (e.key === 'Enter') runCompare(); });


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
