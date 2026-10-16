const $ = (s) => document.querySelector(s),
  uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
let S = { unit: "lb", workouts: [], templates: [], custom: [], active: null, view: "home" },
  rest = 0,
  det = null;
try {
  Object.assign(S, JSON.parse(localStorage.getItem("gt1") || "{}"));
} catch (e) {}
let cloud = null,
  sent = {},
  sentMeta = "",
  pushing = false,
  again = false,
  dirty = false,
  tm = 0,
  syncMsg = "Saved on this device only.";
const save = () => {
  S.ts = Date.now();
  try {
    localStorage.setItem("gt1", JSON.stringify(S));
  } catch (e) {}
  if (cloud) {
    dirty = true;
    clearTimeout(tm);
    tm = setTimeout(push, 800);
  }
};
// Starter library (not user data). Bodyweight exercises: weight field = optional ADDED weight.
const LIB =
  `Bench Press|Chest|Barbell;Incline Dumbbell Press|Chest|Dumbbell;Chest Fly|Chest|Cable;Push-up|Chest|Bodyweight;Overhead Press|Shoulders|Barbell;Lateral Raise|Shoulders|Dumbbell;Face Pull|Shoulders|Cable;Barbell Row|Back|Barbell;Lat Pulldown|Back|Cable;Pull-up|Back|Bodyweight;Seated Cable Row|Back|Cable;Deadlift|Back|Barbell;Back Squat|Legs|Barbell;Front Squat|Legs|Barbell;Leg Press|Legs|Machine;Romanian Deadlift|Legs|Barbell;Lunge|Legs|Dumbbell;Leg Curl|Legs|Machine;Leg Extension|Legs|Machine;Calf Raise|Legs|Machine;Hip Thrust|Glutes|Barbell;Barbell Curl|Biceps|Barbell;Hammer Curl|Biceps|Dumbbell;Tricep Pushdown|Triceps|Cable;Skull Crusher|Triceps|Barbell;Dip|Triceps|Bodyweight;Plank|Core|Bodyweight;Cable Crunch|Core|Cable;Hanging Leg Raise|Core|Bodyweight`
    .split(";")
    .map((s) => {
      const [n, m, q] = s.split("|");
      return { id: "s_" + n.toLowerCase().replace(/\W+/g, "_"), name: n, mu: m, eq: q };
    });
const MU = ["Chest", "Back", "Shoulders", "Legs", "Glutes", "Biceps", "Triceps", "Core", "Other"],
  EQ = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Other"];
const ex = (id) =>
  [...LIB, ...S.custom].find((e) => e.id === id) || {
    name: "Deleted exercise",
    mu: "Other",
    eq: "",
  };
// Weights are stored in kg always; converted only for display/input.
const k2u = (k) => (S.unit == "kg" ? k : k * 2.20462),
  u2k = (v) => (S.unit == "kg" ? v : v / 2.20462),
  fw = (k) => +k2u(k).toFixed(1),
  U = () => S.unit;
const vol = (ss) => ss.filter((s) => s.done && s.t != "w").reduce((a, s) => a + s.w * s.r, 0),
  wv = (w) => w.exs.reduce((a, e) => a + vol(e.sets), 0);
const e1 = (w, r) => (r <= 1 ? w : w * (1 + r / 30)),
  nm = (n) => Math.round(n).toLocaleString();
const wk = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const wks = (n) => {
  const o = [],
    d = new Date(wk(Date.now()));
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - 7 * i);
    o.push(x.getTime());
  }
  return o;
};
const dt = (t) =>
    new Date(t).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
  dur = (s) => {
    s = Math.max(0, s | 0);
    const h = (s / 3600) | 0,
      m = ((s % 3600) / 60) | 0;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0");
  };
const done = () => [...S.workouts].sort((a, b) => b.start - a.start);
const prs = (id) => {
  let r = { w: 0, e: 0, rw: 0, v: 0, n: 0, r: 0 };
  S.workouts.forEach((w) =>
    w.exs
      .filter((x) => x.ex == id)
      .forEach((x) => {
        r.v = Math.max(r.v, vol(x.sets));
        x.sets
          .filter((s) => s.done && s.t != "w")
          .forEach((s) => {
            r.n++;
            r.r = Math.max(r.r, s.r);
            if (s.w > r.w || (s.w == r.w && s.r > r.rw)) {
              r.w = s.w;
              r.rw = s.r;
            }
            r.e = Math.max(r.e, e1(s.w, s.r));
          });
      }),
  );
  return r;
};
const prev = (id) => {
  for (const w of done()) {
    const x = w.exs.find((x) => x.ex == id);
    if (x) return x.sets.filter((s) => s.t != "w");
  }
  return [];
};
const bars = (v, l) => {
  const m = Math.max(...v, 1),
    w = 300 / v.length;
  return `<svg viewBox="0 0 300 130" class="ch" role="img" aria-label="Bar chart">${v
    .map((x, i) => {
      const h = (x / m) * 95;
      return `<rect x="${i * w + 4}" y="${105 - h}" width="${w - 8}" height="${x ? Math.max(h, 2) : 0}" rx="3" fill="#62d2ff" opacity="${i == v.length - 1 ? 1 : 0.5}"/><text x="${i * w + w / 2}" y="122" text-anchor="middle">${l[i]}</text>${x ? `<text x="${i * w + w / 2}" y="${100 - h}" text-anchor="middle">${x >= 1e3 ? (x / 1e3).toFixed(1) + "k" : x}</text>` : ""}`;
    })
    .join("")}</svg>`;
};
const line = (p) => {
  if (p.length < 2) return '<p class="mu">Log this exercise in two workouts to see a trend.</p>';
  const y = p.map((a) => a.y),
    mn = Math.min(...y),
    r = Math.max(...y) - mn || 1,
    q = p.map((a, i) => [15 + (i * 270) / (p.length - 1), 100 - ((a.y - mn) / r) * 80]);
  return `<svg viewBox="0 0 300 130" class="ch" role="img" aria-label="Estimated 1RM trend"><polyline points="${q.map((a) => a.join(",")).join(" ")}" fill="none" stroke="#62d2ff" stroke-width="2.5"/>${q.map((a, i) => `<circle cx="${a[0]}" cy="${a[1]}" r="3.5" fill="#62d2ff"/>`).join("")}<text x="15" y="122">${p[0].x}</text><text x="285" y="122" text-anchor="end">${p.at(-1).x}</text><text x="285" y="10" text-anchor="end">${Math.max(...y)} ${U()}</text></svg>`;
};
const wl = (w) => new Date(w).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
const ns = (w = 0, r = 0) => ({ t: "n", w, r, done: false });
function startW(src) {
  const f = () => {
    S.active = {
      id: uid(),
      name: src?.name || "Workout",
      start: Date.now(),
      notes: "",
      exs: (src?.exs || []).map((x) => ({
        id: uid(),
        ex: x.ex,
        sets: x.sets
          ? x.sets.map((s) => ns(s.w, s.r))
          : Array.from({ length: x.n || 3 }, () => ns(x.w || 0, x.r || 0)),
      })),
    };
    rest = 0;
    S.view = "workout";
    save();
    render();
  };
  S.active ? ask("Replace your current workout in progress?", "Replace", f) : f();
}
function ask(msg, ok, fn) {
  modal(
    `<h3>${esc(msg)}</h3><div class="row" style="margin-top:14px"><button data-a="cm" style="flex:1">Cancel</button><button class="p" id="okb" style="flex:1">${ok}</button></div>`,
  );
  $("#okb").onclick = () => {
    cm();
    fn();
  };
}
const modal = (h) => {
    $("#m").innerHTML = `<div class="sheet">${h}</div>`;
    $("#m").classList.add("s");
  },
  cm = () => {
    $("#m").classList.remove("s");
    det = null;
  };
function picker(cb) {
  let q = "",
    mu = "All";
  window.pk = (id) => {
    cm();
    cb(id);
  };
  const list = () => {
    const l = [...LIB, ...S.custom].filter(
      (e) => (mu == "All" || e.mu == mu) && e.name.toLowerCase().includes(q.toLowerCase()),
    );
    $("#pl").innerHTML =
      l
        .map(
          (e) =>
            `<button style="width:100%;text-align:left;margin-bottom:6px" data-a="pk" data-id="${e.id}">${esc(e.name)} <span class="mu">${e.mu} · ${e.eq}</span></button>`,
        )
        .join("") || '<p class="mu">No match. Create it below.</p>';
  };
  modal(
    `<div class="row sp"><h3>Add exercise</h3><button data-a="cm">Close</button></div><label>Search<input id="pq" type="search" placeholder="Search exercises"></label><div style="margin:8px 0">${["All", ...MU].map((m) => `<button class="chip ${m == "All" ? "on" : ""}" data-mu="${m}">${m}</button>`).join("")}</div><div id="pl"></div><details><summary>Create custom exercise</summary><div class="card"><label>Name<input id="cn"></label><label>Muscle group<select id="cmu">${MU.map((m) => `<option>${m}</option>`).join("")}</select></label><label>Equipment<select id="ceq">${EQ.map((m) => `<option>${m}</option>`).join("")}</select></label><button class="p" id="cc" style="margin-top:8px">Create exercise</button><p class="mu" id="ce"></p></div></details>`,
  );
  list();
  $("#pq").oninput = (e) => {
    q = e.target.value;
    list();
  };
  document.querySelectorAll("[data-mu]").forEach(
    (b) =>
      (b.onclick = () => {
        mu = b.dataset.mu;
        document.querySelectorAll("[data-mu]").forEach((x) => x.classList.toggle("on", x == b));
        list();
      }),
  );
  $("#cc").onclick = () => {
    const n = $("#cn").value.trim();
    if (!n) return ($("#ce").textContent = "Enter a name.");
    if ([...LIB, ...S.custom].some((e) => e.name.toLowerCase() == n.toLowerCase()))
      return ($("#ce").textContent = "That exercise already exists.");
    const e = { id: "c_" + uid(), name: n, mu: $("#cmu").value, eq: $("#ceq").value };
    S.custom.push(e);
    save();
    pk(e.id);
  };
}
function aView() {
  const a = S.active;
  return `<div class="row sp"><input data-f="name" value="${esc(a.name)}" aria-label="Workout name" style="font:700 24px 'Barlow Condensed';"></div>
<div class="g3" style="margin:10px 0"><div class="card"><div class="mu">Time</div><div class="n big" id="wt">${dur((Date.now() - a.start) / 1e3)}</div></div><div class="card"><div class="mu">Volume (${U()})</div><div class="n big" id="wv">${nm(k2u(wv(a)))}</div></div><div class="card"><div class="mu">Sets done</div><div class="n big" id="wsd">${a.exs.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)}</div></div></div>
${
  a.exs
    .map((x, i) => {
      const e = ex(x.ex),
        p = prev(x.ex);
      return `<div class="card"><div class="row sp"><h3>${esc(e.name)}</h3><div class="row"><button data-a="mv" data-i="${i}" data-d="-1" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button data-a="mv" data-i="${i}" data-d="1" aria-label="Move down" ${i < a.exs.length - 1 ? "" : "disabled"}>↓</button><button class="d" data-a="rx" data-i="${i}" aria-label="Remove ${esc(e.name)}">✕</button></div></div>
<div class="set pv"><span>Set</span><span>Previous</span><span>${e.eq == "Bodyweight" ? "+" : ""}${U()}</span><span>Reps</span><span>Done</span><span></span></div>
${x.sets.map((s, j) => `<div class="set ${s.done ? "done" : ""}"><button data-a="ty" data-i="${i}" data-j="${j}" aria-label="Set type ${s.t == "w" ? "warm-up" : s.t == "d" ? "drop set" : "normal"}, tap to change" ${s.t == "w" ? 'style="color:#ffb74d"' : s.t == "d" ? 'style="color:#c792ea"' : ""}>${s.t == "w" ? "W" : s.t == "d" ? "D" : j + 1 - x.sets.slice(0, j).filter((q) => q.t == "w").length}</button><span class="pv">${p[j] ? fw(p[j].w) + " × " + p[j].r : "–"}</span><input data-f="w" data-i="${i}" data-j="${j}" inputmode="decimal" value="${s.w ? fw(s.w) : ""}" placeholder="0" aria-label="Weight, set ${j + 1}"><input data-f="r" data-i="${i}" data-j="${j}" inputmode="numeric" value="${s.r || ""}" placeholder="0" aria-label="Reps, set ${j + 1}"><button class="ck ${s.done ? "on" : ""}" data-a="ck" data-i="${i}" data-j="${j}" aria-label="Mark set ${j + 1} complete" aria-pressed="${s.done}">✓</button><button data-a="ds" data-i="${i}" data-j="${j}" aria-label="Delete set ${j + 1}">–</button></div>`).join("")}
<button data-a="as" data-i="${i}" style="width:100%;margin-top:8px">Add set</button></div>`;
    })
    .join("") ||
  '<div class="card mu">No exercises yet. Add your first exercise to start logging.</div>'
}
<button class="p" data-a="ae" style="width:100%;margin-bottom:8px">Add exercise</button><label>Notes<textarea data-f="notes" rows="2">${esc(a.notes)}</textarea></label>
<div class="row" style="margin-top:10px"><button class="d" data-a="cancel" style="flex:1">Cancel workout</button><button data-a="sat" style="flex:1">Save as template</button><button class="p" data-a="fin" style="flex:1">Finish</button></div>`;
}
const V = {
  home() {
    const W = done(),
      w0 = wk(Date.now()),
      tw = W.filter((w) => wk(w.start) == w0),
      ws = wks(8),
      vs = ws.map((w) =>
        Math.round(k2u(W.filter((x) => wk(x.start) == w).reduce((a, x) => a + wv(x), 0))),
      );
    const ids = [...new Set(W.flatMap((w) => w.exs.map((x) => x.ex)))]
      .map((id) => ({ id, p: prs(id) }))
      .filter((x) => x.p.e > 0)
      .sort((a, b) => b.p.e - a.p.e)
      .slice(0, 5);
    return `<div class="row sp"><div><h1>${S.active ? "Workout in progress" : W.length ? "Ready to train?" : "Welcome"}</h1><div class="mu">${W.length ? "Here is your week so far." : "Log your first workout to see stats and records here."}</div></div><button data-a="go" data-v="settings" aria-label="Settings">⚙</button></div>
<button class="p" data-a="go" data-v="workout" style="width:100%;margin:14px 0;min-height:54px;font-size:18px">${S.active ? "Resume workout" : "Start workout"}</button>
<div class="g3"><div class="card"><div class="mu">Workouts this week</div><div class="n big">${tw.length}</div></div><div class="card"><div class="mu">Volume (${U()})</div><div class="n big">${nm(k2u(tw.reduce((a, x) => a + wv(x), 0)))}</div></div><div class="card"><div class="mu">Total workouts</div><div class="n big">${W.length}</div></div></div>
<h2>Weekly volume</h2><div class="card">${W.length ? bars(vs, ws.map(wl)) : '<span class="mu">Your chart appears after your first completed workout.</span>'}</div>
<h2>Personal records</h2>${ids.map((x) => `<div class="card row sp"><b>${esc(ex(x.id).name)}</b><span>${fw(x.p.w)}${U()} × ${x.p.rw} · est. 1RM ${fw(x.p.e)}</span></div>`).join("") || '<div class="card mu">Complete working sets to set records. Warm-ups never count.</div>'}
<h2>Recent workouts</h2>${W.slice(0, 3).map(hc).join("") || '<div class="card mu">Nothing logged yet.</div>'}<p class="mu" style="margin-top:16px">☁ ${syncMsg}</p>`;
  },
  workout() {
    if (S.active) return aView();
    return `<h1>Workouts</h1><button class="p" data-a="start" style="width:100%;margin:14px 0;min-height:54px;font-size:18px">Start empty workout</button><h2>Templates</h2>${S.templates.map((t, i) => `<div class="card"><div class="row sp"><div><h3>${esc(t.name)}</h3><div class="mu">${t.exs.map((x) => esc(ex(x.ex).name) + " " + x.n + "×" + (x.r || "?")).join(", ")}</div></div></div><div class="row" style="margin-top:10px"><button class="p" data-a="st" data-i="${i}">Start</button><button data-a="rt" data-i="${i}">Rename</button><button data-a="dt" data-i="${i}">Duplicate</button><button class="d" data-a="xt" data-i="${i}">Delete</button></div></div>`).join("") || '<div class="card mu">No templates yet. Build a workout (Push, Pull, Legs…) and tap “Save as template”, or save one from a finished workout in History.</div>'}`;
  },
  history() {
    const W = done();
    return `<h1>History</h1><div style="margin-top:12px">${W.map(hc).join("") || '<div class="card mu">No completed workouts yet. Finish a workout and it shows up here.</div>'}</div>`;
  },
  progress() {
    const W = done(),
      ws = wks(12),
      ids = [...new Set(W.flatMap((w) => w.exs.map((x) => x.ex)))];
    if (!W.length)
      return '<h1>Progress</h1><div class="card mu" style="margin-top:12px">Complete a workout to unlock volume, frequency, and strength charts.</div>';
    const sel = window.pe && ids.includes(window.pe) ? window.pe : ids[0],
      p = prs(sel),
      pts = [...W]
        .reverse()
        .map((w) => {
          const x = w.exs.find((x) => x.ex == sel);
          if (!x) return null;
          const m = Math.max(
            0,
            ...x.sets.filter((s) => s.done && s.t != "w").map((s) => e1(s.w, s.r)),
          );
          return m ? { x: wl(w.start), y: fw(m) } : null;
        })
        .filter(Boolean);
    const mo = {},
      cut = Date.now() - 30 * 864e5;
    W.filter((w) => w.start > cut).forEach((w) =>
      w.exs.forEach((x) => {
        const m = ex(x.ex).mu;
        mo[m] = (mo[m] || 0) + vol(x.sets);
      }),
    );
    const mm = Math.max(1, ...Object.values(mo)),
      tot = W.reduce(
        (a, w) =>
          a + w.exs.reduce((b, x) => b + x.sets.filter((s) => s.done && s.t != "w").length, 0),
        0,
      ),
      reps = W.reduce(
        (a, w) =>
          a +
          w.exs.reduce(
            (b, x) => b + x.sets.filter((s) => s.done && s.t != "w").reduce((c, s) => c + s.r, 0),
            0,
          ),
        0,
      );
    return `<h1>Progress</h1><div class="g3" style="margin:12px 0"><div class="card"><div class="mu">Working sets</div><div class="n big">${tot}</div></div><div class="card"><div class="mu">Total reps</div><div class="n big">${nm(reps)}</div></div><div class="card"><div class="mu">Avg / week</div><div class="n big">${(W.length / Math.max(1, (Date.now() - W.at(-1).start) / 6048e5)).toFixed(1)}</div></div></div>
<h2>Weekly volume (${U()})</h2><div class="card">${bars(
      ws.map((w) =>
        Math.round(k2u(W.filter((x) => wk(x.start) == w).reduce((a, x) => a + wv(x), 0))),
      ),
      ws.map(wl),
    )}</div>
<h2>Workouts per week</h2><div class="card">${bars(
      ws.map((w) => W.filter((x) => wk(x.start) == w).length),
      ws.map(wl),
    )}</div>
<h2>Volume by muscle, last 30 days</h2><div class="card">${
      Object.entries(mo)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([m, v]) =>
            `<div class="row sp"><span>${m}</span><span class="mu">${nm(k2u(v))} ${U()}</span></div><div class="bar" style="width:${(v / mm) * 100}%"></div>`,
        )
        .join("") || '<span class="mu">No workouts in the last 30 days.</span>'
    }</div>
<h2>Exercise strength</h2><label>Exercise<select data-f="pe">${ids.map((i) => `<option value="${i}" ${i == sel ? "selected" : ""}>${esc(ex(i).name)}</option>`).join("")}</select></label>
<div class="card" style="margin-top:10px"><div class="mu">Estimated 1RM (Epley: weight × (1 + reps ÷ 30)). An estimate, not a tested max.</div>${line(pts)}</div>
<div class="g3"><div class="card"><div class="mu">Heaviest</div><b>${fw(p.w)} ${U()} × ${p.rw}</b></div><div class="card"><div class="mu">Est. 1RM</div><b>${fw(p.e)} ${U()}</b></div><div class="card"><div class="mu">Best session</div><b>${nm(k2u(p.v))} ${U()}</b></div></div>
<h2>History for this exercise</h2>${W.filter((w) => w.exs.some((x) => x.ex == sel))
      .slice(0, 6)
      .map((w) => {
        const x = w.exs.find((x) => x.ex == sel),
          pw = W.find((o) => o.start < w.start && o.exs.some((y) => y.ex == sel)),
          pv = pw ? vol(pw.exs.find((y) => y.ex == sel).sets) : null,
          v = vol(x.sets),
          d =
            pv == null
              ? ""
              : ` <b style="color:${v >= pv ? "var(--a)" : "var(--r)"}">${v >= pv ? "▲" : "▼"} ${nm(Math.abs(k2u(v - pv)))}</b>`;
        return `<div class="card"><div class="row sp"><b>${dt(w.start)}</b><span>${nm(k2u(v))} ${U()}${d}</span></div><div class="mu">${x.sets.map((s) => (s.t == "w" ? "W " : "") + fw(s.w) + "×" + s.r).join(" · ")}</div></div>`;
      })
      .join("")}`;
  },
  settings() {
    return `<div class="row sp"><h1>Settings</h1><button data-a="go" data-v="home">Back</button></div><h2>Units</h2><div class="card"><div class="row"><button class="chip ${S.unit == "lb" ? "on" : ""}" data-a="un" data-u="lb">Pounds (lb)</button><button class="chip ${S.unit == "kg" ? "on" : ""}" data-a="un" data-u="kg">Kilograms (kg)</button></div><p class="mu">Data is stored in kg and converted for display, so switching never changes your history.</p></div>
<h2>Data</h2><div class="card"><button data-a="ex" style="width:100%;margin-bottom:8px">Export / back up data</button><button data-a="im" style="width:100%;margin-bottom:8px">Restore from backup</button><button class="d" data-a="dh" style="width:100%;margin-bottom:8px">Delete workout history</button><button class="d" data-a="dall" style="width:100%">Delete everything</button></div>
<h2>Cloud sync</h2><div class="card mu">${syncMsg}<br>Your data is private to your Claude account. Use Export for an extra backup.</div><h2>How volume works</h2><div class="card mu">Volume = weight × reps for completed working sets (normal and drop sets). Warm-up and incomplete sets are excluded. Bodyweight exercises use the weight field for optional added weight, so bodyweight-only sets log reps but add 0 volume. Workouts are grouped by local date; weeks start Monday.</div>`;
  },
};
function hc(w) {
  const n = w.exs.reduce((a, x) => a + x.sets.length, 0);
  return `<button class="card" data-a="hd" data-id="${w.id}" style="width:100%;text-align:left;display:block"><div class="row sp"><h3>${esc(w.name)}</h3><span class="mu">${dt(w.start)}</span></div><div class="mu">${dur(w.dur)} · ${n} sets · ${nm(k2u(wv(w)))} ${U()}</div><div class="mu">${w.exs.map((x) => esc(ex(x.ex).name)).join(", ")}</div></button>`;
}
function render() {
  try {
    $("#v").innerHTML = V[S.view]();
    document
      .querySelectorAll("nav button")
      .forEach((b) => b.classList.toggle("on", b.dataset.v == S.view));
    scrollTo(0, 0);
  } catch (e) {
    $("#v").innerHTML =
      '<div class="card"><h3>Something went wrong</h3><p class="mu">' +
      esc(e.message) +
      '</p><button data-a="go" data-v="home">Back to home</button></div>';
  }
}
function finish() {
  const a = S.active;
  if (S.workouts.some((w) => w.id == a.id)) {
    S.active = null;
    save();
    return render();
  }
  const exs = a.exs
    .map((x) => ({ id: x.id, ex: x.ex, sets: x.sets.filter((s) => s.done) }))
    .filter((x) => x.sets.length);
  S.workouts.push({
    id: a.id,
    name: a.name.trim() || "Workout",
    start: a.start,
    end: Date.now(),
    dur: (Date.now() - a.start) / 1e3,
    notes: a.notes,
    exs,
  });
  S.active = null;
  rest = 0;
  S.view = "history";
  save();
  render();
}
const A = {
  go: (d) => {
    S.view = d.v;
    save();
    render();
  },
  cm,
  pk: (d) => window.pk(d.id),
  r15: () => {
    rest += 15e3;
  },
  r0: () => {
    rest = 0;
  },
  start: () => startW(null),
  st: (d) => startW(S.templates[d.i]),
  rt: (d) => {
    modal(
      `<h3>Rename template</h3><input id="rn" value="${esc(S.templates[d.i].name)}"><button class="p" id="rk" style="margin-top:10px;width:100%">Save name</button>`,
    );
    $("#rk").onclick = () => {
      S.templates[d.i].name = $("#rn").value.trim() || "Template";
      save();
      cm();
      render();
    };
  },
  dt: (d) => {
    const t = S.templates[d.i];
    S.templates.push({ ...JSON.parse(JSON.stringify(t)), id: uid(), name: t.name + " copy" });
    save();
    render();
  },
  xt: (d) =>
    ask("Delete this template?", "Delete", () => {
      S.templates.splice(d.i, 1);
      save();
      render();
    }),
  sat: () => {
    const a = S.active;
    if (!a.exs.length)
      return modal(
        '<h3>Add an exercise first</h3><button data-a="cm" style="width:100%">OK</button>',
      );
    S.templates.push({
      id: uid(),
      name: a.name,
      exs: a.exs.map((x) => {
        const l = x.sets.at(-1) || {};
        return { ex: x.ex, n: x.sets.length, r: l.r || 0, w: l.w || 0 };
      }),
    });
    save();
    modal(
      '<h3>Template saved</h3><p class="mu">Find it under Workouts.</p><button data-a="cm" style="width:100%">OK</button>',
    );
  },
  ae: () =>
    picker((id) => {
      S.active.exs.push({ id: uid(), ex: id, sets: [ns()] });
      save();
      render();
    }),
  rx: (d) =>
    ask("Remove this exercise and its sets?", "Remove", () => {
      S.active.exs.splice(d.i, 1);
      save();
      render();
    }),
  mv: (d) => {
    const x = S.active.exs,
      i = +d.i,
      j = i + +d.d;
    [x[i], x[j]] = [x[j], x[i]];
    save();
    render();
  },
  as: (d) => {
    const s = S.active.exs[d.i].sets,
      l = s.at(-1);
    s.push(l ? ns(l.w, l.r) : ns());
    save();
    render();
  },
  ds: (d) => {
    S.active.exs[d.i].sets.splice(d.j, 1);
    save();
    render();
  },
  ty: (d) => {
    const s = S.active.exs[d.i].sets[d.j];
    s.t = { n: "w", w: "d", d: "n" }[s.t];
    save();
    render();
  },
  ck: (d) => {
    const s = S.active.exs[d.i].sets[d.j];
    if (!s.done && !(s.r > 0))
      return modal(
        '<h3>Enter reps first</h3><p class="mu">A set needs at least 1 rep to count.</p><button data-a="cm" style="width:100%">OK</button>',
      );
    s.done = !s.done;
    rest = s.done ? Date.now() + 9e4 : 0;
    save();
    render();
  },
  cancel: () =>
    ask("Cancel this workout? Unsaved progress will be lost.", "Discard workout", () => {
      S.active = null;
      rest = 0;
      save();
      render();
    }),
  fin: () => {
    const n = S.active.exs.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
    n
      ? ask(
          `Finish workout? ${n} completed sets will be saved; unchecked sets are dropped.`,
          "Finish workout",
          finish,
        )
      : modal(
          '<h3>No completed sets</h3><p class="mu">Check off at least one set, or cancel the workout.</p><button data-a="cm" style="width:100%">OK</button>',
        );
  },
  hd: (d) => {
    const w = S.workouts.find((x) => x.id == d.id);
    det = w.id;
    modal(
      `<div class="row sp"><h3>${esc(w.name)}</h3><button data-a="cm">Close</button></div><p class="mu">${dt(w.start)} · ${dur(w.dur)} · ${nm(k2u(wv(w)))} ${U()} volume</p>${w.exs.map((x) => `<div class="card"><b>${esc(ex(x.ex).name)}</b><div class="mu">${x.sets.map((s) => (s.t == "w" ? "W " : s.t == "d" ? "D " : "") + fw(s.w) + " × " + s.r).join(" · ")}</div></div>`).join("")}<label>Notes<textarea data-f="hn" rows="2">${esc(w.notes)}</textarea></label><div class="row" style="margin-top:10px"><button class="p" data-a="rep" style="flex:1">Repeat workout</button><button class="d" data-a="dw" style="flex:1">Delete</button></div>`,
    );
  },
  rep: () => {
    const w = S.workouts.find((x) => x.id == det);
    cm();
    startW({
      name: w.name,
      exs: w.exs.map((x) => ({ ex: x.ex, sets: x.sets.filter((s) => s.t != "w") })),
    });
  },
  dw: () =>
    ask("Delete this workout permanently?", "Delete", () => {
      S.workouts = S.workouts.filter((x) => x.id != det);
      save();
      cm();
      render();
    }),
  un: (d) => {
    S.unit = d.u;
    save();
    render();
  },
  ex: () => {
    const j = JSON.stringify(
      {
        app: "iron-log",
        version: 1,
        weightUnit: "kg",
        exported: new Date().toISOString(),
        data: { workouts: S.workouts, templates: S.templates, custom: S.custom, unit: S.unit },
      },
      null,
      1,
    );
    modal(
      `<h3>Backup</h3><p class="mu">Copy this text and keep it somewhere safe. Weights are in kg.</p><textarea id="bk" rows="10" readonly>${esc(j)}</textarea><button class="p" id="cp" style="width:100%;margin-top:8px">Copy to clipboard</button><button data-a="cm" style="width:100%;margin-top:8px">Close</button>`,
    );
    $("#cp").onclick = () => {
      $("#bk").select();
      try {
        navigator.clipboard.writeText(j);
      } catch (e) {
        document.execCommand("copy");
      }
      $("#cp").textContent = "Copied";
    };
  },
  im: () => {
    modal(
      '<h3>Restore backup</h3><p class="mu">Paste a backup. This replaces current workouts, templates, and custom exercises.</p><textarea id="ib" rows="8"></textarea><p id="ie" style="color:var(--r)"></p><button class="p" id="ik" style="width:100%">Restore</button>',
    );
    $("#ik").onclick = () => {
      try {
        const d = JSON.parse($("#ib").value).data;
        if (!Array.isArray(d.workouts) || !Array.isArray(d.templates)) throw 0;
        S.workouts = d.workouts;
        S.templates = d.templates;
        S.custom = d.custom || [];
        S.unit = d.unit || S.unit;
        save();
        cm();
        render();
      } catch (e) {
        $("#ie").textContent = "That is not a valid Iron Log backup.";
      }
    };
  },
  dh: () =>
    ask(
      "Delete all workout history? Templates stay. This cannot be undone.",
      "Delete history",
      () => {
        S.workouts = [];
        save();
        render();
      },
    ),
  dall: () =>
    ask("Delete ALL data including templates and custom exercises?", "Delete everything", () => {
      S = { unit: S.unit, workouts: [], templates: [], custom: [], active: null, view: "home" };
      save();
      render();
    }),
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  if (b && A[b.dataset.a]) A[b.dataset.a](b.dataset);
});
function upd(e) {
  const t = e.target,
    f = t.dataset.f,
    a = S.active;
  if (!f) return;
  const n = parseFloat(String(t.value).replace(",", "."));
  if (f == "pe") {
    window.pe = t.value;
    return render();
  }
  if (f == "hn") {
    S.workouts.find((w) => w.id == det).notes = t.value;
    return save();
  }
  if (f == "name") a.name = t.value;
  else if (f == "notes") a.notes = t.value;
  else {
    const s = a.exs[t.dataset.i].sets[t.dataset.j];
    if (f == "w") s.w = n > 0 ? u2k(Math.min(n, 2e3)) : 0;
    else s.r = n > 0 ? Math.min(Math.floor(n), 999) : 0;
  }
  save();
  $("#wv") && ($("#wv").textContent = nm(k2u(wv(a))));
}
document.addEventListener("input", (e) => {
  if (e.target.dataset.f != "pe") upd(e);
});
document.addEventListener("change", upd);
setInterval(() => {
  if (S.active && S.view == "workout" && $("#wt")) {
    $("#wt").textContent = dur((Date.now() - S.active.start) / 1e3);
    $("#wsd").textContent = S.active.exs.reduce(
      (n, e) => n + e.sets.filter((s) => s.done).length,
      0,
    );
  }
  const r = $("#rest"),
    left = Math.ceil((rest - Date.now()) / 1e3);
  if (left > 0 && S.active) {
    r.hidden = false;
    r.innerHTML = `Rest <span class="n" style="font-size:24px">${dur(left)}</span><button data-a="r15">+15s</button><button data-a="r0">Skip</button>`;
  } else r.hidden = true;
}, 500);
const meta = () =>
  JSON.stringify({ unit: S.unit, templates: S.templates, custom: S.custom, active: S.active });
const stat = () => {
  if (S.view == "settings") render();
};
async function push() {
  if (!cloud) return;
  if (pushing) {
    again = true;
    return;
  }
  pushing = true;
  try {
    const m = meta();
    if (m != sentMeta) {
      await cloud
        .doc("meta")
        .set({
          ts: S.ts || Date.now(),
          unit: S.unit,
          templates: S.templates,
          custom: S.custom,
          active: S.active || null,
        });
      sentMeta = m;
    }
    for (const w of S.workouts) {
      const j = JSON.stringify(w);
      if (sent[w.id] !== j) {
        await cloud.doc("w_" + w.id).set(w);
        sent[w.id] = j;
      }
    }
    for (const id of Object.keys(sent))
      if (!S.workouts.some((w) => w.id == id)) {
        await cloud.doc("w_" + id).delete();
        delete sent[id];
      }
    syncMsg = "Synced to your account ✓";
    if (!again) dirty = false;
  } catch (e) {
    if (e.code == "invalid_argument") {
      cloud = null;
      syncMsg = "Your access here is view-only, so data is saved on this device only.";
    } else
      syncMsg =
        "Sync problem (" +
        (e.code || "error") +
        "). Saved on this device; will retry on your next change.";
  }
  pushing = false;
  if (again) {
    again = false;
    push();
  }
  stat();
}
async function pull() {
  if (pushing || !cloud) return;
  try {
    const snap = await cloud.get(),
      ws = [];
    let m = null;
    snap.docs.forEach((d) => {
      const x = JSON.parse(JSON.stringify(d.data()));
      if (d.id == "meta") m = x;
      else if (d.id.startsWith("w_")) ws.push(x);
    });
    const first = S.synced != cloud.path;
    if (dirty && !first) {
      push();
      return;
    }
    const cids = new Set(ws.map((w) => w.id));
    if (first)
      S.workouts.forEach((w) => {
        if (!cids.has(w.id)) ws.push(w);
      });
    S.workouts = ws;
    sent = {};
    ws.forEach((w) => {
      if (cids.has(w.id)) sent[w.id] = JSON.stringify(w);
    });
    if (m && m.ts > (S.ts || 0)) {
      S.unit = m.unit || S.unit;
      S.templates = m.templates || [];
      S.custom = m.custom || [];
      S.active = m.active || null;
      sentMeta = meta();
    } else sentMeta = "";
    S.synced = cloud.path;
    try {
      localStorage.setItem("gt1", JSON.stringify(S));
    } catch (e) {}
    syncMsg = "Synced to your account ✓";
    if (!(S.view == "workout" && S.active)) render();
    else stat();
    push();
  } catch (e) {
    syncMsg =
      "Could not reach your account storage (" + (e.code || "error") + "). Using this device.";
    stat();
  }
}
async function initSync() {
  try {
    const db = await claude.use("db"),
      user = await claude.use("user"),
      id = user && (await user.id());
    if (!db || !id) {
      syncMsg =
        "Saved on this device only. Open this page while signed in to Claude to sync across devices.";
      return stat();
    }
    cloud = db.collection("data/users/" + id);
    syncMsg = "Connecting…";
    await pull();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && cloud) pull();
    });
  } catch (e) {
    cloud = null;
    syncMsg = "Saved on this device only.";
    stat();
  }
}
addEventListener("error", (e) => {
  const b = document.createElement("div");
  b.className = "card";
  b.style.color = "var(--r)";
  b.textContent = "Error: " + e.message;
  $("#v").prepend(b);
});
render();
initSync();