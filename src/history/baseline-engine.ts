import type {
  BaselineSummary,
  CommitStats,
  HistorySnapshot,
  MetricBaseline,
  SnapshotMetricKey,
  TimeRange,
} from '../types/index.js';
import { getISOWeekKey, getMonthKey } from '../utils/date-utils.js';

const METRIC_KEYS: SnapshotMetricKey[] = [
  'totalCommits',
  'linesAdded',
  'linesDeleted',
  'activeAuthors',
  'filesChanged',
  'aiPercentage',
  'busFactor',
  'stabilityScore',
  'pressureScore',
  'highRiskFiles',
  'staleBranches',
];

/** 根据当前统计结果生成一份可持久化快照 */
export function buildSnapshotFromStats(params: {
  repoKey: string;
  repoNames: string[];
  stats: CommitStats;
  timeRange: TimeRange | null;
  period?: string;
}): HistorySnapshot {
  const { repoKey, repoNames, stats, timeRange, period } = params;

  return {
    schemaVersion: 1,
    repoKey,
    repoNames,
    generatedAt: new Date().toISOString(),
    range: {
      from: timeRange?.from.toISOString().split('T')[0],
      to: timeRange?.to.toISOString().split('T')[0],
      period,
    },
    metrics: {
      totalCommits: stats.totalCommits,
      linesAdded: stats.linesAdded,
      linesDeleted: stats.linesDeleted,
      activeAuthors: stats.authors.length,
      filesChanged: stats.filesChanged,
      aiPercentage: stats.aiMetrics?.aiPercentage,
      busFactor: stats.teamHealth?.busFactor,
      stabilityScore: stats.stability?.stabilityScore,
      pressureScore: stats.workPressure?.pressureScore,
      highRiskFiles: stats.techDebt?.highRiskFiles.length,
      staleBranches: stats.branchStats?.staleBranches.length,
    },
  };
}

/** 计算周/月趋势基线 */
export function calculateBaselineSummary(
  snapshots: HistorySnapshot[]
): BaselineSummary {
  if (snapshots.length === 0) {
    return { weekly: [], monthly: [] };
  }

  const ordered = [...snapshots].sort(
    (a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
  );
  const current = ordered[ordered.length - 1];

  return {
    weekly: buildWindowBaselines(
      current,
      ordered,
      getISOWeekKey,
      4
    ),
    monthly: buildWindowBaselines(
      current,
      ordered,
      getMonthKey,
      3
    ),
  };
}

function buildWindowBaselines(
  current: HistorySnapshot,
  snapshots: HistorySnapshot[],
  bucketKeyGetter: (date: Date) => string,
  maxBuckets: number
): MetricBaseline[] {
  const historicalSnapshots = snapshots.filter(
    (snapshot) => snapshot.generatedAt !== current.generatedAt
  );
  const currentBucket = bucketKeyGetter(new Date(current.generatedAt));
  const bucketMap = new Map<string, HistorySnapshot>();

  for (const snapshot of historicalSnapshots) {
    const bucketKey = bucketKeyGetter(new Date(snapshot.generatedAt));
    const existing = bucketMap.get(bucketKey);
    if (!existing || new Date(existing.generatedAt) < new Date(snapshot.generatedAt)) {
      bucketMap.set(bucketKey, snapshot);
    }
  }

  const bucketSnapshots = [...bucketMap.entries()]
    .filter(([bucketKey]) => bucketKey !== currentBucket)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, snapshot]) => snapshot)
    .slice(-maxBuckets);
  const fallbackSnapshots = historicalSnapshots.slice(-maxBuckets);
  const previousSnapshots = mergeSnapshotSamples(
    bucketSnapshots,
    fallbackSnapshots,
    maxBuckets
  );

  return METRIC_KEYS
    .filter((metric) => typeof current.metrics[metric] === 'number')
    .map((metric) => buildMetricBaseline(metric, current, previousSnapshots));
}

function mergeSnapshotSamples(
  primary: HistorySnapshot[],
  fallback: HistorySnapshot[],
  limit: number
): HistorySnapshot[] {
  const merged = new Map<string, HistorySnapshot>();

  for (const snapshot of primary) {
    merged.set(snapshot.generatedAt, snapshot);
  }

  for (const snapshot of fallback) {
    if (merged.size >= limit) break;
    merged.set(snapshot.generatedAt, snapshot);
  }

  return [...merged.values()]
    .sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime())
    .slice(-limit);
}

function buildMetricBaseline(
  metric: SnapshotMetricKey,
  current: HistorySnapshot,
  previousSnapshots: HistorySnapshot[]
): MetricBaseline {
  const currentValue = current.metrics[metric];
  if (typeof currentValue !== 'number') {
    return {
      metric,
      current: 0,
      trend: 'insufficient',
    };
  }

  const historyValues = previousSnapshots
    .map((snapshot) => snapshot.metrics[metric])
    .filter((value): value is number => typeof value === 'number');

  if (historyValues.length === 0) {
    return {
      metric,
      current: roundNumber(currentValue),
      trend: 'insufficient',
    };
  }

  const previous = historyValues[historyValues.length - 1];
  const average = historyValues.reduce((sum, value) => sum + value, 0) / historyValues.length;
  const changePercentage = previous === 0
    ? (currentValue === 0 ? 0 : 100)
    : ((currentValue - previous) / previous) * 100;

  let trend: MetricBaseline['trend'] = 'flat';
  if (Math.abs(changePercentage) < 5) {
    trend = 'flat';
  } else if (changePercentage > 0) {
    trend = 'up';
  } else {
    trend = 'down';
  }

  return {
    metric,
    current: roundNumber(currentValue),
    previous: roundNumber(previous),
    average: roundNumber(average),
    changePercentage: roundNumber(changePercentage),
    trend,
  };
}

function roundNumber(value: number): number {
  return Math.round(value * 10) / 10;
}
