import type {
  BaselineSummary,
  CommitStats,
  HistorySnapshot,
  InsightItem,
  MetricBaseline,
  SnapshotMetricKey,
} from '../types/index.js';

/** 基于当前结果与历史基线生成首页异常摘要 */
export function generateInsights(
  currentSnapshot: HistorySnapshot,
  baseline: BaselineSummary,
  stats: CommitStats
): InsightItem[] {
  const insights: InsightItem[] = [];

  pushIfExists(insights, buildActivityDropInsight(baseline));
  pushIfExists(insights, buildAISpikeInsight(baseline));
  pushIfExists(insights, buildPressureInsight(currentSnapshot));
  pushIfExists(insights, buildBusFactorInsight(currentSnapshot));
  pushIfExists(insights, buildRiskFilesInsight(baseline, stats));
  pushIfExists(insights, buildStaleBranchesInsight(currentSnapshot));

  return insights
    .sort((a, b) => compareSeverity(b.severity) - compareSeverity(a.severity))
    .slice(0, 5);
}

function buildActivityDropInsight(
  baseline: BaselineSummary
): InsightItem | undefined {
  const metric = getPreferredBaseline(baseline, 'activeAuthors');
  if (!metric?.changePercentage || metric.changePercentage > -30) {
    return undefined;
  }

  return {
    id: 'activity-drop',
    category: 'activity',
    severity: metric.changePercentage <= -50 ? 'critical' : 'warning',
    title: '活跃作者明显下降',
    evidence: `活跃作者较上一个观察周期下降 ${Math.abs(metric.changePercentage).toFixed(1)}%，从 ${metric.previous} 人降到 ${metric.current} 人。`,
    impact: '团队负载可能开始集中，交付弹性和知识分散度都会下降。',
    suggestion: '优先检查任务是否过度集中到少数成员，并评估是否需要重新分配模块责任。',
  };
}

function buildAISpikeInsight(
  baseline: BaselineSummary
): InsightItem | undefined {
  const metric = getPreferredBaseline(baseline, 'aiPercentage');
  if (
    metric?.previous === undefined ||
    metric.changePercentage === undefined ||
    metric.current - metric.previous < 8
  ) {
    return undefined;
  }

  return {
    id: 'ai-spike',
    category: 'ai',
    severity: metric.current >= 35 ? 'warning' : 'info',
    title: 'AI 代码占比短期抬升',
    evidence: `AI 代码占比较上一个观察周期从 ${metric.previous.toFixed(1)}% 提升到 ${metric.current.toFixed(1)}%。`,
    impact: '若评审和回归验证没有同步加强，后续返工与稳定性风险可能上升。',
    suggestion: '建议对高 AI 占比目录增加代码评审强度，并抽样复核近期高 AI 提交。',
  };
}

function buildPressureInsight(
  currentSnapshot: HistorySnapshot
): InsightItem | undefined {
  const pressureScore = currentSnapshot.metrics.pressureScore;
  if (typeof pressureScore !== 'number' || pressureScore < 70) {
    return undefined;
  }

  return {
    id: 'pressure-high',
    category: 'stability',
    severity: pressureScore >= 85 ? 'critical' : 'warning',
    title: '团队压力指数偏高',
    evidence: `当前压力指数为 ${pressureScore.toFixed(0)}/100，已超过预警阈值。`,
    impact: '持续的非工作时间开发会影响稳定性、质量和团队可持续性。',
    suggestion: '建议检查排期与发布节奏，确认是否存在集中冲刺或救火型开发。',
  };
}

function buildBusFactorInsight(
  currentSnapshot: HistorySnapshot
): InsightItem | undefined {
  const busFactor = currentSnapshot.metrics.busFactor;
  if (typeof busFactor !== 'number' || busFactor > 2) {
    return undefined;
  }

  return {
    id: 'bus-factor-low',
    category: 'team',
    severity: busFactor <= 1 ? 'critical' : 'warning',
    title: '关键知识集中度偏高',
    evidence: `当前 Bus Factor 为 ${busFactor.toFixed(0)}，关键模块依赖的核心成员过少。`,
    impact: '一旦关键成员请假、离岗或切换项目，核心模块交付可能受到直接影响。',
    suggestion: '建议优先安排关键模块轮值、结对开发和文档补齐，降低单点依赖。',
  };
}

function buildRiskFilesInsight(
  baseline: BaselineSummary,
  stats: CommitStats
): InsightItem | undefined {
  const metric = getPreferredBaseline(baseline, 'highRiskFiles');
  if (
    !metric ||
    metric.previous === undefined ||
    metric.changePercentage === undefined ||
    metric.changePercentage < 20 ||
    metric.current < 3
  ) {
    return undefined;
  }

  const action = stats.techDebt?.actionItems[0];
  return {
    id: 'risk-files-increase',
    category: 'debt',
    severity: metric.current >= 10 ? 'critical' : 'warning',
    title: '高风险文件数量上升',
    evidence: `高风险文件数较上一个观察周期增长 ${metric.changePercentage.toFixed(1)}%，当前为 ${metric.current} 个。`,
    impact: '技术债开始集中累积，后续缺陷修复和迭代速度都可能受影响。',
    suggestion: action
      ? `优先处理 ${action.file}，建议动作：${action.suggestedAction}。`
      : '建议优先治理风险最高的目录或文件，并安排一次小范围技术债清理。',
  };
}

function buildStaleBranchesInsight(
  currentSnapshot: HistorySnapshot
): InsightItem | undefined {
  const staleBranches = currentSnapshot.metrics.staleBranches;
  if (typeof staleBranches !== 'number' || staleBranches < 10) {
    return undefined;
  }

  return {
    id: 'stale-branches',
    category: 'branch',
    severity: staleBranches >= 20 ? 'warning' : 'info',
    title: '陈旧分支数量偏多',
    evidence: `当前长期未合并分支达到 ${staleBranches} 个。`,
    impact: '分支积压会增加合并成本，也容易掩盖失效需求和无人维护的开发线。',
    suggestion: '建议本周安排一次分支清理，确认哪些分支需要合并、归档或删除。',
  };
}

function getPreferredBaseline(
  baseline: BaselineSummary,
  metric: SnapshotMetricKey
): MetricBaseline | undefined {
  return baseline.weekly.find((item) => item.metric === metric && item.trend !== 'insufficient')
    || baseline.monthly.find((item) => item.metric === metric && item.trend !== 'insufficient')
    || baseline.weekly.find((item) => item.metric === metric)
    || baseline.monthly.find((item) => item.metric === metric);
}

function pushIfExists(
  insights: InsightItem[],
  insight?: InsightItem
): void {
  if (insight) {
    insights.push(insight);
  }
}

function compareSeverity(severity: InsightItem['severity']): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}
