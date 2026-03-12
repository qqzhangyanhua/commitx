import type { CommitStats } from '../types/index.js';

/**
 * 合并时间模式数据
 */
export function mergeTimePatterns(merged: CommitStats, stats: CommitStats): void {
  for (let i = 0; i < 7; i++) {
    merged.timePatterns.weekdayDistribution[i] += stats.timePatterns.weekdayDistribution[i];
  }
}

/**
 * 合并趋势数据
 */
export function mergeTrends(merged: CommitStats, stats: CommitStats): void {
  for (const wp of stats.trends.weeklyTrend) {
    const existing = merged.trends.weeklyTrend.find((w) => w.week === wp.week);
    if (existing) {
      existing.commits += wp.commits;
      existing.linesAdded += wp.linesAdded;
      existing.linesDeleted += wp.linesDeleted;
    } else {
      merged.trends.weeklyTrend.push({ ...wp });
    }
  }

  for (const cp of stats.trends.cumulativeLines) {
    const existing = merged.trends.cumulativeLines.find((c) => c.date === cp.date);
    if (existing) {
      existing.netLines += cp.netLines;
    } else {
      merged.trends.cumulativeLines.push({ ...cp });
    }
  }
}

/**
 * 标准化时间模式和趋势数据
 */
export function normalizeTimePatterns(merged: CommitStats): void {
  const totalWeekdayCommits = merged.timePatterns.weekdayDistribution.reduce((a, b) => a + b, 0);
  if (totalWeekdayCommits > 0) {
    merged.timePatterns.weekendCommits =
      (merged.timePatterns.weekdayDistribution[5] + merged.timePatterns.weekdayDistribution[6]) /
      totalWeekdayCommits;
  }

  merged.trends.weeklyTrend.sort((a, b) => a.week.localeCompare(b.week));
  merged.trends.cumulativeLines.sort((a, b) => a.date.localeCompare(b.date));

  let cumulative = 0;
  for (const point of merged.trends.cumulativeLines) {
    cumulative += point.netLines;
    point.netLines = cumulative;
  }
}
