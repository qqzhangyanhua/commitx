import type { CommitStats } from '../types/index.js';

/**
 * 合并作者统计数据
 */
export function mergeAuthors(merged: CommitStats, stats: CommitStats): void {
  for (const author of stats.authors) {
    const existing = merged.authors.find(
      (a) => a.email.toLowerCase() === author.email.toLowerCase()
    );
    if (existing) {
      existing.commits += author.commits;
      existing.linesAdded += author.linesAdded;
      existing.linesDeleted += author.linesDeleted;
      if (author.lastActiveDate > existing.lastActiveDate) {
        existing.lastActiveDate = author.lastActiveDate;
      }
    } else {
      merged.authors.push({ ...author });
    }
  }
}

/**
 * 排序作者列表
 */
export function sortAuthors(merged: CommitStats): void {
  merged.authors.sort((a, b) => b.commits - a.commits);
}
