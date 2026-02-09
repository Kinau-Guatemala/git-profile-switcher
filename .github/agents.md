````md
# Git Config Switcher (Tray/Menubar) — Agent Build README

This README is a **step-by-step execution plan** for an agent to build a cross-platform desktop tray app that:
- Stores multiple Git identity profiles
- Switches identity **globally by default**
- Does switching **safely** (non-destructive) via a managed include file
- Provides **tray quick switch**, **undo**, and **verification** (including config origin)

---

## 0) Project rules (must follow)

### Safety rules (non-negotiable)
1. **Do not rewrite or “own” the user’s `~/.gitconfig`** beyond installing a single include.
2. Use a **managed config file** that the app owns (switching writes only there).
3. All changes must be **idempotent** (running twice should not duplicate includes).
4. Must provide **Undo last switch**.

### Security rules (Electron)
- `contextIsolation: true`
- `nodeIntegration: false`
- All filesystem + Git execution in **main process**
- Renderer talks to main only through a strict **preload IPC bridge** (whitelisted API)

---

## 1) Target stack

**Electron + React + TypeScript + Vite**

Required libs:
- `execa` (run git commands)
- `zod` (schema validation)
- `uuid` (profile ids)

Optional but useful:
- `zustand` (UI state)
- `vitest` (tests)
- `electron-builder` (packaging)

---

## 2) Repository initialization

### 2.1 Scaffold the project
1. Create project with an Electron+Vite React TS template:
   ```bash
   npm create electron-vite@latest git-config-switcher
   cd git-config-switcher
   npm install
   npm run dev
````

Choose **React + TypeScript**.

2. Confirm:

* app launches in dev
* hot reload works

### 2.2 Install dependencies

```bash
npm i execa zod uuid
npm i -D vitest @types/node
```

Add scripts to `package.json` (if missing):

* `"test": "vitest"`

---

## 3) Target folder structure (create these)

Create:

```
src/
  core/
    profiles/
    git/
    verify/
  main/
  preload/
  renderer/
```

Final target layout:

```
src/
  core/
    profiles/
      schema.ts
      storage.ts
      state.ts
    git/
      gitRunner.ts
      managedInclude.ts
      identity.ts
    verify/
      types.ts
      originParser.ts
      globalVerify.ts
      repoVerify.ts
  main/
    app.ts
    tray.ts
    windows.ts
    ipc.ts
  preload/
    index.ts
  renderer/
    main.tsx
    App.tsx
    env.d.ts
    screens/
      Profiles.tsx
      Verify.tsx
    components/
      ProfileForm.tsx
      OriginTable.tsx
```

---

## 4) Core design decisions (implement exactly)

### 4.1 Managed include file strategy

The app owns a file:

* **managed file**: `~/.gitconfig-switcher`

The app ensures the user’s main config includes it:

* **main file**: `~/.gitconfig`
* ensure it contains:

  ```ini
  [include]
    path = ~/.gitconfig-switcher
  ```

Switching profiles **writes only to** `~/.gitconfig-switcher` using:

* `git config --file ~/.gitconfig-switcher user.name "..."`
* `git config --file ~/.gitconfig-switcher user.email "..."`

This avoids breaking complex user setups (includes, corporate configs, conditional rules).

---

## 5) IPC contract (strict, typed)

Expose only these renderer APIs via preload:

* `profiles.list(): Promise<Profile[]>`
* `profiles.save(profile: ProfileInput): Promise<Profile>`
* `profiles.delete(profileId: string): Promise<void>`
* `profiles.apply(profileId: string): Promise<{ ok: true }>`
* `verify.global(): Promise<VerifyResult>`
* `verify.inRepo(repoPath: string): Promise<VerifyResult>`
* `app.openWindow(name: "profiles" | "verify"): Promise<void>`

Renderer must not access Node or filesystem directly.

---

## 6) Data model

### 6.1 Profile schema (Zod)

**File:** `src/core/profiles/schema.ts`

Fields:

* `id: string` (uuid)
* `label: string`
* `userName: string`
* `userEmail: string`
* `advanced?: { gpgSign?: boolean; signingKey?: string; sshKeyPath?: string; hosts?: string[] }`
* `createdAt: string` (ISO)
* `updatedAt: string` (ISO)

Export:

* `ProfileSchema`
* `Profile` type (`z.infer<typeof ProfileSchema>`)
* `ProfileInputSchema` (like Profile but without id/timestamps for creation)

### 6.2 App state

**File:** `src/core/profiles/state.ts`

State fields:

* `activeProfileId?: string`
* `undoStack: Array<{ profileId: string; at: string }>` (cap length to 3)

---

## 7) Storage strategy

Store JSON in Electron `app.getPath("userData")`:

* `${userData}/profiles.json`
* `${userData}/state.json`

**File:** `src/core/profiles/storage.ts`
Implement:

* `loadProfiles(userDataPath): Promise<Profile[]>`
* `saveProfiles(userDataPath, profiles): Promise<void>`

**File:** `src/core/profiles/state.ts`
Implement:

* `loadState(userDataPath): Promise<AppState>`
* `saveState(userDataPath, state): Promise<void>`

Main process passes `userDataPath` (renderer never touches paths).

---

## 8) Git execution layer

### 8.1 Git runner

**File:** `src/core/git/gitRunner.ts`

Implement:

* `checkGitInstalled(): Promise<void>` (runs `git --version`)
* `runGit(args: string[], opts?: { cwd?: string }): Promise<{ stdout: string }>`

  * Use `execa("git", args, { cwd, env })`
  * Convert failures to a friendly error object:

    * `message`, `stderr`, `exitCode`

### 8.2 Ensure managed include installed (idempotent)

**File:** `src/core/git/managedInclude.ts`

Implement:

* `ensureManagedIncludeInstalled(): Promise<{ managedPath: string; gitconfigPath: string }>`
  Steps:

1. `home = os.homedir()`
2. `managedPath = ~/.gitconfig-switcher`
3. `gitconfigPath = ~/.gitconfig`
4. Ensure `managedPath` exists (create empty file if missing).
5. Ensure `gitconfigPath` exists (create if missing).
6. Read `.gitconfig` text; if include line for managed path exists → done.
7. If missing → append exactly once:

   ```ini
   \n[include]\n  path = ~/.gitconfig-switcher\n
   ```
8. Must not duplicate if called repeatedly.

### 8.3 Apply profile (writes only managed file)

**File:** `src/core/git/identity.ts`

Implement:

* `applyProfile(profile: Profile, managedPath: string): Promise<void>`
  Use git:
* `git config --file <managedPath> user.name "<userName>"`
* `git config --file <managedPath> user.email "<userEmail>"`

If advanced present:

* if `gpgSign` defined:

  * `git config --file <managedPath> commit.gpgsign true|false`
* if `signingKey` defined:

  * `git config --file <managedPath> user.signingkey "<...>"`

---

## 9) Verification layer

### 9.1 Types

**File:** `src/core/verify/types.ts`

Define:

```ts
export type OriginEntry = { originFile: string; key: string; value: string };
export type VerifyResult = {
  effectiveName: string | null;
  effectiveEmail: string | null;
  origins: OriginEntry[];
  warnings: string[];
};
```

### 9.2 Parse `--show-origin`

**File:** `src/core/verify/originParser.ts`

Implement:

* `parseShowOrigin(output: string): OriginEntry[]`

Input is lines similar to:

* `file:/Users/jose/.gitconfig  user.email=jose@example.com`

Parse robustly for:

* `file:` prefix
* spaces between origin and `key=value`
* Windows path formats

### 9.3 Global verify

**File:** `src/core/verify/globalVerify.ts`

Implement:

* `verifyGlobal(): Promise<VerifyResult>`
  Steps:

1. `git config --global --get user.name`
2. `git config --global --get user.email`
3. `git config --global --list --show-origin`
4. Parse origins; filter to relevant keys (`user.name`, `user.email`, maybe signing)
5. Return result

### 9.4 Repo verify (optional, but implemented)

**File:** `src/core/verify/repoVerify.ts`

Implement:

* `verifyInRepo(repoPath: string): Promise<VerifyResult>`
  Steps:

1. Run `git config --get user.name` with `cwd=repoPath`
2. Run `git config --get user.email` with `cwd=repoPath`
3. Run `git config --list --show-origin` with `cwd=repoPath`
4. Add warnings if local differs from global (main compares if needed)

---

## 10) Main process wiring

### 10.1 Windows management

**File:** `src/main/windows.ts`

Implement:

* `openProfilesWindow()`
* `openVerifyWindow()`
  Each loads renderer route:
* `/#/profiles`
* `/#/verify`

### 10.2 IPC handlers

**File:** `src/main/ipc.ts`

Register `ipcMain.handle`:

* `profiles:list` → loadProfiles
* `profiles:save` → upsert profile (validate with zod), persist, rebuild tray
* `profiles:delete` → delete, persist, rebuild tray
* `profiles:apply` → ensure include installed, apply profile, update state undo, rebuild tray
* `verify:global` → verifyGlobal
* `verify:inRepo` → verifyInRepo(repoPath)
* `app:openWindow` → windows.ts functions

All handlers:

* validate inputs
* return friendly errors (don’t crash)

### 10.3 Preload bridge

**File:** `src/preload/index.ts`

Expose:

```ts
contextBridge.exposeInMainWorld("api", {
  profiles: { list, save, delete, apply },
  verify: { global, inRepo },
  app: { openWindow }
});
```

### 10.4 Renderer type declarations

**File:** `src/renderer/env.d.ts`

Define `window.api` interface matching exposed methods.

---

## 11) Tray quick switch

### 11.1 Tray module

**File:** `src/main/tray.ts`

Implement:

* `createTray({ getProfiles, getState, applyProfile, openProfiles, openVerify, undo, quit })`
* `rebuildTrayMenu()` (call after any profile/state change)

Menu requirements:

* Disabled header:

  * `Active: <name> <email>` (read from verifyGlobal or cached last apply)
* Submenu "Switch":

  * list profiles as radio items
  * checked item equals `activeProfileId`
  * clicking applies immediately
* Items:

  * Verify…
  * Manage Profiles…
  * Undo last switch (disabled if none)
  * Quit

### 11.2 Apply from tray

When a profile is clicked:

1. Call `profiles:apply(profileId)`
2. Show OS notification (optional)
3. Rebuild menu

---

## 12) Renderer UI

### 12.1 Profiles screen

**File:** `src/renderer/screens/Profiles.tsx`

Requirements:

* list profiles
* create/edit form (can be modal or inline)
* delete
* optional Apply button (tray is primary, but keep Apply for usability)

Calls IPC via `window.api.profiles.*`.

### 12.2 Profile form component

**File:** `src/renderer/components/ProfileForm.tsx`

Fields:

* label
* userName
* userEmail
* advanced accordion:

  * gpgSign (checkbox)
  * signingKey (text)
  * sshKeyPath (text)
  * hosts (comma-separated)

### 12.3 Verify screen

**File:** `src/renderer/screens/Verify.tsx`

Show:

* effective name/email
* origins table (key/value + origin file)
* “Verify in repo…” (optional):

  * open folder picker (if implemented in main) or accept path input for v1

---

## 13) Tests (minimum)

### 13.1 Origin parser tests

**File:** `src/core/verify/originParser.test.ts`

* feed sample outputs for macOS/Linux/Windows
* assert parsed entries for `user.name/user.email`

### 13.2 Include installer tests

**File:** `src/core/git/managedInclude.test.ts`

* run twice and ensure include is appended once
* ensure other existing content remains unchanged

(If full filesystem mocking is too heavy, test with temp directory and injected paths.)

---

## 14) Packaging

### 14.1 Add electron-builder (after core works)

```bash
npm i -D electron-builder
```

Add scripts:

* `"dist": "electron-builder"`

Add minimal `build` config in `package.json`:

* `appId`, `productName`
* targets per OS
* icons (optional for v1)

---

## 15) Milestones (build order)

### Milestone 1 — Skeleton + secure IPC

* project runs
* preload bridge exists
* profiles window opens

### Milestone 2 — Profiles CRUD persistence

* profiles.json loads/saves
* restart preserves profiles

### Milestone 3 — Tray quick switch

* tray menu shows profiles
* selecting profile calls apply (even if apply is stubbed)

### Milestone 4 — Safe switching with managed include

* ensureManagedIncludeInstalled works
* apply writes to managed file only
* undo works

### Milestone 5 — Verification

* verify global works
* show origin in UI

### Milestone 6 — Packaging

* build installers

---

## 16) Definition of Done (v1 acceptance criteria)

* Tray quick switch works (at least Windows + macOS tested in dev).
* Switching is global-by-default and **non-destructive** (`~/.gitconfig` only gets include).
* Undo last switch works.
* Verify shows effective name/email and origin file(s).
* Clear error message if Git is not installed / not in PATH.

---

## 17) Notes for the agent (common pitfalls)

* Do not parse/write `.gitconfig` deeply; only append include if missing.
* Always prefer `git config` CLI for reads/writes.
* Keep renderer dumb: it displays data; main process does real work.
* Make include installation idempotent; repeated startup must not duplicate blocks.

---

```

If you want, I can also produce:
- a **“first 10 commits” plan** (commit messages + exact diff goals), or
- a **single linear checklist** with zero branching (“do these tasks, in this order, no choices”).
::contentReference[oaicite:0]{index=0}
```
