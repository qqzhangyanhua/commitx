import type { FileLifecycleStats, ShortLivedFile, ZombieFile, ActiveFile } from '../../types/index.js';
import { getNameStatusHistory, listCodeFilesAtRev, type NameStatusEvent } from './git-source.js';

const SHORT_LIVED_THRESHOLD_DAYS = 7;
const ZOMBIE_THRESHOLD_DAYS = 180;
const ACTIVE_FILE_MIN_EVENTS = 5;

interface FileLife {
  path: string;
  createdDate: Date;
  createdBy: string;
  lastModifiedDate: Date;
  lastAuthor: string;
  deletedDate?: Date;
  eventCount: number;
  isDeleted: boolean;
}

export async function calculateFileLifecycle(
  repoPath: string,
  referenceDate?: Date
): Promise<FileLifecycleStats> {
  try {
    const events = await getNameStatusHistory(repoPath, referenceDate);
    const lives = buildFileLives(events);

    const currentFiles = await listCodeFilesAtRev(repoPath, 'HEAD');
    const currentFileSet = new Set(currentFiles);

    const now = referenceDate || new Date();

    return categorizeFiles(lives, currentFileSet, now);
  } catch {
    return emptyFileLifecycleStats();
  }
}

function buildFileLives(events: NameStatusEvent[]): Map<string, FileLife> {
  const lives = new Map<string, FileLife>();

  for (const event of events) {
    if (event.type === 'A') {
      if (!lives.has(event.path)) {
        lives.set(event.path, {
          path: event.path,
          createdDate: event.date,
          createdBy: event.author,
          lastModifiedDate: event.date,
          lastAuthor: event.author,
          eventCount: 1,
          isDeleted: false
        });
      }
    } else if (event.type === 'M') {
      const life = lives.get(event.path);
      if (life) {
        life.lastModifiedDate = event.date;
        life.lastAuthor = event.author;
        life.eventCount++;
      } else {
        lives.set(event.path, {
          path: event.path,
          createdDate: event.date,
          createdBy: event.author,
          lastModifiedDate: event.date,
          lastAuthor: event.author,
          eventCount: 1,
          isDeleted: false
        });
      }
    } else if (event.type === 'D') {
      const life = lives.get(event.path);
      if (life) {
        life.deletedDate = event.date;
        life.isDeleted = true;
        life.eventCount++;
      }
    } else if (event.type === 'R' && event.oldPath) {
      const oldLife = lives.get(event.oldPath);
      if (oldLife) {
        lives.delete(event.oldPath);
        lives.set(event.path, {
          ...oldLife,
          path: event.path,
          lastModifiedDate: event.date,
          lastAuthor: event.author,
          eventCount: oldLife.eventCount + 1
        });
      }
    }
  }

  return lives;
}

function categorizeFiles(
  lives: Map<string, FileLife>,
  currentFileSet: Set<string>,
  referenceDate: Date
): FileLifecycleStats {
  const shortLived: ShortLivedFile[] = [];
  const zombies: ZombieFile[] = [];
  const active: ActiveFile[] = [];
  let totalDeleted = 0;

  for (const life of lives.values()) {
    if (life.isDeleted && life.deletedDate) {
      totalDeleted++;
      const lifespanDays = daysBetween(life.createdDate, life.deletedDate);
      if (lifespanDays <= SHORT_LIVED_THRESHOLD_DAYS) {
        shortLived.push({
          path: life.path,
          createdDate: life.createdDate,
          deletedDate: life.deletedDate,
          lifespanDays,
          createdBy: life.createdBy
        });
      }
    } else if (currentFileSet.has(life.path)) {
      const daysSince = daysBetween(life.lastModifiedDate, referenceDate);

      if (daysSince > ZOMBIE_THRESHOLD_DAYS) {
        zombies.push({
          path: life.path,
          createdDate: life.createdDate,
          lastModifiedDate: life.lastModifiedDate,
          daysSinceLastModified: daysSince,
          lastAuthor: life.lastAuthor
        });
      }

      if (life.eventCount >= ACTIVE_FILE_MIN_EVENTS) {
        const lifespanDays = daysBetween(life.createdDate, life.lastModifiedDate);
        active.push({
          path: life.path,
          createdDate: life.createdDate,
          lastModifiedDate: life.lastModifiedDate,
          modifyCount: life.eventCount,
          lifespanDays
        });
      }
    }
  }

  return {
    shortLivedFiles: shortLived
      .sort((a, b) => a.lifespanDays - b.lifespanDays)
      .slice(0, 20),
    zombieFiles: zombies
      .sort((a, b) => b.daysSinceLastModified - a.daysSinceLastModified)
      .slice(0, 20),
    activeFiles: active
      .sort((a, b) => b.modifyCount - a.modifyCount)
      .slice(0, 50),
    totalFilesCreated: lives.size,
    totalFilesDeleted: totalDeleted
  };
}

function daysBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function emptyFileLifecycleStats(): FileLifecycleStats {
  return {
    shortLivedFiles: [],
    zombieFiles: [],
    activeFiles: [],
    totalFilesCreated: 0,
    totalFilesDeleted: 0
  };
}
