import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HistorySnapshot } from '../types/index.js';

const SNAPSHOT_SCHEMA_VERSION = 1;
const DEFAULT_KEEP_COUNT = 100;

/** 生成稳定的仓库分组标识（包含时间范围以避免不同时间段数据混淆） */
export function buildRepoKey(
  repoPaths: string[],
  repoNames: string[] = [],
  period?: string
): string {
  const sortedPaths = [...repoPaths].sort((a, b) => a.localeCompare(b));
  const pathsWithPeriod = period
    ? `${sortedPaths.join('|')}::${period}`
    : sortedPaths.join('|');
  const hash = createHash('sha1')
    .update(pathsWithPeriod)
    .digest('hex')
    .slice(0, 12);

  const prefix = repoNames.length > 0
    ? repoNames
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((name) => sanitizeSegment(name))
      .filter(Boolean)
      .slice(0, 3)
      .join('-')
    : 'repos';

  return `${prefix || 'repos'}-${hash}`;
}

/** 获取历史快照根目录 */
export function getHistoryDir(baseDir: string): string {
  return join(baseDir, '.commit-report', 'history');
}

/** 保存快照到本地 */
export async function saveSnapshot(
  baseDir: string,
  snapshot: HistorySnapshot
): Promise<string> {
  const repoDir = join(getHistoryDir(baseDir), snapshot.repoKey);
  await mkdir(repoDir, { recursive: true });

  const filename = `${toFileTimestamp(snapshot.generatedAt)}.json`;
  const outputPath = join(repoDir, filename);
  const payload: HistorySnapshot = {
    ...snapshot,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  };

  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
  return outputPath;
}

/** 读取某个仓库分组的全部快照 */
export async function loadSnapshots(
  baseDir: string,
  repoKey: string
): Promise<HistorySnapshot[]> {
  const repoDir = join(getHistoryDir(baseDir), repoKey);

  try {
    const files = await readdir(repoDir);
    const snapshots: HistorySnapshot[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await readFile(join(repoDir, file), 'utf-8');
        const snapshot = JSON.parse(content) as HistorySnapshot;
        if (snapshot.repoKey === repoKey) {
          snapshots.push(snapshot);
        }
      } catch {
        // 单个快照损坏时跳过，避免影响整体报告生成
      }
    }

    return snapshots.sort((a, b) =>
      new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
    );
  } catch {
    return [];
  }
}

/** 清理过旧快照，避免历史目录无限增长 */
export async function pruneSnapshots(
  baseDir: string,
  repoKey: string,
  keep = DEFAULT_KEEP_COUNT
): Promise<void> {
  const repoDir = join(getHistoryDir(baseDir), repoKey);

  try {
    const files = (await readdir(repoDir))
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));

    const staleFiles = files.slice(0, Math.max(0, files.length - keep));
    await Promise.all(
      staleFiles.map((file) => rm(join(repoDir, file), { force: true }))
    );
  } catch {
    // 历史目录不存在或清理失败时，不阻塞主流程
  }
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function toFileTimestamp(isoString: string): string {
  return isoString
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
}

