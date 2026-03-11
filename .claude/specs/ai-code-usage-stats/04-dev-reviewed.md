# Dev Review Report: AI Code Usage Stats (ai-code-usage-stats)

**Review Date**: 2026-03-11  
**Reviewer**: BMAD Review Agent  
**Review Iteration**: 1

---

## 1. Summary

| Attribute | Value |
|-----------|-------|
| **Status** | **Pass with Risk** |
| **Build** | ✅ Passes (`pnpm build`) |
| **TypeScript** | ✅ Strict mode compliant |
| **Files Reviewed** | 13 (5 new, 8 modified) |

### Verdict

Implementation aligns with PRD and architecture. Core features (tool detection, per-tool aggregation, trends, report UI) are correctly implemented. Several issues require attention before QA: revert detection logic bug, toolRetentionAdoption merge formula for future multi-repo, and stats-calculator slightly over 500 lines.

---

## 2. Requirements Compliance

### Epic 1: Tool Identification & Classification ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| Co-authored-by and body parsing | ✅ | `git-log-parser.ts` includes `%b`, body parsing, 64KB cap |
| Built-in tools (Claude, Codex, etc.) | ✅ | `ai-detector.ts` TOOL_DETECTION_PATTERNS covers all 8 + other |
| Multi-tool per commit | ✅ | `detectAITools()` returns array, each tool counted |
| "Other" when no match | ✅ | `effectiveTools = tools.length > 0 ? tools : (aiScore > 0 ? ['other'] : [])` |
| No user config | ✅ | All patterns built-in |

### Epic 2: Per-Tool Aggregation ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| ToolAIMetrics (totalLines, aiLines, commits) | ✅ | Single-pass in `ai-stats-calculator.ts` |
| Multi-tool: each gets full line count | ✅ | Lines 81–119: each tool in effectiveTools gets commitLines |
| Multi-repo merge | ✅ | `mergeStats` merges toolAIMetrics, toolAITrends by toolId / week+toolId |
| ToolAITrendPoint (ISO week) | ✅ | Uses `getISOWeekKey` from `time-stats.ts` |
| AuthorToolAIStats, DirectoryToolAIStats | ✅ | Phase 2 implemented |

### Epic 3: Retention & Adoption ✅ (with caveats)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Revert detection | ⚠️ | REVERT_HASH_PATTERN correct; REVERT_SUBJECT_PATTERN logic incorrect (see Issues) |
| Adoption (current branch) | ✅ | `getTargetBranch` uses HEAD, fallback main/master |
| ≥50k commits: last 1000 only | ✅ | `ai-retention-adoption.ts` line 24 |
| Per-tool rates | ✅ | ToolRetentionAdoption per toolId |

### Epic 4: Report Visualization ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| Tool usage cards | ✅ | Bar chart with lines, %, commits |
| Multi-tool trend chart | ✅ | D3 multi-line chart with legend |
| Display name mapping | ✅ | TOOL_DISPLAY_NAMES in report.html |
| Author × tool matrix | ✅ | Table with escapeHtml |
| Directory × tool distribution | ✅ | Table with escapeHtml |
| Retention/adoption UI | ✅ | Cards per tool |
| Conditional rendering | ✅ | `if (!stats.toolAIMetrics \|\| ...) return` |
| XSS safety | ✅ | escapeHtml for author, path, tool names; JSON escaped in html-builder |

---

## 3. Architecture Compliance

| Component | Expected | Actual |
|-----------|----------|--------|
| git-log-parser | `%b`, 64KB cap | ✅ FORMAT includes `%n%b`, BODY_CAP_BYTES = 64*1024 |
| ai-detector | detectAITools(message): string[] | ✅ Returns AIToolId[] |
| ai-stats-calculator | Single-pass, ISO week | ✅ Single loop, getISOWeekKey |
| stats-calculator | Orchestrator + mergeStats | ✅ Split into modules, mergeStats handles all new fields |
| Types | AIToolId, ToolAIMetrics, etc. | ✅ All defined in types/index.ts |
| report.html | Tool cards, trend, matrix | ✅ Implemented |

---

## 4. Issues

### Critical

*None.*

### Major

| ID | Location | Description |
|----|----------|-------------|
| M1 | `ai-retention-adoption.ts` L76–94 | **Revert detection (subject) is wrong**: When matching `Revert "..."`, code adds `c.hash^` (parent of revert commit) to `reverted`. The parent is the commit *before* the revert, not the commit that was reverted. The reverted commit is the one whose changes were undone. Without `This reverts commit <hash>`, the reverted commit cannot be reliably identified from the subject. **Fix**: Either remove the REVERT_SUBJECT_PATTERN branch or use `git show` / `git log` to resolve the reverted commit from the subject. |

### Minor

| ID | Location | Description |
|----|----------|-------------|
| m1 | `stats-calculator.ts` | **File size**: 505 lines (limit 500). Consider moving 5+ lines to a helper or extracted module. |
| m2 | `stats-calculator.ts` L334 | **Unused variable**: `const key = \`${at.email.toLowerCase()}|||${at.toolId}\`;` in authorToolAIStats merge is never used. |
| m3 | `mergeStats` L364–367 | **toolRetentionAdoption merge**: Uses `(existing.retentionRate + tra.retentionRate) / 2`. Correct for 2 repos, wrong for 3+ (not a proper average). Currently only single-repo computes retention, so no impact. Document or fix if multi-repo retention is added. |
| m4 | `ai-retention-adoption.ts` L99–125 | **getTargetBranch**: Returns `'master'` when neither main nor master exists. `isCommitOnBranch` may fail. Consider verifying branch existence or handling this case. |

---

## 5. Code Quality Checklist

| Criterion | Status |
|-----------|--------|
| TypeScript strict mode | ✅ |
| ESM imports with `.js` extension | ✅ |
| File size ≤500 lines | ⚠️ stats-calculator 505 |
| ISO week consistency | ✅ All trend logic uses getISOWeekKey |
| Tool detection patterns | ✅ Matches PRD table |
| "Other" logic (aiScore > 0 only) | ✅ |
| Multi-tool: full line count per tool | ✅ |
| 64KB body cap | ✅ Truncates with `\n...(truncated)` |
| mergeStats for new fields | ✅ toolAIMetrics, toolAITrends, authorToolAIStats, directoryToolAIStats, toolRetentionAdoption |
| XSS safety | ✅ escapeHtml + JSON escape in html-builder |
| Retention/adoption: current branch | ✅ |
| Performance: ≥50k → last 1000 | ✅ |

---

## 6. QA Testing Guide

### Functional Tests

1. **Tool detection**
   - Repo with Co-authored-by (e.g. `Co-authored-by: Copilot <...>`) → copilot in toolAIMetrics
   - Repo with body containing `Generated with [Claude Code]` → claude-code
   - Commit with aiScore > 0 but no tool patterns → `other`
   - Commit with aiScore = 0 → no tools

2. **Per-tool aggregation**
   - Single-tool commit → one tool gets lines
   - Multi-tool commit (e.g. Co-authored-by with 2 tools) → both get full line count
   - Verify toolAIMetrics sum of aiLines vs aiMetrics.totalAILines (may differ due to multi-tool double-counting per PRD)

3. **Trends**
   - toolAITrends week format: `YYYY-Www`
   - Compare with aiTrends for consistency

4. **Retention / adoption**
   - Repo with `This reverts commit <hash>` → reverted commit excluded from retention
   - Repo on main branch → adoption rate reflects commits on main
   - Repo with ≥50k commits → only last 1000 used

5. **Report**
   - Tool section visible when toolAIMetrics exists
   - Tool section hidden when no tool data
   - Author × tool matrix and directory × tool table render correctly
   - Dark/light theme for tool charts

### Regression Tests

- Single-repo vs multi-repo
- Time range filter (e.g. `--period 3m`)
- Author filter
- Compare report before/after for existing AI metrics

### Edge Cases

- Empty repo
- Repo with no AI-like commits
- Very long commit body (>64KB)
- Detached HEAD (main/master fallback)

---

## 7. Sprint Plan Updates

### Completed (mark as done)

- P.1: Split stats-calculator into modules
- P.2: Update mergeStats, imports
- 1.1: Git log body parsing (64KB cap)
- 1.2: detectAITools()
- 1.3: Integrate tool detection with aiScore
- 1.4: Types (AIToolId, ToolAIMetrics, ToolAITrendPoint)
- 2.1: Single-pass tool aggregation
- 2.2: ToolAITrendPoint (ISO week)
- 2.3: mergeStats for tool metrics
- 3.1: Tool usage cards
- 3.2: Multi-tool trend chart
- 3.3: Tool display name mapping
- 3.4: Conditional rendering & XSS
- 4.1–4.5: Author×tool, directory×tool
- 5.1–5.5: Retention, adoption, UI

### Pending (address before QA)

- **M1**: Fix revert detection (REVERT_SUBJECT_PATTERN) in ai-retention-adoption.ts
- **m1**: Reduce stats-calculator to ≤500 lines (optional)
- **m2**: Remove unused `key` variable in mergeStats (optional)

### Review Status

- **Dev Review**: ✅ Completed
- **Ready for QA**: ⚠️ After M1 fix recommended; can proceed with risk if revert detection is low priority

---

## 8. Recommendations

1. **M1**: Fix or remove the REVERT_SUBJECT_PATTERN branch; document that only `This reverts commit <hash>` is supported.
2. **m1**: Trim stats-calculator (e.g. extract a small helper) to meet 500-line limit.
3. **m3**: If multi-repo retention is planned, implement weighted average for toolRetentionAdoption merge.
4. Add unit tests for `detectAITools`, `getISOWeekKey`, and mergeStats tool merging.

---

*Report generated by BMAD Review Agent. Independent of Dev context.*
