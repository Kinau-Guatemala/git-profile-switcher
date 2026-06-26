# Graph Report - git-profile-switcher  (2026-06-26)

## Corpus Check
- 48 files · ~37,492 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1170 nodes · 2520 edges · 78 communities (60 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `49da0641`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Bundled Runtime Internals|Bundled Runtime Internals]]
- [[_COMMUNITY_Zod Number & Array Schemas|Zod Number & Array Schemas]]
- [[_COMMUNITY_Zod Parsing & Error Context|Zod Parsing & Error Context]]
- [[_COMMUNITY_Project Docs, CI & Architecture|Project Docs, CI & Architecture]]
- [[_COMMUNITY_Electron Main IPC, Tray & State|Electron Main: IPC, Tray & State]]
- [[_COMMUNITY_Zod Schema Composition|Zod Schema Composition]]
- [[_COMMUNITY_Renderer Theme & SSH UI|Renderer: Theme & SSH UI]]
- [[_COMMUNITY_Zod String Validators|Zod String Validators]]
- [[_COMMUNITY_Zod Parse Status & Wrappers|Zod Parse Status & Wrappers]]
- [[_COMMUNITY_Zod Object Schema|Zod Object Schema]]
- [[_COMMUNITY_Zod String Check Methods|Zod String Check Methods]]
- [[_COMMUNITY_Renderer Profile Forms|Renderer: Profile Forms]]
- [[_COMMUNITY_Execa Process Execution|Execa Process Execution]]
- [[_COMMUNITY_Zod DefaultCatchIntersection|Zod Default/Catch/Intersection]]
- [[_COMMUNITY_TypeScript Compiler Options|TypeScript Compiler Options]]
- [[_COMMUNITY_Git Config Parsing & Profile Apply|Git Config Parsing & Profile Apply]]
- [[_COMMUNITY_Renderer Origin Verify View|Renderer: Origin Verify View]]
- [[_COMMUNITY_Signal-Exit & Window Mgmt|Signal-Exit & Window Mgmt]]
- [[_COMMUNITY_Profile Detection & SSH Config|Profile Detection & SSH Config]]
- [[_COMMUNITY_package.json Metadata|package.json Metadata]]
- [[_COMMUNITY_Stream Buffering Utilities|Stream Buffering Utilities]]
- [[_COMMUNITY_Electron Builder Config|Electron Builder Config]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Child Process Spawn Helpers|Child Process Spawn Helpers]]
- [[_COMMUNITY_NPM Scripts|NPM Scripts]]
- [[_COMMUNITY_PATH & Env Utilities|PATH & Env Utilities]]
- [[_COMMUNITY_Stream Piping & Input|Stream Piping & Input]]
- [[_COMMUNITY_Validation Regex & Signals|Validation Regex & Signals]]
- [[_COMMUNITY_ZodError Formatting|ZodError Formatting]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_SSH Key & Host Setup|SSH Key & Host Setup]]
- [[_COMMUNITY_tsconfig.node Config|tsconfig.node Config]]
- [[_COMMUNITY_which  Command Resolution|which / Command Resolution]]
- [[_COMMUNITY_ArrayBuffer Resizing|ArrayBuffer Resizing]]
- [[_COMMUNITY_Zod Effects & Map|Zod Effects & Map]]
- [[_COMMUNITY_Zod Enum|Zod Enum]]
- [[_COMMUNITY_Git Runner & Identity|Git Runner & Identity]]
- [[_COMMUNITY_SSH Key Generation|SSH Key Generation]]
- [[_COMMUNITY_Process Kill Timeout|Process Kill Timeout]]
- [[_COMMUNITY_Zod Date Schema|Zod Date Schema]]
- [[_COMMUNITY_Signal Tables|Signal Tables]]
- [[_COMMUNITY_Signal-Exit Fallback|Signal-Exit Fallback]]
- [[_COMMUNITY_Shebang Parsing|Shebang Parsing]]
- [[_COMMUNITY_Zod Lazy Path|Zod Lazy Path]]
- [[_COMMUNITY_ZodAny|ZodAny]]
- [[_COMMUNITY_ZodTuple|ZodTuple]]
- [[_COMMUNITY_ZodNullable|ZodNullable]]
- [[_COMMUNITY_ZodOptional|ZodOptional]]
- [[_COMMUNITY_ZodPromise|ZodPromise]]
- [[_COMMUNITY_ZodUnion|ZodUnion]]
- [[_COMMUNITY_ZodUnknown|ZodUnknown]]
- [[_COMMUNITY_Misc Group 51|Misc Group 51]]
- [[_COMMUNITY_Misc Group 52|Misc Group 52]]
- [[_COMMUNITY_Misc Group 53|Misc Group 53]]
- [[_COMMUNITY_Misc Group 54|Misc Group 54]]
- [[_COMMUNITY_Misc Group 55|Misc Group 55]]
- [[_COMMUNITY_Misc Group 56|Misc Group 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]

## God Nodes (most connected - your core abstractions)
1. `error` - 50 edges
2. `ZodString` - 49 edges
3. `C()` - 46 edges
4. `ip()` - 43 edges
5. `ZodType` - 31 edges
6. `Ni()` - 27 edges
7. `pc()` - 26 edges
8. `addIssueToContext()` - 25 edges
9. `nc()` - 24 edges
10. `Ge()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Managed Include Strategy` --semantically_similar_to--> `Project Safety Rules`  [INFERRED] [semantically similar]
  README.md → CONTRIBUTING.md
- `Ir()` --calls--> `error`  [INFERRED]
  dist-renderer/assets/index-CnYVGocc.js → dist-electron/main/index.js
- `Iu()` --calls--> `error`  [INFERRED]
  dist-renderer/assets/index-CnYVGocc.js → dist-electron/main/index.js
- `Ni()` --calls--> `error`  [INFERRED]
  dist-renderer/assets/index-CnYVGocc.js → dist-electron/main/index.js
- `Gn()` --calls--> `error`  [INFERRED]
  dist-renderer/assets/index-CnYVGocc.js → dist-electron/main/index.js

## Hyperedges (group relationships)
- **Non-Destructive Config Safety Model** — readme_managed_include_strategy, readme_gitconfig_switcher_file, security_files_touched, contributing_project_safety_rules [INFERRED 0.85]
- **Tagged Release Build Pipeline** — contributing_release_process, workflows_release_workflow, contributing_ci_checks, ci_ci_workflow [INFERRED 0.85]
- **Secure Renderer-Main Process Boundary** — readme_security_model, readme_architecture, index_html_renderer_entry, readme_tech_stack [INFERRED 0.75]

## Communities (78 total, 18 thin omitted)

### Community 0 - "Bundled Runtime Internals"
Cohesion: 0.02
Nodes (63): aliases, AppStateSchema, arrayBufferMethods, binary, byteToHex, {
  /**
   * Called when the process is exiting, whether via signal, explicit
   * exit, or running out of stuff to do.
   *
   * If the global process object is not suitable for instrumentation,
   * then this will be a no-op.
   *
   * Returns a function that may be used to unload signal-exit.
   */
  onExit
}, calledFunctions, childProcess (+55 more)

### Community 1 - "Zod Number & Array Schemas"
Cohesion: 0.13
Nodes (3): floatSafeRemainder(), readShebang$1(), ZodNumber

### Community 2 - "Zod Parsing & Error Context"
Cohesion: 0.10
Nodes (17): addIssueToContext(), assertNever(), errorMap(), getErrorMap(), joinValues(), makeIssue(), OK(), ZodBoolean (+9 more)

### Community 3 - "Project Docs, CI & Architecture"
Cohesion: 0.09
Nodes (31): CI Workflow, Pre-PR CI Checks (typecheck/test/build), Contributing Guide, Project Safety Rules, Tagged Release Process, index.html Renderer Entry, Bug Report Issue Template, Issue Template Config (+23 more)

### Community 4 - "Electron Main: IPC, Tray & State"
Cohesion: 0.16
Nodes (18): setupIpcHandlers(), userDataPath, createTray(), rebuildTrayMenu(), userDataPath, openProfilesWindow(), openVerifyWindow(), preload (+10 more)

### Community 5 - "Zod Schema Composition"
Cohesion: 0.11
Nodes (4): Ou(), processCreateParams(), ZodPipeline, ZodType

### Community 6 - "Renderer: Theme & SSH UI"
Cohesion: 0.12
Nodes (14): App(), ThemeContext, ThemeContextValue, useThemeContext(), Theme, THEMES, useTheme(), Settings() (+6 more)

### Community 8 - "Zod Parse Status & Wrappers"
Cohesion: 0.12
Nodes (5): DIRTY(), ParseStatus, ZodLazy, ZodMap, ZodTuple

### Community 9 - "Zod Object Schema"
Cohesion: 0.11
Nodes (4): createZodEnum(), deepPartialify(), ZodObject, ZodReadonly

### Community 10 - "Zod String Check Methods"
Cohesion: 0.04
Nodes (52): Bc, be, Br(), cf(), Cl(), Cn(), Ct, Dl (+44 more)

### Community 11 - "Renderer: Profile Forms"
Cohesion: 0.13
Nodes (12): Props, Props, api, DetectedProfile, electron, Profile, ProfileAdvanced, ProfileAdvancedSchema (+4 more)

### Community 12 - "Execa Process Execution"
Cohesion: 0.12
Nodes (17): addPipeMethods(), checkGitInstalled(), execa(), generateSSHKey(), getErrorPrefix(), getEscapedCommand(), getSpawnedPromise(), getTimestamp() (+9 more)

### Community 13 - "Zod Default/Catch/Intersection"
Cohesion: 0.11
Nodes (10): getParsedType(), handleResult(), isAsync(), isValid(), mergeValues(), ZodBranded, ZodCatch, ZodDefault (+2 more)

### Community 14 - "TypeScript Compiler Options"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 15 - "Git Config Parsing & Profile Apply"
Cohesion: 0.23
Nodes (14): detectExistingProfiles(), ensureManagedIncludeInstalled(), getGlobalProfile(), match, parseConditionalIncludes(), parseConfigContent(), parseShowOrigin(), parseSSHConfig() (+6 more)

### Community 16 - "Renderer: Origin Verify View"
Cohesion: 0.22
Nodes (8): Props, checkGitInstalled(), GitError, runGit(), parseShowOrigin(), output, OriginEntry, VerifyResult

### Community 17 - "Signal-Exit & Window Mgmt"
Cohesion: 0.15
Nodes (7): Emitter, ObjectDefineProperty, openProfilesWindow(), openVerifyWindow(), processOk(), setExitHandler(), SignalExit

### Community 18 - "Profile Detection & SSH Config"
Cohesion: 0.20
Nodes (10): GIT_HOSTING_DOMAINS, DetectedProfile, detectExistingProfiles(), getGlobalProfile(), parseConditionalIncludes(), parseConfigContent(), parseSSHConfigForGitHosts(), parseSSHConfig() (+2 more)

### Community 19 - "package.json Metadata"
Cohesion: 0.14
Nodes (13): author, bugs, url, description, homepage, keywords, license, main (+5 more)

### Community 20 - "Stream Buffering Utilities"
Cohesion: 0.18
Nodes (14): addNewChunk(), appendChunk(), appendFinalChunk(), applyEncoding(), arrayBufferToNodeBuffer(), getBufferedData(), getChunkType(), getSpawnedResult() (+6 more)

### Community 21 - "Electron Builder Config"
Cohesion: 0.15
Nodes (13): build, appId, files, linux, mac, productName, win, maintainer (+5 more)

### Community 22 - "Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, electron, electron-builder, @types/node, @types/react, @types/react-dom, @types/uuid, typescript (+5 more)

### Community 23 - "Child Process Spawn Helpers"
Cohesion: 0.20
Nodes (11): createTray(), hookChildProcess(), isValidJWT(), loadProfiles(), loadState(), notFoundError(), rebuildTrayMenu(), spawn() (+3 more)

### Community 24 - "NPM Scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:appimage, build:arch, build:ci, build:mac, dev, preview (+3 more)

### Community 25 - "PATH & Env Utilities"
Cohesion: 0.18
Nodes (11): applyExecPath(), applyPreferLocal(), getEnv(), handleArguments(), hasAlias(), keys, normalizeStdio(), npmRunPath() (+3 more)

### Community 26 - "Stream Piping & Input"
Cohesion: 0.14
Nodes (14): add(), applyProfile(), bareHostFromAlias(), getInput(), handleInput(), insteadOfSources(), isExecaChildProcess(), isStream() (+6 more)

### Community 27 - "Validation Regex & Signals"
Cohesion: 0.20
Nodes (4): addToSSHConfig(), isGitHostingDomain(), isValidCidr(), isValidIP()

### Community 29 - "Runtime Dependencies"
Cohesion: 0.25
Nodes (8): dependencies, execa, react, react-dom, react-router-dom, uuid, zod, zustand

### Community 30 - "SSH Key & Host Setup"
Cohesion: 0.07
Nodes (47): _a(), ah(), al(), Ar(), Bp(), ch(), dh(), eh() (+39 more)

### Community 31 - "tsconfig.node Config"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, module, extends, include

### Community 32 - "which / Command Resolution"
Cohesion: 0.29
Nodes (7): getNotFoundError(), getPathInfo(), resolveCommand$1(), resolveCommandAttempt(), sync(), which$1(), whichSync()

### Community 33 - "ArrayBuffer Resizing"
Cohesion: 0.40
Nodes (6): addArrayBufferChunk(), finalizeArrayBuffer(), getNewContentsLength(), hasArrayBufferResize(), resizeArrayBuffer(), resizeArrayBufferSlow()

### Community 34 - "Zod Effects & Map"
Cohesion: 0.09
Nodes (42): ac(), an(), Ao(), ap(), Ba(), Bt(), ca(), Ce() (+34 more)

### Community 36 - "Git Runner & Identity"
Cohesion: 0.31
Nodes (7): applyProfile(), bareHostFromAlias(), insteadOfSources(), managed, personal, sources, work

### Community 37 - "SSH Key Generation"
Cohesion: 0.40
Nodes (5): addToSSHConfig(), generateSSHKey(), SSHKeyResult, testSSHConnection(), toKeyToken()

### Community 38 - "Process Kill Timeout"
Cohesion: 0.29
Nodes (6): getForceKillAfterTimeout(), isSigterm(), setKillTimeout(), shouldForceKill(), spawnedKill(), validateTimeout()

### Community 40 - "Signal Tables"
Cohesion: 0.50
Nodes (4): getRealtimeSignals(), getSignals(), getSignalsByName(), getSignalsByNumber()

### Community 42 - "Shebang Parsing"
Cohesion: 0.13
Nodes (41): Aa(), At(), au(), Bs(), C(), Ci(), de(), df() (+33 more)

### Community 45 - "ZodTuple"
Cohesion: 0.10
Nodes (37): ai(), Bf(), Da(), di(), dp(), Du(), es(), Fi() (+29 more)

### Community 46 - "ZodNullable"
Cohesion: 0.09
Nodes (34): B(), Bi(), bn(), cu(), dc(), ec(), fc(), Fe() (+26 more)

### Community 51 - "Misc Group 51"
Cohesion: 0.16
Nodes (20): bu(), Ds(), ea(), Er(), Gn(), Ja(), Je(), ka() (+12 more)

### Community 52 - "Misc Group 52"
Cohesion: 0.20
Nodes (18): Ae(), cc(), fn(), ki(), la(), Pn(), Qi(), Ro() (+10 more)

### Community 55 - "Misc Group 55"
Cohesion: 0.18
Nodes (11): code:text (# work GitHub account), code:bash (# Default single-account form), code:bash (git remote set-url origin git@github.com-work:company/repo.g), code:text (Host gh-personal), Creating Profiles, Platform-Agnostic Profile Detection, SSH Configuration for Multiple Accounts, SSH Key Generation (+3 more)

### Community 56 - "Misc Group 56"
Cohesion: 0.36
Nodes (10): D(), Ei(), hc(), Ho(), ll(), lp(), $s(), vc() (+2 more)

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (9): Before Opening a Pull Request, Change Scope, code:bash (npm run typecheck), code:bash (git tag v1.0.0), Contributing, Local Setup, Project Safety Rules, Release Process (+1 more)

### Community 60 - "Community 60"
Cohesion: 0.22
Nodes (9): App does not start, code:bash (git config user.name), code:bash (ssh -T git@github.com-work), code:bash (git --version), code:bash (git remote -v), Commits show the wrong identity, Permission denied when pushing, SSH key does not authenticate (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (8): Comparison vs Manual Setup, Contributing, Features, Git Profile Switcher, License, Screenshots, Themes, Why This Exists

### Community 62 - "Community 62"
Cohesion: 0.36
Nodes (8): Bo(), dn(), Do(), Ft(), hn(), lu(), op(), zo()

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (7): Build Packages Locally, code:bash (git clone https://github.com/Kinau-Guatemala/git-profile-swi), code:bash (# Windows portable .exe), From Source, Installation, Prebuilt Downloads, Prerequisites

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (5): Files The App Does Not Manage, Files The App Touches, Operational Notes, Reporting A Vulnerability, Security Notes

### Community 66 - "Community 66"
Cohesion: 0.50
Nodes (4): ensureManagedIncludeInstalled(), IncludePosition, ManagedIncludeResult, stripManagedInclude()

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (5): 1. Launch the App, 2. Add a Profile, 3. Switch from the Tray, code:text (┌─────────────────────────────────┐), Quick Start

### Community 68 - "Community 68"
Cohesion: 0.40
Nodes (5): changePrototype(), changeToString(), copyProperty(), mimicFunction(), onetime()

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (4): Architecture, code:text (src/), Security Model, Tech Stack

### Community 70 - "Community 70"
Cohesion: 0.50
Nodes (4): code:bash (# Development with hot reload), code:bash (git tag v1.0.0), Development, Publishing A Release

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (3): code:text (~/.gitconfig                          ~/.gitconfig-switcher), How It Works, What This Means

### Community 73 - "Community 73"
Cohesion: 0.67
Nodes (3): Files it does not manage, Files it touches, Security Notes

### Community 74 - "Community 74"
Cohesion: 0.67
Nodes (3): datetimeRegex(), timeRegex(), timeRegexSource()

## Knowledge Gaps
- **220 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `error` connect `Shebang Parsing` to `Bundled Runtime Internals`, `Zod Effects & Map`, `Zod String Check Methods`, `ZodTuple`, `ZodNullable`, `Git Config Parsing & Profile Apply`, `Misc Group 51`, `Misc Group 52`, `Misc Group 56`, `Community 62`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Why does `ZodType` connect `Zod Schema Composition` to `Bundled Runtime Internals`, `Zod Parsing & Error Context`, `Zod Parse Status & Wrappers`, `Zod Default/Catch/Intersection`, `Child Process Spawn Helpers`, `Stream Piping & Input`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `ZodString` connect `Zod String Validators` to `Bundled Runtime Internals`, `Validation Regex & Signals`, `Misc Group 53`, `Git Config Parsing & Profile Apply`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 48 inferred relationships involving `error` (e.g. with `Ir()` and `Iu()`) actually correct?**
  _`error` has 48 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _221 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Bundled Runtime Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.0205785284410794 - nodes in this community are weakly interconnected._
- **Should `Zod Number & Array Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.13105413105413105 - nodes in this community are weakly interconnected._