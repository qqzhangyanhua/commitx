import { spawn } from 'node:child_process';

export interface BlameLineInfo {
  authorTime: number;
  ageDays: number;
}

export interface NameStatusEvent {
  type: 'A' | 'M' | 'D' | 'R';
  path: string;
  oldPath?: string;
  date: Date;
  author: string;
  hash: string;
}

const CODE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.sh', '.bash', '.sql', '.vue', '.svelte'
]);

export async function listCodeFilesAtRev(repoPath: string, rev = 'HEAD'): Promise<string[]> {
  const output = await execGit(repoPath, ['ls-tree', '-r', '--name-only', rev]);
  return output
    .split('\n')
    .filter(f => f.trim())
    .filter(f => {
      const ext = f.substring(f.lastIndexOf('.'));
      return CODE_EXTENSIONS.has(ext);
    });
}

export async function blameFile(repoPath: string, rev: string, filePath: string): Promise<BlameLineInfo[]> {
  try {
    const output = await execGit(repoPath, ['blame', '--line-porcelain', rev, '--', filePath]);
    const lines = output.split('\n');
    const now = Date.now();
    const blameInfo: BlameLineInfo[] = [];

    for (const line of lines) {
      if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.substring(12), 10);
        if (!isNaN(timestamp)) {
          const ageDays = Math.floor((now - timestamp * 1000) / (1000 * 60 * 60 * 24));
          blameInfo.push({
            authorTime: timestamp,
            ageDays: Math.max(0, ageDays)
          });
        }
      }
    }

    return blameInfo;
  } catch {
    return [];
  }
}

export async function getNameStatusHistory(
  repoPath: string,
  beforeDate?: Date
): Promise<NameStatusEvent[]> {
  const args = ['log', '--reverse', '--name-status', '-M', '--format=%H|%aI|%an'];

  if (beforeDate) {
    args.push(`--before=${beforeDate.toISOString()}`);
  }

  try {
    const output = await execGit(repoPath, args);
    return parseNameStatusOutput(output);
  } catch {
    return [];
  }
}

function parseNameStatusOutput(output: string): NameStatusEvent[] {
  const events: NameStatusEvent[] = [];
  const lines = output.split('\n');
  let currentCommit: { hash: string; date: Date; author: string } | null = null;

  for (const line of lines) {
    if (line.includes('|')) {
      const [hash, dateStr, author] = line.split('|');
      currentCommit = { hash, date: new Date(dateStr), author };
    } else if (line.trim() && currentCommit) {
      const parts = line.trim().split('\t');
      const status = parts[0];

      if (status === 'A' || status === 'M' || status === 'D') {
        events.push({
          type: status as 'A' | 'M' | 'D',
          path: parts[1],
          date: currentCommit.date,
          author: currentCommit.author,
          hash: currentCommit.hash
        });
      } else if (status.startsWith('R')) {
        events.push({
          type: 'R',
          path: parts[2],
          oldPath: parts[1],
          date: currentCommit.date,
          author: currentCommit.author,
          hash: currentCommit.hash
        });
      }
    }
  }

  return events;
}

async function execGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    let stdout = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`git command failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}
