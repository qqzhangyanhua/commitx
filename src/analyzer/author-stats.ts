import type { AuthorStats, FileTypeStats, DirectoryStats } from '../types/index.js';
import type { BasicStatsResult } from './basic-stats.js';

/**
 * 从基础统计结果构建作者、文件类型、目录数组
 */
export function buildAuthorFileDirArrays(
  result: BasicStatsResult
): {
  authors: AuthorStats[];
  fileTypes: FileTypeStats[];
  directories: DirectoryStats[];
  hourlyByAuthorArray: { count: number; authors: Record<string, number> }[];
} {
  const authors = Array.from(result.authorMap.values()).sort(
    (a, b) => b.commits - a.commits
  );

  const fileTypes = Array.from(result.fileTypeMap.values()).sort(
    (a, b) => b.added + b.deleted - (a.added + a.deleted)
  );

  const directories = Array.from(result.directoryMap.values())
    .sort((a, b) => b.linesChanged - a.linesChanged)
    .slice(0, 10);

  const hourlyByAuthorArray = Array.from({ length: 24 }, (_, hour) => {
    const authorMap = result.hourlyByAuthor.get(hour);
    const authors: Record<string, number> = {};
    if (authorMap) {
      authorMap.forEach((count, author) => {
        authors[author] = count;
      });
    }
    return {
      count: result.hourlyDistribution[hour],
      authors,
    };
  });

  return { authors, fileTypes, directories, hourlyByAuthorArray };
}
