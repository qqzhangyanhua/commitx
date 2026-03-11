# 产品需求文档：AI 代码工具使用统计 (ai-code-usage-stats)

## Executive Summary

在现有 commit-report 的 AI 检测能力基础上，增加**按 AI 工具维度**的统计，支持 Claude Code、Codex、OpenCode、Gemini、Cursor、Copilot、Codeium、Tabnine 等工具的用量、占比、趋势、实用率等分析，并在 HTML 报告中增加对应可视化。

**范围**：在现有 Git 日志解析与 AI 检测流程上扩展，不改动核心 CLI 与扫描逻辑。

---

## Business Objectives

### Problem Statement

当前 AI 统计只区分「是否疑似 AI 生成」，无法区分具体工具。团队需要：

- 按工具统计使用量
- 对比不同工具的使用率、趋势和分布
- 评估 AI 代码的实用率（保留率、采纳率）
- 为工具选型、合规和成本分析提供数据支撑

### Success Metrics

- **工具识别率**：能识别出 ≥80% 带有明确工具标记的提交
- **报告完整性**：报告中展示各工具用量、占比、趋势、作者分布、实用率
- **向后兼容**：现有 AI 统计逻辑与报告结构保持可用

### Expected ROI

- 支持按工具评估 AI 使用情况
- 为工具采购与策略提供量化依据
- 提升团队对 AI 使用透明度的可见性

---

## User Personas

### Primary Persona: 技术负责人

- **角色**：团队技术负责人 / 架构师
- **目标**：了解各 AI 工具使用占比、趋势、实用率，辅助决策
- **痛点**：当前只能看到整体 AI 占比，无法按工具拆分
- **技术能力**：熟悉 CLI 和 HTML 报告

### Secondary Persona: 开发者

- **角色**：日常使用 AI 工具的开发者
- **目标**：了解自己和团队对不同工具的使用情况
- **痛点**：无法量化自己或团队对不同工具的依赖程度

---

## User Journey Maps

### Journey: 查看各 AI 工具使用统计

1. **触发**：运行 `commit-report` 并生成报告
2. **步骤**：
   - 打开报告，进入 AI 使用分析 Tab
   - 查看「按工具统计」卡片：各工具代码行数、占比
   - 查看工具趋势图：各工具随时间的变化
   - 查看作者维度：每位作者对各工具的使用
   - 查看目录维度：各目录中各工具占比
   - 查看实用率：各工具的代码保留率、采纳率
3. **结果**：获得按工具拆分的 AI 使用全景

---

## Functional Requirements

### Epic 1: 工具识别与分类

#### User Story 1.1: 识别提交中的 AI 工具来源

**As a** 技术负责人
**I want to** 系统能从提交信息中识别出具体 AI 工具
**So that** 可以按工具统计使用量

**Acceptance Criteria:**

- [ ] 支持从 Co-authored-by 和 commit body 中识别工具
- [ ] 内置支持：Claude Code、Codex、OpenCode、Gemini、Cursor、Copilot、Codeium、Tabnine 等
- [ ] 单次提交可识别多个工具
- [ ] 无法识别时归为「其他」类别统计
- [ ] 仅使用内置规则，无需用户自定义配置

#### User Story 1.2: 获取完整提交信息用于工具识别

**As a** 系统
**I want to** 解析完整 commit message（含 body）
**So that** 能正确解析 Co-authored-by 等 trailer

**Acceptance Criteria:**

- [ ] Git log 格式包含 commit body（如 `%b`）
- [ ] 解析逻辑能区分 header、body 与 numstat
- [ ] 保持对现有解析逻辑的兼容性

---

### Epic 2: 按工具维度的统计计算

#### User Story 2.1: 按工具聚合用量

**As a** 技术负责人
**I want to** 看到各 AI 工具的代码行数、提交数
**So that** 能比较各工具使用量

**Acceptance Criteria:**

- [ ] 新增 `ToolAIMetrics`：per-tool 的 totalLines、aiLines、commits
- [ ] 多工具单次提交：每个工具各计一次（行数重复计入）
- [ ] 支持多仓库合并时的 per-tool 聚合
- [ ] 与现有 `AIMetrics` 保持兼容

#### User Story 2.2: 按工具的趋势统计

**As a** 技术负责人
**I want to** 看到各工具随时间的变化
**So that** 能分析工具采用趋势

**Acceptance Criteria:**

- [ ] 新增 `ToolAITrendPoint`：per-tool 的周度 aiLines、aiPercentage
- [ ] 支持多工具趋势对比的可视化数据

#### User Story 2.3: 按作者的工具使用统计

**As a** 开发者
**I want to** 看到每位作者对各工具的使用
**So that** 能了解个人和团队的工具偏好

**Acceptance Criteria:**

- [ ] 新增 `AuthorToolAIStats`：per-author、per-tool 的 aiLines、totalLines、aiPercentage
- [ ] 支持在报告中展示作者 × 工具矩阵

#### User Story 2.4: 按目录的工具使用统计

**As a** 技术负责人
**I want to** 看到各目录中各工具占比
**So that** 能分析不同模块的工具使用差异

**Acceptance Criteria:**

- [ ] 扩展 `DirectoryAIStats` 或新增 `DirectoryToolAIStats`：per-directory、per-tool
- [ ] 支持目录级工具分布展示

---

### Epic 3: 实用率指标

#### User Story 3.1: 代码保留率

**As a** 技术负责人
**I want to** 看到 AI 生成代码的保留率
**So that** 能评估 AI 代码是否被 revert 或重写

**Acceptance Criteria:**

- [ ] **代码保留率**：AI 生成代码未被 revert/重写的比例
- [ ] 检测 revert：通过 `git revert` 或包含 "Revert" 的提交识别被撤销的提交
- [ ] 检测重写：通过后续提交对同一文件/行的覆盖或删除识别
- [ ] 支持 per-tool 的保留率
- [ ] 在报告中展示该指标

#### User Story 3.2: 代码采纳率

**As a** 技术负责人
**I want to** 看到 AI 生成代码的采纳率
**So that** 能评估 AI 代码被纳入主线的比例

**Acceptance Criteria:**

- [ ] **代码采纳率**：已合并到默认分支（main/master）的提交占比
- [ ] 简化定义：不区分是否经过 PR review，仅以「是否在默认分支上」为采纳标准
- [ ] 实现方式：通过 Git 判断提交是否在默认分支的祖先链中
- [ ] 支持 per-tool 的采纳率
- [ ] 在报告中展示该指标

---

### Epic 4: 报告可视化

#### User Story 4.1: 按工具统计卡片

**As a** 用户
**I want to** 在报告中看到各工具用量卡片
**So that** 能快速对比各工具使用情况

**Acceptance Criteria:**

- [ ] 新增「按工具统计」区域
- [ ] 展示各工具：代码行数、占比、提交数
- [ ] 支持饼图或条形图对比

#### User Story 4.2: 工具趋势图

**As a** 用户
**I want to** 看到各工具随时间的变化
**So that** 能分析采用趋势

**Acceptance Criteria:**

- [ ] 新增多工具趋势折线图
- [ ] 支持工具筛选或图例切换

#### User Story 4.3: 作者 × 工具矩阵

**As a** 用户
**I want to** 看到作者与工具的交叉统计
**So that** 能了解团队工具使用分布

**Acceptance Criteria:**

- [ ] 表格或热力图展示作者 × 工具
- [ ] 支持按工具或作者排序

#### User Story 4.4: 实用率展示

**As a** 用户
**I want to** 看到各工具的保留率和采纳率
**So that** 能评估 AI 代码的实际价值

**Acceptance Criteria:**

- [ ] 在按工具统计区域展示保留率、采纳率
- [ ] 支持 per-tool 的实用率对比

---

## Non-Functional Requirements

### Performance

- 工具识别与统计在单遍扫描中完成，避免多次遍历 commits
- 大型仓库（>10k commits）下报告生成时间增加 <20%
- 保留率、采纳率计算需额外 Git 操作，需评估性能影响

### Security

- 不改变现有 XSS 转义逻辑
- 工具名称等来自 commit message 的文本需安全转义

### Usability

- 与现有 AI 统计 Tab 风格一致
- 支持深色/浅色主题

---

## Technical Constraints

### 前置条件：Git Log 格式

- **现状**：`git-log-parser.ts` 使用 `%s`，仅解析 subject，不含 body
- **影响**：Co-authored-by 通常在 body，当前无法获取
- **方案**：将格式改为包含 `%b`，并调整解析逻辑以区分 header、body、numstat

### 内置工具识别规则

| 工具 | Co-authored-by / Body 模式 |
|------|----------------------------|
| Claude Code | `Claude <noreply@anthropic.com>`, `Generated with [Claude Code]` |
| Codex | `codex`, `openai` |
| OpenCode | `opencode` |
| Gemini | `gemini`, `google` |
| Cursor | `cursor` |
| Copilot | `copilot` |
| Codeium | `codeium` |
| Tabnine | `tabnine` |
| 其他 | 无法匹配上述规则时归入「其他」 |

### 代码保留率实现思路

- **Revert 检测**：解析 commit message 中的 `Revert "..."` 或 `git show` 获取 revert 目标
- **重写检测**：对 AI 提交涉及的文件做后续 blame，统计被覆盖/删除的行比例

### 代码采纳率实现思路

- **定义**：已合并到默认分支（main/master）的提交视为采纳
- **实现**：通过 `git branch -a --contains <commit>` 或判断提交是否在默认分支的祖先链中
- **默认分支**：自动检测 main/master，或通过配置指定
- **数据来源**：仅依赖 Git，无需外部 API

---

## Scope & Phasing

### MVP (Phase 1)

- Git log 解析支持 commit body
- 工具识别：Claude Code、Codex、OpenCode、Gemini、Cursor、Copilot、Codeium、Tabnine
- 按工具聚合：totalLines、aiLines、commits、aiPercentage
- 按工具趋势：周度数据
- 报告：工具用量卡片 + 工具趋势图
- 无法识别 →「其他」；多工具 → 行数重复计入

### Phase 2

- 作者 × 工具、目录 × 工具统计
- 作者 × 工具矩阵可视化
- 代码保留率（revert + 重写检测）
- 代码采纳率（默认分支检测，纯 Git 实现）
- 实用率在报告中的完整展示

### Phase 3

- 性能优化（大型仓库下的保留率、采纳率计算）
- 工具识别规则微调与扩展

---

## Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 部分工具无标准 Co-authored-by 格式 | 高 | 中 | 支持多种模式；无法识别时归为「其他」 |
| Git log 格式变更影响解析 | 中 | 高 | 充分测试；保留向后兼容路径 |
| 保留率计算需额外 Git 操作 | 中 | 中 | 评估性能，优先采用高效算法 |
| 重写检测实现复杂 | 中 | 中 | 可先实现 revert 检测，重写检测作为增强 |
| 多分支仓库的默认分支判定 | 低 | 低 | 优先 main/master，支持配置覆盖 |

---

## Dependencies

- Git log 格式与解析逻辑的修改（Epic 1.2）
- 各 AI 工具实际 commit 格式的调研与验证

---

## Appendix

### Glossary

- **工具识别**：从 commit message 中判断该提交由哪个 AI 工具参与生成
- **代码保留率**：AI 生成代码未被 revert 或重写的比例
- **代码采纳率**：已合并到默认分支的提交占比（不区分是否经过 review）
- **Per-tool**：按 AI 工具维度拆分
- **其他**：无法识别具体工具时的归类

### References

- 现有 `ai-detector.ts` 中的 Co-authored-by 与工具模式
- 仓库扫描报告：`.claude/specs/ai-code-usage-stats/00-repo-scan.md`

---

*文档版本*: 1.0 (Final)
*日期*: 2026-03-11
*作者*: Sarah (BMAD Product Owner)
*质量评分*: 92/100
*状态*: 已定稿
