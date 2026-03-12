import type { CommitRecord, CommitStats } from '../types/index.js';
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
import { mergeBasicStats, calculateBusiestDay } from './merge-basic.js';
import { mergeAuthors, sortAuthors } from './merge-author.js';
import { mergeFileTypes, mergeDirectories, sortFileTypesAndDirectories } from './merge-file-dir.js';
import { mergeQualityMetrics, normalizeQualityMetrics } from './merge-quality.js';
import { mergeTimePatterns, mergeTrends, normalizeTimePatterns } from './merge-time.js';
import { mergeCollaboration, normalizeCollaboration } from './merge-collaboration.js';
import {
  mergeMessageStats,
  mergeAuthorFileTypeContributions,
  normalizeMessageStats,
} from './merge-message.js';
import {
  mergeAIMetrics,
  mergeAuthorAIStats,
  mergeDirectoryAIStats,
  mergeAITrends,
  mergeToolAIMetrics,
  mergeToolAITrends,
  mergeAuthorToolAIStats,
  mergeDirectoryToolAIStats,
  mergeToolRetentionAdoption,
  normalizeAIStats,
} from './merge-ai.js';

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
    aiMetrics: {
      totalAILines: 0,
      totalLines: 0,
      aiPercentage: 0,
      confidence: 'low',
      confidenceScore: 0,
      estimatedRange: { minLines: 0, maxLines: 0, minPercentage: 0, maxPercentage: 0 },
      suspiciousCommits: 0,
      highAICommits: [],
    },
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
  const repoCount = statsList.length;

  for (const stats of statsList) {
    mergeBasicStats(merged, stats);
    mergeAuthors(merged, stats);
    mergeFileTypes(merged, stats);
    mergeDirectories(merged, stats);
    mergeQualityMetrics(merged, stats);
    mergeTimePatterns(merged, stats);
    mergeTrends(merged, stats);
    mergeCollaboration(merged, stats);
    mergeMessageStats(merged, stats);
    mergeAIMetrics(merged, stats);
    mergeAuthorAIStats(merged, stats);
    mergeDirectoryAIStats(merged, stats);
    mergeAITrends(merged, stats);
    mergeToolAIMetrics(merged, stats);
    mergeToolAITrends(merged, stats);
    mergeAuthorToolAIStats(merged, stats);
    mergeDirectoryToolAIStats(merged, stats);
    mergeToolRetentionAdoption(merged, stats);
  }

  merged.busiestDay = calculateBusiestDay(merged.dailyHeatmap);
  sortAuthors(merged);
  sortFileTypesAndDirectories(merged);
  normalizeQualityMetrics(merged, repoCount);
  normalizeTimePatterns(merged);
  normalizeCollaboration(merged);
  normalizeMessageStats(merged, repoCount);
  mergeAuthorFileTypeContributions(merged, statsList);
  normalizeAIStats(merged);

  return merged;
}
