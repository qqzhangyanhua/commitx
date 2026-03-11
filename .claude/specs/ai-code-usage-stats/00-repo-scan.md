# UltraThink Repository Scan Report

**Project**: commit-report (github-commit)  
**Scan Date**: 2026-03-11  
**Methodology**: UltraThink (Hypothesis → Evidence → Pattern Recognition → Synthesis → Validation)

---

## 1. Executive Summary

| Attribute | Value |
|-----------|-------|
| **Project Type** | CLI Tool (Node.js) |
| **Primary Purpose** | Git commit statistics and visualization |
| **Language** | TypeScript (strict mode) |
| **Package Manager** | pnpm |
| **Build Tool** | tsup |
| **Target Runtime** | Node.js 18+ |

**commit-report** is a Git commit statistics CLI that recursively scans directories for Git repositories, parses commit history, computes multi-dimensional statistics (including AI code usage metrics), and generates interactive D3.js HTML reports with light/dark theme support.

---

## 2. Project Structure Analysis

### 2.1 Directory Layout

```
github-commit/
├── src/
│   ├── cli/              # CLI entry, argument parsing, orchestration
│   │   ├── index.ts      # Main entry (Commander.js)
│   │   └── time-utils.ts # Time range parsing (7d/1m/3m/6m/1y/all)
│   ├── scanner/         # Repository discovery
│   │   └── index.ts      # Recursive .git scanning
│   ├── analyzer/        # Git log parsing & statistics
│   │   ├── index.ts      # Orchestrates parse → calculate → merge
│   │   ├── git-log-parser.ts
│   │   ├── stats-calculator.ts   # Core stats (942 lines, needs split)
│   │   ├── ai-stats-calculator.ts
│   │   ├── advanced/     # Team health, stability, work pressure, etc.
│   │   └── tech-debt/    # Risk scoring, AI detection, duplication
│   ├── reporter/        # HTML report generation
│   │   ├── index.ts
│   │   └── html-builder.ts
│   └── types/           # Centralized type definitions
│       └── index.ts
├── templates/
│   └── report.html      # Single-file HTML + D3.js + Tailwind
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── CLAUDE.md            # AI context & module docs
```

### 2.2 Data Flow

```
CLI (Commander) → Scanner → Analyzer → Reporter
     ↓               ↓           ↓          ↓
  TimeRange     RepoInfo[]   CommitStats   HTML
```

**Pipeline**: User input → Time range resolution → Scan repos → Select repos (interactive) → Parse git log → Calculate stats (basic + AI + advanced + tech-debt) → Merge (multi-repo) → Build HTML → Write file → Open browser.

---

## 3. Technology Stack

### 3.1 Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| commander | ^14.0.3 | CLI argument parsing |
| @inquirer/prompts | ^8.2.0 | Interactive prompts (checkbox, confirm) |
| chalk | ^5.6.2 | Terminal colors |
| ora | ^9.3.0 | Spinner/progress |
| ignore | ^7.0.5 | .gitignore rule parsing |
| open | ^11.0.0 | Open browser |
| simple-git | ^3.30.0 | Listed but not directly used (candidate for removal) |

### 3.2 Dev Dependencies

| Package | Version |
|---------|---------|
| TypeScript | ^5.9.3 |
| tsup | ^8.5.1 |
| @types/node | ^25.2.2 |

### 3.3 Build Configuration

- **tsconfig.json**: ES2022, ESNext modules, strict mode, declaration + sourceMap
- **tsup.config.ts**: Single entry `src/cli/index.ts`, ESM output, Node 18 target, shebang banner, `external: ['inquirer']`
- **Output**: `dist/index.js` (single bundled file)

### 3.4 Frontend (Report Template)

- **Tailwind CSS** (CDN)
- **D3.js v7** (CDN)
- **Inter** font (Google Fonts)
- Inline JavaScript for charts; data injected via `__REPORT_DATA__` placeholder

---

## 4. Code Patterns & Conventions

### 4.1 Module Organization

- **Single responsibility**: Each module has a clear domain (scan / parse / calculate / render).
- **ESM imports**: `.js` extension in imports (e.g. `from './index.js'`).
- **Types**: Centralized in `src/types/index.ts`; no inline type definitions in business logic.

### 4.2 Naming Conventions

- **Functions**: camelCase (`calculateStats`, `parseGitLog`, `mergeStats`)
- **Interfaces**: PascalCase (`CommitRecord`, `CommitStats`, `AIMetrics`)
- **Constants**: UPPER_SNAKE_CASE or camelCase for config (`COMMIT_SEPARATOR`, `IGNORE_DIRS`)

### 4.3 Design Patterns

- **Pipeline**: Sequential stages (scan → analyze → report).
- **Map aggregation**: Single-pass over `CommitRecord[]` with `Map` for author/fileType/directory stats.
- **Merge strategy**: `mergeStats()` aggregates per-repo `CommitStats`; advanced stats (teamHealth, stability, etc.) are dropped in multi-repo mode.
- **Template injection**: HTML template with `__REPORT_DATA__` replaced by JSON (XSS-escaped).

### 4.4 Key Algorithms

- **Git log parsing**: `git log --format="..." --numstat` with custom separator; .gitignore applied; 100MB buffer.
- **AI score**: Heuristic in `ai-detector.ts`: Co-authored-by AI tools (+50), AI tool signatures (+35), large generic commits (+15–25), high-add-zero-delete (+15), anomalous naming (+20).
- **Tech debt**: Risk scorer + AI detection + duplication + prioritizer → radar dimensions + action items.

---

## 5. AI Code Usage Statistics (Relevant to ai-code-usage-stats)

### 5.1 Data Model

- **AIMetrics**: `totalAILines`, `totalLines`, `aiPercentage`, `suspiciousCommits`, `highAICommits[]`
- **AuthorAIStats**: per-author AI lines, total lines, aiPercentage
- **DirectoryAIStats**: per-directory AI stats, `isHighRisk` (commits>50 && aiPercentage>60)
- **AITrendPoint**: weekly AI percentage over time

### 5.2 Calculation Flow

1. `stats-calculator.ts` calls `calculateAIMetrics(commits)` from `ai-stats-calculator.ts`
2. `ai-stats-calculator.ts` uses `calculateAIScore(commit)` and `isAutoGeneratedFile(path)` from `tech-debt/ai-detector.ts`
3. AI lines estimated as `(commitLines * aiScore) / 100` per commit
4. Results merged in `mergeStats()` for multi-repo (author/directory/trends aggregated)

### 5.3 Report Integration

- `templates/report.html`: Cards for AI percentage, lines, suspicious commits; tab for high-AI commits
- Conditional rendering: `if (!stats.aiMetrics) return;`

### 5.4 Integration Points for New Features

- **New AI detection signals**: Extend `ai-detector.ts` patterns (`AI_CO_AUTHOR_PATTERNS`, `AI_TOOL_PATTERNS`, etc.)
- **New AI metrics**: Add types in `src/types/index.ts`, extend `calculateAIMetrics()`, update `mergeStats()`, add UI in `report.html`
- **New report sections**: Add D3.js blocks in `report.html` reading from `window.REPORT_DATA.stats`

---

## 6. Documentation Review

### 6.1 Existing Documentation

| Document | Quality | Content |
|----------|---------|---------|
| README.md | Good | Features, install, usage, params, tech stack |
| CLAUDE.md | Excellent | Architecture, module index, AI guidance |
| src/*/CLAUDE.md | Good | Per-module responsibilities, interfaces, FAQ |

### 6.2 Missing

- No CONTRIBUTING.md
- No API documentation (internal only)
- No architecture decision records (ADRs)
- No unit tests; manual testing only

---

## 7. Development Workflow

### 7.1 Git & Branching

- Standard Git; no explicit branching strategy documented
- `.gitignore`: node_modules, dist, *.tgz, commitx-report*.html, .DS_Store, .vscode, .idea, .worktrees

### 7.2 CI/CD

- **No `.github/workflows`** or `.gitlab-ci.yml` found
- No automated tests or deployment pipelines

### 7.3 Scripts

```json
"build": "tsup",
"dev": "tsup --watch",
"start": "node dist/cli/index.js"
```

**Note**: `package.json` bin points to `./dist/index.js`; tsup outputs `dist/index.js` for single entry. `start` script references `dist/cli/index.js` which may be outdated.

### 7.4 Testing Strategy

- No unit tests
- Manual testing: single vs multi-repo, small vs large repos, time filters, author filter, depth limit

---

## 8. Constraints & Considerations

### 8.1 Technical Constraints

- **stats-calculator.ts**: ~942 lines; project guideline is ≤500 lines per file; refactor recommended
- **Advanced stats**: Only valid for single-repo; multi-repo merge sets them to `undefined`
- **simple-git**: Declared but unused; consider removal
- **Template path**: Reporter resolves `report.html` via multiple relative paths for dev vs built output

### 8.2 Integration Constraints

- **Node.js 18+** required
- **Git** must be installed (checked at startup)
- **Large repos**: 100MB buffer for git log; >100k commits may be slow

### 8.3 Conventions to Follow

1. Add new types in `src/types/index.ts` before implementation
2. Keep single-pass aggregation where possible for performance
3. Use `.js` extension in ESM imports
4. Preserve XSS escaping in `html-builder.ts` when injecting data
5. Handle multi-repo merge explicitly for new optional stats (like AI metrics)

---

## 9. File Inventory (Key Files)

| Path | Lines (approx) | Role |
|------|----------------|------|
| src/cli/index.ts | 131 | CLI orchestration |
| src/cli/time-utils.ts | 74 | Time range parsing |
| src/scanner/index.ts | 115 | Repo discovery |
| src/analyzer/index.ts | 70 | Analysis orchestration |
| src/analyzer/git-log-parser.ts | 136 | Git log parsing |
| src/analyzer/stats-calculator.ts | 942 | Core + AI + merge stats |
| src/analyzer/ai-stats-calculator.ts | 160 | AI metrics calculation |
| src/analyzer/tech-debt/ai-detector.ts | 248 | AI score heuristics |
| src/analyzer/tech-debt/index.ts | 131 | Tech debt aggregation |
| src/reporter/index.ts | 34 | Report generation |
| src/reporter/html-builder.ts | 92 | Template + serialization |
| src/types/index.ts | 413 | Type definitions |
| templates/report.html | ~2700 | HTML + D3 charts |

---

## 10. Recommendations for ai-code-usage-stats Feature

1. **Extend existing AI pipeline**: `ai-stats-calculator.ts` and `ai-detector.ts` are the primary extension points.
2. **Preserve merge logic**: Any new AI-related fields should be merged in `mergeStats()` (see lines 374–423).
3. **Update types first**: Add interfaces in `src/types/index.ts` before implementation.
4. **Report template**: Add new sections in `templates/report.html` with conditional checks for new data.
5. **Consider splitting stats-calculator**: If adding more logic, extract AI/advanced stats into separate modules.

---

*Report generated via UltraThink methodology. Cross-validated against package.json, tsconfig, tsup config, and source code.*
