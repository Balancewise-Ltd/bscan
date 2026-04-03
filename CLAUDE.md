# CLAUDE.md — Wisers + BSCAN Project Context (Prerelease v2)

> Drop this file into the repo root. Any AI agent, coworker, or developer picks it up and has everything needed to continue work without re-explaining anything. Written 1 April 2026.

---

## TL;DR

Two products under **Balancewise Ltd** (founder: Chisom, Northumbria University CS Level 5):

1. **Wisers** (`wisrs.com`) — social platform for wealth builders going from £0→£10K/month. "X meets LinkedIn for side hustlers." Free, identity-based. Target: 20K users (15K mobile, 5K desktop). University + convention demo.

2. **BSCAN** (`bscan.balancewises.io`) — website scanning + SEO SaaS. Scanner, AI fix generator, deep crawl, monitoring, Stripe billing (live keys), 40 admin endpoints, social media cross-posting engine.

Both share one server, one database, one backend.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  CLIENTS                                            │
│  wisrs.com → Cloudflare CDN → Nginx → SvelteKit     │
│  api-bscan.balancewises.io → Nginx → FastAPI        │
│  (api-bscan is DNS-ONLY in Cloudflare, not proxied) │
└─────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────┐
│  SERVER: 165.22.126.190 (DigitalOcean Ubuntu)       │
│                                                      │
│  FastAPI (uvicorn) ←→ pgbouncer:6432 ←→ PG16:5432  │
│                   ←→ Redis (Celery broker)           │
│                   ←→ Cloudflare R2 (images)          │
│                   ←→ WebSocket (multi-tab)            │
│                                                      │
│  Nginx serves SvelteKit static build                 │
│  from /home/deploy/bscan-repo/build/                 │
└─────────────────────────────────────────────────────┘
```

---

## File Paths

### Server (`ssh deploy@165.22.126.190`)
```
/home/bscan/app/backend/              ← Backend root (run from HERE for .env)
/home/bscan/app/backend/.env          ← Environment variables
/home/bscan/app/backend/app/
  ├── routers/
  │   ├── community.py                ← Posts, feed, likes, rockets, DMs, hashtags (60+ endpoints)
  │   ├── wisers.py                   ← Communities, milestones, journey, mentorship (21 endpoints)
  │   ├── admin.py                    ← 40+ admin endpoints
  │   ├── auth.py                     ← Register, login, JWT
  │   └── ai_visibility_router.py     ← AI visibility / GEO scoring
  ├── core/
  │   ├── config.py                   ← pydantic-settings (NEVER use os.getenv!)
  │   ├── security.py                 ← JWT, require_auth, get_optional_user_id
  │   └── database.py                 ← SQLAlchemy async engine + sessions
  ├── services/
  │   ├── storage.py                  ← R2 upload, WebP compression, avatar crop
  │   ├── post_processor.py           ← Hashtag/mention extraction
  │   └── notifications.py            ← notify_async()
  └── tasks/
      └── publish_scheduled.py        ← Cron: */5 * * * *

/home/deploy/bscan-repo/build/        ← Frontend build (served by Nginx)
/etc/nginx/sites-enabled/              ← Nginx configs for all domains
```

### Local Mac (`~/Downloads/bscan`)
```
src/
├── routes/
│   ├── wisers/
│   │   ├── +page.svelte              ← Main feed (1500+ lines, has own mobile nav)
│   │   ├── +layout.svelte            ← Wraps all /wisers/* with shared mobile nav
│   │   ├── [username]/+page.svelte   ← Profile page
│   │   ├── communities/
│   │   │   ├── +page.svelte          ← Browse communities
│   │   │   └── [slug]/+page.svelte   ← Community detail
│   │   ├── messages/+page.svelte     ← DM/Messages
│   │   ├── mentorship/+page.svelte   ← Mentorship browse/profile/requests
│   │   └── hashtag/+page.svelte      ← Hashtag results
│   ├── notifications/+page.svelte
│   ├── account/+page.svelte          ← Settings/profile edit
│   └── +layout.svelte                ← Root layout
├── lib/
│   ├── api/client.ts                 ← API client (1000+ lines, 32+ methods)
│   ├── components/
│   │   └── WisersMobileNav.svelte    ← Shared bottom nav (154 lines)
│   └── stores/
│       ├── wisers-ws.ts              ← WebSocket store (wsUnreadDMs, wsNotifCount, wsLastMessage, wsConnected, connectWS, sendTyping, markConvRead, fetchUnreadCounts, resetNotifCount, resetDMCount)
│       └── auth.ts                   ← Auth store ($auth.token, $auth.user)
├── app.html                          ← Shell HTML (PWA meta, chat widget killer)
└── static/
    ├── manifest.json                 ← PWA manifest
    └── sw.js                         ← Service worker
```

---

## Critical Rules — READ BEFORE CHANGING ANYTHING

### 1. Svelte 5 (Runes Mode)
```svelte
<!-- ❌ WRONG: Event modifiers DON'T EXIST -->
<button onclick|stopPropagation={handler}>

<!-- ✅ CORRECT -->
<button onclick={(e) => { e.stopPropagation(); handler(); }}>
```
```svelte
<!-- ❌ WRONG: infinite loop — reads + writes messages -->
$effect(() => { const msg = $wsLastMessage; messages = [...messages, msg]; });

<!-- ✅ CORRECT: untrack stops re-trigger -->
$effect(() => { const msg = $wsLastMessage; untrack(() => { messages = [...messages, msg]; }); });
```
- `<svelte:component>` is deprecated — components are dynamic by default
- Literal emoji characters only — Python unicode escapes break
- `$derived` for computed, `$state` for reactive, `$effect` for side effects
- `window.addEventListener` callbacks don't trigger Svelte reactivity — use stores

### 2. Database — PostgreSQL via pgbouncer
```
DATABASE_URL=postgresql+asyncpg://bscan_user:bscan_pg_2026_secure@localhost:6432/bscan_db?prepared_statement_cache_size=0
```
⚠️ `statement_cache_size=0` required in BOTH URL AND `connect_args`.

| ❌ SQLite | ✅ PostgreSQL |
|-----------|---------------|
| `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` |
| `datetime('now', '-30 days')` | `CURRENT_TIMESTAMP - INTERVAL '30 days'` |
| `strftime` | `TO_CHAR` / `EXTRACT()` |
| `last_insert_rowid()` | `RETURNING id` |

### 3. Config
`config.py` uses pydantic-settings. **NEVER use `os.getenv()`** — bypasses .env loading, caused SECRET_KEY bug.

### 4. Cloudflare DNS
| Subdomain | Proxy | Why |
|-----------|-------|-----|
| `bscan` | ✅ Proxied | Static frontend |
| `api-bscan` | ❌ DNS only | **WebSocket breaks if proxied** |
| `admin-bscan` | ❌ DNS only | **CORS breaks if proxied** |
| `wisrs.com` | ✅ Proxied | Frontend |
| `wisrs.co.uk` | ✅ Proxied | 301 → wisrs.com |

### 5. Nginx
`try_files $uri /index.html` — NOT `$uri $uri/ /index.html` (causes 403).
`client_max_body_size 20M`.

### 6. File Editing
- `grep` before AND after every string replacement
- Count `<div>` vs `</div>` after Svelte edits — #1 build failure cause
- zsh mangles heredocs — use Python scripts
- Whitespace must match EXACTLY

---

## WebSocket Protocol

**Connect:** `wss://api-bscan.balancewises.io/api/community/ws?token={jwt}`
Multi-tab: `Dict[str, List[WebSocket]]` per user.

**Server → Client:**
```json
{"action": "new_message", "sender_id": "...", "content": "...", "conversation_id": 5}
{"action": "new_notification", "title": "...", "body": "...", "url": "/wisers/..."}
{"action": "typing", "sender_id": "...", "conversation_id": 5}
{"action": "pong"}
```
**Client → Server:**
```json
{"action": "ping"}
{"action": "typing", "to_user_id": "...", "conversation_id": 5}
```

**Frontend store (`wisers-ws.ts`):** `wsLastMessage` (writable, watched by `$effect` in DM page), `wsUnreadDMs`/`wsNotifCount` (badge counts), `connectWS(token)`, `sendTyping(toUserId, conversationId?)`.

---

## Theme System

Modes: dark (default), light, system. Stored in `localStorage('wisers-theme')`. Applied via `data-wisers-theme` attribute.

```
Dark:  --wbg:#0a0a0f  --wcard:#111117  --wt:#e4e6ea  --wgold:#f5a623  --wbd:#1e1e2a
Light: --wbg:#ffffff   --wcard:#ffffff   --wt:#1c1e21  --wgold:#d4a017  --wbd:#dddfe2
```

⚠️ Bottom nav: hardcode `#0a0a0f`/`#ffffff` — NOT `var(--wcard)` (causes bleed).

---

## Mobile Architecture

**Shared nav:** `WisersMobileNav.svelte` via `+layout.svelte` wraps ALL `/wisers/*`.
**Feed exception:** Own interactive nav with create bottom sheet.
**Items:** Home, Groups, + (FAB), Inbox (live badge), Profile (avatar initial).
**Active:** `$derived` from `$page.url.pathname`.
**Chat widget:** Hidden mobile via CSS + JS interval.
**PWA:** manifest.json, apple-mobile-web-app-capable, install prompt after 5s.
**Breakpoints:** 768px mobile, 1024px tablet, 380px small phone.
**Safe areas:** `env(safe-area-inset-bottom)` on nav + body.
**No zoom:** All inputs forced to 16px.

---

## API Reference

### Auth
| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST | `/api/auth/register` | — | email, password, name, username |
| POST | `/api/auth/login` | — | → JWT token |
| GET | `/api/auth/me` | ✅ | Current user |

### Feed & Posts
| POST | `/api/community/posts` | ✅ | content, post_type, image_url |
| GET | `/api/community/feed?page=N` | — | 20/page |
| GET | `/api/community/feed/friends?page=N` | ✅ | Friends only |
| GET | `/api/community/posts/{id}` | — | Single post |
| DELETE | `/api/community/posts/{id}` | ✅ | Own only |
| PUT | `/api/community/post/{id}` | ✅ | Edit (saves history) |
| GET | `/api/community/post/{id}/edits` | — | Edit history |
| GET | `/api/community/post/{id}/analytics` | ✅ | Own posts only |

### Reactions
| POST | `/api/community/posts/{id}/like` | ✅ | Toggle |
| POST | `/api/community/toggle-rocket/{id}` | ✅ | Toggle rocket |
| POST | `/api/community/repost/{id}` | ✅ | Repost |
| POST | `/api/community/bookmark/{id}` | ✅ | Toggle |
| GET | `/api/community/bookmarks?page=N` | ✅ | Saved posts |

### Social Graph
| POST/DELETE | `/api/community/follow/{username}` | ✅ | Follow/unfollow |
| GET | `/api/community/followers/{username}` | — | List + count |
| GET | `/api/community/following/{username}` | — | List + count |
| GET | `/api/community/follow-status/{username}` | ✅ | i_follow, they_follow |
| POST/DELETE | `/api/community/block/{username}` | ✅ | Block/unblock |
| POST/DELETE | `/api/community/mute/{username}` | ✅ | Mute/unmute |

### DMs
| GET | `/api/community/conversations` | ✅ | List |
| POST | `/api/community/conversations/start` | ✅ | Start/get |
| GET/POST | `/api/community/messages/{conv_id}` | ✅ | Get/send |
| POST | `/api/community/messages/{conv_id}/read` | ✅ | Mark read |

### Communities (wisers.py)
| POST | `/api/wisers/communities` | ✅ | name, description, category, privacy |
| GET | `/api/wisers/communities?category=X` | — | List |
| GET | `/api/wisers/communities/{slug}` | — | Detail |
| POST | `/api/wisers/communities/{slug}/join` | ✅ | Join |
| POST | `/api/wisers/communities/{slug}/leave` | ✅ | Leave |
| GET | `/api/wisers/communities/{slug}/feed` | — | Community posts |
| POST | `/api/wisers/communities/{slug}/post` | ✅ | Post in community |

### Mentorship
| POST | `/api/wisers/mentorship/profile` | ✅ | Create/update |
| GET | `/api/wisers/mentorship/browse?role=mentor` | — | Browse |
| POST | `/api/wisers/mentorship/request/{username}` | ✅ | Request |
| POST | `/api/wisers/mentorship/respond/{id}` | ✅ | Accept/decline |

### Journey
| POST | `/api/wisers/journey/entries` | ✅ | Add entry |
| GET | `/api/wisers/journey/{username}` | — | Get journey |
| POST | `/api/wisers/journey/goals` | ✅ | Add goal |
| PUT | `/api/wisers/journey/goals/{id}` | ✅ | Update progress |

### Hashtags, Polls, Scheduling
| GET | `/api/community/hashtags/trending` | — | Top 20 |
| GET | `/api/community/hashtags/{tag}?page=N` | — | Posts by tag |
| POST | `/api/community/poll` | ✅ | question, options[], ends_at |
| POST | `/api/community/poll/{id}/vote` | ✅ | option_id |
| POST | `/api/community/schedule-post` | ✅ | content, scheduled_for |
| GET | `/api/community/activity` | ✅ | Timeline |
| GET | `/api/community/mentions?page=N` | ✅ | @mentions |

---

## Debugging Playbook

### Build fails
```bash
grep -c "<div" src/routes/wisers/+page.svelte    # Must match </div> count
grep -n "</main>" src/routes/wisers/+page.svelte  # Exactly 1, before RIGHT SIDEBAR
```

### Backend 500
```bash
sudo journalctl -u bscan -f --no-pager | tail -30
curl -s https://api-bscan.balancewises.io/api/community/feed | python3 -m json.tool | head -20
```

### Generate auth token
```bash
cd /home/bscan/app/backend && sudo ./venv/bin/python3 -c "
import sys; sys.path.insert(0, '.')
from app.core.security import create_access_token
print(create_access_token('5b07f55a-aec7-496e-bb21-71d728a4f9db', 'chisom@test.com'))"
```

### Database queries
```bash
PGPASSWORD=bscan_pg_2026_secure psql -U bscan_user -d bscan_db -c "SELECT COUNT(*) FROM users;"
```

---

## Deploy

### Server paths for frontends
| App | Domain | Server path |
|-----|--------|-------------|
| Wisers / BSCAN | wisrs.com / bscan.balancewises.io | `/home/deploy/bscan-repo/build/` |
| Help center | help.wisrs.com | `/home/deploy/help-wisrs/build/` |
| Console | console.balancewises.io | `/home/deploy/console-repo/build/` |

### Deploy commands (from Mac)
```bash
# Wisers / BSCAN frontend (has deploy script)
cd ~/Downloads/bscan && ./deploy.sh

# Help center (manual)
cd ~/Downloads/help-wisrs && npm run build && scp -r build/* deploy@165.22.126.190:/home/deploy/help-wisrs/build/

# Console (manual)
cd ~/Downloads/console-bscan && npm run build && scp -r build/* deploy@165.22.126.190:/home/deploy/console-repo/build/

# Backend
ssh deploy@165.22.126.190
sudo systemctl restart bscan && sudo journalctl -u bscan -f

# Push repos to remote
cd ~/Downloads/bscan-backend && git push
cd ~/Downloads/bscan && git add -A && git commit -m "feat: all frontend updates" && git push
```

---

## Credentials
| Service | Value |
|---------|-------|
| Server | `165.22.126.190` |
| PostgreSQL | `bscan_user` / `bscan_pg_2026_secure` / `bscan_db` |
| R2 Access | `ef1ed8a703e09d1bfcced625555073fb` |
| R2 Secret | `8dabe98d5f57bb1e81e371db1311d8174d6cf543ff10ac6bc5995d8a3fc56d00` |
| R2 Public | `https://pub-fef6fc1308b64ae0ad70a155fca72665.r2.dev` |
| Cloudflare Zone | `6892f1c21e05082b1db02736a09b6a4d` |
| Chisom UUID | `5b07f55a-aec7-496e-bb21-71d728a4f9db` |

---

## Known Issues
1. **Build error:** `</main>` tag removed — needs restoring before `<!-- RIGHT SIDEBAR -->`
2. **Repost button:** May still exist in some paths — grep `w-repost-btn`
3. **Chat widget mobile:** CSS + JS kill added, some variants may persist
4. **Feed features (toast, skeletons, scroll, share):** Added via batch replacement, verify each landed

## Not Built Yet
| Feature | Effort | Priority |
|---------|--------|----------|
| Fix build error | 5 min | CRITICAL |
| Seed 50+ users | 1 hr | HIGH |
| Onboarding wizard | 1 hr | HIGH |
| Community settings | 2 hrs | MEDIUM |
| Link previews | 2 hrs | MEDIUM |
| Image lightbox | 1 hr | MEDIUM |
| Search page | 2 hrs | MEDIUM |
| Email notifications | 2 hrs | LOW |
| Video upload | 2 hrs | DEFER |

---

## Design: gold `#f5a623`, DM Sans font, 12px radius cards, 24px pills, three-column (240/flex/280), full-bleed pages
## Categories (13): side-hustle, ecommerce, investing, tech, freelance, saas, crypto, property, content-creation, careers, fire, students, general
## Seed: 20 demo users, 25 posts, 5 milestones, 6 communities

---

### Change Discipline — MANDATORY BEFORE EVERY CODE CHANGE

1. **Verify before acting.** Check the actual file on disk, the actual column types in the database, the actual route paths in the running server. Never assume a column is BOOLEAN — run `\d table_name`. Never assume a file exists — run `ls`. Never assume a route works — run `curl`.

2. **Cross-check file names and paths.** Before scp, confirm the source file exists locally AND the destination path exists on the server. Before `cp /tmp/x.py`, confirm `/tmp/x.py` arrived. Two files with the same name in different directories (e.g. `routers/reports.py` vs `tasks/reports.py`) must be handled explicitly — never overwrite one with the other.

3. **Research before changing.** Check the database schema, the ORM model, the raw SQL, AND the frontend expectations before changing any column type, response shape, or endpoint path. A "fix" that doesn't account for all four layers creates new bugs.

4. **One verified change at a time.** Do not batch 80 changes across 16 files without verifying the assumptions behind them. If a fix depends on a column being BOOLEAN, confirm it IS boolean first. If a fix depends on a route prefix, confirm the prefix in main.py first.

5. **Test after every deploy.** After `systemctl restart bscan`, immediately check logs (`journalctl -u bscan --since "30 sec ago"`) and hit the affected endpoint with curl. Do not move on until the change is confirmed working.

6. **Never suggest disabling security features, proxies, or infrastructure** as a fix for a code bug. If Cloudflare, Nginx, or rate limiters appear to interfere, the root cause is almost always a backend 500 hiding behind the infrastructure layer. Fix the 500.

7. **Separate confirmed facts from assumptions.** When debugging, state what you know (from logs, curl, grep) vs what you're guessing. Label guesses explicitly.

*Last updated: 2 April 2026 — Chisom, contact@balancewises.io*
