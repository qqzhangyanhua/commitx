import type { CommitStats } from '../types/index.js';

/**
 * 合并文件类型统计数据
 */
export function mergeFileTypes(merged: CommitStats, stats: CommitStats): void {
  for (const ft of stats.fileTypes) {
    const existing = merged.fileTypes.find((f) => f.extension === ft.extension);
    if (existing) {
      existing.added += ft.added;
      existing.deleted += ft.deleted;
      existing.fileCount += ft.fileCount;
    } else {
      merged.fileTypes.push({ ...ft });
    }
  }
}

/**
 * 合并目录统计数据
 */
export function mergeDirectories(merged: CommitStats, stats: CommitStats): void {
  for (const dir of stats.directories) {
    const existing = merged.directories.find((d) => d.path === dir.path);
    if (existing) {
      existing.commits += dir.commits;
      existing.linesChanged += dir.linesChanged;
    } else {
      merged.directories.push({ ...dir });
    }
  }
}

/**
 * 排序并截取文件类型和目录
 */
export function sortFileTypesAndDirectories(merged: CommitStats): void {
  merged.fileTypes.sort((a, b) => b.added + b.deleted - (a.added + a.deleted));
  merged.directories.sort((a, b) => b.linesChanged - a.linesChanged);
  merged.directories = merged.directories.slice(0, 10);
}
