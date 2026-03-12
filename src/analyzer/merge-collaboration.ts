import type { CommitStats } from '../types/index.js';

/**
 * 合并协作指标
 */
export function mergeCollaboration(merged: CommitStats, stats: CommitStats): void {
  for (const sf of stats.collaboration.soloFiles) {
    const existing = merged.collaboration.soloFiles.find((s) => s.path === sf.path);
    if (existing) {
      existing.commits += sf.commits;
    } else {
      merged.collaboration.soloFiles.push({ ...sf });
    }
  }

  for (const ch of stats.collaboration.collaborationHotspots) {
    const existing = merged.collaboration.collaborationHotspots.find((c) => c.path === ch.path);
    if (existing) {
      existing.totalCommits += ch.totalCommits;
      existing.authorCount = Math.max(existing.authorCount, ch.authorCount);
    } else {
      merged.collaboration.collaborationHotspots.push({ ...ch });
    }
  }
}

/**
 * 排序并截取协作数据
 */
export function normalizeCollaboration(merged: CommitStats): void {
  merged.collaboration.soloFiles.sort((a, b) => b.commits - a.commits);
  merged.collaboration.soloFiles = merged.collaboration.soloFiles.slice(0, 10);
  merged.collaboration.collaborationHotspots.sort((a, b) => b.totalCommits - a.totalCommits);
  merged.collaboration.collaborationHotspots = merged.collaboration.collaborationHotspots.slice(0, 10);
}
