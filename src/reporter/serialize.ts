import type { AuthorDetail, CommitStats } from '../types/index.js';

/**
 * 将 CommitStats 转为可 JSON 序列化的格式
 * Date 对象转为 ISO 字符串
 */
export function serializeStats(stats: CommitStats): Record<string, unknown> {
  const serializeAuthorDetail = (author: AuthorDetail) => ({
    ...author,
    lastCommitDate: author.lastCommitDate.toISOString(),
  });

  return {
    ...stats,
    firstCommitDate: stats.firstCommitDate.toISOString(),
    lastCommitDate: stats.lastCommitDate.toISOString(),
    authors: stats.authors.map((a) => ({
      ...a,
      lastActiveDate: a.lastActiveDate.toISOString(),
    })),
    contributorChurn: stats.contributorChurn
      ? {
          ...stats.contributorChurn,
          active: stats.contributorChurn.active.map(serializeAuthorDetail),
          occasional: stats.contributorChurn.occasional.map(serializeAuthorDetail),
          dormant: stats.contributorChurn.dormant.map(serializeAuthorDetail),
          lost: stats.contributorChurn.lost.map(serializeAuthorDetail),
          newJoiners: stats.contributorChurn.newJoiners.map(serializeAuthorDetail),
        }
      : undefined,
    aiMetrics: stats.aiMetrics
      ? {
          ...stats.aiMetrics,
          highAICommits: stats.aiMetrics.highAICommits.map((commit) => ({
            ...commit,
            date: commit.date.toISOString(),
          })),
        }
      : undefined,
    directoryAIStats: stats.directoryAIStats?.map((directory) => ({
      ...directory,
      lastModified: directory.lastModified.toISOString(),
    })),
    techDebt: stats.techDebt
      ? {
          ...stats.techDebt,
          highRiskFiles: stats.techDebt.highRiskFiles.map((file) => ({
            ...file,
            lastModified: file.lastModified.toISOString(),
          })),
        }
      : undefined,
  };
}
