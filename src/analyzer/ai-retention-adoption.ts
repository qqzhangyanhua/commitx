import { execSync } from 'node:child_process';
import type {
  CommitRecord,
  AIToolId,
  ToolRetentionAdoption,
} from '../types/index.js';
import {
  detectAITools,
  calculateAIScore,
} from './tech-debt/ai-detector.js';

const REVERT_HASH_PATTERN = /This reverts commit ([a-f0-9]+)/i;

/**
 * 计算工具保留率与采纳率
 * @param commits 提交记录（≥50k 时仅用最后 1000 条）
 * @param repoPath 仓库路径
 */
export async function calculateToolRetentionAdoption(
  commits: CommitRecord[],
  repoPath: string
): Promise<ToolRetentionAdoption[]> {
  const limit = commits.length >= 50000 ? 1000 : commits.length;
  const sample = commits.slice(-limit);

  const commitToTools = new Map<string, AIToolId[]>();
  for (const c of sample) {
    const tools = detectAITools(c.message);
    const aiScore = calculateAIScore(c);
    const effectiveTools =
      tools.length > 0 ? tools : (aiScore > 0 ? (['other'] as AIToolId[]) : []);
    if (effectiveTools.length > 0) {
      commitToTools.set(c.hash, effectiveTools);
    }
  }

  const revertedHashes = findRevertedCommits(sample);
  const targetBranch = getTargetBranch(repoPath);

  const toolStats = new Map<
    AIToolId,
    { total: number; reverted: number; adopted: number }
  >();

  for (const [hash, tools] of commitToTools) {
    const isReverted = revertedHashes.has(hash);
    const isAdopted = await isCommitOnBranch(repoPath, hash, targetBranch);

    for (const toolId of tools) {
      const s = toolStats.get(toolId) || {
        total: 0,
        reverted: 0,
        adopted: 0,
      };
      s.total++;
      if (isReverted) s.reverted++;
      if (isAdopted) s.adopted++;
      toolStats.set(toolId, s);
    }
  }

  return Array.from(toolStats.entries()).map(([toolId, s]) => ({
    toolId,
    retentionRate: s.total > 0 ? ((s.total - s.reverted) / s.total) * 100 : 100,
    adoptionRate: s.total > 0 ? (s.adopted / s.total) * 100 : 0,
  }));
}

function findRevertedCommits(commits: CommitRecord[]): Set<string> {
  const reverted = new Set<string>();

  for (const c of commits) {
    const hashMatch = c.message.match(REVERT_HASH_PATTERN);
    if (hashMatch) {
      reverted.add(hashMatch[1]);
    }
  }

  return reverted;
}

function getTargetBranch(repoPath: string): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    if (branch && branch !== 'HEAD') {
      return branch;
    }
  } catch {
    // detached HEAD or error
  }

  for (const candidate of ['main', 'master']) {
    try {
      execSync(`git rev-parse --verify ${candidate}`, {
        cwd: repoPath,
        stdio: 'pipe',
      });
      return candidate;
    } catch {
      // branch doesn't exist
    }
  }

  return 'HEAD';
}

async function isCommitOnBranch(
  repoPath: string,
  commitHash: string,
  branch: string
): Promise<boolean> {
  try {
    execSync(`git merge-base --is-ancestor ${commitHash} ${branch}`, {
      cwd: repoPath,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}
