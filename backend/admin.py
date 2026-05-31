"""Admin dashboard served directly by the FastAPI backend.

register_admin(app, db, admin_token) adds:
  GET /admin                 -> self-contained HTML dashboard (paste ADMIN_TOKEN)
  GET /api/admin/overview    -> aggregated token cost/usage across ALL users
Both are guarded by the X-Admin-Token header (the ADMIN_TOKEN from .env).
All cost data is read straight from db.token_usage (cost_usd is stored per event).
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, Header
from fastapi.responses import HTMLResponse


def register_admin(app, db, admin_token: str):

    def _check(token: Optional[str]):
        if not admin_token or token != admin_token:
            raise HTTPException(status_code=401, detail="Unauthorized")

    @app.get("/api/admin/overview")
    async def admin_overview(days: int = 30, x_admin_token: Optional[str] = Header(None)):
        _check(x_admin_token)
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days)
        events = await db.token_usage.find(
            {"created_at": {"$gte": start}}, {"_id": 0}
        ).to_list(200000)

        total_cost = 0.0
        total_tokens = 0
        by_action, by_day, by_model, by_user = {}, {}, {}, {}
        for e in events:
            cost = e.get("cost_usd", 0) or 0
            tok = e.get("total_tokens", 0) or 0
            total_cost += cost
            total_tokens += tok
            for bucket, key in (
                (by_action, e.get("action", "other")),
                (by_day, e.get("date")),
                (by_model, e.get("model", "?")),
                (by_user, e.get("user_id", "?")),
            ):
                b = bucket.setdefault(key, {"calls": 0, "tokens": 0, "cost_usd": 0.0})
                b["calls"] += 1
                b["tokens"] += tok
                b["cost_usd"] = round(b["cost_usd"] + cost, 6)

        top = sorted(by_user.items(), key=lambda kv: kv[1]["cost_usd"], reverse=True)[:10]
        uids = [uid for uid, _ in top]
        ulist = await db.users.find(
            {"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}
        ).to_list(100)
        umap = {u["user_id"]: u for u in ulist}
        top_users = [
            {
                "user_id": uid,
                "email": umap.get(uid, {}).get("email"),
                "name": umap.get(uid, {}).get("name"),
                **stats,
            }
            for uid, stats in top
        ]

        total_users = await db.users.count_documents({})
        active_subs = await db.users.count_documents(
            {"subscription_expires_at": {"$gt": now}}
        )
        codes_total = await db.redeem_codes.count_documents({})
        codes_used = await db.redeem_codes.count_documents({"used_count": {"$gt": 0}})

        return {
            "period_days": days,
            "total_cost_usd": round(total_cost, 6),
            "total_tokens": total_tokens,
            "calls": len(events),
            "users": {"total": total_users, "active_subscriptions": active_subs},
            "codes": {
                "total": codes_total,
                "used": codes_used,
                "available": codes_total - codes_used,
            },
            "by_action": by_action,
            "by_model": by_model,
            "by_day": dict(sorted(by_day.items())),
            "top_users": top_users,
        }

    @app.get("/api/admin/codes")
    async def admin_codes(limit: int = 1000, x_admin_token: Optional[str] = Header(None)):
        _check(x_admin_token)
        codes = await db.redeem_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        names = [c["code"] for c in codes]
        reds = await db.redemptions.find(
            {"code": {"$in": names}}, {"_id": 0}
        ).to_list(20000)
        by_code = {}
        uids = set()
        for r in reds:
            by_code.setdefault(r["code"], []).append(r)
            uids.add(r.get("user_id"))
        ulist = await db.users.find(
            {"user_id": {"$in": list(uids)}}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}
        ).to_list(20000)
        umap = {u["user_id"]: u for u in ulist}

        def _iso(dt):
            try:
                return dt.isoformat()
            except Exception:
                return None

        out = []
        for c in codes:
            redeemers = [
                {
                    "email": umap.get(r.get("user_id"), {}).get("email"),
                    "name": umap.get(r.get("user_id"), {}).get("name"),
                    "redeemed_at": _iso(r.get("redeemed_at")),
                }
                for r in by_code.get(c["code"], [])
            ]
            used = c.get("used_count", 0) or 0
            max_uses = c.get("max_uses", 1)
            if not c.get("active", True):
                status = "inactive"
            elif max_uses is not None and used >= max_uses:
                status = "used"
            else:
                status = "available"
            out.append({
                "code": c["code"],
                "grant_tier": c.get("grant_tier"),
                "duration_days": c.get("duration_days"),
                "used_count": used,
                "max_uses": max_uses,
                "status": status,
                "redeemers": redeemers,
            })
        return {"total": len(out), "codes": out}

    @app.get("/admin", response_class=HTMLResponse)
    async def admin_page():
        return _DASHBOARD_HTML


_DASHBOARD_HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>FinFlow · Admin</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root { --teal:#4DB6AC; --dark:#1F2937; --gray:#6B7280; --line:#E5E7EB; --bg:#F3F4F6; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--dark); }
  header { background:var(--dark); color:#fff; padding:16px 24px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  header h1 { font-size:18px; margin:0; font-weight:600; }
  header .spacer { flex:1; }
  select, button { font:inherit; border-radius:8px; border:1px solid #374151; background:#111827; color:#fff; padding:8px 12px; cursor:pointer; }
  .wrap { max-width:1100px; margin:0 auto; padding:24px; }
  .gate { max-width:420px; margin:80px auto; background:#fff; border-radius:16px; padding:28px; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .gate h2 { margin:0 0 8px; } .gate p { color:var(--gray); margin:0 0 16px; }
  .gate input { width:100%; padding:12px 14px; border:1px solid var(--line); border-radius:10px; font:inherit; margin-bottom:12px; }
  .gate button { width:100%; background:var(--teal); border:none; padding:12px; font-weight:600; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; margin-bottom:20px; }
  .card { background:#fff; border-radius:14px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  .card .label { color:var(--gray); font-size:12px; text-transform:uppercase; letter-spacing:.4px; }
  .card .val { font-size:24px; font-weight:700; margin-top:6px; }
  .card .sub { color:var(--gray); font-size:12px; margin-top:2px; }
  .panel { background:#fff; border-radius:14px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,.06); margin-bottom:20px; }
  .panel h3 { margin:0 0 14px; font-size:14px; text-transform:uppercase; letter-spacing:.4px; color:var(--gray); }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th,td { text-align:left; padding:8px 6px; border-bottom:1px solid #F3F4F6; }
  th { color:var(--gray); font-weight:600; font-size:12px; text-transform:uppercase; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .err { color:#EF4444; font-size:13px; margin-top:8px; }
  .muted { color:var(--gray); }
  .genrow { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
  .genrow input, .genrow select { background:#fff; color:var(--dark); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font:inherit; }
  .genrow input[type=number]{ width:90px; }
  .genrow button { background:var(--teal); border:none; color:#fff; font-weight:600; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  .genout { background:#F9FAFB; border:1px solid var(--line); border-radius:8px; padding:10px; margin-bottom:12px; font-family:ui-monospace,Menlo,monospace; font-size:13px; max-height:150px; overflow:auto; white-space:pre-wrap; }
  .badge { padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
  .b-available { background:#DCFCE7; color:#166534; }
  .b-used { background:#FEE2E2; color:#991B1B; }
  .b-inactive { background:#F3F4F6; color:#6B7280; }
  .filters { display:flex; gap:8px; margin-bottom:10px; }
  .filters button { background:#fff; color:var(--gray); border:1px solid var(--line); padding:6px 12px; }
  .filters button.active { background:var(--teal); color:#fff; border-color:var(--teal); }
  .row2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  @media (max-width:760px){ .row2 { grid-template-columns:1fr; } }
  .chart3 { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
  @media (max-width:760px){ .chart3 { grid-template-columns:1fr; } }
  .chartlabel { font-size:12px; font-weight:600; color:var(--gray); margin-bottom:8px; }
</style>
</head>
<body>
<div id="gate" class="gate">
  <h2>FinFlow Admin</h2>
  <p>Paste your <b>ADMIN_TOKEN</b> to view usage &amp; cost.</p>
  <input id="token" type="password" placeholder="ADMIN_TOKEN" autocomplete="off"/>
  <button onclick="saveToken()">Open dashboard</button>
  <div id="gateErr" class="err"></div>
</div>

<div id="app" style="display:none">
  <header>
    <h1>FinFlow · Usage &amp; Cost</h1>
    <div class="spacer"></div>
    <select id="period" onchange="load()">
      <option value="7">7 days</option>
      <option value="30" selected>30 days</option>
      <option value="90">90 days</option>
    </select>
    <button onclick="load()">Refresh</button>
    <button onclick="logout()">Sign out</button>
  </header>
  <div class="wrap">
    <div class="cards" id="cards"></div>
    <div class="panel"><h3>Daily cost (USD)</h3><canvas id="dayChart" height="90"></canvas></div>
    <div class="panel">
      <h3>By feature</h3>
      <div class="chart3">
        <div><div class="chartlabel">Cost (USD)</div><canvas id="costChart" height="220"></canvas></div>
        <div><div class="chartlabel">Calls</div><canvas id="callsChart" height="220"></canvas></div>
        <div><div class="chartlabel">Cost / call (USD)</div><canvas id="cpcChart" height="220"></canvas></div>
      </div>
    </div>
    <div class="panel"><h3>By model</h3><div id="models"></div></div>
    <div class="panel"><h3>Top users by cost</h3><div id="topUsers"></div></div>
    <div class="panel">
      <h3>Redeem codes</h3>
      <div class="genrow">
        <span class="muted">Generate</span>
        <input id="genCount" type="number" value="10" min="1" max="1000" title="count"/>
        <select id="genTier"><option value="pro">pro</option><option value="basic">basic</option><option value="power">power</option></select>
        <input id="genDays" type="number" value="7" min="1" title="days"/>
        <button onclick="generateCodes()">Generate</button>
        <span id="genMsg" class="muted"></span>
      </div>
      <div id="genOut" class="genout" style="display:none"></div>
      <div class="filters">
        <button data-f="all" class="active" onclick="setCodeFilter('all')">All</button>
        <button data-f="available" onclick="setCodeFilter('available')">Available</button>
        <button data-f="used" onclick="setCodeFilter('used')">Used</button>
      </div>
      <div id="codesTable" style="max-height:380px; overflow:auto"></div>
    </div>
    <div id="err" class="err"></div>
  </div>
</div>

<script>
let TOKEN = localStorage.getItem("ff_admin_token") || "";
let dayChart, costChart, callsChart, cpcChart;
function barChart(canvasId, existing, labels, data, color, fmt){
  if(existing) existing.destroy();
  return new Chart(document.getElementById(canvasId), {
    type:"bar",
    data:{ labels, datasets:[{ data, backgroundColor:color }] },
    options:{ indexAxis:"y", plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>fmt(c.parsed.x) } } }, scales:{ x:{ ticks:{ callback:v=>fmt(v) } } } }
  });
}
const fmtCost = n => !n ? "$0.00" : n < 0.01 ? "$"+n.toFixed(6) : n < 1 ? "$"+n.toFixed(4) : "$"+n.toFixed(2);
const fmtNum = n => (n||0).toLocaleString("en-US");
const ACTIONS = { chat:"Chat", voice:"Voice", ocr:"Receipt Scan", insights:"AI Insights", transcribe:"Transcription", other:"Other" };

function saveToken(){
  const t = document.getElementById("token").value.trim();
  if(!t){ document.getElementById("gateErr").textContent="Enter a token."; return; }
  TOKEN = t; localStorage.setItem("ff_admin_token", t);
  showApp(); load();
}
function logout(){ localStorage.removeItem("ff_admin_token"); TOKEN=""; location.reload(); }
function showApp(){ document.getElementById("gate").style.display="none"; document.getElementById("app").style.display="block"; }

async function load(){
  document.getElementById("err").textContent = "";
  const days = document.getElementById("period").value;
  let res;
  try {
    res = await fetch(`/api/admin/overview?days=${days}`, { headers: { "X-Admin-Token": TOKEN } });
  } catch(e){ document.getElementById("err").textContent = "Network error: "+e.message; return; }
  if(res.status === 401){ logout(); return; }
  if(!res.ok){ document.getElementById("err").textContent = "Error "+res.status; return; }
  const d = await res.json();
  render(d);
  loadCodes();
}

function render(d){
  document.getElementById("cards").innerHTML = [
    ["Total cost", fmtCost(d.total_cost_usd), `last ${d.period_days} days`],
    ["Tokens", fmtNum(d.total_tokens), `${fmtNum(d.calls)} AI calls`],
    ["Users", fmtNum(d.users.total), `${fmtNum(d.users.active_subscriptions)} active subs`],
    ["Codes", fmtNum(d.codes.available)+" left", `${fmtNum(d.codes.used)} of ${fmtNum(d.codes.total)} used`],
  ].map(([l,v,s]) => `<div class="card"><div class="label">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`).join("");

  // daily chart
  const days = Object.keys(d.by_day);
  const costs = days.map(k => d.by_day[k].cost_usd);
  if(dayChart) dayChart.destroy();
  dayChart = new Chart(document.getElementById("dayChart"), {
    type:"line",
    data:{ labels:days, datasets:[{ data:costs, borderColor:"#4DB6AC", backgroundColor:"rgba(77,182,172,.15)", fill:true, tension:.3, pointRadius:2 }] },
    options:{ plugins:{legend:{display:false}}, scales:{ y:{ ticks:{ callback:v=>"$"+v.toFixed(4) } } } }
  });

  // by feature — 3 charts: cost, calls, cost/call. Same feature order across all.
  const acts = Object.entries(d.by_action).sort((a,b)=>b[1].cost_usd-a[1].cost_usd);
  const fLabels = acts.map(([k])=>ACTIONS[k]||k);
  const usd = v => "$"+Number(v).toFixed(10);
  const int = v => Number(v).toLocaleString("en-US");
  costChart  = barChart("costChart",  costChart,  fLabels, acts.map(([,s])=>s.cost_usd), "#4DB6AC", usd);
  callsChart = barChart("callsChart", callsChart, fLabels, acts.map(([,s])=>s.calls),    "#3B82F6", int);
  cpcChart   = barChart("cpcChart",   cpcChart,   fLabels, acts.map(([,s])=> s.calls ? s.cost_usd/s.calls : 0), "#F59E0B", usd);

  // by model
  const models = Object.entries(d.by_model).sort((a,b)=>b[1].cost_usd-a[1].cost_usd);
  const cpc10 = s => s.calls ? "$"+Number(s.cost_usd/s.calls).toFixed(10) : "$0.00";
  document.getElementById("models").innerHTML = `<table><tr><th>Model</th><th class="num">Calls</th><th class="num">Tokens</th><th class="num">Cost</th><th class="num">Cost/call</th></tr>`+
    models.map(([m,s])=>`<tr><td>${m}</td><td class="num">${fmtNum(s.calls)}</td><td class="num">${fmtNum(s.tokens)}</td><td class="num">${fmtCost(s.cost_usd)}</td><td class="num">${cpc10(s)}</td></tr>`).join("")+`</table>`;

  // top users
  const tu = d.top_users || [];
  document.getElementById("topUsers").innerHTML = tu.length ? `<table><tr><th>User</th><th class="num">Calls</th><th class="num">Tokens</th><th class="num">Cost</th></tr>`+
    tu.map(u=>`<tr><td>${(u.name||"—")} <span class="muted">${u.email||u.user_id}</span></td><td class="num">${fmtNum(u.calls)}</td><td class="num">${fmtNum(u.tokens)}</td><td class="num">${fmtCost(u.cost_usd)}</td></tr>`).join("")+`</table>`
    : `<p class="muted">No usage yet.</p>`;
}

let CODES = [], CODE_FILTER = "all";
async function loadCodes(){
  let res;
  try { res = await fetch("/api/admin/codes?limit=1000", { headers:{ "X-Admin-Token": TOKEN } }); }
  catch(e){ return; }
  if(!res.ok) return;
  const d = await res.json();
  CODES = d.codes || [];
  renderCodes();
}
function setCodeFilter(f){
  CODE_FILTER = f;
  document.querySelectorAll(".filters button").forEach(b => b.classList.toggle("active", b.dataset.f === f));
  renderCodes();
}
function renderCodes(){
  const rows = CODES.filter(c => CODE_FILTER === "all" || c.status === CODE_FILTER);
  const badge = s => `<span class="badge b-${s}">${s}</span>`;
  document.getElementById("codesTable").innerHTML =
    `<table><tr><th>Code</th><th>Tier</th><th class="num">Days</th><th>Status</th><th>Redeemed by</th></tr>` +
    rows.map(c => {
      const r = (c.redeemers && c.redeemers[0]) || null;
      const by = r ? `${r.name || ""} <span class="muted">${r.email || ""}</span>` : `<span class="muted">—</span>`;
      return `<tr><td class="mono">${c.code}</td><td>${c.grant_tier}</td><td class="num">${c.duration_days}</td><td>${badge(c.status)}</td><td>${by}</td></tr>`;
    }).join("") + `</table>` + (rows.length ? "" : `<p class="muted">No codes.</p>`);
}
async function generateCodes(){
  const count = parseInt(document.getElementById("genCount").value) || 1;
  const grant_tier = document.getElementById("genTier").value;
  const duration_days = parseInt(document.getElementById("genDays").value) || 7;
  document.getElementById("genMsg").textContent = "Generating…";
  let res;
  try {
    res = await fetch("/api/admin/codes", {
      method:"POST",
      headers:{ "X-Admin-Token": TOKEN, "Content-Type":"application/json" },
      body: JSON.stringify({ count, grant_tier, duration_days }),
    });
  } catch(e){ document.getElementById("genMsg").textContent = "Network error"; return; }
  if(!res.ok){ document.getElementById("genMsg").textContent = "Error " + res.status; return; }
  const d = await res.json();
  document.getElementById("genMsg").textContent = `Generated ${d.count} code(s).`;
  const out = document.getElementById("genOut");
  out.style.display = "block";
  out.textContent = (d.codes || []).join("\n");
  load();
}

if(TOKEN){ showApp(); load(); }
</script>
</body>
</html>"""
