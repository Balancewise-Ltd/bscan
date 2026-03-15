/* ══════════════════════════════════════════════════════════
   BSCAN SEO Dashboard — JavaScript
   ══════════════════════════════════════════════════════════ */

var API = 'https://api-bscan.balancewises.io';
var userPlan = 'guest';
var isLoggedIn = false;

/* ── Tab Switching ────────────────────────────────────── */
function showTab(id) {
    document.querySelectorAll('.seo-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.seo-panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelector('.seo-tab[onclick*="' + id + '"]').classList.add('active');
    document.getElementById('panel-' + id).classList.add('active');
}

/* ── Auth Check ───────────────────────────────────────── */
async function checkAuth() {
    var token = localStorage.getItem('bscan_token');
    if (!token) {
        showAuthGate();
        return;
    }
    try {
        var r = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
        if (r.ok) {
            var u = await r.json();
            userPlan = u.plan || 'free';
            isLoggedIn = true;
            hideAuthGate();
            // Unlock backlinks for Pro/Agency
            if (userPlan === 'pro' || userPlan === 'agency') {
                document.getElementById('bl-paywall').style.display = 'none';
                document.getElementById('bl-tool').style.display = 'block';
            } else {
                document.getElementById('bl-paywall').style.display = 'block';
                document.getElementById('bl-tool').style.display = 'none';
            }
            // Unlock AI for Agency
            if (userPlan === 'agency') {
                document.getElementById('ai-paywall').style.display = 'none';
                document.getElementById('ai-preview').classList.remove('ai-blur');
            }
        } else {
            showAuthGate();
        }
    } catch (e) {
        showAuthGate();
    }
}

function showAuthGate() {
    document.getElementById('auth-gate').classList.add('active');
    document.getElementById('seo-tools').style.display = 'none';
}

function hideAuthGate() {
    document.getElementById('auth-gate').classList.remove('active');
    document.getElementById('seo-tools').style.display = 'block';
    // Default: show backlink paywall (overridden in checkAuth if Pro/Agency)
    document.getElementById('bl-paywall').style.display = 'block';
    document.getElementById('bl-tool').style.display = 'none';
}

/* ── 1. Keyword Research ──────────────────────────────── */
document.getElementById('kw-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') searchKeywords(); });

async function searchKeywords() {
    var input = document.getElementById('kw-input');
    var keyword = input.value.trim();
    if (!keyword) return input.focus();
    var btn = document.getElementById('kw-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Researching...';
    try {
        var r = await fetch(API + '/api/seo/keywords/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: keyword }) });
        var d = await r.json();
        renderKeywordResults(d);
    } catch (e) {
        document.getElementById('kw-results').innerHTML = '<div class="empty"><h3>Could not fetch suggestions</h3><p>' + e.message + '</p></div>';
    }
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Research';
}

function renderKeywordResults(d) {
    document.getElementById('kw-total').textContent = (d.total_keywords || 0) + ' keywords';
    var h = '';
    if (d.suggestions && d.suggestions.length) {
        h += '<div class="kw-group"><div class="kw-group-title">Direct Suggestions <span class="count">' + d.suggestions.length + '</span></div><div class="kw-tags">';
        d.suggestions.forEach(function(k) { h += '<span class="kw-tag" onclick="copyKw(this)">' + esc(k) + '</span>'; });
        h += '</div></div>';
    }
    if (d.questions && d.questions.length) {
        h += '<div class="kw-group"><div class="kw-group-title">Question Keywords <span class="count">' + d.questions.length + '</span></div><div class="kw-tags">';
        d.questions.slice(0, 30).forEach(function(k) { h += '<span class="kw-tag question" onclick="copyKw(this)">' + esc(k) + '</span>'; });
        h += '</div></div>';
    }
    if (d.comparisons && d.comparisons.length) {
        h += '<div class="kw-group"><div class="kw-group-title">Comparison Keywords <span class="count">' + d.comparisons.length + '</span></div><div class="kw-tags">';
        d.comparisons.slice(0, 20).forEach(function(k) { h += '<span class="kw-tag comparison" onclick="copyKw(this)">' + esc(k) + '</span>'; });
        h += '</div></div>';
    }
    if (d.long_tail && d.long_tail.length) {
        h += '<div class="kw-group"><div class="kw-group-title">Long-Tail Ideas <span class="count">' + d.long_tail.length + '</span></div><div class="kw-tags">';
        d.long_tail.slice(0, 40).forEach(function(k) { h += '<span class="kw-tag longtail" onclick="copyKw(this)">' + esc(k) + '</span>'; });
        h += '</div></div>';
    }
    if (d.prepositions && d.prepositions.length) {
        h += '<div class="kw-group"><div class="kw-group-title">Preposition Variations <span class="count">' + d.prepositions.length + '</span></div><div class="kw-tags">';
        d.prepositions.slice(0, 20).forEach(function(k) { h += '<span class="kw-tag" onclick="copyKw(this)">' + esc(k) + '</span>'; });
        h += '</div></div>';
    }
    if (!h) h = '<div class="empty"><h3>No suggestions found</h3><p>Try a different keyword.</p></div>';
    document.getElementById('kw-results').innerHTML = h;
}

function copyKw(el) {
    navigator.clipboard.writeText(el.textContent).then(function() {
        var orig = el.textContent; el.textContent = 'Copied!'; el.style.borderColor = 'var(--success)'; el.style.color = 'var(--success)';
        setTimeout(function() { el.textContent = orig; el.style.borderColor = ''; el.style.color = ''; }, 1200);
    });
}

/* ── 2. GSC Rankings ──────────────────────────────────── */
function connectGSC() {
    var token = localStorage.getItem('bscan_token');
    if (!token) { alert('Please log in first at /account'); return; }
    fetch(API + '/api/seo/gsc/connect', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.auth_url) window.location = d.auth_url; else alert(d.detail || 'Could not start Google connection'); })
    .catch(function() { alert('Connection error'); });
}

function renderGSCDashboard(data) {
    document.getElementById('gsc-gate').style.display = 'none';
    document.getElementById('gsc-dashboard').style.display = 'block';
    var s = data.summary || {};
    document.getElementById('gsc-stats').innerHTML = '<div class="bl-stat"><div class="bl-stat-num blue">' + (s.total_keywords || 0) + '</div><div class="bl-stat-label">Keywords</div></div><div class="bl-stat"><div class="bl-stat-num green">' + (s.total_clicks || 0).toLocaleString() + '</div><div class="bl-stat-label">Clicks</div></div><div class="bl-stat"><div class="bl-stat-num gold">' + (s.total_impressions || 0).toLocaleString() + '</div><div class="bl-stat-label">Impressions</div></div><div class="bl-stat"><div class="bl-stat-num purple">' + (s.average_position || 0) + '</div><div class="bl-stat-label">Avg Position</div></div>';
    var dist = data.position_distribution || {};
    var maxVal = Math.max(dist['1-3'] || 0, dist['4-10'] || 0, dist['11-20'] || 0, dist['21-50'] || 0, dist['50+'] || 0, 1);
    var bars = [{ label: '1-3', val: dist['1-3'] || 0, cls: 'top3' }, { label: '4-10', val: dist['4-10'] || 0, cls: 'top10' }, { label: '11-20', val: dist['11-20'] || 0, cls: 'top20' }, { label: '21-50', val: dist['21-50'] || 0, cls: 'top50' }, { label: '50+', val: dist['50+'] || 0, cls: 'low' }];
    document.getElementById('pos-dist').innerHTML = bars.map(function(b) { var h = Math.max((b.val / maxVal) * 100, 4); return '<div class="pos-bar ' + b.cls + '" style="height:' + h + '%" title="' + b.label + ': ' + b.val + '"></div>'; }).join('');
    document.getElementById('pos-labels').innerHTML = bars.map(function(b) { return '<div class="pos-label">' + b.label + '<br><strong>' + b.val + '</strong></div>'; }).join('');
    var kws = data.top_keywords || [];
    document.getElementById('gsc-kw-count').textContent = kws.length + ' keywords';
    document.getElementById('gsc-keywords').innerHTML = kws.map(function(kw) { var pos = kw.position || 0; var posCls = pos <= 3 ? 'top3' : pos <= 10 ? 'top10' : pos <= 20 ? 'top20' : 'low'; var ctr = kw.ctr || 0; return '<tr><td class="kw-cell">' + esc(kw.keyword || '') + '</td><td class="pos-cell ' + posCls + '">' + pos + '</td><td class="num">' + (kw.clicks || 0).toLocaleString() + '</td><td class="num">' + (kw.impressions || 0).toLocaleString() + '</td><td class="num">' + ctr + '%<div class="ctr-bar"><div class="ctr-fill" style="width:' + Math.min(ctr * 5, 100) + '%"></div></div></td></tr>'; }).join('');
    var opps = data.opportunities || [];
    document.getElementById('gsc-opportunities').innerHTML = opps.length ? opps.map(function(o) { return '<div class="qw-item"><div class="qw-icon high">⚡</div><div class="qw-body"><h4>' + esc(o.keyword) + '</h4><p>Currently position ' + o.position + ' with ' + o.impressions.toLocaleString() + ' impressions/month. ' + esc(o.potential) + '</p><span class="qw-impact high">HIGH POTENTIAL</span></div></div>'; }).join('') : '<div class="empty"><p>No quick wins found yet — keep creating content!</p></div>';
}

/* ── 3. Backlinks ─────────────────────────────────────── */
document.getElementById('bl-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') searchBacklinks(); });

async function searchBacklinks() {
    var input = document.getElementById('bl-input');
    var domain = input.value.trim().replace('https://', '').replace('http://', '').split('/')[0];
    if (!domain) return input.focus();
    var btn = document.getElementById('bl-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Analysing...';
    try {
        var r = await fetch(API + '/api/seo/backlinks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: domain }) });
        var d = await r.json();
        renderBacklinkResults(d);
    } catch (e) {
        document.getElementById('bl-results').innerHTML = '<div class="empty"><h3>Analysis failed</h3><p>' + e.message + '</p></div>';
    }
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Analyse';
}

function renderBacklinkResults(d) {
    var h = '<div class="bl-grid">';
    h += '<div class="bl-stat"><div class="bl-stat-num blue">' + (d.total_backlinks ? d.total_backlinks.toLocaleString() : 'N/A') + '</div><div class="bl-stat-label">Total Backlinks</div></div>';
    h += '<div class="bl-stat"><div class="bl-stat-num green">' + (d.referring_domains ? d.referring_domains.toLocaleString() : 'N/A') + '</div><div class="bl-stat-label">Referring Domains</div></div>';
    h += '<div class="bl-stat"><div class="bl-stat-num gold">' + (d.link_influence_score || 'N/A') + '</div><div class="bl-stat-label">Influence Score</div></div>';
    h += '<div class="bl-stat"><div class="bl-stat-num purple">' + (d.link_quality || 'N/A') + '</div><div class="bl-stat-label">Link Quality</div></div></div>';
    if (d.nofollow_percentage !== null && d.nofollow_percentage !== undefined) h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Nofollow: ' + d.nofollow_percentage + '% · Dofollow: ' + (100 - d.nofollow_percentage).toFixed(1) + '%</div>';
    if (d.industry_category) h += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Industry: <strong style="color:var(--text-primary)">' + esc(d.industry_category) + '</strong></div>';
    if (d.link_signals && d.link_signals.length) { h += '<div class="kw-group"><div class="kw-group-title">Link Signals</div><div class="kw-tags">'; d.link_signals.forEach(function(s) { h += '<span class="kw-tag longtail">' + esc(s) + '</span>'; }); h += '</div></div>'; }
    if (d.source) h += '<div style="font-size:10px;color:var(--text-muted);margin-top:12px;font-family:Space Mono,monospace;">Source: ' + esc(d.source) + '</div>';
    h += '<div style="margin-top:20px;padding:20px;background:linear-gradient(135deg,rgba(6,182,212,.08),rgba(245,166,35,.05));border:1px solid var(--border-light);border-radius:12px;text-align:center;"><p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Want to compare backlinks against a competitor?</p><a href="/compare" style="display:inline-block;padding:10px 20px;background:var(--cyan);color:var(--bg-deep);border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">Compare Backlinks →</a></div>';
    document.getElementById('bl-results').innerHTML = h;
}

/* ── Utils ────────────────────────────────────────────── */
function esc(t) { return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ── GSC callback check ───────────────────────────────── */
var params = new URLSearchParams(location.search);
if (params.get('gsc') === 'connected') { history.replaceState({}, '', location.pathname); }

/* ── Init ─────────────────────────────────────────────── */
checkAuth();


/* ══════════════════════════════════════════════════════════
   Mobile Menu
   ══════════════════════════════════════════════════════════ */
(function() {
    var menuOpen = false;
    window.toggleMobileMenu = function() { menuOpen = !menuOpen; var menu = document.getElementById('mobile-menu'); document.getElementById('menu-icon-open').style.display = menuOpen ? 'none' : 'block'; document.getElementById('menu-icon-close').style.display = menuOpen ? 'block' : 'none'; menuOpen ? menu.classList.add('open') : menu.classList.remove('open'); };
    window.closeMobileMenu = function() { menuOpen = false; document.getElementById('mobile-menu').classList.remove('open'); document.getElementById('menu-icon-open').style.display = 'block'; document.getElementById('menu-icon-close').style.display = 'none'; };
    window.addEventListener('resize', function() { if (window.innerWidth > 640) closeMobileMenu(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeMobileMenu(); });
})();
