import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { ConfigFile } from '../types/index.js';

const CONFIG_FILENAMES = [
  '.commit-reportrc.json',
  'commit-report.config.json',
];

/**
 * 按优先级加载配置文件：
 * 1. --config 指定路径
 * 2. .commit-reportrc.json
 * 3. commit-report.config.json
 * 4. package.json 的 "commit-report" 字段
 */
export async function loadConfig(
  configPath?: string,
  searchDir?: string
): Promise<ConfigFile | null> {
  const baseDir = searchDir || process.cwd();

  if (configPath) {
    return readJsonFile<ConfigFile>(resolve(baseDir, configPath));
  }

  for (const filename of CONFIG_FILENAMES) {
    const found = await searchUp(filename, baseDir);
    if (found) return found;
  }

  const pkgConfig = await loadFromPackageJson(baseDir);
  if (pkgConfig) return pkgConfig;

  return null;
}

/**
 * 将配置文件值与 CLI 参数合并。CLI 参数优先。
 * 只有用户未通过 CLI 显式传入的值才从配置文件中取。
 */
export function mergeConfigWithOpts<T extends Record<string, unknown>>(
  opts: T,
  config: ConfigFile | null,
  cliDefaults: Record<string, unknown>
): T {
  if (!config) return opts;

  const merged = { ...opts };
  const configMapping: Record<string, keyof ConfigFile> = {
    period: 'period',
    output: 'output',
    format: 'format',
    depth: 'depth',
    quiet: 'quiet',
    template: 'template',
  };

  for (const [optKey, configKey] of Object.entries(configMapping)) {
    const configValue = config[configKey];
    if (configValue !== undefined && opts[optKey] === cliDefaults[optKey]) {
      (merged as Record<string, unknown>)[optKey] = configValue;
    }
  }

  return merged;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(
      `配置文件加载失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function searchUp(
  filename: string,
  startDir: string
): Promise<ConfigFile | null> {
  let dir = startDir;
  const root = resolve('/');

  while (dir !== root) {
    try {
      return await readJsonFile<ConfigFile>(resolve(dir, filename));
    } catch {
      dir = dirname(dir);
    }
  }
  return null;
}

async function loadFromPackageJson(
  startDir: string
): Promise<ConfigFile | null> {
  let dir = startDir;
  const root = resolve('/');

  while (dir !== root) {
    try {
      const pkg = await readJsonFile<Record<string, unknown>>(
        resolve(dir, 'package.json')
      );
      if (pkg['commit-report'] && typeof pkg['commit-report'] === 'object') {
        return pkg['commit-report'] as ConfigFile;
      }
      return null;
    } catch {
      dir = dirname(dir);
    }
  }
  return null;
}
