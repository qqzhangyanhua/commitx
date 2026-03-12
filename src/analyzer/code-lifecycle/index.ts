import type { CommitRecord, CodeLifecycleMetrics } from '../../types/index.js';
import { calculateCodeAge } from './code-age.js';
import { calculateFileLifecycle } from './file-lifecycle.js';
import { calculateDeletionRate } from './deletion-rate.js';

export async function calculateCodeLifecycle(
  repoPath: string,
  commits: CommitRecord[],
  options: { referenceDate?: Date } = {}
): Promise<CodeLifecycleMetrics> {
  const referenceDate = options.referenceDate || new Date();

  const [codeAge, fileLifecycle, deletionRate] = await Promise.all([
    calculateCodeAge(repoPath, 'HEAD'),
    calculateFileLifecycle(repoPath, referenceDate),
    Promise.resolve(calculateDeletionRate(commits))
  ]);

  return {
    codeAge,
    fileLifecycle,
    deletionRate
  };
}

export { calculateCodeAge } from './code-age.js';
export { calculateFileLifecycle } from './file-lifecycle.js';
export { calculateDeletionRate } from './deletion-rate.js';
