const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  initial = [
    ["JavaScript", "J", 159],
    ["Node.js", "N", 210],
    ["Design_Patterns", "D", 95],
  ];
let catalog = [],
  selected = "",
  selectedSection = "",
  current = null,
  filter = "all",
  folders = [],
  lastTime = 0;
const state = () => {
    try {
      return JSON.parse(localStorage.getItem("courseCompass") || "{}");
    } catch (e) {
      return {};
    }
  },
  save = (x) => {
    localStorage.setItem("courseCompass", JSON.stringify(x));
    try {
      backup.then((d) => {
        let t = d.transaction("state", "readwrite");
        t.objectStore("state").put(x, "main");
      });
    } catch (e) {}
  },
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
  flagged = (l) => !!state().flags?.[l.id],
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
    );

const backup = new Promise((ok, bad) => {
    let r = indexedDB.open("courseCompassBackup", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  }),
  readBackup = async () =>
    new Promise((ok) => {
      backup.then(
        (d) => {
          let r = d.transaction("state").objectStore("state").get("main");
          r.onsuccess = () => ok(r.result || null);
          r.onerror = () => ok(null);
        },
        () => ok(null),
      );
    });

/* ---------- Dashboard ---------- */
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
  $("#flagCount").textContent = all.filter(flagged).length;
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
    ? [...new Set(catalog.map((x) => x.course))].map((n) => {
        let ls = catalog.filter((x) => x.course === n);
        let doneCount = ls.filter(status).length;
        let p = ls.length ? Math.round((doneCount / ls.length) * 100) : 0;
        return {
          name: n,
          icon: n.charAt(0).toUpperCase(),
          total: ls.length,
          done: doneCount,
          progress: p,
        };
      })
    : initial.map((x) => ({
        name: x[0],
        icon: x[1],
        total: x[2],
        done: 0,
        progress: 0,
      }));

  // Sort courses: Active in-progress first, then unstarted, then completed
  courses.sort((a, b) => {
    let rankA = a.progress > 0 && a.progress < 100 ? 2 : a.progress === 0 ? 1 : 0;
    let rankB = b.progress > 0 && b.progress < 100 ? 2 : b.progress === 0 ? 1 : 0;
    if (rankB !== rankA) return rankB - rankA;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return a.name.localeCompare(b.name);
  });

  $("#courses").innerHTML = courses
    .map((c) => {
      let badge =
        c.progress === 100
          ? '<span class="badge-tag done">Completed</span>'
          : c.progress > 0
            ? `<span class="badge-tag active">${c.progress}% done</span>`
            : '<span class="badge-tag">Not started</span>';
      return `<button class="course" data-course="${esc(c.name)}">
        <div class="course-header-row">
          <span class="icon">${c.icon}</span>
          ${badge}
        </div>
        <div class="course-info">
          <h3>${esc(c.name)}</h3>
          <p>Explore lessons and track your study milestones.</p>
        </div>
        <div class="course-bottom">
          <div class="progress"><i style="width:${c.progress}%"></i></div>
          <div class="course-footer">
            <span>${c.total} lessons</span>
            <span>${c.done}/${c.total} done</span>
          </div>
        </div>
      </button>`;
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
  renderActivityGraph();
}

/* ---------- Library ---------- */
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
          `<article class="lesson-card ${flagged(l) ? "flagged" : ""}"><button class="lesson-open" data-id="${esc(l.id)}"><h4>${esc(l.title)}</h4><p>${esc(l.section)} · ${pct(l)}% watched</p></button><span class="check ${status(l) ? "done" : ""}">${status(l) ? "Done" : flagged(l) ? "Watch later" : pct(l) ? pct(l) + "% watched" : "Not started"}</span></article>`,
      )
      .join("") || '<div class="empty"><h3>No lessons match</h3></div>';
  $$(".lesson-open").forEach(
    (b) =>
      (b.onclick = () =>
        openLesson(catalog.find((x) => x.id === b.dataset.id))),
  );
}

/* ---------- Notes & Flagged views ---------- */
function notes() {
  let n = state().notes || {},
    ls = catalog.filter((x) => n[x.id]);
  $("#notesList").innerHTML =
    ls
      .map(
        (l) =>
          `<article class="lesson-card"><button class="lesson-open" data-id="${esc(l.id)}"><h4>${esc(l.title)}</h4><p>${esc(n[l.id].slice(0, 110))}</p></button></article>`,
      )
      .join("") || '<div class="empty"><h3>No notes yet</h3></div>';
  $$(".lesson-open").forEach(
    (b) =>
      (b.onclick = () =>
        openLesson(catalog.find((x) => x.id === b.dataset.id))),
  );
}
function renderFlagged() {
  let ls = catalog.filter(flagged);
  $("#flaggedList").innerHTML =
    ls
      .map(
        (l) =>
          `<article class="lesson-card flagged"><button class="lesson-open" data-id="${esc(l.id)}"><h4>${esc(l.title)}</h4><p>${esc(l.course)} · ${esc(l.section)} · ${pct(l)}% watched</p></button><button class="check" data-unflag="${esc(l.id)}">Clear flag</button></article>`,
      )
      .join("") ||
      '<div class="empty"><h3>Nothing flagged</h3><p>Flag a lesson from the player when the topic isn\'t clear yet — it will appear here to revisit.</p></div>';
  $$("#flaggedList .lesson-open").forEach(
    (b) =>
      (b.onclick = () =>
        openLesson(catalog.find((x) => x.id === b.dataset.id))),
  );
  $$("#flaggedList .check").forEach((b) => {
    b.onclick = () => {
      let s = state();
      s.flags = s.flags || {};
      delete s.flags[b.dataset.unflag];
      save(s);
      renderFlagged();
      renderDash();
      if (current) updateFlagUI();
    };
  });
}

/* ---------- Navigation ---------- */
function show(v) {
  ["dashboard", "library", "notes", "flagged", "player"].forEach((x) =>
    $("#" + x + "View").classList.toggle("hidden", x !== v),
  );
  $$(".nav").forEach((x) => x.classList.toggle("active", x.dataset.view === v));
  document.body.classList.toggle("player-mode", v === "player");
  $("#backToLibraryHeader").classList.toggle("hidden", v !== "player");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (v === "dashboard") renderDash();
  if (v === "notes") notes();
  if (v === "flagged") renderFlagged();
}
function openLibrary(c) {
  if (c && c !== selected) selectedSection = "";
  selected = c || selected;
  show("library");
  renderLibrary();
}
function goToLesson(offset) {
  if (!current || !catalog.length) return;
  let idx = catalog.findIndex((x) => x.id === current.id);
  let ni = idx + offset;
  if (ni >= 0 && ni < catalog.length) openLesson(catalog[ni]);
}

/* ---------- Player ---------- */
function doneButton() {
  if (!current) return;
  let p = pct(current),
    ready = p >= 50,
    isDone = status(current);
  $("#doneBtn").disabled = !isDone && !ready;
  $("#doneBtn").textContent = isDone
    ? "Completed"
    : ready
      ? "Mark complete"
      : "Watch " + (50 - p) + "% more";
  let progressBadge = $("#progressBadge");
  if (progressBadge) {
    progressBadge.textContent = isDone
      ? "Completed"
      : p > 0
        ? p + "% watched"
        : "Not started";
    progressBadge.classList.toggle("done", isDone);
  }
}
function updateFlagUI() {
  let f = current && flagged(current);
  $("#flagBtn").classList.toggle("flagged", !!f);
  $("#flagBtn").textContent = f ? "Flagged · watch later" : "Flag for later";
  $("#flagBadge").classList.toggle("show", !!f);
}
function setPlayerNav() {
  if (!current || !catalog.length) return;
  let idx = catalog.findIndex((x) => x.id === current.id);
  let hasPrev = idx > 0;
  let hasNext = idx !== -1 && idx < catalog.length - 1;
  $("#prevBtn").classList.toggle("hidden", !hasPrev);
  $("#nextBtn").classList.toggle("hidden", !hasNext);
}
async function openLesson(l) {
  if (!l.url) {
    let sourceId = l.id.split("::")[0];
    let folder = folders.find((f) => f.id === sourceId);
    if (folder) {
      try {
        let perm = await folder.handle.requestPermission({ mode: "read" });
        if (perm === "granted") {
          await load();
          let updatedLesson = catalog.find((x) => x.id === l.id);
          if (updatedLesson && updatedLesson.url) {
            openLesson(updatedLesson);
            return;
          }
        } else {
          flash("Read permission denied for this folder.");
          return;
        }
      } catch (e) {
        flash("Could not access folder: " + e.message);
        return;
      }
    }
    flash("This course folder is not connected.");
    return;
  }

  current = l;
  let s = state();
  s.last = l.id;
  save(s);
  $("#video").src = l.url;
  $("#lessonTitle").textContent = l.title;
  $("#lessonMeta").textContent = l.course + " · " + l.section;

  let courseBreadcrumb = $("#playerCourseBreadcrumb");
  if (courseBreadcrumb) courseBreadcrumb.textContent = l.course;
  let sectionBreadcrumb = $("#playerSectionBreadcrumb");
  if (sectionBreadcrumb) sectionBreadcrumb.textContent = l.section;

  $("#noteText").value = s.notes?.[l.id] || "";
  $("#watchProgress").style.width = pct(l) + "%";
  setPlayerNav();
  updateFlagUI();
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
function toggleFlag() {
  if (!current) return;
  let s = state();
  s.flags = s.flags || {};
  s.flags[current.id] = !s.flags[current.id];
  save(s);
  updateFlagUI();
  renderDash();
  renderLibrary();
  flash(
    s.flags[current.id]
      ? "Flagged — come back to this one later."
      : "Flag removed.",
  );
}

/* ---------- Scan / load ---------- */
function saveCatalogCache() {
  let cache = catalog.map(({ id, course, section, title }) => ({
    id,
    course,
    section,
    title,
  }));
  localStorage.setItem("courseCompassCatalog", JSON.stringify(cache));
}
function loadCatalogCache() {
  let cached = localStorage.getItem("courseCompassCatalog");
  if (cached) catalog = JSON.parse(cached);
}
async function scan(h, path = "", source = "", fixed = "", dest = catalog) {
  for await (let e of h.values()) {
    if (e.kind === "directory")
      await scan(e, path ? path + "/" + e.name : e.name, source, fixed, dest);
    else if (/\.(mp4|mkv|webm|mov|m4v)$/i.test(e.name)) {
      let parts = (path + "/" + e.name).split("/"),
        course = fixed || parts[0],
        rest = fixed ? parts : parts.slice(1),
        file = await e.getFile();
      dest.push({
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
  catalog.forEach((x) => x.url && URL.revokeObjectURL(x.url));
  loadCatalogCache();
  let newCatalog = [];
  let scannedSources = new Set();
  for (let f of folders) {
    if ((await f.handle.queryPermission({ mode: "read" })) === "granted") {
      let folderCatalog = [];
      await scan(
        f.handle,
        "",
        f.id,
        /^(video|videos|library|courses)$/i.test(f.name) ? "" : f.name,
        folderCatalog,
      );
      newCatalog.push(...folderCatalog);
      scannedSources.add(f.id);
    }
  }
  if (scannedSources.size > 0) {
    let unscannedItems = catalog.filter((x) => {
      let sourceId = x.id.split("::")[0];
      return !scannedSources.has(sourceId);
    });
    catalog = [...unscannedItems, ...newCatalog];
    saveCatalogCache();
  }
  catalog.sort(
    (a, b) =>
      a.course.localeCompare(b.course) ||
      a.section.localeCompare(b.section) ||
      a.title.localeCompare(b.title, undefined, { numeric: true }),
  );
  let allPermission = true;
  for (let f of folders) {
    if ((await f.handle.queryPermission({ mode: "read" })) !== "granted") {
      allPermission = false;
      break;
    }
  }
  $("#connectBtn").textContent =
    folders.length === 0 || allPermission
      ? "Add course folder"
      : "Reconnect folders";
  renderDash();
  renderLibrary();
}
async function connect() {
  try {
    let allPermission = true;
    for (let f of folders) {
      if ((await f.handle.queryPermission({ mode: "read" })) !== "granted") {
        allPermission = false;
        break;
      }
    }
    if (folders.length && !allPermission) {
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
async function restore() {
  let r = await readFolders();
  folders = r.map((x, i) =>
    x.handle ? x : { id: "legacy-" + i, handle: x, name: x.name || "Video" },
  );
  await load();
}

/* ---------- Activity Graph ---------- */
function renderActivityGraph() {
  let s = state(),
    activity = s.activity || {};
  let todayObj = new Date();
  let dayOfWeek = todayObj.getDay();
  let startOffset = 364 + dayOfWeek;
  let endOffset = -(6 - dayOfWeek);
  let cells = [];
  let months = [];
  let lastMonthName = "";
  let lastMonthCol = -100;
  for (let i = startOffset; i >= endOffset; i--) {
    let dateStr = day(i);
    let isFuture = i < 0;
    let sec = isFuture ? 0 : activity[dateStr] || 0;
    let lvl = 0;
    if (sec > 0 && !isFuture) {
      let m = sec / 60;
      if (m <= 10) lvl = 1;
      else if (m <= 30) lvl = 2;
      else if (m <= 60) lvl = 3;
      else lvl = 4;
    }
    let localDate = new Date(dateStr + "T00:00:00");
    let formattedDate = localDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    cells.push({ dateStr, formattedDate, level: lvl, seconds: sec, isFuture });
    if (localDate.getDay() === 0) {
      let monthName = localDate.toLocaleString("default", { month: "short" });
      if (monthName !== lastMonthName) {
        let colIdx = Math.floor((startOffset - i) / 7);
        if (colIdx - lastMonthCol >= 4) {
          months.push({ name: monthName, index: colIdx });
          lastMonthCol = colIdx;
        }
        lastMonthName = monthName;
      }
    }
  }
  $("#graphMonths").innerHTML = months
    .map(
      (m) =>
        `<span class="graph-month-label" style="grid-column: ${m.index + 1} / span 3;">${m.name}</span>`,
    )
    .join("");
  $("#activityGraph").innerHTML = cells
    .map((c) => {
      let titleAttr = `${c.formattedDate}: ${mins(c.seconds)} watched`;
      return `<div class="graph-day" data-date="${c.dateStr}" data-level="${c.level}" title="${esc(titleAttr)}" ${c.isFuture ? 'style="opacity:0.25;pointer-events:none;"' : ""}></div>`;
    })
    .join("");
  $$(".graph-day").forEach((dayEl) => {
    dayEl.onclick = () => {
      $$(".graph-day").forEach((el) => el.classList.remove("selected"));
      dayEl.classList.add("selected");
      showDayDetail(dayEl.dataset.date);
    };
  });
  let todayStr = day(0);
  showDayDetail(todayStr);
  let todayEl = $(`.graph-day[data-date="${todayStr}"]`);
  if (todayEl) todayEl.classList.add("selected");
}
function showDayDetail(dateStr) {
  let s = state(),
    history = s.history || {},
    activity = s.activity || {};
  let localDate = new Date(dateStr + "T00:00:00");
  let formattedDate = localDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  let totalSec = activity[dateStr] || 0;
  let dayHistory = history[dateStr] || {};
  $("#detailDate").textContent = formattedDate;
  $("#detailDuration").textContent = mins(totalSec) + " watched";
  let listHtml = "";
  let items = Object.entries(dayHistory);
  if (items.length > 0) {
    listHtml = items
      .map(([id, info]) => {
        let title = info.title || "Unknown Lesson";
        let course = info.course || "";
        let duration = mins(info.duration || 0);
        return `<li class="detail-item">
          <span class="detail-title">${esc(title)}</span>
          ${course ? `<span class="detail-course">${esc(course)}</span>` : ""}
          <span class="detail-time">${duration}</span>
        </li>`;
      })
      .join("");
  } else if (totalSec > 0) {
    listHtml = `<li class="detail-item" style="color: var(--muted); font-style: italic;">
      <span class="detail-title">Detailed breakdown not available for legacy data.</span>
      <span class="detail-time">${mins(totalSec)}</span>
    </li>`;
  } else {
    listHtml = `<li class="detail-item" style="color: var(--muted); font-style: italic;">
      <span class="detail-title">No lessons watched on this day.</span>
    </li>`;
  }
  $("#detailList").innerHTML = listHtml;
  $("#historyDetail").classList.remove("hidden");
}

/* ---------- Wiring ---------- */
$("#connectBtn").onclick = connect;
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
let backLibrary = () => openLibrary(current?.course);
if ($("#backToLibraryBtn")) $("#backToLibraryBtn").onclick = backLibrary;
if ($("#backToLibraryHeader")) $("#backToLibraryHeader").onclick = backLibrary;
if ($("#playerCourseBreadcrumb")) $("#playerCourseBreadcrumb").onclick = backLibrary;
if ($("#quickNotesBtn")) $("#quickNotesBtn").onclick = () => show("notes");
if ($("#quickFlaggedBtn")) $("#quickFlaggedBtn").onclick = () => show("flagged");
$("#prevBtn").onclick = () => goToLesson(-1);
$("#nextBtn").onclick = () => goToLesson(1);
$("#flagBtn").onclick = toggleFlag;
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
  s.history = s.history || {};
  s.watchSeconds[current.id] = (s.watchSeconds[current.id] || 0) + d;
  s.activity[day(0)] = (s.activity[day(0)] || 0) + d;
  s.history[day(0)] = s.history[day(0)] || {};
  let record =
    s.history[day(0)][current.id] || {
      duration: 0,
      title: current.title,
      course: current.course,
    };
  if (typeof record === "number") {
    record = { duration: record, title: current.title, course: current.course };
  }
  record.duration = (record.duration || 0) + d;
  s.history[day(0)][current.id] = record;
  save(s);
  $("#watchProgress").style.width = pct(current) + "%";
  doneButton();
};
document.addEventListener("keydown", (e) => {
  if (e.target.matches("textarea, input")) return;
  if ($("#playerView").classList.contains("hidden")) return;
  if (e.key.toLowerCase() === "f") toggleFlag();
});

/* ---------- Backup & Restore ---------- */
function exportData() {
  let data = state();
  let blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "course-compass-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  flash("Progress backup downloaded.");
}
function importData(file) {
  let reader = new FileReader();
  reader.onload = () => {
    try {
      let data = JSON.parse(reader.result);
      if (typeof data !== "object" || data === null || Array.isArray(data))
        throw new Error("bad");
      let cur = state();
      let merged = { ...cur, ...data };
      for (const k of Object.keys(data)) {
        if (
          data[k] &&
          typeof data[k] === "object" &&
          !Array.isArray(data[k]) &&
          cur[k] &&
          typeof cur[k] === "object" &&
          !Array.isArray(cur[k])
        ) {
          merged[k] = { ...cur[k], ...data[k] };
        }
      }
      save(merged);
      flash("Backup restored and merged with current progress.");
      renderDash();
      renderLibrary();
    } catch (e) {
      flash("That file is not a valid backup.");
    }
  };
  reader.readAsText(file);
}
(async function tryAutoRestore() {
  let raw = localStorage.getItem("courseCompass");
  let empty = !raw || raw === "{}" || raw === "undefined";
  if (empty) {
    let saved = await readBackup();
    if (saved && Object.keys(saved).length) {
      localStorage.setItem("courseCompass", JSON.stringify(saved));
      flash("Recovered your progress from the internal backup.");
      renderDash();
      renderLibrary();
    }
  }
})();
$("#exportBtn").onclick = exportData;
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = (e) => {
  if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
  e.target.value = "";
};

renderDash();
restore();