import { execSync } from 'node:child_process';
import type { BranchStats, StaleBranch, MergeFrequencyPoint } from '../types/index.js';

const STALE_THRESHOLD_DAYS = 30;

/**
 * 分析仓库的分支统计
 */
export function calculateBranchStats(repoPath: string): BranchStats {
  const branches = getRemoteBranches(repoPath);
  const merges = getMergeHistory(repoPath);
  const staleBranches = findStaleBranches(repoPath, branches);

  const lifespans = calculateBranchLifespans(repoPath, merges);
  const avgBranchLifespanDays = lifespans.length > 0
    ? lifespans.reduce((a, b) => a + b, 0) / lifespans.length
    : 0;

  const mergeFrequency = buildMergeFrequency(merges);

  return {
    activeBranches: branches.length - staleBranches.length,
    staleBranches,
    avgBranchLifespanDays: Math.round(avgBranchLifespanDays * 10) / 10,
    mergeFrequency,
    totalMerges: merges.length,
  };
}

interface MergeRecord {
  hash: string;
  date: Date;
  message: string;
  branch: string;
}

function getRemoteBranches(repoPath: string): string[] {
  try {
    const output = execSync(
      'git branch -r --format="%(refname:short)"',
      { cwd: repoPath, encoding: 'utf-8', timeout: 10000 }
    );
    return output
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b && !b.includes('HEAD'));
  } catch {
    return [];
  }
}

function findStaleBranches(repoPath: string, branches: string[]): StaleBranch[] {
  const now = Date.now();
  const stale: StaleBranch[] = [];

  for (const branch of branches) {
    if (branch.endsWith('/main') || branch.endsWith('/master')) continue;

    try {
      const info = execSync(
        `git log -1 --format="%ai|%an" "${branch}"`,
        { cwd: repoPath, encoding: 'utf-8', timeout: 5000 }
      ).trim();

      const [dateStr, author] = info.split('|');
      if (!dateStr) continue;

      const lastCommitDate = new Date(dateStr);
      const daysSince = Math.floor(
        (now - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSince >= STALE_THRESHOLD_DAYS) {
        stale.push({
          name: branch.replace(/^origin\//, ''),
          lastCommitDate: lastCommitDate.toISOString().split('T')[0],
          daysSinceLastCommit: daysSince,
          author: author || 'unknown',
        });
      }
    } catch {
      // skip inaccessible branches
    }
  }

  return stale
    .sort((a, b) => b.daysSinceLastCommit - a.daysSinceLastCommit)
    .slice(0, 20);
}

function getMergeHistory(repoPath: string): MergeRecord[] {
  try {
    const output = execSync(
      'git log --merges --format="%H|%ai|%s" -500',
      { cwd: repoPath, encoding: 'utf-8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
    );

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, dateStr, ...msgParts] = line.split('|');
        const message = msgParts.join('|');
        const branchMatch = message.match(/Merge (?:branch|pull request) '?(.+?)'?(?:\s|$|into)/);
        return {
          hash: hash || '',
          date: new Date(dateStr || ''),
          message,
          branch: branchMatch?.[1] || '',
        };
      })
      .filter((m) => !isNaN(m.date.getTime()));
  } catch {
    return [];
  }
}

function calculateBranchLifespans(
  repoPath: string,
  merges: MergeRecord[]
): number[] {
  const lifespans: number[] = [];
  const sampled = merges.slice(0, 100);

  for (const merge of sampled) {
    if (!merge.branch) continue;
    try {
      const firstCommitDate = execSync(
        `git log --format="%ai" --reverse "${merge.hash}^2" 2>/dev/null | head -1`,
        { cwd: repoPath, encoding: 'utf-8', timeout: 5000, shell: '/bin/bash' }
      ).trim();

      if (firstCommitDate) {
        const start = new Date(firstCommitDate);
        const end = merge.date;
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) {
          lifespans.push(days);
        }
      }
    } catch {
      // skip
    }
  }

  return lifespans;
}

function buildMergeFrequency(merges: MergeRecord[]): MergeFrequencyPoint[] {
  const weekMap = new Map<string, number>();

  for (const merge of merges) {
    const d = merge.date;
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    const key = monday.toISOString().split('T')[0];
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, mergeCount]) => ({ week, merges: mergeCount }));
}
