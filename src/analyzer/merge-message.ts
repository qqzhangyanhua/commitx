import type { CommitStats, AuthorFileTypeContribution } from '../types/index.js';

/**
 * 合并 commit message 统计
 */
export function mergeMessageStats(merged: CommitStats, stats: CommitStats): void {
  for (const [type, count] of Object.entries(stats.messageStats.typeDistribution)) {
    merged.messageStats.typeDistribution[type] =
      (merged.messageStats.typeDistribution[type] || 0) + count;
  }
  merged.messageStats.avgMessageLength += stats.messageStats.avgMessageLength;
}

/**
 * 合并作者文件类型贡献
 */
export function mergeAuthorFileTypeContributions(
  merged: CommitStats,
  statsList: CommitStats[]
): void {
  const contributionMap = new Map<string, AuthorFileTypeContribution>();
  for (const stats of statsList) {
    for (const contrib of stats.authorFileTypeContributions) {
      const key = `${contrib.email.toLowerCase()}|||${contrib.extension}`;
      const existing = contributionMap.get(key);
      if (existing) {
        existing.linesAdded += contrib.linesAdded;
        existing.linesDeleted += contrib.linesDeleted;
        existing.commits += contrib.commits;
        existing.fileCount += contrib.fileCount;
      } else {
        contributionMap.set(key, { ...contrib });
      }
    }
  }
  merged.authorFileTypeContributions = Array.from(contributionMap.values())
    .sort((a, b) => {
      const totalA = a.linesAdded + a.linesDeleted;
      const totalB = b.linesAdded + b.linesDeleted;
      return totalB - totalA;
    })
    .slice(0, 20);
}

/**
 * 标准化 message 统计
 */
export function normalizeMessageStats(merged: CommitStats, repoCount: number): void {
  merged.messageStats.avgMessageLength /= repoCount;
}
