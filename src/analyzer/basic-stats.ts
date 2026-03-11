import type {
  CommitRecord,
  AuthorStats,
  FileTypeStats,
  DirectoryStats,
  BusiestDay,
} from '../types/index.js';
import { extname } from 'node:path';

/** 获取文件路径的第一层目录 */
export function getTopDirectory(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 1 ? parts[0] : '(根目录)';
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface BasicStatsResult {
  totalLinesAdded: number;
  totalLinesDeleted: number;
  allFilePaths: Set<string>;
  authorMap: Map<string, AuthorStats>;
  fileTypeMap: Map<string, FileTypeStats>;
  directoryMap: Map<string, DirectoryStats>;
  directoryCommitSet: Map<string, Set<string>>;
  hourlyDistribution: number[];
  dailyHeatmap: Record<string, number>;
  hourlyByAuthor: Map<number, Map<string, number>>;
  dailyCounts: Map<string, number>;
  busiestDay: BusiestDay;
  firstCommitDate: Date;
  lastCommitDate: Date;
}

/**
 * 单遍扫描计算基础统计、作者、文件类型、目录、时间分布
 */
export function calculateBasicStats(commits: CommitRecord[]): BasicStatsResult {
  const sorted = [...commits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  const allFilePaths = new Set<string>();
  const authorMap = new Map<string, AuthorStats>();
  const fileTypeMap = new Map<string, FileTypeStats>();
  const directoryMap = new Map<string, DirectoryStats>();
  const directoryCommitSet = new Map<string, Set<string>>();
  const hourlyDistribution = new Array<number>(24).fill(0);
  const dailyHeatmap: Record<string, number> = {};
  const hourlyByAuthor = new Map<number, Map<string, number>>();
  const dailyCounts = new Map<string, number>();

  for (const commit of sorted) {
    const hour = commit.date.getHours();
    hourlyDistribution[hour]++;

    if (!hourlyByAuthor.has(hour)) {
      hourlyByAuthor.set(hour, new Map());
    }
    const hourAuthors = hourlyByAuthor.get(hour)!;
    hourAuthors.set(commit.author, (hourAuthors.get(commit.author) || 0) + 1);

    const dateKey = formatDateKey(commit.date);
    dailyHeatmap[dateKey] = (dailyHeatmap[dateKey] || 0) + 1;
    dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);

    const authorKey = commit.email.toLowerCase();
    let authorStat = authorMap.get(authorKey);
    if (!authorStat) {
      authorStat = {
        name: commit.author,
        email: commit.email,
        commits: 0,
        linesAdded: 0,
        linesDeleted: 0,
        lastActiveDate: commit.date,
      };
      authorMap.set(authorKey, authorStat);
    }
    authorStat.commits++;
    authorStat.lastActiveDate = commit.date;

    for (const file of commit.files) {
      totalLinesAdded += file.added;
      totalLinesDeleted += file.deleted;
      allFilePaths.add(file.path);

      authorStat.linesAdded += file.added;
      authorStat.linesDeleted += file.deleted;

      const ext = extname(file.path).toLowerCase() || '(无扩展名)';
      let ftStat = fileTypeMap.get(ext);
      if (!ftStat) {
        ftStat = { extension: ext, added: 0, deleted: 0, fileCount: 0 };
        fileTypeMap.set(ext, ftStat);
      }
      ftStat.added += file.added;
      ftStat.deleted += file.deleted;

      const topDir = getTopDirectory(file.path);
      let dirStat = directoryMap.get(topDir);
      if (!dirStat) {
        dirStat = { path: topDir, commits: 0, linesChanged: 0 };
        directoryMap.set(topDir, dirStat);
        directoryCommitSet.set(topDir, new Set());
      }
      dirStat.linesChanged += file.added + file.deleted;
      directoryCommitSet.get(topDir)!.add(commit.hash);
    }
  }

  for (const [dir, commitSet] of directoryCommitSet) {
    const dirStat = directoryMap.get(dir);
    if (dirStat) {
      dirStat.commits = commitSet.size;
    }
  }

  const fileCountByExt = new Map<string, Set<string>>();
  for (const filePath of allFilePaths) {
    const ext = extname(filePath).toLowerCase() || '(无扩展名)';
    if (!fileCountByExt.has(ext)) {
      fileCountByExt.set(ext, new Set());
    }
    fileCountByExt.get(ext)!.add(filePath);
  }
  for (const [ext, files] of fileCountByExt) {
    const ftStat = fileTypeMap.get(ext);
    if (ftStat) {
      ftStat.fileCount = files.size;
    }
  }

  let busiestDay: BusiestDay = { date: '', count: 0 };
  for (const [date, count] of dailyCounts) {
    if (count > busiestDay.count) {
      busiestDay = { date, count };
    }
  }

  return {
    totalLinesAdded,
    totalLinesDeleted,
    allFilePaths,
    authorMap,
    fileTypeMap,
    directoryMap,
    directoryCommitSet,
    hourlyDistribution,
    dailyHeatmap,
    hourlyByAuthor,
    dailyCounts,
    busiestDay,
    firstCommitDate: sorted[0]?.date ?? new Date(),
    lastCommitDate: sorted[sorted.length - 1]?.date ?? new Date(),
  };
}
