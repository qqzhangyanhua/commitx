# 系统架构文档：AI 代码工具使用统计 (ai-code-usage-stats)

## Executive Summary

在现有 commit-report 的 AI 检测管道基础上扩展，增加按 AI 工具维度的统计。设计引入工具识别（Claude Code、Codex、Cursor、Copilot 等）、按工具聚合指标、作者×工具矩阵、目录×工具矩阵、保留率和采纳率。复用现有分析管道和报告模板，变更集中在 git-log-parser、ai-detector、ai-stats-calculator、types 和 report.html。

## 实施顺序

1. **前置条件**: 拆分 `stats-calculator.ts`（≤500 行/文件）
2. **Phase 1 (MVP)**: Git log body 解析、工具检测、按工具聚合统计、趋势图
3. **Phase 2**: 作者×工具矩阵、目录×工具统计、保留率（revert 检测）、采纳率（当前分支）

## 架构概览

### 系统上下文

```
CLI (不变) → Scanner (不变) → Analyzer (扩展) → Reporter (扩展)
```

### 组件变更总览

| 组件 | 变更类型 | 描述 |
|------|----------|------|
| `git-log-parser.ts` | 修改 | 添加 `%b` 解析 body；64KB 上限 |
| `ai-detector.ts` | 扩展 | 新增 `detectAITools(message): string[]` |
| `ai-stats-calculator.ts` | 扩展 | 按工具聚合；保持现有 `calculateAIMetrics` |
| `stats-calculator.ts` | 拆分+修改 | 前置拆分；扩展 `mergeStats` 合并工具指标 |
| `src/types/index.ts` | 扩展 | 新增 `AIToolId`、`ToolAIMetrics`、`ToolAITrendPoint` 等 |
| `templates/report.html` | 扩展 | 新增工具卡片、趋势图、矩阵、实用率展示 |
| `html-builder.ts` | 微调 | 确保新类型序列化 |

---

## 组件详细设计

### 1. Git Log Parser 变更

**格式变更**:
```typescript
// 之前：仅 subject
const FORMAT = `${COMMIT_SEPARATOR}%H|%an|%ae|%aI|%s`;

// 之后：subject + body
const FORMAT = `${COMMIT_SEPARATOR}%H|%an|%ae|%aI|%s%n%b`;
```

**Body 大小限制**: 64KB/commit。超过则截断并追加 `\n...(truncated)`。

**解析逻辑**:
- 第一行: `hash|author|email|date|subject`
- Body: 后续行直到 numstat（blank line 后接 `added\tdeleted\tpath`）
- `CommitRecord.message` = `subject + (body ? '\n' + body : '')`

### 2. 工具检测 (ai-detector.ts)

**新函数**:
```typescript
export function detectAITools(message: string): string[]
```

**工具映射**:

| Tool ID | 匹配模式 |
|---------|----------|
| `claude-code` | `Claude <noreply@anthropic.com>`, `Generated with [Claude Code]` |
| `codex` | `codex`, `openai` |
| `opencode` | `opencode` |
| `gemini` | `gemini`, `google` |
| `cursor` | `cursor` |
| `copilot` | `copilot` |
| `codeium` | `codeium` |
| `tabnine` | `tabnine` |

**「其他」分类**: 仅当 `aiScore > 0` 且 `detectAITools()` 返回空数组时归为 `other`。

**逻辑**:
```typescript
const tools = detectAITools(commit.message);
const aiScore = calculateAIScore(commit);
const effectiveTools = tools.length > 0 ? tools : (aiScore > 0 ? ['other'] : []);
```

### 3. 类型定义 (src/types/index.ts)

**Phase 1 (MVP)**:
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

**Phase 2**:
```typescript
export interface AuthorToolAIStats {
  author: string;
  email: string;
  toolId: AIToolId;
  aiLines: number;
  totalLines: number;
  aiPercentage: number;
}

export interface DirectoryToolAIStats {
  path: string;
  toolId: AIToolId;
  aiLines: number;
  totalLines: number;
  commits: number;
  aiPercentage: number;
}

export interface ToolRetentionAdoption {
  toolId: AIToolId;
  retentionRate: number;
  adoptionRate: number;
}
```

**CommitStats 扩展**:
- Phase 1: `toolAIMetrics?: ToolAIMetrics[]`, `toolAITrends?: ToolAITrendPoint[]`
- Phase 2: `authorToolAIStats?`, `directoryToolAIStats?`, `toolRetentionAdoption?`

### 4. AI Stats Calculator (ai-stats-calculator.ts)

**数据流**:
1. 遍历每个 commit: `tools = detectAITools(commit.message)`
2. 若 `tools.length === 0` 且 `aiScore > 0` → `tools = ['other']`
3. 每个工具各计一次，行数重复计入（PRD 决策）
4. 聚合: `toolAIMetrics`, `toolAITrends`（Phase 1）; `authorToolAIStats`, `directoryToolAIStats`（Phase 2）

**单遍扫描**:
- Maps: `Map<toolId, ToolData>`, `Map<week-toolId, TrendData>`
- Week key: 统一使用 ISO week（与 stats-calculator 一致）

### 5. 保留率与采纳率 (Phase 2)

**保留率**:
- 仅 revert 检测（重写检测后续增强）
- 识别 `Revert "..."` 消息
- Per-tool: 追踪被 revert 提交使用的工具

**采纳率**:
- 定义: 在当前分支祖先链中的提交占比
- 当前分支: `git rev-parse --abbrev-ref HEAD`
- Detached HEAD: 回退到 main/master

**性能**:
- ≥50k 提交: 仅计算最近 1000 条
- <50k 提交: 全量计算

### 6. stats-calculator.ts 拆分（前置条件）

**当前**: ~942 行，超过 500 行上限

**拆分方案**:
- `basic-stats.ts` — 核心统计（提交数、行数等）
- `author-stats.ts` — 作者聚合
- `time-stats.ts` — 时间分布与模式
- `quality-stats.ts` — 质量与协作指标
- `stats-calculator.ts` — 编排入口 + `mergeStats()`

### 7. 合并逻辑 (mergeStats)

- 按 `toolId` 合并 `toolAIMetrics`
- 按 `week + toolId` 合并 `toolAITrends`
- Phase 2: 按 `author + toolId`、`path + toolId` 合并

### 8. 报告模板 (report.html)

**Phase 1 (MVP)**:
- 工具用量卡片: 按工具显示 lines、%、commits（条形图/饼图）
- 工具趋势图: 多折线 D3 图（每工具一条线）

**Phase 2**:
- 作者×工具矩阵（表格或热力图）
- 目录×工具分布
- 保留率/采纳率展示

**条件渲染**: `if (!stats.toolAIMetrics || stats.toolAIMetrics.length === 0) return;`

---

## 数据流图

```
1. 前置: 拆分 stats-calculator.ts
2. parseGitLog (添加 %b, 64KB 上限) → CommitRecord[]
3. 遍历每个 commit:
   - aiScore = calculateAIScore(commit)
   - tools = detectAITools(commit.message)
   - effectiveTools = tools.length > 0 ? tools : (aiScore > 0 ? ['other'] : [])
   - 若 effectiveTools.length > 0: 每个工具归属全量 aiLines
4. 聚合 → toolAIMetrics, toolAITrends (Phase 1)
5. mergeStats() → 按 toolId, week+toolId 合并
6. 报告: 工具卡片 + 趋势图 (Phase 1)
```

---

## 技术决策汇总

| 决策项 | 方案 |
|--------|------|
| Body 大小限制 | 64KB |
| 「其他」范围 | 仅 aiScore > 0 且无已知工具 |
| 保留率 (Phase 2) | 仅 revert 检测 |
| 采纳率分支 | 当前分支（Detached HEAD 回退 main/master） |
| 大型仓库性能 | ≥50k 提交仅计算最近 1000 条 |
| stats-calculator | 先拆分再开发 |
| MVP 范围 | 工具聚合 + 趋势图 |
| Week key | 统一 ISO week |
| 多工具单提交 | 每个工具各计一次（行数重复计入） |

---

*文档版本*: 1.0 (Final)
*日期*: 2026-03-11
*质量评分*: 92/100
*状态*: 已定稿
