import type {
  CommitRecord,
  TimePatterns,
  TrendData,
  WeeklyPoint,
  CumulativePoint,
} from '../types/index.js';
import { formatDateKey } from './basic-stats.js';
import { getISOWeekKey } from '../utils/date-utils.js';

export function emptyTimePatterns(): TimePatterns {
  return {
    weekdayDistribution: new Array<number>(7).fill(0),
    weekendCommits: 0,
    avgCommitInterval: 0,
    longestStreak: 0,
    currentStreak: 0,
  };
}

export function emptyTrendData(): TrendData {
  return {
    weeklyTrend: [],
    cumulativeLines: [],
  };
}

/** 计算时间模式指标 */
export function calculateTimePatterns(commits: CommitRecord[]): TimePatterns {
  if (commits.length === 0) {
    return emptyTimePatterns();
  }

  const weekdayDistribution = new Array<number>(7).fill(0);
  const weekdayByAuthor: Map<number, Map<string, number>> = new Map();

  for (const commit of commits) {
    const day = commit.date.getDay();
    const idx = day === 0 ? 6 : day - 1;
    weekdayDistribution[idx]++;

    if (!weekdayByAuthor.has(idx)) {
      weekdayByAuthor.set(idx, new Map());
    }
    const dayAuthors = weekdayByAuthor.get(idx)!;
    dayAuthors.set(commit.author, (dayAuthors.get(commit.author) || 0) + 1);
  }

  const weekendCommits =
    (weekdayDistribution[5] + weekdayDistribution[6]) / commits.length;

  const sorted = [...commits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  let totalInterval = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalInterval += sorted[i].date.getTime() - sorted[i - 1].date.getTime();
  }
  const avgCommitInterval =
    sorted.length > 1 ? totalInterval / (sorted.length - 1) / 3600000 : 0;

  const { longestStreak, currentStreak } = calculateStreaks(sorted);

  const weekdayByAuthorArray = Array.from({ length: 7 }, (_, day) => {
    const authorMap = weekdayByAuthor.get(day);
    const authors: Record<string, number> = {};
    if (authorMap) {
      authorMap.forEach((count, author) => {
        authors[author] = count;
      });
    }
    return {
      count: weekdayDistribution[day],
      authors,
    };
  });

  return {
    weekdayDistribution,
    weekendCommits,
    avgCommitInterval,
    longestStreak,
    currentStreak,
    weekdayByAuthor: weekdayByAuthorArray,
  };
}

/** 计算连续提交天数 */
function calculateStreaks(sortedCommits: CommitRecord[]): {
  longestStreak: number;
  currentStreak: number;
} {
  if (sortedCommits.length === 0) {
    return { longestStreak: 0, currentStreak: 0 };
  }

  const uniqueDates = new Set<string>();
  for (const commit of sortedCommits) {
    uniqueDates.add(formatDateKey(commit.date));
  }

  const sortedDates = Array.from(uniqueDates).sort();
  if (sortedDates.length === 0) {
    return { longestStreak: 0, currentStreak: 0 };
  }

  let longestStreak = 1;
  let currentStreakCount = 1;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.round(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }

    longestStreak = Math.max(longestStreak, tempStreak);
  }

  const today = formatDateKey(new Date());
  const lastCommitDate = sortedDates[sortedDates.length - 1];
  const lastDate = new Date(lastCommitDate);
  const todayDate = new Date(today);
  const daysSinceLastCommit = Math.round(
    (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastCommit <= 1) {
    currentStreakCount = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currDate = new Date(sortedDates[i + 1]);
      const prevDate = new Date(sortedDates[i]);
      const diffDays = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        currentStreakCount++;
      } else {
        break;
      }
    }
  } else {
    currentStreakCount = 0;
  }

  return { longestStreak, currentStreak: currentStreakCount };
}

/** 计算趋势数据 */
export function calculateTrends(commits: CommitRecord[]): TrendData {
  if (commits.length === 0) {
    return emptyTrendData();
  }

  const weekMap = new Map<string, WeeklyPoint>();
  for (const commit of commits) {
    const week = getISOWeekKey(commit.date);
    const entry = weekMap.get(week) || {
      week,
      commits: 0,
      linesAdded: 0,
      linesDeleted: 0,
    };
    entry.commits++;
    for (const file of commit.files) {
      entry.linesAdded += file.added;
      entry.linesDeleted += file.deleted;
    }
    weekMap.set(week, entry);
  }
  const weeklyTrend = Array.from(weekMap.values()).sort((a, b) =>
    a.week.localeCompare(b.week)
  );

  const dailyNet = new Map<string, number>();
  for (const commit of commits) {
    const dateKey = formatDateKey(commit.date);
    const net = commit.files.reduce((sum, f) => sum + f.added - f.deleted, 0);
    dailyNet.set(dateKey, (dailyNet.get(dateKey) || 0) + net);
  }

  let cumulative = 0;
  const cumulativeLines: CumulativePoint[] = Array.from(dailyNet.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, net]) => {
      cumulative += net;
      return { date, netLines: cumulative };
    });

  return { weeklyTrend, cumulativeLines };
}
