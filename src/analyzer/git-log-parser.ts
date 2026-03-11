import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ig from 'ignore';
import type { CommitRecord, FileChange, TimeRange } from '../types/index.js';

/** git log 的格式化分隔符 */
const COMMIT_SEPARATOR = '---COMMITX_SEP---';
const FIELD_SEPARATOR = '|';
/** Body 大小上限 64KB */
const BODY_CAP_BYTES = 64 * 1024;
/** 包含 subject + body */
const FORMAT = `${COMMIT_SEPARATOR}%H${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s%n%b`;

/**
 * 从指定仓库解析 git log，返回提交记录数组
 * timeRange 为 null 时表示获取所有提交
 */
export async function parseGitLog(
  repoPath: string,
  timeRange: TimeRange | null,
  author?: string
): Promise<CommitRecord[]> {
  const ignoreFilter = await loadGitignore(repoPath);

  const args = [
    'git',
    'log',
    `--format="${FORMAT}"`,
    '--numstat',
  ];

  if (timeRange) {
    args.push(`--since="${timeRange.from.toISOString()}"`);
    args.push(`--until="${timeRange.to.toISOString()}"`);
  }

  if (author) {
    args.push(`--author="${author}"`);
  }

  let output: string;
  try {
    output = execSync(args.join(' '), {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large repos
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return [];
  }

  if (!output.trim()) {
    return [];
  }

  return parseOutput(output, ignoreFilter);
}

/** 判断是否为 numstat 行 (added\tdeleted\tpath) */
function isNumstatLine(line: string): boolean {
  const tabParts = line.split('\t');
  if (tabParts.length !== 3) return false;
  const [a, d] = tabParts;
  return (a === '-' || !Number.isNaN(parseInt(a, 10))) &&
    (d === '-' || !Number.isNaN(parseInt(d, 10)));
}

/**
 * 解析 git log 输出文本为 CommitRecord 数组
 * 支持 subject + body，body 上限 64KB
 */
function parseOutput(
  output: string,
  ignoreFilter: ReturnType<typeof ig>
): CommitRecord[] {
  const commits: CommitRecord[] = [];
  const blocks = output.split(COMMIT_SEPARATOR).filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;

    const headerLine = lines[0].replace(/^"|"$/g, '');
    const parts = headerLine.split(FIELD_SEPARATOR);
    if (parts.length < 5) continue;

    const [hash, authorName, email, dateStr, subject, ...subjectRest] = parts;
    const subjectFull = [subject, ...subjectRest].join(FIELD_SEPARATOR).trim();

    let bodyLines: string[] = [];
    let bodyByteCount = 0;
    let fileStartIndex = 1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (isNumstatLine(line)) {
        fileStartIndex = i;
        break;
      }
      if (bodyByteCount >= BODY_CAP_BYTES) continue;
      const lineBytes = Buffer.byteLength(line, 'utf8');
      if (bodyByteCount + lineBytes + 20 > BODY_CAP_BYTES) {
        bodyLines.push('\n...(truncated)');
        fileStartIndex = i;
        break;
      }
      bodyLines.push(line);
      bodyByteCount += lineBytes + 1;
    }

    const body = bodyLines.join('\n').trimEnd();
    const message = body ? `${subjectFull}\n${body}` : subjectFull;

    const files: FileChange[] = [];
    for (let i = fileStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !isNumstatLine(line)) continue;

      const tabParts = line.split('\t');
      const [addedStr, deletedStr, filePath] = tabParts;

      const added = addedStr === '-' ? 0 : parseInt(addedStr, 10) || 0;
      const deleted = deletedStr === '-' ? 0 : parseInt(deletedStr, 10) || 0;

      if (ignoreFilter.ignores(filePath)) continue;

      files.push({ added, deleted, path: filePath });
    }

    commits.push({
      hash,
      author: authorName,
      email,
      date: new Date(dateStr),
      message,
      files,
    });
  }

  return commits;
}

/**
 * 读取仓库的 .gitignore 规则
 */
async function loadGitignore(repoPath: string): Promise<ReturnType<typeof ig>> {
  const ignoreInstance = ig();

  try {
    const content = await readFile(join(repoPath, '.gitignore'), 'utf-8');
    ignoreInstance.add(content);
  } catch {
    // 没有 .gitignore 文件，跳过
  }

  // 默认忽略一些常见的生成文件
  ignoreInstance.add([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ]);

  return ignoreInstance;
}
