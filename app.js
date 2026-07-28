const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  initial = [
    ["JavaScript", "⚡", 159],
    ["Node.js", "⬢", 210],
    ["Design_Patterns", "◇", 95],
  ];
let catalog = [],
  selected = "",
  selectedSection = "",
  current = null,
  filter = "all",
  folders = [],
  lastTime = 0;
const state = () => JSON.parse(localStorage.getItem("courseCompass") || "{}"),
  save = (x) => localStorage.setItem("courseCompass", JSON.stringify(x)),
  esc = (s) =>
    String(s).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    ),
  status = (l) => !!state().completed?.[l.id],
  day = (o) => {
    let d = new Date();
    d.setDate(d.getDate() - o);
    return d.toISOString().slice(0, 10);
  },
  mins = (s) =>
    s < 3600 ? Math.round(s / 60) + "m" : (s / 3600).toFixed(1) + "h",
  pct = (l) => {
    let s = state();
    return s.durations?.[l.id]
      ? Math.min(
          100,
          Math.round(((s.watchSeconds?.[l.id] || 0) / s.durations[l.id]) * 100),
        )
      : 0;
  },
  flash = (x) => {
    $("#toast").textContent = x;
    $("#toast").classList.add("show");
    setTimeout(() => $("#toast").classList.remove("show"), 2200);
  };
const db = new Promise((ok, bad) => {
    let r = indexedDB.open("courseCompassFolders", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("folders");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  }),
  readFolders = async () =>
    new Promise((ok, bad) => {
      db.then((d) => {
        let r = d.transaction("folders").objectStore("folders").getAll();
        r.onsuccess = () => ok(r.result || []);
        r.onerror = () => bad(r.error);
      });
    }),
  writeFolder = async (x) =>
    new Promise((ok, bad) =>
      db.then((d) => {
        let t = d.transaction("folders", "readwrite");
        t.objectStore("folders").put(x, x.id);
        t.oncomplete = ok;
        t.onerror = () => bad(t.error);
      }),
    ),
  clearFolders = async () =>
    new Promise((ok, bad) =>
      db.then((d) => {
        let t = d.transaction("folders", "readwrite");
        t.objectStore("folders").clear();
        t.oncomplete = ok;
        t.onerror = () => bad(t.error);
      }),
    );
function renderDash() {
  let all = catalog.length
      ? catalog
      : initial.flatMap((x) =>
          Array.from({ length: x[2] }, (_, i) => ({ id: x[0] + i })),
        ),
    s = state(),
    done = all.filter(status).length,
    total = Object.values(s.activity || {}).reduce((a, b) => a + b, 0),
    streak = 0;
  for (let i = 0; i < 365 && (s.activity?.[day(i)] || 0) > 0; i++) streak++;
  $("#doneStat").textContent = done;
  $("#timeStat").textContent = mins(total);
  $("#streakStat").textContent = streak + " day" + (streak === 1 ? "" : "s");
  $("#progressStat").textContent = all.length
    ? Math.round((done / all.length) * 100) + "%"
    : "0%";
  $("#lessonCount").textContent = all.length;
  $("#courseSummary").textContent = catalog.length
    ? [...new Set(catalog.map((x) => x.course))].length +
      " connected courses · " +
      mins(
        Object.entries(s.activity || {})
          .filter(([d]) => d >= day(6))
          .reduce((n, [, v]) => n + v, 0),
      ) +
      " this week"
    : "464 lessons ready to connect";
  let courses = catalog.length
    ? [...new Set(catalog.map((x) => x.course))].map((n) => [
        n,
        n === "JavaScript" ? "⚡" : n === "Node.js" ? "⬢" : "◇",
        catalog.filter((x) => x.course === n).length,
      ])
    : initial;
  $("#courses").innerHTML = courses
    .map((c) => {
      let ls = catalog.filter((x) => x.course === c[0]),
        p = ls.length
          ? Math.round((ls.filter(status).length / ls.length) * 100)
          : 0;
      return `<button class="course" data-course="${esc(c[0])}"><span class="icon">${c[1]}</span><h3>${esc(c[0])}</h3><p>Explore lessons at your own pace and keep your progress visible.</p><div class="progress"><i style="width:${p}%"></i></div><div class="course-footer"><span>${c[2]} lessons</span><span>${p}% done</span></div></button>`;
    })
    .join("");
  $$(".course").forEach(
    (b) => (b.onclick = () => openLibrary(b.dataset.course)),
  );
  let last = s.last && catalog.find((x) => x.id === s.last);
  $("#continueArea").innerHTML = last
    ? `<button class="lesson-card" id="continueBtn"><div><h4>${esc(last.title)}</h4><p>${esc(last.course)} · ${pct(last)}% watched</p></div><span class="primary">Resume</span></button>`
    : '<div class="empty"><h3>Choose your next lesson</h3><p>Connect one or more course folders to build your library.</p></div>';
  if (last) $("#continueBtn").onclick = () => openLesson(last);
}
function renderLibrary() {
  if (!catalog.length) {
    $("#outline").innerHTML = "";
    $("#lessonList").innerHTML =
      '<div class="empty"><h3>No connected lessons</h3><p>Add a course folder to start.</p></div>';
    return;
  }
  let cs = [...new Set(catalog.map((x) => x.course))];
  if (!selected || !cs.includes(selected)) {
    selected = cs[0];
    selectedSection = "";
  }
  let outline = "";
  for (const c of cs) {
    let courseLessons = catalog.filter((x) => x.course === c),
      sections = [...new Set(courseLessons.map((x) => x.section))];
    outline += `<button class="course-nav ${c === selected && !selectedSection ? "active" : ""}" data-course="${esc(c)}">${esc(c)}<small>All topics · ${courseLessons.length} lessons</small></button>`;
    if (c === selected)
      outline += sections
        .map(
          (s) =>
            `<button class="topic-nav ${s === selectedSection ? "active" : ""}" data-section="${esc(s)}">↳ ${esc(s)}<small>${courseLessons.filter((x) => x.section === s).length} lessons</small></button>`,
        )
        .join("");
  }
  $("#outline").innerHTML = outline;
  $$(".course-nav").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.course;
        selectedSection = "";
        renderLibrary();
      }),
  );
  $$(".topic-nav").forEach(
    (b) =>
      (b.onclick = () => {
        selectedSection = b.dataset.section;
        renderLibrary();
      }),
  );
  let ls = catalog.filter(
      (x) =>
        x.course === selected &&
        (!selectedSection || x.section === selectedSection),
    ),
    q = $("#search").value.toLowerCase();
  if (q) ls = ls.filter((x) => (x.title + x.section).toLowerCase().includes(q));
  if (filter === "done") ls = ls.filter(status);
  if (filter === "todo") ls = ls.filter((x) => !status(x));
  if (filter === "watched") ls = ls.filter((x) => pct(x) > 0);
  $("#lessonList").innerHTML =
    ls
      .map(
        (l) =>
          `<article class="lesson-card"><button class="lesson-open" data-id="${esc(l.id)}" style="border:0;background:transparent;color:inherit;text-align:left;padding:0;flex:1"><h4>${esc(l.title)}</h4><p>${esc(l.section)} · ${pct(l)}% watched</p></button><span class="check ${status(l) ? "done" : ""}">${status(l) ? "✓ Done" : pct(l) ? pct(l) + "% watched" : "Not started"}</span></article>`,
      )
      .join("") || '<div class="empty"><h3>No lessons match</h3></div>';
  $$(".lesson-open").forEach(
    (b) =>
      (b.onclick = () =>
        openLesson(catalog.find((x) => x.id === b.dataset.id))),
  );
}
function notes() {
  let n = state().notes || {},
    ls = catalog.filter((x) => n[x.id]);
  $("#notesList").innerHTML =
    ls
      .map(
        (l) =>
          `<article class="lesson-card"><button class="lesson-open" data-id="${esc(l.id)}" style="border:0;background:transparent;color:inherit;text-align:left;padding:0;flex:1"><h4>${esc(l.title)}</h4><p>${esc(n[l.id].slice(0, 110))}</p></button></article>`,
      )
      .join("") || '<div class="empty"><h3>No notes yet</h3></div>';
  $$(".lesson-open").forEach(
    (b) =>
      (b.onclick = () =>
        openLesson(catalog.find((x) => x.id === b.dataset.id))),
  );
}
function show(v) {
  ["dashboard", "library", "notes", "player"].forEach((x) =>
    $("#" + x + "View").classList.toggle("hidden", x !== v),
  );
  $$(".nav").forEach((x) => x.classList.toggle("active", x.dataset.view === v));
  if (v === "dashboard") renderDash();
  if (v === "notes") notes();
}
function openLibrary(c) {
  if (c && c !== selected) selectedSection = "";
  selected = c || selected;
  show("library");
  renderLibrary();
}
function doneButton() {
  if (!current) return;
  let p = pct(current),
    ready = p >= 50;
  $("#doneBtn").disabled = !status(current) && !ready;
  $("#doneBtn").textContent = status(current)
    ? "Completed ✓"
    : ready
      ? "Mark complete"
      : "Watch " + (50 - p) + "% more";
}
function openLesson(l) {
  current = l;
  let s = state();
  s.last = l.id;
  save(s);
  $("#video").src = l.url;
  $("#lessonTitle").textContent = l.title;
  $("#lessonMeta").textContent = l.course + " · " + l.section;
  $("#breadcrumb").textContent = l.course + " / " + l.section;
  $("#noteText").value = s.notes?.[l.id] || "";
  $("#watchProgress").style.width = pct(l) + "%";
  doneButton();
  show("player");
}
function toggleDone() {
  if (!current || (!status(current) && pct(current) < 50))
    return flash("Watch at least half before completing this lesson.");
  let s = state();
  s.completed = s.completed || {};
  s.completed[current.id] = !s.completed[current.id];
  save(s);
  doneButton();
  renderDash();
  renderLibrary();
}
async function scan(h, path = "", source = "", fixed = "") {
  for await (let e of h.values()) {
    if (e.kind === "directory")
      await scan(e, path ? path + "/" + e.name : e.name, source, fixed);
    else if (/\.(mp4|mkv|webm|mov|m4v)$/i.test(e.name)) {
      let parts = (path + "/" + e.name).split("/"),
        course = fixed || parts[0],
        rest = fixed ? parts : parts.slice(1),
        file = await e.getFile();
      catalog.push({
        id: source + "::" + path + "/" + e.name,
        course,
        section: rest.slice(0, -1).join(" / ") || "Lessons",
        title: e.name
          .replace(/\.[^.]+$/, "")
          .replace(/^\d+[.\-\s]*/, "")
          .trim(),
        url: URL.createObjectURL(file),
      });
    }
  }
}
async function load() {
  catalog.forEach((x) => URL.revokeObjectURL(x.url));
  catalog = [];
  for (let f of folders)
    if ((await f.handle.queryPermission({ mode: "read" })) === "granted")
      await scan(
        f.handle,
        "",
        f.id,
        /^(video|videos|library|courses)$/i.test(f.name) ? "" : f.name,
      );
  catalog.sort(
    (a, b) =>
      a.course.localeCompare(b.course) ||
      a.section.localeCompare(b.section) ||
      a.title.localeCompare(b.title, undefined, { numeric: true }),
  );
  $("#connectBtn").textContent = catalog.length
    ? "Add course folder"
    : "Reconnect folders";
  $("#disconnectBtn").classList.toggle("hidden", !folders.length);
  renderDash();
  renderLibrary();
}
async function connect() {
  try {
    if (folders.length && !catalog.length) {
      for (let f of folders) await f.handle.requestPermission({ mode: "read" });
      await load();
      return;
    }
    let h = await window.showDirectoryPicker({ mode: "read" }),
      f = { id: crypto.randomUUID(), handle: h, name: h.name };
    await writeFolder(f);
    folders.push(f);
    await load();
    flash(h.name + " added to your library");
  } catch (e) {
    if (e.name !== "AbortError") flash("Could not read that folder.");
  }
}
async function disconnect() {
  let v = $("#video");
  v.pause();
  v.removeAttribute("src");
  v.load();
  catalog.forEach((x) => URL.revokeObjectURL(x.url));
  catalog = [];
  folders = [];
  current = null;
  await clearFolders();
  $("#disconnectBtn").classList.add("hidden");
  show("dashboard");
  renderDash();
  renderLibrary();
  flash("Course library disconnected");
}
async function restore() {
  let r = await readFolders();
  folders = r.map((x, i) =>
    x.handle ? x : { id: "legacy-" + i, handle: x, name: x.name || "Video" },
  );
  await load();
}
$("#connectBtn").onclick = connect;
$("#disconnectBtn").onclick = disconnect;
$$(".nav").forEach((b) => (b.onclick = () => show(b.dataset.view)));
$("#search").oninput = renderLibrary;
$$(".chip[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      $$(".chip[data-filter]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      filter = b.dataset.filter;
      renderLibrary();
    }),
);
$("#backToLibrary").onclick = () => openLibrary(current?.course);
$("#doneBtn").onclick = toggleDone;
$("#noteText").oninput = (e) => {
  if (!current) return;
  let s = state();
  s.notes = s.notes || {};
  s.notes[current.id] = e.target.value;
  save(s);
};
$("#video").onloadedmetadata = (e) => {
  if (!current) return;
  let s = state();
  s.durations = s.durations || {};
  s.durations[current.id] = e.target.duration;
  save(s);
  doneButton();
};
$("#video").onplay = (e) => (lastTime = e.target.currentTime);
$("#video").onseeked = (e) => (lastTime = e.target.currentTime);
$("#video").ontimeupdate = (e) => {
  if (!current) return;
  let d = e.target.currentTime - lastTime;
  lastTime = e.target.currentTime;
  if (d <= 0 || d > 3) return;
  let s = state();
  s.watchSeconds = s.watchSeconds || {};
  s.activity = s.activity || {};
  s.watchSeconds[current.id] = (s.watchSeconds[current.id] || 0) + d;
  s.activity[day(0)] = (s.activity[day(0)] || 0) + d;
  save(s);
  $("#watchProgress").style.width = pct(current) + "%";
  doneButton();
};
renderDash();
restore();
