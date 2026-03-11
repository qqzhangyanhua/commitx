import type {
  CommitRecord,
  QualityMetrics,
  CollaborationMetrics,
  CommitMessageStats,
  AuthorFileTypeContribution,
  HotFile,
  SoloFile,
  CollabFile,
} from '../types/index.js';
import { extname } from 'node:path';

export function emptyQualityMetrics(): QualityMetrics {
  return {
    avgFilesPerCommit: 0,
    avgLinesPerCommit: 0,
    churnRate: 0,
    hotFiles: [],
  };
}

export function emptyCollaborationMetrics(): CollaborationMetrics {
  return {
    soloFiles: [],
    collaborationHotspots: [],
  };
}

export function emptyMessageStats(): CommitMessageStats {
  return {
    typeDistribution: {},
    avgMessageLength: 0,
  };
}

/** 计算代码质量指标 */
export function calculateQualityMetrics(commits: CommitRecord[]): QualityMetrics {
  if (commits.length === 0) {
    return emptyQualityMetrics();
  }

  const totalFiles = commits.reduce((sum, c) => sum + c.files.length, 0);
  const avgFilesPerCommit = totalFiles / commits.length;

  const totalLines = commits.reduce(
    (sum, c) => sum + c.files.reduce((s, f) => s + f.added + f.deleted, 0),
    0
  );
  const avgLinesPerCommit = totalLines / commits.length;

  const totalAdded = commits.reduce(
    (sum, c) => sum + c.files.reduce((s, f) => s + f.added, 0),
    0
  );
  const totalDeleted = commits.reduce(
    (sum, c) => sum + c.files.reduce((s, f) => s + f.deleted, 0),
    0
  );
  const churnRate = totalAdded > 0 ? totalDeleted / totalAdded : 0;

  const fileModifyMap = new Map<string, { count: number; authors: Set<string> }>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const entry = fileModifyMap.get(file.path) || {
        count: 0,
        authors: new Set<string>(),
      };
      entry.count++;
      entry.authors.add(commit.author);
      fileModifyMap.set(file.path, entry);
    }
  }

  const hotFiles: HotFile[] = Array.from(fileModifyMap.entries())
    .map(([path, data]) => ({
      path,
      modifyCount: data.count,
      authors: Array.from(data.authors),
    }))
    .sort((a, b) => b.modifyCount - a.modifyCount)
    .slice(0, 10);

  return { avgFilesPerCommit, avgLinesPerCommit, churnRate, hotFiles };
}

/** 计算协作指标 */
export function calculateCollaboration(
  commits: CommitRecord[]
): CollaborationMetrics {
  if (commits.length === 0) {
    return emptyCollaborationMetrics();
  }

  const fileAuthors = new Map<string, Set<string>>();
  const fileCommits = new Map<string, number>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const authors = fileAuthors.get(file.path) || new Set<string>();
      authors.add(commit.email.toLowerCase());
      fileAuthors.set(file.path, authors);
      fileCommits.set(file.path, (fileCommits.get(file.path) || 0) + 1);
    }
  }

  const soloFiles: SoloFile[] = [];
  const collaborationHotspots: CollabFile[] = [];

  for (const [path, authors] of fileAuthors) {
    const commitCount = fileCommits.get(path) || 0;
    if (authors.size === 1 && commitCount >= 3) {
      soloFiles.push({
        path,
        author: Array.from(authors)[0],
        commits: commitCount,
      });
    } else if (authors.size >= 2 && commitCount >= 5) {
      collaborationHotspots.push({
        path,
        authorCount: authors.size,
        totalCommits: commitCount,
      });
    }
  }

  return {
    soloFiles: soloFiles.sort((a, b) => b.commits - a.commits).slice(0, 10),
    collaborationHotspots: collaborationHotspots
      .sort((a, b) => b.totalCommits - a.totalCommits)
      .slice(0, 10),
  };
}

/** 计算 Commit Message 统计 */
export function calculateMessageStats(
  commits: CommitRecord[]
): CommitMessageStats {
  if (commits.length === 0) {
    return emptyMessageStats();
  }

  const typeDistribution: Record<string, number> = {};
  let totalLength = 0;

  const typeRegex =
    /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/i;

  for (const commit of commits) {
    totalLength += commit.message.length;
    const match = commit.message.match(typeRegex);
    if (match) {
      const type = match[1].toLowerCase();
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    } else {
      typeDistribution['other'] = (typeDistribution['other'] || 0) + 1;
    }
  }

  return {
    typeDistribution,
    avgMessageLength: totalLength / commits.length,
  };
}

/** 计算作者文件类型贡献 */
export function calculateAuthorFileTypeContributions(
  commits: CommitRecord[]
): AuthorFileTypeContribution[] {
  if (commits.length === 0) {
    return [];
  }

  const contributionMap = new Map<string, AuthorFileTypeContribution>();
  const uniqueFilesMap = new Map<string, Set<string>>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const ext = extname(file.path).toLowerCase() || '(无扩展名)';
      const key = `${commit.email.toLowerCase()}|||${ext}`;

      let contribution = contributionMap.get(key);
      if (!contribution) {
        contribution = {
          author: commit.author,
          email: commit.email,
          extension: ext,
          linesAdded: 0,
          linesDeleted: 0,
          commits: 0,
          fileCount: 0,
        };
        contributionMap.set(key, contribution);
        uniqueFilesMap.set(key, new Set());
      }

      contribution.linesAdded += file.added;
      contribution.linesDeleted += file.deleted;
      uniqueFilesMap.get(key)!.add(file.path);
    }
  }

  const commitCountMap = new Map<string, Set<string>>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const ext = extname(file.path).toLowerCase() || '(无扩展名)';
      const key = `${commit.email.toLowerCase()}|||${ext}`;

      if (!commitCountMap.has(key)) {
        commitCountMap.set(key, new Set());
      }
      commitCountMap.get(key)!.add(commit.hash);
    }
  }

  for (const [key, contribution] of contributionMap) {
    contribution.commits = commitCountMap.get(key)?.size || 0;
    contribution.fileCount = uniqueFilesMap.get(key)?.size || 0;
  }

  return Array.from(contributionMap.values())
    .sort((a, b) => {
      const totalA = a.linesAdded + a.linesDeleted;
      const totalB = b.linesAdded + b.linesDeleted;
      return totalB - totalA;
    })
    .slice(0, 20);
}
