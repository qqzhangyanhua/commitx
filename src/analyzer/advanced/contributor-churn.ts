import type { CommitRecord, ContributorChurnMetrics, AuthorDetail } from '../../types/index.js';

/**
 * 计算贡献者流失率指标
 */
export function calculateContributorChurn(commits: CommitRecord[]): ContributorChurnMetrics {
  if (commits.length === 0) {
    return emptyContributorChurn();
  }

  // 统计每个作者的最后提交时间
  const authorLastCommit = new Map<string, {
    name: string;
    email: string;
    lastDate: Date;
    firstDate: Date;
    totalCommits: number;
  }>();

  for (const commit of commits) {
    const key = commit.email.toLowerCase();
    const existing = authorLastCommit.get(key);

    if (!existing) {
      authorLastCommit.set(key, {
        name: commit.author,
        email: commit.email,
        lastDate: commit.date,
        firstDate: commit.date,
        totalCommits: 1
      });
    } else {
      if (commit.date > existing.lastDate) {
        existing.lastDate = commit.date;
      }
      if (commit.date < existing.firstDate) {
        existing.firstDate = commit.date;
      }
      existing.totalCommits++;
    }
  }

  // 四级分类
  const now = new Date();
  const active: AuthorDetail[] = [];
  const occasional: AuthorDetail[] = [];
  const dormant: AuthorDetail[] = [];
  const lost: AuthorDetail[] = [];
  const newJoiners: AuthorDetail[] = [];

  for (const [, author] of authorLastCommit) {
    const daysSinceLast = Math.floor((now.getTime() - author.lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceFirst = Math.floor((now.getTime() - author.firstDate.getTime()) / (1000 * 60 * 60 * 24));

    const detail: AuthorDetail = {
      name: author.name,
      email: author.email,
      lastCommitDate: author.lastDate,
      daysSinceLastCommit: daysSinceLast,
      totalCommits: author.totalCommits
    };

    // 新加入（首次提交 <30天）
    if (daysSinceFirst < 30) {
      newJoiners.push(detail);
    }

    // 按最后活跃时间分类
    if (daysSinceLast < 30) {
      active.push(detail);
    } else if (daysSinceLast < 90) {
      occasional.push(detail);
    } else if (daysSinceLast < 180) {
      dormant.push(detail);
    } else {
      lost.push(detail);
    }
  }

  // 计算比率并排序
  const totalAuthors = authorLastCommit.size;
  const churnRate = totalAuthors > 0 ? lost.length / totalAuthors : 0;
  const retentionRate = totalAuthors > 0 ? active.length / totalAuthors : 0;
  const growthRate = totalAuthors > 0 ? newJoiners.length / totalAuthors : 0;

  return {
    active: active.sort((a, b) => b.totalCommits - a.totalCommits),
    occasional: occasional.sort((a, b) => a.daysSinceLastCommit - b.daysSinceLastCommit),
    dormant: dormant.sort((a, b) => a.daysSinceLastCommit - b.daysSinceLastCommit),
    lost: lost.sort((a, b) => b.totalCommits - a.totalCommits),
    newJoiners: newJoiners.sort((a, b) => a.daysSinceLastCommit - b.daysSinceLastCommit),
    churnRate: Math.round(churnRate * 1000) / 1000,
    retentionRate: Math.round(retentionRate * 1000) / 1000,
    growthRate: Math.round(growthRate * 1000) / 1000
  };
}

function emptyContributorChurn(): ContributorChurnMetrics {
  return {
    active: [],
    occasional: [],
    dormant: [],
    lost: [],
    newJoiners: [],
    churnRate: 0,
    retentionRate: 0,
    growthRate: 0,
  };
}
