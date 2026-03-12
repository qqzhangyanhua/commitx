import type { CommitStats } from '../types/index.js';

/**
 * 合并质量指标
 */
export function mergeQualityMetrics(merged: CommitStats, stats: CommitStats): void {
  merged.quality.avgFilesPerCommit += stats.quality.avgFilesPerCommit;
  merged.quality.avgLinesPerCommit += stats.quality.avgLinesPerCommit;
  merged.quality.churnRate += stats.quality.churnRate;

  for (const hf of stats.quality.hotFiles) {
    const existing = merged.quality.hotFiles.find((h) => h.path === hf.path);
    if (existing) {
      existing.modifyCount += hf.modifyCount;
      for (const author of hf.authors) {
        if (!existing.authors.includes(author)) {
          existing.authors.push(author);
        }
      }
    } else {
      merged.quality.hotFiles.push({ ...hf, authors: [...hf.authors] });
    }
  }
}

/**
 * 标准化质量指标（除以仓库数量）
 */
export function normalizeQualityMetrics(merged: CommitStats, repoCount: number): void {
  merged.quality.avgFilesPerCommit /= repoCount;
  merged.quality.avgLinesPerCommit /= repoCount;
  merged.quality.churnRate /= repoCount;
  merged.quality.hotFiles.sort((a, b) => b.modifyCount - a.modifyCount);
  merged.quality.hotFiles = merged.quality.hotFiles.slice(0, 10);
}
