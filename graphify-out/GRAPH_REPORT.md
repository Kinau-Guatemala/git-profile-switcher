# Graph Report - .  (2026-06-26)

## Corpus Check
- Corpus is ~31,325 words - fits in a single context window. You may not need a graph.

## Summary
- 738 nodes · 1275 edges · 58 communities (39 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.88)
- Token cost: 41,088 input · 0 output

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
- [[_COMMUNITY_Misc Group 56|Misc Group 56]]

## God Nodes (most connected - your core abstractions)
1. `ZodString` - 49 edges
2. `ZodType` - 31 edges
3. `addIssueToContext()` - 25 edges
4. `ZodNumber` - 21 edges
5. `execa()` - 20 edges
6. `ZodObject` - 18 edges
7. `ZodBigInt` - 17 edges
8. `compilerOptions` - 16 edges
9. `DIRTY()` - 14 edges
10. `OK()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Managed Include Strategy` --semantically_similar_to--> `Project Safety Rules`  [INFERRED] [semantically similar]
  README.md → CONTRIBUTING.md
- `App Overview Screenshot (Profiles/SSH/Verify UI)` --references--> `Git Profile Switcher (App)`  [EXTRACTED]
  docs/screenshots/app-overview.svg → README.md
- `Tray Menu Screenshot (Switch/Verify/Undo)` --references--> `Tray-First Switching`  [EXTRACTED]
  docs/screenshots/tray-menu.svg → README.md
- `Tray Menu Screenshot (Switch/Verify/Undo)` --references--> `Undo Last Switch`  [EXTRACTED]
  docs/screenshots/tray-menu.svg → README.md
- `App Overview Screenshot (Profiles/SSH/Verify UI)` --references--> `SSH Key Management (ed25519)`  [EXTRACTED]
  docs/screenshots/app-overview.svg → README.md

## Hyperedges (group relationships)
- **Non-Destructive Config Safety Model** — readme_managed_include_strategy, readme_gitconfig_switcher_file, security_files_touched, contributing_project_safety_rules [INFERRED 0.85]
- **Tagged Release Build Pipeline** — contributing_release_process, workflows_release_workflow, contributing_ci_checks, ci_ci_workflow [INFERRED 0.85]
- **Secure Renderer-Main Process Boundary** — readme_security_model, readme_architecture, index_html_renderer_entry, readme_tech_stack [INFERRED 0.75]

## Communities (58 total, 19 thin omitted)

### Community 0 - "Bundled Runtime Internals"
Cohesion: 0.02
Nodes (54): aliases, AppStateSchema, arrayBufferMethods, binary, byteToHex, {
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
}, calledFunctions, childProcess (+46 more)

### Community 1 - "Zod Number & Array Schemas"
Cohesion: 0.07
Nodes (6): floatSafeRemainder(), readShebang$1(), ZodArray, ZodBigInt, ZodNumber, ZodSet

### Community 2 - "Zod Parsing & Error Context"
Cohesion: 0.13
Nodes (15): addIssueToContext(), assertNever(), errorMap(), getErrorMap(), joinValues(), makeIssue(), OK(), ZodBoolean (+7 more)

### Community 3 - "Project Docs, CI & Architecture"
Cohesion: 0.09
Nodes (31): CI Workflow, Pre-PR CI Checks (typecheck/test/build), Contributing Guide, Project Safety Rules, Tagged Release Process, index.html Renderer Entry, Bug Report Issue Template, Issue Template Config (+23 more)

### Community 4 - "Electron Main: IPC, Tray & State"
Cohesion: 0.14
Nodes (20): ensureManagedIncludeInstalled(), ManagedIncludeResult, setupIpcHandlers(), userDataPath, createTray(), rebuildTrayMenu(), userDataPath, openProfilesWindow() (+12 more)

### Community 5 - "Zod Schema Composition"
Cohesion: 0.12
Nodes (3): processCreateParams(), ZodPipeline, ZodType

### Community 6 - "Renderer: Theme & SSH UI"
Cohesion: 0.12
Nodes (14): App(), ThemeContext, ThemeContextValue, useThemeContext(), Theme, THEMES, useTheme(), Settings() (+6 more)

### Community 8 - "Zod Parse Status & Wrappers"
Cohesion: 0.14
Nodes (4): DIRTY(), ParseStatus, ZodBranded, ZodLazy

### Community 9 - "Zod Object Schema"
Cohesion: 0.11
Nodes (4): createZodEnum(), deepPartialify(), ZodObject, ZodReadonly

### Community 11 - "Renderer: Profile Forms"
Cohesion: 0.15
Nodes (10): Props, Props, api, DetectedProfile, electron, Profile, ProfileAdvanced, ProfileAdvancedSchema (+2 more)

### Community 12 - "Execa Process Execution"
Cohesion: 0.11
Nodes (19): addPipeMethods(), changePrototype(), changeToString(), checkGitInstalled(), copyProperty(), execa(), getErrorPrefix(), getEscapedCommand() (+11 more)

### Community 13 - "Zod Default/Catch/Intersection"
Cohesion: 0.16
Nodes (8): getParsedType(), handleResult(), isAsync(), isValid(), mergeValues(), ZodCatch, ZodDefault, ZodIntersection

### Community 14 - "TypeScript Compiler Options"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 15 - "Git Config Parsing & Profile Apply"
Cohesion: 0.23
Nodes (14): applyProfile(), detectExistingProfiles(), error, getGlobalProfile(), match, parseConditionalIncludes(), parseConfigContent(), parseShowOrigin() (+6 more)

### Community 16 - "Renderer: Origin Verify View"
Cohesion: 0.23
Nodes (7): Props, verifyGlobal(), parseShowOrigin(), output, verifyInRepo(), OriginEntry, VerifyResult

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
Cohesion: 0.20
Nodes (10): add(), getInput(), handleInput(), isExecaChildProcess(), isStream(), isWritableStream(), makeAllStream(), mergeStream$1 (+2 more)

### Community 27 - "Validation Regex & Signals"
Cohesion: 0.22
Nodes (7): datetimeRegex(), isSigterm(), isValidCidr(), isValidIP(), shouldForceKill(), timeRegex(), timeRegexSource()

### Community 29 - "Runtime Dependencies"
Cohesion: 0.25
Nodes (8): dependencies, execa, react, react-dom, react-router-dom, uuid, zod, zustand

### Community 30 - "SSH Key & Host Setup"
Cohesion: 0.25
Nodes (6): addToSSHConfig(), ensureManagedIncludeInstalled(), generateSSHKey(), isGitHostingDomain(), testSSHConnection(), toKeyToken()

### Community 31 - "tsconfig.node Config"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, module, extends, include

### Community 32 - "which / Command Resolution"
Cohesion: 0.29
Nodes (7): getNotFoundError(), getPathInfo(), resolveCommand$1(), resolveCommandAttempt(), sync(), which$1(), whichSync()

### Community 33 - "ArrayBuffer Resizing"
Cohesion: 0.40
Nodes (6): addArrayBufferChunk(), finalizeArrayBuffer(), getNewContentsLength(), hasArrayBufferResize(), resizeArrayBuffer(), resizeArrayBufferSlow()

### Community 36 - "Git Runner & Identity"
Cohesion: 0.40
Nodes (4): checkGitInstalled(), GitError, runGit(), applyProfile()

### Community 37 - "SSH Key Generation"
Cohesion: 0.40
Nodes (5): addToSSHConfig(), generateSSHKey(), SSHKeyResult, testSSHConnection(), toKeyToken()

### Community 38 - "Process Kill Timeout"
Cohesion: 0.40
Nodes (4): getForceKillAfterTimeout(), setKillTimeout(), spawnedKill(), validateTimeout()

### Community 40 - "Signal Tables"
Cohesion: 0.50
Nodes (4): getRealtimeSignals(), getSignals(), getSignalsByName(), getSignalsByNumber()

### Community 42 - "Shebang Parsing"
Cohesion: 0.67
Nodes (3): detectShebang(), parse$1(), parseNonShell()

## Knowledge Gaps
- **160 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+155 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ZodString` connect `Zod String Validators` to `Bundled Runtime Internals`, `Zod Number & Array Schemas`, `Zod String Check Methods`, `Git Config Parsing & Profile Apply`, `Misc Group 55`, `Validation Regex & Signals`, `SSH Key & Host Setup`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `ZodType` connect `Zod Schema Composition` to `Bundled Runtime Internals`, `Zod Parsing & Error Context`, `Zod Parse Status & Wrappers`, `Zod Default/Catch/Intersection`, `Misc Group 55`, `Child Process Spawn Helpers`, `Stream Piping & Input`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `ZodNumber` connect `Zod Number & Array Schemas` to `Bundled Runtime Internals`, `Zod Parsing & Error Context`, `Process Kill Timeout`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _161 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Bundled Runtime Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.021505376344086023 - nodes in this community are weakly interconnected._
- **Should `Zod Number & Array Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Zod Parsing & Error Context` be split into smaller, more focused modules?**
  _Cohesion score 0.12701612903225806 - nodes in this community are weakly interconnected._