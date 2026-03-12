import type {
  CommitBehaviorMetrics,
  CommitSizeBucket,
  CommitRhythmBucket,
  FixupCommit,
} from '../types/index.js';

/**
 * 合并多个仓库的提交行为指标
 */
export function mergeCommitBehavior(
  behaviors: (CommitBehaviorMetrics | undefined)[]
): CommitBehaviorMetrics | undefined {
  const validBehaviors = behaviors.filter(
    (b): b is CommitBehaviorMetrics => b !== undefined
  );

  if (validBehaviors.length === 0) {
    return undefined;
  }

  if (validBehaviors.length === 1) {
    return validBehaviors[0];
  }

  return {
    sizeDistribution: mergeSizeDistribution(validBehaviors),
    fixupAnalysis: mergeFixupAnalysis(validBehaviors),
    rhythm: mergeRhythm(validBehaviors),
  };
}

function mergeSizeDistribution(behaviors: CommitBehaviorMetrics[]) {
  const mergedBuckets: CommitSizeBucket[] = [
    { range: 'tiny', label: '1-10 行', count: 0, percentage: 0, minLines: 1, maxLines: 10 },
    { range: 'small', label: '11-50 行', count: 0, percentage: 0, minLines: 11, maxLines: 50 },
    { range: 'medium', label: '51-200 行', count: 0, percentage: 0, minLines: 51, maxLines: 200 },
    { range: 'large', label: '201-500 行', count: 0, percentage: 0, minLines: 201, maxLines: 500 },
    { range: 'huge', label: '500+ 行', count: 0, percentage: 0, minLines: 501, maxLines: Infinity },
  ];

  let totalCommits = 0;
  let totalLines = 0;

  for (const behavior of behaviors) {
    const dist = behavior.sizeDistribution;
    totalCommits += dist.totalCommits;
    totalLines += dist.avgLinesPerCommit * dist.totalCommits;

    for (let i = 0; i < dist.buckets.length; i++) {
      mergedBuckets[i].count += dist.buckets[i].count;
    }
  }

  for (const bucket of mergedBuckets) {
    bucket.percentage = totalCommits > 0 ? bucket.count / totalCommits : 0;
  }

  const hugeBucket = mergedBuckets.find((b) => b.range === 'huge')!;
  const hugeCommitRate = totalCommits > 0 ? hugeBucket.count / totalCommits : 0;
  const avgLinesPerCommit = totalCommits > 0 ? totalLines / totalCommits : 0;

  return {
    buckets: mergedBuckets,
    totalCommits,
    avgLinesPerCommit,
    hugeCommitRate,
  };
}

function mergeFixupAnalysis(behaviors: CommitBehaviorMetrics[]) {
  let totalFixes = 0;
  let totalCommits = 0;
  let totalTimeDiffHours = 0;
  const allTimeDiffs: number[] = [];
  const allFixupCommits: FixupCommit[] = [];

  const distribution = {
    minutes: 0,
    hours: 0,
    days: 0,
    weeks: 0,
  };

  for (const behavior of behaviors) {
    const fixup = behavior.fixupAnalysis;
    totalFixes += fixup.totalFixes;
    totalCommits += behavior.sizeDistribution.totalCommits;
    totalTimeDiffHours += fixup.avgTimeDiffHours * fixup.totalFixes;

    distribution.minutes += fixup.distribution.minutes;
    distribution.hours += fixup.distribution.hours;
    distribution.days += fixup.distribution.days;
    distribution.weeks += fixup.distribution.weeks;

    for (const commit of fixup.fixupCommits) {
      allTimeDiffs.push(commit.timeDiffMinutes / 60);
      allFixupCommits.push(commit);
    }
  }

  const fixRate = totalCommits > 0 ? totalFixes / totalCommits : 0;
  const avgTimeDiffHours = totalFixes > 0 ? totalTimeDiffHours / totalFixes : 0;

  const sortedTimeDiffs = [...allTimeDiffs].sort((a, b) => a - b);
  const medianTimeDiffHours =
    sortedTimeDiffs.length > 0
      ? sortedTimeDiffs[Math.floor(sortedTimeDiffs.length / 2)]
      : 0;

  const top20Fixups = allFixupCommits
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

function mergeRhythm(behaviors: CommitBehaviorMetrics[]) {
  const mergedBuckets: CommitRhythmBucket[] = [
    { range: 'minute', label: '分钟级 (< 1h)', count: 0, percentage: 0 },
    { range: 'hour', label: '小时级 (1-24h)', count: 0, percentage: 0 },
    { range: 'day', label: '天级 (1-7d)', count: 0, percentage: 0 },
    { range: 'week', label: '周级 (7d+)', count: 0, percentage: 0 },
  ];

  let totalIntervals = 0;
  let totalIntervalHours = 0;
  const allIntervals: number[] = [];

  for (const behavior of behaviors) {
    const rhythm = behavior.rhythm;
    totalIntervalHours += rhythm.avgIntervalHours * (rhythm.buckets.reduce((sum, b) => sum + b.count, 0));

    for (let i = 0; i < rhythm.buckets.length; i++) {
      mergedBuckets[i].count += rhythm.buckets[i].count;
      totalIntervals += rhythm.buckets[i].count;
    }

    for (const bucket of rhythm.buckets) {
      for (let j = 0; j < bucket.count; j++) {
        allIntervals.push(rhythm.avgIntervalHours);
      }
    }
  }

  for (const bucket of mergedBuckets) {
    bucket.percentage = totalIntervals > 0 ? bucket.count / totalIntervals : 0;
  }

  const avgIntervalHours = totalIntervals > 0 ? totalIntervalHours / totalIntervals : 0;

  const sortedIntervals = [...allIntervals].sort((a, b) => a - b);
  const medianIntervalHours =
    sortedIntervals.length > 0
      ? sortedIntervals[Math.floor(sortedIntervals.length / 2)]
      : 0;

  const burstCommits = mergedBuckets[0].count;
  const steadyCommits = mergedBuckets[1].count;

  return {
    buckets: mergedBuckets,
    avgIntervalHours,
    medianIntervalHours,
    burstCommits,
    steadyCommits,
  };
}
