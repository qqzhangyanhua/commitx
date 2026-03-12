import pLimit from 'p-limit';
import type { CodeAgeStats, AgeDistributionBucket, OldCodeFile, FrequentRewriteArea } from '../../types/index.js';
import { listCodeFilesAtRev, blameFile, type BlameLineInfo } from './git-source.js';

const limit = pLimit(4);

const AGE_BUCKETS = [
  { range: '0-30天', days: 30 },
  { range: '31-90天', days: 90 },
  { range: '91-180天', days: 180 },
  { range: '181-365天', days: 365 },
  { range: '1-2年', days: 730 },
  { range: '2年+', days: Infinity }
];

interface FileAgeStats {
  path: string;
  avgAgeDays: number;
  oldestLineDays: number;
  totalLines: number;
  modifyCount: number;
  bucketCounts: number[];
}

export async function calculateCodeAge(
  repoPath: string,
  referenceRev = 'HEAD'
): Promise<CodeAgeStats> {
  try {
    const files = await listCodeFilesAtRev(repoPath, referenceRev);

    if (files.length === 0) {
      return emptyCodeAgeStats();
    }

    const bucketCounts = AGE_BUCKETS.map(() => 0);
    const fileBucketCounts = AGE_BUCKETS.map(() => 0);
    const fileStats: FileAgeStats[] = [];
    let totalLinesAnalyzed = 0;

    await Promise.all(
      files.map(file =>
        limit(async () => {
          const blameInfo = await blameFile(repoPath, referenceRev, file);
          if (blameInfo.length === 0) return;

          const stats = summarizeBlame(file, blameInfo);
          totalLinesAnalyzed += stats.totalLines;

          for (let i = 0; i < AGE_BUCKETS.length; i++) {
            bucketCounts[i] += stats.bucketCounts[i];
          }

          const avgBucketIndex = findBucketIndex(stats.avgAgeDays);
          if (avgBucketIndex >= 0) {
            fileBucketCounts[avgBucketIndex]++;
          }

          fileStats.push(stats);
        })
      )
    );

    const ageDistribution = AGE_BUCKETS.map((bucket, i) => ({
      range: bucket.range,
      rangeDays: bucket.days,
      lines: bucketCounts[i],
      percentage: totalLinesAnalyzed > 0 ? bucketCounts[i] / totalLinesAnalyzed : 0,
      files: fileBucketCounts[i]
    }));

    const oldestFiles = fileStats
      .sort((a, b) => b.avgAgeDays - a.avgAgeDays)
      .slice(0, 10)
      .map(s => ({
        path: s.path,
        avgAgeDays: s.avgAgeDays,
        oldestLineDays: s.oldestLineDays,
        totalLines: s.totalLines,
        lastModified: new Date()
      }));

    const frequentRewriteAreas = fileStats
      .filter(s => s.modifyCount >= 3 && s.avgAgeDays <= 90)
      .sort((a, b) => a.avgAgeDays - b.avgAgeDays)
      .slice(0, 10)
      .map(s => ({
        path: s.path,
        avgAgeDays: s.avgAgeDays,
        totalLines: s.totalLines,
        estimatedRewrites: Math.floor(365 / Math.max(s.avgAgeDays, 1))
      }));

    return {
      ageDistribution,
      oldestFiles,
      frequentRewriteAreas,
      totalLinesAnalyzed,
      filesAnalyzed: files.length
    };
  } catch {
    return emptyCodeAgeStats();
  }
}

function summarizeBlame(path: string, blameInfo: BlameLineInfo[]): FileAgeStats {
  const bucketCounts = AGE_BUCKETS.map(() => 0);
  let sumAge = 0;
  let maxAge = 0;

  for (const info of blameInfo) {
    sumAge += info.ageDays;
    maxAge = Math.max(maxAge, info.ageDays);

    for (let i = 0; i < AGE_BUCKETS.length; i++) {
      if (i === 0 && info.ageDays <= AGE_BUCKETS[i].days) {
        bucketCounts[i]++;
        break;
      } else if (i > 0 && info.ageDays > AGE_BUCKETS[i - 1].days && info.ageDays <= AGE_BUCKETS[i].days) {
        bucketCounts[i]++;
        break;
      }
    }
  }

  const avgAgeDays = blameInfo.length > 0 ? Math.round(sumAge / blameInfo.length) : 0;
  const uniqueTimestamps = new Set(blameInfo.map(b => b.authorTime)).size;

  return {
    path,
    avgAgeDays,
    oldestLineDays: maxAge,
    totalLines: blameInfo.length,
    modifyCount: uniqueTimestamps,
    bucketCounts
  };
}

function findBucketIndex(ageDays: number): number {
  for (let i = 0; i < AGE_BUCKETS.length; i++) {
    if (i === 0 && ageDays <= AGE_BUCKETS[i].days) {
      return i;
    } else if (i > 0 && ageDays > AGE_BUCKETS[i - 1].days && ageDays <= AGE_BUCKETS[i].days) {
      return i;
    }
  }
  return AGE_BUCKETS.length - 1;
}

function emptyCodeAgeStats(): CodeAgeStats {
  return {
    ageDistribution: AGE_BUCKETS.map(b => ({
      range: b.range,
      rangeDays: b.days,
      lines: 0,
      percentage: 0,
      files: 0
    })),
    oldestFiles: [],
    frequentRewriteAreas: [],
    totalLinesAnalyzed: 0,
    filesAnalyzed: 0
  };
}
