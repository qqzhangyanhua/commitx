import type {
  CommitRecord,
  CommitBehaviorMetrics,
  CommitSizeDistribution,
  CommitSizeBucket,
  FixupAnalysis,
  FixupCommit,
  CommitRhythm,
  CommitRhythmBucket,
} from '../types/index.js';

/**
 * 计算提交行为指标
 */
export function calculateCommitBehavior(
  commits: CommitRecord[]
): CommitBehaviorMetrics | undefined {
  if (commits.length === 0) {
    return undefined;
  }

  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    sizeDistribution: calculateCommitSizeDistribution(sorted),
    fixupAnalysis: calculateFixupAnalysis(sorted),
    rhythm: calculateCommitRhythm(sorted),
  };
}

/**
 * 计算提交粒度分布
 */
function calculateCommitSizeDistribution(
  commits: CommitRecord[]
): CommitSizeDistribution {
  const buckets: CommitSizeBucket[] = [
    { range: 'tiny', label: '1-10 行', count: 0, percentage: 0, minLines: 1, maxLines: 10 },
    { range: 'small', label: '11-50 行', count: 0, percentage: 0, minLines: 11, maxLines: 50 },
    { range: 'medium', label: '51-200 行', count: 0, percentage: 0, minLines: 51, maxLines: 200 },
    { range: 'large', label: '201-500 行', count: 0, percentage: 0, minLines: 201, maxLines: 500 },
    { range: 'huge', label: '500+ 行', count: 0, percentage: 0, minLines: 501, maxLines: Infinity },
  ];

  let totalLines = 0;

  for (const commit of commits) {
    const linesChanged = commit.files.reduce(
      (sum, file) => sum + file.added + file.deleted,
      0
    );
    totalLines += linesChanged;

    for (const bucket of buckets) {
      if (linesChanged >= bucket.minLines && linesChanged <= bucket.maxLines) {
        bucket.count++;
        break;
      }
    }
  }

  const totalCommits = commits.length;
  for (const bucket of buckets) {
    bucket.percentage = totalCommits > 0 ? bucket.count / totalCommits : 0;
  }

  const hugeBucket = buckets.find((b) => b.range === 'huge')!;
  const hugeCommitRate = totalCommits > 0 ? hugeBucket.count / totalCommits : 0;
  const avgLinesPerCommit = totalCommits > 0 ? totalLines / totalCommits : 0;

  return {
    buckets,
    totalCommits,
    avgLinesPerCommit,
    hugeCommitRate,
  };
}

/**
 * 计算 Fixup 链分析
 */
function calculateFixupAnalysis(commits: CommitRecord[]): FixupAnalysis {
  const fixRegex = /\b(fix|修复|修正|bugfix)\b/i;
  const hotfixRegex = /\b(hotfix|紧急修复|urgent fix)\b/i;
  const revertRegex = /\b(revert|回滚|撤销|rollback)\b/i;

  const fixupCommits: FixupCommit[] = [];
  const timeDiffs: number[] = [];

  for (let i = 1; i < commits.length; i++) {
    const commit = commits[i];
    const prevCommit = commits[i - 1];
    const message = commit.message;

    let type: 'fix' | 'hotfix' | 'revert' | null = null;

    if (hotfixRegex.test(message)) {
      type = 'hotfix';
    } else if (revertRegex.test(message)) {
      type = 'revert';
    } else if (fixRegex.test(message)) {
      type = 'fix';
    }

    if (type) {
      const timeDiffMinutes =
        (commit.date.getTime() - prevCommit.date.getTime()) / (1000 * 60);

      fixupCommits.push({
        hash: commit.hash,
        type,
        timeDiffMinutes,
        author: commit.author,
        date: commit.date,
        message: commit.message,
      });

      timeDiffs.push(timeDiffMinutes);
    }
  }

  const totalFixes = fixupCommits.length;
  const fixRate = commits.length > 0 ? totalFixes / commits.length : 0;

  const avgTimeDiffHours =
    timeDiffs.length > 0
      ? timeDiffs.reduce((sum, t) => sum + t, 0) / timeDiffs.length / 60
      : 0;

  const sortedTimeDiffs = [...timeDiffs].sort((a, b) => a - b);
  const medianTimeDiffHours =
    sortedTimeDiffs.length > 0
      ? sortedTimeDiffs[Math.floor(sortedTimeDiffs.length / 2)] / 60
      : 0;

  const distribution = {
    minutes: timeDiffs.filter((t) => t < 60).length,
    hours: timeDiffs.filter((t) => t >= 60 && t < 60 * 24).length,
    days: timeDiffs.filter((t) => t >= 60 * 24 && t < 60 * 24 * 7).length,
    weeks: timeDiffs.filter((t) => t >= 60 * 24 * 7).length,
  };

  const top20Fixups = fixupCommits
    .sort((a, b) => a.timeDiffMinutes - b.timeDiffMinutes)
    .slice(0, 20);

  return {
    totalFixes,
    fixRate,
    avgTimeDiffHours,
    medianTimeDiffHours,
    distribution,
    fixupCommits: top20Fixups,
  };
}

/**
 * 计算提交节奏
 */
function calculateCommitRhythm(commits: CommitRecord[]): CommitRhythm {
  const buckets: CommitRhythmBucket[] = [
    { range: 'minute', label: '分钟级 (< 1h)', count: 0, percentage: 0 },
    { range: 'hour', label: '小时级 (1-24h)', count: 0, percentage: 0 },
    { range: 'day', label: '天级 (1-7d)', count: 0, percentage: 0 },
    { range: 'week', label: '周级 (7d+)', count: 0, percentage: 0 },
  ];

  const intervals: number[] = [];

  for (let i = 1; i < commits.length; i++) {
    const intervalMinutes =
      (commits[i].date.getTime() - commits[i - 1].date.getTime()) / (1000 * 60);
    intervals.push(intervalMinutes);

    if (intervalMinutes < 60) {
      buckets[0].count++;
    } else if (intervalMinutes < 60 * 24) {
      buckets[1].count++;
    } else if (intervalMinutes < 60 * 24 * 7) {
      buckets[2].count++;
    } else {
      buckets[3].count++;
    }
  }

  const totalIntervals = intervals.length;
  for (const bucket of buckets) {
    bucket.percentage = totalIntervals > 0 ? bucket.count / totalIntervals : 0;
  }

  const avgIntervalHours =
    intervals.length > 0
      ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length / 60
      : 0;

  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianIntervalHours =
    sortedIntervals.length > 0
      ? sortedIntervals[Math.floor(sortedIntervals.length / 2)] / 60
      : 0;

  const burstCommits = buckets[0].count;
  const steadyCommits = buckets[1].count;

  return {
    buckets,
    avgIntervalHours,
    medianIntervalHours,
    burstCommits,
    steadyCommits,
  };
}
