import type { CommitStats, BusiestDay } from '../types/index.js';

/**
 * 合并基础统计数据
 */
export function mergeBasicStats(merged: CommitStats, stats: CommitStats): void {
  merged.totalCommits += stats.totalCommits;
  merged.linesAdded += stats.linesAdded;
  merged.linesDeleted += stats.linesDeleted;
  merged.filesChanged += stats.filesChanged;

  if (!merged.firstCommitDate || stats.firstCommitDate < merged.firstCommitDate) {
    merged.firstCommitDate = stats.firstCommitDate;
  }
  if (!merged.lastCommitDate || stats.lastCommitDate > merged.lastCommitDate) {
    merged.lastCommitDate = stats.lastCommitDate;
  }

  for (let i = 0; i < 24; i++) {
    merged.hourlyDistribution[i] += stats.hourlyDistribution[i];
  }

  for (const [date, count] of Object.entries(stats.dailyHeatmap)) {
    merged.dailyHeatmap[date] = (merged.dailyHeatmap[date] || 0) + count;
  }
}

/**
 * 计算最忙碌的一天
 */
export function calculateBusiestDay(dailyHeatmap: Record<string, number>): BusiestDay {
  let busiestDay: BusiestDay = { date: '', count: 0 };
  for (const [date, count] of Object.entries(dailyHeatmap)) {
    if (count > busiestDay.count) {
      busiestDay = { date, count };
    }
  }
  return busiestDay;
}
