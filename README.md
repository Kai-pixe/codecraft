# CodeCraft (PWA)

Personal, offline code editor with no dependencies. Vanilla HTML + CSS + JS, no build step.

## Layout
- 3 columns: **OpenRouter 1** (left) · **tabs + code + output** (center) · **OpenRouter 2** (right), each with its own model, same OpenRouter key.
- Drag the bars between columns and above the output panel to resize (double tap = reset; with a bar focused, use the arrow keys).
- On narrow screens (phone) the AI panels become drawers.
- Menus: File, Edit, Selection, Project, View, Run, AI, Help (Help → Keyboard shortcuts).

## Saving (manual)
Autosave is off by default: you decide when to save with Ctrl+S. The first time it asks where: in the app or on your device (you pick folder and name; later Ctrl+S presses write there). Save as… (Ctrl+Shift+S) always lets you choose. Unsaved changes are kept when switching tabs and when reloading.

## AI that edits your code
In each panel, "Allow it to edit my code when I ask": if you ask for a change, it is applied in the editor (left unsaved; undo with Ctrl+Z or the button). Use @file to include other files. The AI answers with ```apply blocks (the older ```aplicar is still understood).

## VS Code-style sidebar
Activity bar on the left: Explorer, Search, Source control (GitHub), Workflows and rules, OpenRouter, plus Appearance (palette icon). One click opens a view; another click on the same one closes it. Three icons at the top right show or hide the left column, the bottom Output panel and the right column (Gemini).

## Source control (GitHub)
Connect your account with a token (a classic token with `repo` scope is the simplest; a fine-grained one needs Contents: Read and write and, to create repositories, Administration: Read and write). From there: Initialize repository, Publish to GitHub (creates the repo and uploads everything), Link an existing one, Clone, see changes (A/M/D), Commit and push (with an AI-written message ✨) and Pull changes. Everything uses the GitHub API: git is not needed.

## Projects and real folders
Project → Projects…: each project has its own files and tabs. **Open Chromebook folder** links a real folder (e.g. from Linux files): saving writes into it, so git and wrangler in your Linux files see the same files. «Reload from folder» reads the disk again. .git and node_modules are skipped.

## Security (read this)
- **Keys are encrypted.** Gemini/OpenRouter keys and the GitHub token are stored only encrypted (AES-256-GCM, key from your passphrase with PBKDF2 600,000 rounds). They are unlocked in memory for the session, locked automatically after 30 minutes of inactivity, and can be locked from AI → Lock keys. Old plaintext keys are migrated the first time you open the app. If you forget the passphrase there is no recovery: paste the keys again.
- **Safe preview (default).** The preview runs in an isolated frame with no access to the app, its storage or your keys. Project CSS, JS, images and fonts are inlined; links between project pages work; `console.log` and errors appear in the Output panel. Limitation: ES-module `import` between project files does not work there; switch the preview selector to **Full** (same origin, trusted code only).
- Deploying with the supplied `_headers` adds a strict CSP and removes framing; the preview page has its own `sandbox` header.

## Explorer: selection and undo
Ctrl/Cmd+click toggles, Shift+click selects a range, Ctrl+A selects everything, right-click empty space → **Select all folders**. A bar shows the count with a **Delete** button; the confirmation lists how many folders and files go. **Ctrl+Z** in the explorer (or right-click → Undo last delete) restores them. Linked projects only remove the app's copy, never your disk folder.

## Editor extras
- **Local history** (Edit → Local history…): up to 30 versions per file, one per manual save plus periodic autosave snapshots; Compare (line diff) and Restore.
- **Tab triggers:** `!` + Tab (HTML boilerplate), `log`, `fn`, `for`, `try`, `fetch`… in JS, `flex`, `grid`, `@m` in CSS, and mini-Emmet in HTML (`ul>li*3`, `div.card#main>p{text}`).
- **Format document** (Shift+Alt+F): full for JSON and CSS; other types only trim trailing spaces and add the final newline.
- **Syntax check** in the status bar: exact for JSON; a quick bracket/string check for JS and CSS (not a full parser).
- **Tabs** can be dragged to reorder. **Preview** has screen sizes (mobile, tablet, laptop).

## Run
The Run button (Ctrl+Enter) runs `.js` in an isolated browser Worker and opens `.html` in the preview. The result appears in the **Terminal** panel (Ctrl+`).

## Terminal (virtual, light)
The panel at the bottom has a command line (type `help`). It does **not** start real processes or load anything heavy: it is text commands over your project files, so it uses almost no memory.
- **Files:** `ls cd pwd tree cat head tail wc touch mkdir cp mv rm echo grep find sort uniq du`, with pipes `|`, `>` / `>>`, `&&`, wildcards `* ?`, Tab completion and ↑ ↓ history.
- **Run:** `node file.js`, `js 2+2`, `node -e "code"`, `run`, `open`, `edit`, `preview`, `stop` (or Ctrl+C).
- **Git (GitHub API, git not needed):** `git status`, `git commit -m "msg"`, `git push [-m "msg"]`, `git pull`, `git log`, `git branch`, `git remote`, `git clone user/repo`. `deploy` = `git push` plus a reminder about Cloudflare Pages.
- **Palette:** Ctrl+P, then type `$` and a command. **Workflows:** lines that start with `$` run terminal commands.
- **Not available** (they need a real system): `npm`, `python`, `wrangler`… Use the Linux terminal (Crostini) on the same folder (Project → Open Chromebook folder).

## Welcome screen
When no file is open, the centre shows your recent files and shortcuts. On start, CodeCraft reopens the last file you were editing.

## Appearance
Palette icon (or View → Appearance): VS Code-like themes (Dark+, Light+, Monokai, Dracula, One Dark, GitHub Dark, Solarized, Midnight), accent color, interface background color, and font size for the editor and for the interface.

## Autocomplete and AI suggestions
Suggestions while you type (Tab/Enter accept, Esc closes, Ctrl+Space forces them) and auto-closing of ( [ { and quotes. **Alt+Enter** asks Gemini/OpenRouter to continue your code (Tab accepts, Esc dismisses). In Appearance you can turn on AI suggestions on pause (they use your AI quota). GitGuard prevents sending context that contains secrets.

## Workflows and rules
Own panel in the activity bar.
- **Workflows**: a recipe of steps. Each line is a step; lines starting with `$` run a terminal command (for example `$ node {{file}}` or `$ git push`) and the rest go to the AI. Run them with ▶ or by typing `/name` in the chat. Placeholders: `{{args}}`, `{{file}}` (current file), `{{project}}`.
- **Rules**: fixed instructions added to every message sent to Gemini or OpenRouter. `AGENTS.md` and `.codecraft/rules.md` in the project are also read.

## GitGuard
Before every push to GitHub it looks for keys, tokens and files like `.env`, and for your own saved keys. You can protect files so they are never pushed. It also warns before sending a secret to the AI.

## OpenRouter models
In the OpenRouter panel, the small arrow next to the title shows the model selector: favorites, recent and free models, plus **Browse…** to search every model (free / paid, ★ favorite).

## Explorer (VS Code style)
- Tree with folders first, chevrons, file icons by type, indent guides and a dot for unsaved files.
- Click a folder to expand/collapse; click a file to open it. The active file is revealed automatically.
- Toolbar on the project row: New file, New folder, Reload from folder (linked projects), Collapse all, More (⋯).
- New file / New folder / Rename are **inline** (type the name in the tree; `a/b.js` creates the folders). New items go in the selected folder.
- Right-click (or long-press, or the ⋯ button, or the Menu key): Open, Rename, Duplicate, Download, Copy path, Delete.
- Drag files and folders onto a folder (or the project row) to move them. Dropping real files from your computer still imports them.
- Keyboard: ↑ ↓ Home End to move, → expand, ← collapse / go to parent, Enter open, F2 rename, Delete delete.

## Other tools
Ctrl+P opens a file, Ctrl+Shift+P the command palette, Ctrl+Shift+F searches all files. Light syntax highlighting (visible lines only). HTML preview (served from the Service Worker; reload once after installing if you see a 404). If Gemini or OpenRouter reach their limit, the other one answers (API settings).

## Import / export (no restrictions)
Files of any type and size, whole folders, drag and drop, `.zip` (it is unzipped) and `.json` backups. Non-text files are stored intact. Export one file, everything as `.zip`, or a `.json` backup.

## Try it locally (Crostini)
    python3 -m http.server 8080

## Deploy
Static site: upload the folder as is. `_headers` applies the CSP (includes `worker-src blob:` to run .js; `style-src 'unsafe-inline'` is needed for the inline styles of the interface).

## AI keys
There are no keys in the code. AI → API settings. They are stored in localStorage on that device.

## Updating the app
Change the number in `CACHE` in sw.js (now codecraft-v17) every time you modify files. If the app ever looks half loaded, press «Repair and reload» (it does not delete your files).

## Third-party components
None: no libraries, no build step.


## Real terminal (optional): cc-bridge.py
The built-in terminal is virtual. To run real `git`, `npm`, `npx wrangler`, `python`… use the bridge (Python 3, no installs):
1. In the Linux terminal (Crostini), inside your project folder: `python3 cc-bridge.py` (or `python3 cc-bridge.py ~/my-project`).
2. It prints a token. In CodeCraft's terminal type: `bridge connect TOKEN`.
3. From then on, anything that is not a CodeCraft command runs for real (npm, wrangler, python…). Use `! git status` to force a real command (plain `git` stays the GitHub-API version). `cd` is remembered. Ctrl+C stops it. `bridge off` disconnects.
It only listens on 127.0.0.1 and needs the token. Commands cannot ask for input (stdin is closed): use flags such as `-y`.
