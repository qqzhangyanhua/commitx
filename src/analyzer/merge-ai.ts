import type { CommitStats } from '../types/index.js';

/**
 * 合并 AI 指标
 */
export function mergeAIMetrics(merged: CommitStats, stats: CommitStats): void {
  if (stats.aiMetrics && merged.aiMetrics) {
    merged.aiMetrics.totalAILines += stats.aiMetrics.totalAILines;
    merged.aiMetrics.totalLines += stats.aiMetrics.totalLines;
    merged.aiMetrics.suspiciousCommits += stats.aiMetrics.suspiciousCommits;

    if (stats.aiMetrics.estimatedRange && merged.aiMetrics.estimatedRange) {
      merged.aiMetrics.estimatedRange.minLines += stats.aiMetrics.estimatedRange.minLines;
      merged.aiMetrics.estimatedRange.maxLines += stats.aiMetrics.estimatedRange.maxLines;
    }

    for (const c of stats.aiMetrics.highAICommits) {
      merged.aiMetrics.highAICommits.push({ ...c });
    }
  }
}

/**
 * 合并作者 AI 统计
 */
export function mergeAuthorAIStats(merged: CommitStats, stats: CommitStats): void {
  if (stats.authorAIStats && merged.authorAIStats) {
    for (const ai of stats.authorAIStats) {
      const existing = merged.authorAIStats.find(
        (a) => a.email.toLowerCase() === ai.email.toLowerCase()
      );
      if (existing) {
        existing.aiLines += ai.aiLines;
        existing.totalLines += ai.totalLines;
      } else {
        merged.authorAIStats.push({ ...ai });
      }
    }
  }
}

/**
 * 合并目录 AI 统计
 */
export function mergeDirectoryAIStats(merged: CommitStats, stats: CommitStats): void {
  if (stats.directoryAIStats && merged.directoryAIStats) {
    for (const dir of stats.directoryAIStats) {
      const existing = merged.directoryAIStats.find((d) => d.path === dir.path);
      if (existing) {
        existing.aiLines += dir.aiLines;
        existing.totalLines += dir.totalLines;
        existing.commits += dir.commits;
        if (dir.lastModified > existing.lastModified) {
          existing.lastModified = dir.lastModified;
        }
      } else {
        merged.directoryAIStats.push({ ...dir });
      }
    }
  }
}

/**
 * 合并 AI 趋势
 */
export function mergeAITrends(merged: CommitStats, stats: CommitStats): void {
  if (stats.aiTrends && merged.aiTrends) {
    for (const tp of stats.aiTrends) {
      const existing = merged.aiTrends.find((t) => t.week === tp.week);
      if (existing) {
        existing.aiLines += tp.aiLines;
        existing.totalLines += tp.totalLines;
      } else {
        merged.aiTrends.push({ ...tp });
      }
    }
  }
}

/**
 * 合并工具 AI 指标
 */
export function mergeToolAIMetrics(merged: CommitStats, stats: CommitStats): void {
  if (stats.toolAIMetrics && merged.toolAIMetrics) {
    for (const tm of stats.toolAIMetrics) {
      const existing = merged.toolAIMetrics.find((t) => t.toolId === tm.toolId);
      if (existing) {
        existing.totalLines += tm.totalLines;
        existing.aiLines += tm.aiLines;
        existing.commits += tm.commits;
      } else {
        merged.toolAIMetrics.push({ ...tm });
      }
    }
  }
}

/**
 * 合并工具 AI 趋势
 */
export function mergeToolAITrends(merged: CommitStats, stats: CommitStats): void {
  if (stats.toolAITrends && merged.toolAITrends) {
    for (const tt of stats.toolAITrends) {
      const existing = merged.toolAITrends.find(
        (t) => t.week === tt.week && t.toolId === tt.toolId
      );
      if (existing) {
        existing.aiLines += tt.aiLines;
        existing.totalLines += tt.totalLines;
      } else {
        merged.toolAITrends.push({ ...tt });
      }
    }
  }
}

/**
 * 合并作者工具 AI 统计
 */
export function mergeAuthorToolAIStats(merged: CommitStats, stats: CommitStats): void {
  if (stats.authorToolAIStats && merged.authorToolAIStats) {
    for (const at of stats.authorToolAIStats) {
      const existing = merged.authorToolAIStats.find(
        (a) => a.email.toLowerCase() === at.email.toLowerCase() && a.toolId === at.toolId
      );
      if (existing) {
        existing.aiLines += at.aiLines;
        existing.totalLines += at.totalLines;
      } else {
        merged.authorToolAIStats.push({ ...at });
      }
    }
  }
}

/**
 * 合并目录工具 AI 统计
 */
export function mergeDirectoryToolAIStats(merged: CommitStats, stats: CommitStats): void {
  if (stats.directoryToolAIStats && merged.directoryToolAIStats) {
    for (const dt of stats.directoryToolAIStats) {
      const existing = merged.directoryToolAIStats.find(
        (d) => d.path === dt.path && d.toolId === dt.toolId
      );
      if (existing) {
        existing.aiLines += dt.aiLines;
        existing.totalLines += dt.totalLines;
        existing.commits += dt.commits;
      } else {
        merged.directoryToolAIStats.push({ ...dt });
      }
    }
  }
}

/**
 * 合并工具留存和采用率
 */
export function mergeToolRetentionAdoption(merged: CommitStats, stats: CommitStats): void {
  if (stats.toolRetentionAdoption && merged.toolRetentionAdoption) {
    for (const tra of stats.toolRetentionAdoption) {
      const existing = merged.toolRetentionAdoption.find((t) => t.toolId === tra.toolId);
      if (existing) {
        existing.retentionRate = (existing.retentionRate + tra.retentionRate) / 2;
        existing.adoptionRate = (existing.adoptionRate + tra.adoptionRate) / 2;
      } else {
        merged.toolRetentionAdoption.push({ ...tra });
      }
    }
  }
}

/**
 * 标准化所有 AI 统计数据
 */
export function normalizeAIStats(merged: CommitStats): void {
  if (merged.aiMetrics) {
    merged.aiMetrics.aiPercentage =
      merged.aiMetrics.totalLines > 0
        ? (merged.aiMetrics.totalAILines / merged.aiMetrics.totalLines) * 100
        : 0;

    if (merged.aiMetrics.estimatedRange) {
      merged.aiMetrics.estimatedRange.minPercentage =
        merged.aiMetrics.totalLines > 0
          ? (merged.aiMetrics.estimatedRange.minLines / merged.aiMetrics.totalLines) * 100
          : 0;
      merged.aiMetrics.estimatedRange.maxPercentage =
        merged.aiMetrics.totalLines > 0
          ? (merged.aiMetrics.estimatedRange.maxLines / merged.aiMetrics.totalLines) * 100
          : 0;
    }

    merged.aiMetrics.highAICommits = merged.aiMetrics.highAICommits
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 20);
  }

  if (merged.authorAIStats) {
    for (const ai of merged.authorAIStats) {
      ai.aiPercentage = ai.totalLines > 0 ? (ai.aiLines / ai.totalLines) * 100 : 0;
    }
    merged.authorAIStats.sort((a, b) => b.aiPercentage - a.aiPercentage);
  }

  if (merged.directoryAIStats) {
    for (const dir of merged.directoryAIStats) {
      dir.aiPercentage = dir.totalLines > 0 ? (dir.aiLines / dir.totalLines) * 100 : 0;
      dir.isHighRisk = dir.commits > 50 && dir.aiPercentage > 60;
    }
    merged.directoryAIStats.sort((a, b) => b.aiPercentage - a.aiPercentage);
  }

  if (merged.aiTrends) {
    for (const tp of merged.aiTrends) {
      tp.aiPercentage = tp.totalLines > 0 ? (tp.aiLines / tp.totalLines) * 100 : 0;
    }
    merged.aiTrends.sort((a, b) => a.week.localeCompare(b.week));
  }

  if (merged.toolAIMetrics) {
    for (const tm of merged.toolAIMetrics) {
      tm.aiPercentage = tm.totalLines > 0 ? (tm.aiLines / tm.totalLines) * 100 : 0;
    }
    merged.toolAIMetrics.sort((a, b) => b.aiLines - a.aiLines);
  }

  if (merged.toolAITrends) {
    for (const tt of merged.toolAITrends) {
      tt.aiPercentage = tt.totalLines > 0 ? (tt.aiLines / tt.totalLines) * 100 : 0;
    }
    merged.toolAITrends.sort(
      (a, b) => a.week.localeCompare(b.week) || a.toolId.localeCompare(b.toolId)
    );
  }

  if (merged.authorToolAIStats) {
    for (const at of merged.authorToolAIStats) {
      at.aiPercentage = at.totalLines > 0 ? (at.aiLines / at.totalLines) * 100 : 0;
    }
    merged.authorToolAIStats.sort((a, b) => b.aiLines - a.aiLines);
  }

  if (merged.directoryToolAIStats) {
    for (const dt of merged.directoryToolAIStats) {
      dt.aiPercentage = dt.totalLines > 0 ? (dt.aiLines / dt.totalLines) * 100 : 0;
    }
    merged.directoryToolAIStats.sort((a, b) => b.aiLines - a.aiLines);
  }
}
