import type { CommitRecord, DeletionRateStats, DeletionPeriod, HighDeletionFile, DeletionTrendPoint } from '../../types/index.js';

const DELETION_PERIODS = [7, 30, 90, 180];

interface AddedChunk {
  date: Date;
  remaining: number;
}

export function calculateDeletionRate(commits: CommitRecord[]): DeletionRateStats {
  if (commits.length === 0) {
    return emptyDeletionRateStats();
  }

  const sortedCommits = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  const fileQueues = new Map<string, AddedChunk[]>();
  const deletedByWindow = new Map<number, number>();
  DELETION_PERIODS.forEach(p => deletedByWindow.set(p, 0));

  let totalAdded = 0;
  const weeklyMap = new Map<string, { added: number; deleted: number }>();
  const fileStats = new Map<string, { added: number; deleted: number; lastDate: Date }>();

  for (const commit of sortedCommits) {
    for (const file of commit.files) {
      totalAdded += file.added;

      if (!fileQueues.has(file.path)) {
        fileQueues.set(file.path, []);
      }
      const queue = fileQueues.get(file.path)!;

      if (file.added > 0) {
        queue.push({ date: commit.date, remaining: file.added });
      }

      let toDelete = file.deleted;
      while (toDelete > 0 && queue.length > 0) {
        const chunk = queue[0];
        const used = Math.min(toDelete, chunk.remaining);
        chunk.remaining -= used;
        toDelete -= used;

        if (chunk.remaining === 0) {
          queue.shift();
        }

        const ageDays = daysBetween(chunk.date, commit.date);
        for (const window of DELETION_PERIODS) {
          if (ageDays <= window) {
            deletedByWindow.set(window, deletedByWindow.get(window)! + used);
          }
        }
      }

      const week = getISOWeek(commit.date);
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, { added: 0, deleted: 0 });
      }
      const weekData = weeklyMap.get(week)!;
      weekData.added += file.added;
      weekData.deleted += file.deleted;

      if (!fileStats.has(file.path)) {
        fileStats.set(file.path, { added: 0, deleted: 0, lastDate: commit.date });
      }
      const fileStat = fileStats.get(file.path)!;
      fileStat.added += file.added;
      fileStat.deleted += file.deleted;
      fileStat.lastDate = commit.date;
    }
  }

  const overallDeletionRate = totalAdded > 0 ? deletedByWindow.get(DELETION_PERIODS[DELETION_PERIODS.length - 1])! / totalAdded : 0;

  const deletionByPeriod: DeletionPeriod[] = DELETION_PERIODS.map(days => {
    const deleted = deletedByWindow.get(days)!;
    return {
      period: `${days}天内`,
      periodDays: days,
      deletedLines: deleted,
      totalLines: totalAdded,
      rate: totalAdded > 0 ? deleted / totalAdded : 0
    };
  });

  const highDeletionFiles: HighDeletionFile[] = [];
  for (const [path, stat] of fileStats) {
    if (stat.added > 0) {
      const rate = stat.deleted / stat.added;
      if (rate > 0.3) {
        highDeletionFiles.push({
          path,
          addedLines: stat.added,
          deletedLines: stat.deleted,
          deletionRate: rate,
          lastModified: stat.lastDate
        });
      }
    }
  }
  highDeletionFiles.sort((a, b) => b.deletionRate - a.deletionRate);
  highDeletionFiles.splice(10);

  const deletionTrend: DeletionTrendPoint[] = [];
  for (const [week, data] of weeklyMap) {
    deletionTrend.push({
      week,
      deletionRate: data.added > 0 ? data.deleted / data.added : 0,
      addedLines: data.added,
      deletedLines: data.deleted
    });
  }
  deletionTrend.sort((a, b) => a.week.localeCompare(b.week));

  return {
    overallDeletionRate,
    deletionByPeriod,
    highDeletionFiles,
    deletionTrend
  };
}

function daysBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function emptyDeletionRateStats(): DeletionRateStats {
  return {
    overallDeletionRate: 0,
    deletionByPeriod: DELETION_PERIODS.map(days => ({
      period: `${days}天内`,
      periodDays: days,
      deletedLines: 0,
      totalLines: 0,
      rate: 0
    })),
    highDeletionFiles: [],
    deletionTrend: []
  };
}
