# Sprint Plan: AI Code Usage Stats (ai-code-usage-stats)

## Executive Summary

| Attribute | Value |
|-----------|-------|
| **Total Scope** | ~101 story points |
| **Estimated Duration** | 3 sprints (6 weeks) |
| **Team Size Assumption** | 1–2 developers |
| **Sprint Length** | 2 weeks |
| **Velocity Assumption** | 35–45 points/sprint |

**Decisions applied**:
- ISO week: migrate all trend logic to ISO week
- Adoption: current branch, fallback main/master for detached HEAD
- Retention: revert-only in Phase 2
- Tool display names: add mapping (e.g. `claude-code` → "Claude Code")
- package.json: fix `start` script in prerequisite

---

## Epic Breakdown

### Prerequisite Epic: Refactor stats-calculator.ts

**Business Value**: Reduce file size to ≤500 lines, align week logic, and prepare for AI tool stats.

**Total Points**: 25
**Priority**: High (blocker for Phase 1)

| Story ID | Title | Points |
|----------|-------|--------|
| P.1 | Split stats-calculator into modules | 18 |
| P.2 | Update mergeStats, imports, fix package.json | 6 |
| P.3 | Verify no regression | 3 |

### Epic 1: Git Log Body Parsing & Tool Detection (Phase 1)

**Business Value**: Enable tool detection from Co-authored-by and commit body.

**Total Points**: 21
**Priority**: High

| Story ID | Title | Points |
|----------|-------|--------|
| 1.1 | Git log format + body parsing (64KB cap) | 8 |
| 1.2 | detectAITools() in ai-detector | 5 |
| 1.3 | Integrate tool detection with aiScore ("other" logic) | 5 |
| 1.4 | Types: AIToolId, ToolAIMetrics, ToolAITrendPoint | 3 |

### Epic 2: Per-Tool Aggregation & Trends (Phase 1)

**Business Value**: Per-tool metrics and weekly trends for reporting.

**Total Points**: 18
**Priority**: High

| Story ID | Title | Points |
|----------|-------|--------|
| 2.1 | Single-pass tool aggregation in ai-stats-calculator | 8 |
| 2.2 | ToolAITrendPoint (uses shared ISO week) | 5 |
| 2.3 | mergeStats for toolAIMetrics & toolAITrends | 5 |

### Epic 3: Report Visualization (Phase 1 MVP)

**Business Value**: Tool cards and trend chart in the HTML report.

**Total Points**: 16
**Priority**: High

| Story ID | Title | Points |
|----------|-------|--------|
| 3.1 | Tool usage cards (bar/pie) | 5 |
| 3.2 | Multi-tool trend line chart | 5 |
| 3.3 | Tool display name mapping | 3 |
| 3.4 | Conditional rendering & XSS safety | 3 |

### Epic 4: Author×Tool & Directory×Tool (Phase 2)

**Total Points**: 21
**Priority**: Medium

| Story ID | Title | Points |
|----------|-------|--------|
| 4.1 | AuthorToolAIStats aggregation | 8 |
| 4.2 | DirectoryToolAIStats aggregation | 5 |
| 4.3 | mergeStats for author/directory tool stats | 5 |
| 4.4 | Author×tool matrix UI | 5 |
| 4.5 | Directory×tool distribution UI | 3 |

### Epic 5: Retention & Adoption (Phase 2)

**Total Points**: 21
**Priority**: Medium

| Story ID | Title | Points |
|----------|-------|--------|
| 5.1 | Revert detection (Revert "...") | 8 |
| 5.2 | Per-tool retention rate | 5 |
| 5.3 | Adoption: current branch (fallback main/master) | 8 |
| 5.4 | ≥50k commits: last 1000 only | 3 |
| 5.5 | ToolRetentionAdoption UI | 5 |

---

## Detailed User Stories & Tasks

### P.1: Split stats-calculator into modules (18 pts)

**Epic**: Prerequisite
**Priority**: High

**User Story**: As a developer, I want stats-calculator split into smaller modules so that each file stays ≤500 lines and trend logic uses ISO week consistently.

**Acceptance Criteria**:
- [ ] `basic-stats.ts` – core stats (commits, lines, files)
- [ ] `author-stats.ts` – author aggregation
- [ ] `time-stats.ts` – time distribution, patterns, **getISOWeekKey**
- [ ] `quality-stats.ts` – quality and collaboration
- [ ] `stats-calculator.ts` – orchestration + mergeStats only
- [ ] All files ≤500 lines
- [ ] ESM imports use `.js` extension

**Tasks**:
1. **P.1.1**: Extract basic-stats (4h)
2. **P.1.2**: Extract author-stats (4h)
3. **P.1.3**: Extract time-stats (4h)
4. **P.1.4**: Extract quality-stats (6h)
5. **P.1.5**: Refactor stats-calculator as orchestrator (4h)
6. **P.1.6**: Update imports in analyzer/index.ts (2h)
7. **P.1.7**: ISO week migration (6h) — Add `getISOWeekKey`, replace all `getWeekKey` usages
8. **P.1.8**: Fix package.json start script (1h)

### P.2: Update mergeStats and imports (6 pts)

**Tasks**:
1. **P.2.1**: Update mergeStats to use extracted modules (3h)
2. **P.2.2**: Verify package.json start script (1h)
3. **P.2.3**: Final import and build check (2h)

### P.3: Verify no regression (3 pts)

**Tasks**:
1. **P.3.1**: Manual test single-repo (1h)
2. **P.3.2**: Manual test multi-repo (1h)
3. **P.3.3**: Compare trend data before/after ISO week migration (1h)

### 1.1: Git log format + body parsing (64KB cap) (8 pts)

**Acceptance Criteria**:
- [ ] Format includes `%b` (body)
- [ ] Body capped at 64KB; truncate with `\n...(truncated)`
- [ ] Parse header vs body vs numstat
- [ ] `CommitRecord.message` = subject + (body ? '\n' + body : '')
- [ ] Backward compatible

**Tasks**:
1. **1.1.1**: Change FORMAT to include `%n%b` (2h)
2. **1.1.2**: Implement body parsing and numstat boundary (4h)
3. **1.1.3**: Add 64KB truncation (2h)
4. **1.1.4**: Test with repos that have Co-authored-by (2h)

### 1.2: detectAITools() in ai-detector (5 pts)

**Acceptance Criteria**:
- [ ] `detectAITools(message: string): string[]` returns tool IDs
- [ ] Supports: claude-code, codex, opencode, gemini, cursor, copilot, codeium, tabnine
- [ ] Single commit can map to multiple tools
- [ ] Uses Co-authored-by and body patterns

**Tasks**:
1. **1.2.1**: Add tool mapping (3h)
2. **1.2.2**: Implement regex/pattern matching (3h)
3. **1.2.3**: Return deduplicated array of tool IDs (1h)

### 1.3: Integrate tool detection with aiScore (5 pts)

**Logic**:
```typescript
const tools = detectAITools(commit.message);
const aiScore = calculateAIScore(commit);
const effectiveTools = tools.length > 0 ? tools : (aiScore > 0 ? ['other'] : []);
```

### 1.4: Types: AIToolId, ToolAIMetrics, ToolAITrendPoint (3 pts)

**Types**:
```typescript
export type AIToolId = 'claude-code' | 'codex' | 'opencode' | 'gemini' | 'cursor' | 'copilot' | 'codeium' | 'tabnine' | 'other';

export interface ToolAIMetrics {
  toolId: AIToolId;
  totalLines: number;
  aiLines: number;
  commits: number;
  aiPercentage: number;
}

export interface ToolAITrendPoint {
  week: string;
  toolId: AIToolId;
  aiLines: number;
  totalLines: number;
  aiPercentage: number;
}
```

### 2.1: Single-pass tool aggregation (8 pts)

**Acceptance Criteria**:
- [ ] `toolAIMetrics: ToolAIMetrics[]` per-tool
- [ ] Multi-tool commits: each tool gets full line count
- [ ] "Other" only when aiScore > 0 and no known tools
- [ ] Single-pass over commits

### 2.2: ToolAITrendPoint (ISO week) (5 pts)

**Acceptance Criteria**:
- [ ] Uses shared `getISOWeekKey` from time-stats
- [ ] Map<`${week}-${toolId}`, TrendData>

### 2.3: mergeStats for toolAIMetrics & toolAITrends (5 pts)

### 3.1: Tool usage cards (bar/pie) (5 pts)

**Acceptance Criteria**:
- [ ] "按工具统计" section in AI tab
- [ ] Per-tool: lines, %, commits
- [ ] Bar or pie chart
- [ ] Uses display names

### 3.2: Multi-tool trend line chart (5 pts)

**Acceptance Criteria**:
- [ ] Multi-line D3 chart (one line per tool)
- [ ] Legend to toggle tools
- [ ] Uses display names

### 3.3: Tool display name mapping (3 pts)

```typescript
export const TOOL_DISPLAY_NAMES: Record<AIToolId, string> = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'opencode': 'OpenCode',
  'gemini': 'Gemini',
  'cursor': 'Cursor',
  'copilot': 'Copilot',
  'codeium': 'Codeium',
  'tabnine': 'Tabnine',
  'other': '其他',
};
```

### 3.4: Conditional rendering & XSS safety (3 pts)

### 4.1–4.5: Author×Tool & Directory×Tool (Phase 2)

Phase 2 types:
```typescript
export interface AuthorToolAIStats {
  author: string; email: string; toolId: AIToolId;
  aiLines: number; totalLines: number; aiPercentage: number;
}

export interface DirectoryToolAIStats {
  path: string; toolId: AIToolId;
  aiLines: number; totalLines: number; commits: number; aiPercentage: number;
}
```

### 5.1–5.5: Retention & Adoption (Phase 2)

- Revert detection: `Revert "..."` in message
- Adoption: current branch, fallback main/master, ≥50k → last 1000
- Per-tool rates

---

## Sprint Allocation

### Sprint 1 (Weeks 1–2) — Prerequisite + Phase 1 Start

**Sprint Goal**: Refactor stats-calculator, migrate to ISO week, fix package.json, implement Git log body parsing + tool detection.

| Story ID | Title | Points |
|----------|-------|--------|
| P.1 | Split stats-calculator + ISO week + package.json | 18 |
| P.2 | Update mergeStats and imports | 6 |
| P.3 | Verify no regression | 3 |
| 1.1 | Git log body parsing | 8 |
| 1.2 | detectAITools() | 5 |
| 1.3 | Integrate tool detection | 5 |
| 1.4 | Types (AIToolId, etc.) | 3 |
| **Total** | | **48** |

### Sprint 2 (Weeks 3–4) — Phase 1 MVP Complete

**Sprint Goal**: Per-tool aggregation, trends, and report UI with display names.

| Story ID | Title | Points |
|----------|-------|--------|
| 2.1 | Single-pass tool aggregation | 8 |
| 2.2 | ToolAITrendPoint (ISO week) | 5 |
| 2.3 | mergeStats for tool metrics | 5 |
| 3.1 | Tool usage cards | 5 |
| 3.2 | Multi-tool trend chart | 5 |
| 3.3 | Tool display name mapping | 3 |
| 3.4 | Conditional rendering & XSS | 3 |
| (Buffer) | Testing, integration | 5 |
| **Total** | | **39** |

### Sprint 3 (Weeks 5–6) — Phase 2

**Sprint Goal**: Author×tool, directory×tool, retention, adoption, and utility display.

| Story ID | Title | Points |
|----------|-------|--------|
| 4.1 | AuthorToolAIStats | 8 |
| 4.2 | DirectoryToolAIStats | 5 |
| 4.3 | mergeStats for author/dir tool | 5 |
| 4.4 | Author×tool matrix UI | 5 |
| 4.5 | Directory×tool UI | 3 |
| 5.1 | Revert detection | 8 |
| 5.2 | Per-tool retention rate | 5 |
| 5.3 | Adoption (current branch) | 8 |
| 5.4 | ≥50k: last 1000 only | 3 |
| 5.5 | Retention/adoption UI | 5 |
| **Total** | | **55** |

---

## Critical Path

1. P.1 (split + ISO week) → 1.1 (body) → 1.2 (detectAITools) → 2.1 (aggregation) → 2.2 (trends) → 3.1/3.2/3.3 (report)
2. P.1.7 (ISO week) must complete before 2.2
3. 3.3 (display names) can run in parallel with 3.1/3.2

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ISO week migration changes trend shape | M | M | Compare before/after |
| Git log format change breaks parsing | M | H | Test with Co-authored-by repos |
| Tool patterns miss real usage | H | M | "Other" bucket; iterate post-MVP |
| Retention/adoption slow on large repos | M | M | Limit to last 1000 when ≥50k |
| stats-calculator split introduces bugs | M | H | Manual regression testing |

---

## Decisions Log

| # | Decision | Choice |
|---|----------|--------|
| 1 | ISO week scope | Migrate all trend logic to ISO week |
| 2 | Adoption branch | Current branch; detached HEAD → main/master |
| 3 | Phase 2 retention | Revert-only |
| 4 | Tool display names | Add mapping |
| 5 | package.json start | Fix in prerequisite |

---

## Review Status

| Phase | Status | Notes |
|-------|--------|-------|
| **Dev Review** | ✅ Completed (2026-03-11) | See `04-dev-reviewed.md` |
| **Result** | Pass with Risk | Fix M1 (revert detection) before QA recommended |
| **QA** | Pending | Ready after M1 addressed |

---

*Version*: 1.1 (Final)
*Date*: 2026-03-11
*Based on*: PRD v1.0, Architecture v1.0
