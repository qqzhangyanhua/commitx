// ============================================================
// commit-report 类型定义
// ============================================================

/** 单条 Git 提交记录 */
export interface CommitRecord {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: FileChange[];
}

/** 单个文件的变更信息 */
export interface FileChange {
  added: number;
  deleted: number;
  path: string;
}

/** 作者统计信息 */
export interface AuthorStats {
  name: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  lastActiveDate: Date;
}

/** 文件类型统计 */
export interface FileTypeStats {
  extension: string;
  added: number;
  deleted: number;
  fileCount: number;
}

/** 目录统计 */
export interface DirectoryStats {
  path: string;
  commits: number;
  linesChanged: number;
}

// ============================================================
// 扩展统计类型
// ============================================================

/** 热点文件 */
export interface HotFile {
  path: string;
  modifyCount: number;
  authors: string[];
}

/** 代码质量指标 */
export interface QualityMetrics {
  avgFilesPerCommit: number;
  avgLinesPerCommit: number;
  churnRate: number;
  hotFiles: HotFile[];
}

/** 时间分布作者统计 */
export interface TimeAuthorStats {
  count: number;
  authors: Record<string, number>; // 作者名 -> 提交数
}

/** 时间模式指标 */
export interface TimePatterns {
  weekdayDistribution: number[];
  weekendCommits: number;
  avgCommitInterval: number;
  longestStreak: number;
  currentStreak: number;
  weekdayByAuthor?: TimeAuthorStats[]; // 7个元素，对应周一到周日
}

/** 周趋势数据点 */
export interface WeeklyPoint {
  week: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
}

/** 累计代码量数据点 */
export interface CumulativePoint {
  date: string;
  netLines: number;
}

/** 趋势数据 */
export interface TrendData {
  weeklyTrend: WeeklyPoint[];
  cumulativeLines: CumulativePoint[];
}

/** 单人维护文件（知识集中度风险） */
export interface SoloFile {
  path: string;
  author: string;
  commits: number;
}

/** 协作热点文件 */
export interface CollabFile {
  path: string;
  authorCount: number;
  totalCommits: number;
}

/** 协作指标 */
export interface CollaborationMetrics {
  soloFiles: SoloFile[];
  collaborationHotspots: CollabFile[];
}

/** Commit Message 分析 */
export interface CommitMessageStats {
  typeDistribution: Record<string, number>;
  avgMessageLength: number;
}

/** 作者文件类型贡献 */
export interface AuthorFileTypeContribution {
  author: string;
  email: string;
  extension: string;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
  fileCount: number;
}

/** 最繁忙的一天 */
export interface BusiestDay {
  date: string;
  count: number;
}

/** 核心统计指标 */
export interface CommitStats {
  // 基础统计
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;

  // 时间维度
  firstCommitDate: Date;
  lastCommitDate: Date;
  busiestDay: BusiestDay;

  // 作者维度
  authors: AuthorStats[];

  // 文件类型维度
  fileTypes: FileTypeStats[];

  // 目录维度
  directories: DirectoryStats[];

  // 时间分布
  hourlyDistribution: number[];
  dailyHeatmap: Record<string, number>;
  hourlyByAuthor?: TimeAuthorStats[]; // 24个元素，对应0-23点

  // 扩展统计维度
  quality: QualityMetrics;
  timePatterns: TimePatterns;
  trends: TrendData;
  collaboration: CollaborationMetrics;
  messageStats: CommitMessageStats;
  authorFileTypeContributions: AuthorFileTypeContribution[];

  // 高级统计（可选，向后兼容）
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
  techDebt?: TechDebtStats;

  // AI 使用统计（可选）
  aiMetrics?: AIMetrics;
  authorAIStats?: AuthorAIStats[];
  directoryAIStats?: DirectoryAIStats[];
  aiTrends?: AITrendPoint[];
  toolAIMetrics?: ToolAIMetrics[];
  toolAITrends?: ToolAITrendPoint[];
  authorToolAIStats?: AuthorToolAIStats[];
  directoryToolAIStats?: DirectoryToolAIStats[];
  toolRetentionAdoption?: ToolRetentionAdoption[];

  // 分支分析（可选）
  branchStats?: BranchStats;
}

/** 分支统计 */
export interface BranchStats {
  activeBranches: number;
  staleBranches: StaleBranch[];
  avgBranchLifespanDays: number;
  mergeFrequency: MergeFrequencyPoint[];
  totalMerges: number;
}

/** 长期未合并分支 */
export interface StaleBranch {
  name: string;
  lastCommitDate: string;
  daysSinceLastCommit: number;
  author: string;
}

/** 合并频率趋势点 */
export interface MergeFrequencyPoint {
  week: string;
  merges: number;
}

/** 仓库信息 */
export interface RepoInfo {
  path: string;
  name: string;
  commitCount: number;
}

/** 输出格式 */
export type ReportFormat = 'html' | 'json' | 'markdown';

/** CLI 参数类型 */
export interface CliOptions {
  period: string;
  from?: string;
  to?: string;
  author?: string;
  output: string;
  open: boolean;
  depth: number;
  format: ReportFormat;
  quiet: boolean;
  compare?: string;
  template?: string;
  config?: string;
  alias?: string;
}

/** CLI 原始参数 */
export type CliRawOptions = Partial<Record<keyof CliOptions, unknown>>;

/** 时间范围 */
export interface TimeRange {
  from: Date;
  to: Date;
}

/** 扫描配置 */
export interface ScanOptions {
  targetDir: string;
  maxDepth: number;
}

/** 分析配置 */
export interface AnalyzeOptions {
  repos: RepoInfo[];
  timeRange: TimeRange | null;
  author?: string;
  quiet?: boolean;
}

/** 作者别名配置 */
export interface AuthorAlias {
  canonical: string;
  email: string;
  aliases: Array<{ name?: string; email?: string }>;
}

/** 配置文件格式 */
export interface ConfigFile {
  period?: string;
  output?: string;
  format?: ReportFormat;
  depth?: number;
  quiet?: boolean;
  template?: string;
  authorAliases?: AuthorAlias[];
  exclude?: string[];
}

/** 报告配置 */
export interface ReportOptions {
  outputPath: string;
  autoOpen: boolean;
  timeRange: TimeRange | null;
  repoNames: string[];
  format: ReportFormat;
  quiet: boolean;
  templatePath?: string;
  compare?: CompareResult;
  baseline?: BaselineSummary;
  insights?: InsightItem[];
}

/** 对比结果中的 delta 维度 */
export interface DeltaValue {
  value: number;
  percentage: number;
}

/** 对比分析结果 */
export interface CompareResult {
  currentPeriod: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  delta: {
    commits: DeltaValue;
    linesAdded: DeltaValue;
    linesDeleted: DeltaValue;
    activeAuthors: DeltaValue;
    filesChanged: DeltaValue;
  };
  highlights: string[];
}

/** 传递给 HTML 模板的完整数据 */
export interface ReportData {
  stats: Record<string, unknown>;
  generatedAt: string;
  timeRange: {
    from: string;
    to: string;
  } | null;
  repos: string[];
  compare?: CompareResult;
  baseline?: BaselineSummary;
  insights?: InsightItem[];
}

// ============================================================
// 历史快照与洞察类型
// ============================================================

/** 快照指标键 */
export type SnapshotMetricKey =
  | 'totalCommits'
  | 'linesAdded'
  | 'linesDeleted'
  | 'activeAuthors'
  | 'filesChanged'
  | 'aiPercentage'
  | 'busFactor'
  | 'stabilityScore'
  | 'pressureScore'
  | 'highRiskFiles'
  | 'staleBranches';

/** 历史快照中的聚合指标 */
export interface SnapshotMetrics {
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  activeAuthors: number;
  filesChanged: number;
  aiPercentage?: number;
  busFactor?: number;
  stabilityScore?: number;
  pressureScore?: number;
  highRiskFiles?: number;
  staleBranches?: number;
}

/** 历史快照 */
export interface HistorySnapshot {
  schemaVersion: number;
  repoKey: string;
  repoNames: string[];
  generatedAt: string;
  range: {
    from?: string;
    to?: string;
    period?: string;
  };
  metrics: SnapshotMetrics;
}

/** 单项趋势基线 */
export interface MetricBaseline {
  metric: SnapshotMetricKey;
  current: number;
  previous?: number;
  average?: number;
  changePercentage?: number;
  trend: 'up' | 'down' | 'flat' | 'insufficient';
}

/** 周/月趋势基线汇总 */
export interface BaselineSummary {
  weekly: MetricBaseline[];
  monthly: MetricBaseline[];
}

/** 首页异常摘要 */
export interface InsightItem {
  id: string;
  category: 'activity' | 'ai' | 'stability' | 'team' | 'branch' | 'debt';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  evidence: string;
  impact: string;
  suggestion: string;
}

// ============================================================
// 高级统计类型（新增）
// ============================================================

/** 团队健康度指标 */
export interface TeamHealthMetrics {
  busFactor: number;
  criticalAuthors: CriticalAuthor[];
  knowledgeDistribution: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CriticalAuthor {
  name: string;
  email: string;
  uniqueFiles: string[];
  dominantFiles: string[];
  knowledgeScore: number;
}

/** 代码稳定性指标 */
export interface StabilityMetrics {
  fileChurnRate: FileChurn[];
  directoryChurnRate: DirectoryChurn[];
  revertRate: number;
  fixCommitRate: number;
  stabilityScore: number;
}

export interface FileChurn {
  path: string;
  added: number;
  deleted: number;
  churnRate: number;
  modifyCount: number;
  isUnstable: boolean;
}

export interface DirectoryChurn {
  path: string;
  churnRate: number;
  totalChanges: number;
  fileCount: number;
}

/** 工作压力指标 */
export interface WorkPressureMetrics {
  lateNightCommits: number;
  earlyMorningCommits: number;
  weekendCommits: number;
  holidayCommits: HolidayCommit[];
  pressureScore: number;
  offHoursRate: number;
}

export interface HolidayCommit {
  date: string;
  holidayName: string;
  commits: number;
}

/** 贡献者流失指标 */
export interface ContributorChurnMetrics {
  active: AuthorDetail[];
  occasional: AuthorDetail[];
  dormant: AuthorDetail[];
  lost: AuthorDetail[];
  newJoiners: AuthorDetail[];
  churnRate: number;
  retentionRate: number;
  growthRate: number;
}

export interface AuthorDetail {
  name: string;
  email: string;
  lastCommitDate: Date;
  daysSinceLastCommit: number;
  totalCommits: number;
}

/** 高级协作指标 */
export interface AdvancedCollaborationMetrics {
  tightCoupling: FilePair[];
  frequentPairs: FilePair[];
  pairProgramming: AuthorPair[];
  couplingScore: number;
}

export interface FilePair {
  file1: string;
  file2: string;
  coOccurrence: number;
  coupling: number;
}

export interface AuthorPair {
  author1: string;
  author2: string;
  sharedFiles: string[];
  collaborationCount: number;
}

// ============================================================
// AI 使用统计类型
// ============================================================

/** AI 统计指标 */
export interface AIMetrics {
  totalAILines: number;
  totalLines: number;
  aiPercentage: number;
  suspiciousCommits: number;
  highAICommits: AICommit[];
}

/** AI 提交记录 */
export interface AICommit {
  hash: string;
  author: string;
  date: Date;
  aiScore: number;
  linesAdded: number;
  filesCount: number;
  message: string;
}

/** 作者 AI 统计 */
export interface AuthorAIStats {
  author: string;
  email: string;
  aiLines: number;
  totalLines: number;
  aiPercentage: number;
}

/** 目录 AI 统计 */
export interface DirectoryAIStats {
  path: string;
  commits: number;
  aiLines: number;
  totalLines: number;
  aiPercentage: number;
  lastModified: Date;
  isHighRisk: boolean;
}

/** AI 趋势数据点 */
export interface AITrendPoint {
  week: string;
  aiLines: number;
  totalLines: number;
  aiPercentage: number;
}

// ============================================================
// AI 工具使用统计类型 (Phase 1)
// ============================================================

/** AI 工具 ID */
export type AIToolId =
  | 'claude-code'
  | 'codex'
  | 'opencode'
  | 'gemini'
  | 'cursor'
  | 'copilot'
  | 'codeium'
  | 'tabnine'
  | 'other';

/** 按工具维度的 AI 指标 */
export interface ToolAIMetrics {
  toolId: AIToolId;
  totalLines: number;
  aiLines: number;
  commits: number;
  aiPercentage: number;
}

/** 按工具维度的趋势数据点 */
export interface ToolAITrendPoint {
  week: string;
  toolId: AIToolId;
  aiLines: number;
  totalLines: number;
  aiPercentage: number;
}

// ============================================================
// AI 工具使用统计类型 (Phase 2)
// ============================================================

/** 作者 × 工具 AI 统计 */
export interface AuthorToolAIStats {
  author: string;
  email: string;
  toolId: AIToolId;
  aiLines: number;
  totalLines: number;
  aiPercentage: number;
}

/** 目录 × 工具 AI 统计 */
export interface DirectoryToolAIStats {
  path: string;
  toolId: AIToolId;
  aiLines: number;
  totalLines: number;
  commits: number;
  aiPercentage: number;
}

/** 工具保留率与采纳率 */
export interface ToolRetentionAdoption {
  toolId: AIToolId;
  retentionRate: number;
  adoptionRate: number;
}

// ============================================================
// 技术债分析类型
// ============================================================

/** 技术债统计结果 */
export interface TechDebtStats {
  radar: RadarDimension[];
  highRiskFiles: RiskFile[];
  aiDetection: AIDetectionResult;
  duplication: DuplicationResult;
  trends: TrendPoint[];
  actionItems: ActionItem[];
}

/** 雷达图维度数据 */
export interface RadarDimension {
  dimension: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
  affectedFiles: number;
}

/** 高风险文件信息 */
export interface RiskFile {
  path: string;
  riskScore: number;
  complexity: number;
  churnRate: number;
  testCoverage: number;
  knowledgeRisk: number;
  primaryAuthor: string;
  lastModified: Date;
}

/** AI 代码检测结果 */
export interface AIDetectionResult {
  suspiciousFiles: SuspiciousFile[];
  totalSuspicious: number;
}

/** 疑似问题文件 */
export interface SuspiciousFile {
  file?: string;
  commit?: string;
  reason: string;
  score: number;
  description?: string;
}

/** 代码重复检测结果 */
export interface DuplicationResult {
  clusters: DuplicationCluster[];
  fileScores: DuplicationFileScore[];
}

/** 代码重复簇 */
export interface DuplicationCluster {
  files: string[];
  similarity: number;
  lines: number;
}

/** 文件重复度分数 */
export interface DuplicationFileScore {
  file: string;
  score: number;
}

/** 技术债趋势数据点 */
export interface TrendPoint {
  date: string;
  debt: number;
}

/** 治理建议项 */
export interface ActionItem {
  file: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  impact: number;
  effort: number;
  priority: number;
  suggestedAction: string;
  owner: string;
}
