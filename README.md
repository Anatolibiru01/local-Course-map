# Course Compass

> Your offline learning library. Track progress, take notes, and build study streaks — all from local video files.

---

## A Note on Development

This project was built using **vibe coding** — an iterative, AI-assisted development approach where functionality is shaped through conversation and rapid prototyping rather than upfront architectural planning. 

What that means practically:
- The codebase is **vanilla HTML, CSS, and JavaScript** — no build step, no framework, no dependencies.
- Features emerged organically: "What if it tracked streaks?" → added. "Can it remember my folders?" → IndexedDB integration. "I want notes per lesson" → textarea + localStorage.
- Some parts are pragmatic rather than perfect. Error handling is minimal. The UI is hand-rolled. State management is flat objects in `localStorage`.
- It works. It solves a real problem (tracking offline video courses). And it was genuinely fun to build.

If you're reading this as a developer: yes, you could refactor this into React/Vue with a proper state layer, tests, and a build pipeline. The current version prioritizes **working software that runs in any modern browser** over engineering ceremony.

---

## What It Does

Course Compass turns a folder of locally stored video lessons into a structured learning platform. Point it at a directory of course videos, and it will:

- **Auto-organize** videos by folder structure into courses, sections, and lessons
- **Track watch progress** with per-second accuracy (requires watching at normal speed; seeks and fast-forwards are ignored)
- **Mark lessons complete** once you've watched at least 50%
- **Log study time** and maintain a daily activity streak
- **Save notes** for each lesson in a side panel while you watch
- **Remember your folders** across browser restarts via IndexedDB
- **Resume where you left off** with a single click

---

### 1. Connect a Course Folder

Click **"Add course folder"** and select the directory containing your video lessons.

**Folder structure matters.** The app expects a layout like this:

```
MyCourses/
├── JavaScript/
│   ├── 01 - Introduction/
│   │   ├── 01 - Welcome.mp4
│   │   └── 02 - Setup.mp4
│   └── 02 - Fundamentals/
│       ├── 03 - Variables.mp4
│       └── 04 - Functions.mp4
└── Node.js/
    └── 01 - Getting Started/
        ├── 01 - Intro.mp4
        └── 02 - Installation.mp4
```

- **Top-level folder** = Course name (e.g., `JavaScript`, `Node.js`)
- **Subfolders** = Sections (e.g., `01 - Introduction`)
- **Video files** = Lessons (numbered prefixes like `01 - ` are stripped automatically)

Supported formats: `.mp4`, `.mkv`, `.webm`, `.mov`, `.m4v`

### 2. Browse & Learn

- Use the **sidebar** to switch between Dashboard, Course Library, and My Notes.
- In the **Library**, click a course or section in the left outline to filter lessons.
- Use the **search bar** and **filter chips** (All / To do / Watched / Completed) to find specific lessons.

### 3. Watch & Track Progress

Click any lesson to open the **Player**:
- The video plays directly from your local file (no upload, no cloud).
- Your watch time is tracked automatically. The progress bar updates in real time.
- The **"Mark complete"** button enables once you've watched at least 50%.
- Write notes in the side panel — they save automatically to `localStorage`.

### 5. Disconnect or Add More

- **"Add course folder"** — attach additional directories.
- **"Disconnect library"** — clears all data, revokes video URLs, and resets the app to its initial state.

---

## Data & Privacy

Everything stays on your machine:

| Data | Storage | What it holds |
|------|---------|---------------|
| Folder handles | IndexedDB | References to your selected directories (so you don't have to re-pick them every time) |
| Watch progress, notes, activity, completion | localStorage | Your learning state, keyed by lesson ID |
| Video files | Your disk | Never uploaded or read into memory beyond creating a playback URL |

**Important:** Clearing browser data for this site will erase your progress and notes. There is no cloud backup.

---

## Known Limitations

- **Browser support:** Requires a browser with File System Access API (Chromium-based). Firefox and Safari are not supported.
- **Folder permissions:** If you move or rename a connected folder, the stored handle becomes invalid. You'll need to disconnect and reconnect.
- **No export:** Notes and progress are trapped in this browser. There is no JSON export or sync.
- **Single-device:** Data does not sync between computers.
- **File types:** Only scans for video extensions. Subtitles, PDFs, or other materials are ignored.
- **State management:** Flat object mutations in `localStorage`. Large libraries may hit storage limits.

---
