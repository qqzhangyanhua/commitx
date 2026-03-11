import type {
  CommitRecord,
  CommitStats,
  BusiestDay,
  AuthorFileTypeContribution,
} from '../types/index.js';
import { calculateBasicStats } from './basic-stats.js';
import { buildAuthorFileDirArrays } from './author-stats.js';
import {
  calculateTimePatterns,
  calculateTrends,
  emptyTimePatterns,
  emptyTrendData,
} from './time-stats.js';
import {
  calculateQualityMetrics,
  calculateCollaboration,
  calculateMessageStats,
  calculateAuthorFileTypeContributions,
  emptyQualityMetrics,
  emptyCollaborationMetrics,
  emptyMessageStats,
} from './quality-stats.js';
import { calculateAIMetrics } from './ai-stats-calculator.js';

/**
 * 根据解析后的提交记录，计算所有统计维度
 */
export function calculateStats(commits: CommitRecord[]): CommitStats {
  if (commits.length === 0) {
    return emptyStats();
  }

  const basicResult = calculateBasicStats(commits);
  const { authors, fileTypes, directories, hourlyByAuthorArray } =
    buildAuthorFileDirArrays(basicResult);

  const aiStats = calculateAIMetrics(commits);

  return {
    totalCommits: commits.length,
    linesAdded: basicResult.totalLinesAdded,
    linesDeleted: basicResult.totalLinesDeleted,
    filesChanged: basicResult.allFilePaths.size,
    firstCommitDate: basicResult.firstCommitDate,
    lastCommitDate: basicResult.lastCommitDate,
    busiestDay: basicResult.busiestDay,
    authors,
    fileTypes,
    directories,
    hourlyDistribution: basicResult.hourlyDistribution,
    dailyHeatmap: basicResult.dailyHeatmap,
    hourlyByAuthor: hourlyByAuthorArray,
    quality: calculateQualityMetrics(commits),
    timePatterns: calculateTimePatterns(commits),
    trends: calculateTrends(commits),
    collaboration: calculateCollaboration(commits),
    messageStats: calculateMessageStats(commits),
    authorFileTypeContributions: calculateAuthorFileTypeContributions(commits),
    aiMetrics: aiStats.aiMetrics,
    authorAIStats: aiStats.authorAIStats,
    directoryAIStats: aiStats.directoryAIStats,
    aiTrends: aiStats.aiTrends,
    toolAIMetrics: aiStats.toolAIMetrics,
    toolAITrends: aiStats.toolAITrends,
    authorToolAIStats: aiStats.authorToolAIStats,
    directoryToolAIStats: aiStats.directoryToolAIStats,
  };
}

/** 创建空的统计对象 */
function emptyStats(): CommitStats {
  return {
    totalCommits: 0,
    linesAdded: 0,
    linesDeleted: 0,
    filesChanged: 0,
    firstCommitDate: new Date(),
    lastCommitDate: new Date(),
    busiestDay: { date: '', count: 0 },
    authors: [],
    fileTypes: [],
    directories: [],
    hourlyDistribution: new Array<number>(24).fill(0),
    dailyHeatmap: {},
    quality: emptyQualityMetrics(),
    timePatterns: emptyTimePatterns(),
    trends: emptyTrendData(),
    collaboration: emptyCollaborationMetrics(),
    messageStats: emptyMessageStats(),
    authorFileTypeContributions: [],
    aiMetrics: { totalAILines: 0, totalLines: 0, aiPercentage: 0, suspiciousCommits: 0, highAICommits: [] },
    authorAIStats: [], directoryAIStats: [], aiTrends: [],
    toolAIMetrics: [], toolAITrends: [],
    authorToolAIStats: [], directoryToolAIStats: [], toolRetentionAdoption: [],
  };
}

/**
 * 合并多个仓库的统计结果
 */
export function mergeStats(statsList: CommitStats[]): CommitStats {
  if (statsList.length === 0) return emptyStats();
  if (statsList.length === 1) return statsList[0];

  const merged = emptyStats();

  for (const stats of statsList) {
    merged.totalCommits += stats.totalCommits;
    merged.linesAdded += stats.linesAdded;
    merged.linesDeleted += stats.linesDeleted;
    merged.filesChanged += stats.filesChanged;

    if (
      !merged.firstCommitDate ||
      stats.firstCommitDate < merged.firstCommitDate
    ) {
      merged.firstCommitDate = stats.firstCommitDate;
    }
    if (
      !merged.lastCommitDate ||
      stats.lastCommitDate > merged.lastCommitDate
    ) {
      merged.lastCommitDate = stats.lastCommitDate;
    }

    for (let i = 0; i < 24; i++) {
      merged.hourlyDistribution[i] += stats.hourlyDistribution[i];
    }

    for (const [date, count] of Object.entries(stats.dailyHeatmap)) {
      merged.dailyHeatmap[date] = (merged.dailyHeatmap[date] || 0) + count;
    }

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

    for (const ft of stats.fileTypes) {
      const existing = merged.fileTypes.find(
        (f) => f.extension === ft.extension
      );
      if (existing) {
        existing.added += ft.added;
        existing.deleted += ft.deleted;
        existing.fileCount += ft.fileCount;
      } else {
        merged.fileTypes.push({ ...ft });
      }
    }

    for (const dir of stats.directories) {
      const existing = merged.directories.find((d) => d.path === dir.path);
      if (existing) {
        existing.commits += dir.commits;
        existing.linesChanged += dir.linesChanged;
      } else {
        merged.directories.push({ ...dir });
      }
    }

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

    for (let i = 0; i < 7; i++) {
      merged.timePatterns.weekdayDistribution[i] +=
        stats.timePatterns.weekdayDistribution[i];
    }

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
      const existing = merged.trends.cumulativeLines.find(
        (c) => c.date === cp.date
      );
      if (existing) {
        existing.netLines += cp.netLines;
      } else {
        merged.trends.cumulativeLines.push({ ...cp });
      }
    }

    for (const sf of stats.collaboration.soloFiles) {
      const existing = merged.collaboration.soloFiles.find(
        (s) => s.path === sf.path
      );
      if (existing) {
        existing.commits += sf.commits;
      } else {
        merged.collaboration.soloFiles.push({ ...sf });
      }
    }
    for (const ch of stats.collaboration.collaborationHotspots) {
      const existing = merged.collaboration.collaborationHotspots.find(
        (c) => c.path === ch.path
      );
      if (existing) {
        existing.totalCommits += ch.totalCommits;
        existing.authorCount = Math.max(existing.authorCount, ch.authorCount);
      } else {
        merged.collaboration.collaborationHotspots.push({ ...ch });
      }
    }

    for (const [type, count] of Object.entries(stats.messageStats.typeDistribution)) {
      merged.messageStats.typeDistribution[type] =
        (merged.messageStats.typeDistribution[type] || 0) + count;
    }
    merged.messageStats.avgMessageLength += stats.messageStats.avgMessageLength;

    if (stats.aiMetrics && merged.aiMetrics) {
      merged.aiMetrics.totalAILines += stats.aiMetrics.totalAILines;
      merged.aiMetrics.totalLines += stats.aiMetrics.totalLines;
      merged.aiMetrics.suspiciousCommits += stats.aiMetrics.suspiciousCommits;
      for (const c of stats.aiMetrics.highAICommits) {
        merged.aiMetrics.highAICommits.push({ ...c });
      }
    }

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

  let busiestDay: BusiestDay = { date: '', count: 0 };
  for (const [date, count] of Object.entries(merged.dailyHeatmap)) {
    if (count > busiestDay.count) {
      busiestDay = { date, count };
    }
  }
  merged.busiestDay = busiestDay;

  merged.authors.sort((a, b) => b.commits - a.commits);
  merged.fileTypes.sort(
    (a, b) => b.added + b.deleted - (a.added + a.deleted)
  );
  merged.directories.sort((a, b) => b.linesChanged - a.linesChanged);
  merged.directories = merged.directories.slice(0, 10);

  const repoCount = statsList.length;
  merged.quality.avgFilesPerCommit /= repoCount;
  merged.quality.avgLinesPerCommit /= repoCount;
  merged.quality.churnRate /= repoCount;
  merged.quality.hotFiles.sort((a, b) => b.modifyCount - a.modifyCount);
  merged.quality.hotFiles = merged.quality.hotFiles.slice(0, 10);

  const totalWeekdayCommits = merged.timePatterns.weekdayDistribution.reduce(
    (a, b) => a + b,
    0
  );
  if (totalWeekdayCommits > 0) {
    merged.timePatterns.weekendCommits =
      (merged.timePatterns.weekdayDistribution[5] +
        merged.timePatterns.weekdayDistribution[6]) /
      totalWeekdayCommits;
  }

  merged.trends.weeklyTrend.sort((a, b) => a.week.localeCompare(b.week));
  merged.trends.cumulativeLines.sort((a, b) => a.date.localeCompare(b.date));

  let cumulative = 0;
  for (const point of merged.trends.cumulativeLines) {
    cumulative += point.netLines;
    point.netLines = cumulative;
  }

  merged.collaboration.soloFiles.sort((a, b) => b.commits - a.commits);
  merged.collaboration.soloFiles = merged.collaboration.soloFiles.slice(0, 10);
  merged.collaboration.collaborationHotspots.sort(
    (a, b) => b.totalCommits - a.totalCommits
  );
  merged.collaboration.collaborationHotspots =
    merged.collaboration.collaborationHotspots.slice(0, 10);

  merged.messageStats.avgMessageLength /= repoCount;

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

  if (merged.aiMetrics) {
    merged.aiMetrics.aiPercentage = merged.aiMetrics.totalLines > 0
      ? (merged.aiMetrics.totalAILines / merged.aiMetrics.totalLines) * 100
      : 0;
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
    merged.toolAITrends.sort((a, b) => a.week.localeCompare(b.week) || a.toolId.localeCompare(b.toolId));
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

  return merged;
}
