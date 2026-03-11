import { Command } from 'commander';
import chalk from 'chalk';
import { checkbox } from '@inquirer/prompts';
import { resolve as resolvePath } from 'node:path';
import { scanRepositories } from '../scanner/index.js';
import { analyzeRepos } from '../analyzer/index.js';
import { generateReport } from '../reporter/index.js';
import { resolveTimeRange, calculateCompareRange } from './time-utils.js';
import { loadConfig, mergeConfigWithOpts } from './config-loader.js';
import { compareStats } from '../analyzer/compare-engine.js';
import {
  buildSnapshotFromStats,
  calculateBaselineSummary,
} from '../history/baseline-engine.js';
import {
  buildRepoKey,
  loadSnapshots,
  pruneSnapshots,
  saveSnapshot,
} from '../history/snapshot-store.js';
import { generateInsights } from '../history/insight-engine.js';
import type {
  BaselineSummary,
  CliOptions,
  CliRawOptions,
  InsightItem,
  RepoInfo,
  AuthorAlias,
  CompareResult,
  ReportFormat,
} from '../types/index.js';

const program = new Command();

program
  .name('commit-report')
  .description('Git 提交统计工具，生成可视化 HTML 报告')
  .version('1.1.0')
  .argument('[directory]', '要扫描的目录路径', process.cwd())
  .option('-p, --period <period>', '时间预设 (7d/1m/3m/6m/1y/all)', 'all')
  .option('-f, --from <date>', '起始日期 (YYYY-MM-DD)')
  .option('-t, --to <date>', '结束日期 (YYYY-MM-DD)')
  .option('-a, --author <name>', '按作者过滤')
  .option('-o, --output <file>', '输出文件名', 'commit-report.html')
  .option('--no-open', '不自动打开浏览器')
  .option('-d, --depth <number>', '最大扫描深度', '20')
  .option('--format <format>', '输出格式 (html/json/markdown)', 'html')
  .option('-q, --quiet', 'CI 静默模式，跳过交互', false)
  .option('--compare <period>', '对比前一个时间段（例如 3m）')
  .option('--template <path>', '自定义 HTML 模板路径')
  .option('--config <path>', '配置文件路径')
  .option('--alias <path>', '作者别名 JSON 文件路径')
  .action(async (directory: string, rawOpts: CliRawOptions) => {
    try {
      await run(directory, rawOpts);
    } catch (error) {
      const quiet = getBooleanOption(rawOpts.quiet, false);
      if (error instanceof Error && error.message === 'USER_CANCEL') {
        if (!quiet) console.log(chalk.yellow('\n已取消操作'));
        process.exit(0);
      }

      console.error(
        chalk.red(`\n错误: ${error instanceof Error ? error.message : String(error)}`)
      );
      process.exit(1);
    }
  });

const CLI_DEFAULTS: CliRawOptions = {
  period: 'all',
  output: 'commit-report.html',
  format: 'html',
  depth: '20',
  quiet: false,
};

async function run(directory: string, rawOpts: CliRawOptions): Promise<void> {
  await checkGitInstalled();

  const configPath = getOptionalString(rawOpts.config);
  const config = await loadConfig(configPath, directory);
  const mergedOpts = mergeConfigWithOpts(rawOpts, config, CLI_DEFAULTS);
  const opts = normalizeCliOptions(mergedOpts);
  const authorAliasesFromConfig = config?.authorAliases;

  const timeRange = resolveTimeRange(opts);
  const repos = await scanRepositories({
    targetDir: directory,
    maxDepth: opts.depth,
  });

  if (repos.length === 0) {
    if (!opts.quiet) console.log(chalk.red('未找到 Git 仓库'));
    process.exit(1);
  }

  const selectedRepos = await selectRepos(repos, opts.quiet);

  if (!opts.quiet) {
    const timeRangeText = timeRange
      ? `${formatDate(timeRange.from)} ~ ${formatDate(timeRange.to)}`
      : '所有提交';
    console.log(
      chalk.gray(`\n已选择 ${selectedRepos.length} 个仓库，时间范围：${timeRangeText}\n`)
    );
  }

  const authorAliases =
    (await loadAuthorAliases(opts.alias)) || authorAliasesFromConfig;

  const stats = await analyzeRepos(
    {
      repos: selectedRepos,
      timeRange,
      author: opts.author,
      quiet: opts.quiet,
    },
    authorAliases
  );

  if (stats.totalCommits === 0 && !opts.quiet) {
    console.log(chalk.yellow('该时间段内没有提交记录'));
  }

  const compare = await buildCompareResult(
    stats,
    selectedRepos,
    timeRange,
    opts,
    authorAliases
  );

  const historicalContext = await buildHistoricalContext(
    resolvePath(directory),
    selectedRepos,
    stats,
    timeRange,
    opts
  );

  await generateReport(stats, {
    outputPath: opts.output,
    autoOpen: opts.open,
    timeRange,
    repoNames: selectedRepos.map((repo) => repo.name),
    format: opts.format,
    quiet: opts.quiet,
    templatePath: opts.template,
    compare,
    baseline: historicalContext.baseline,
    insights: historicalContext.insights,
  });
}

async function selectRepos(repos: RepoInfo[], quiet: boolean): Promise<RepoInfo[]> {
  if (quiet || repos.length === 1) {
    if (!quiet) {
      const suffix = repos.length === 1
        ? `: ${repos[0].name}`
        : '（静默模式，已全选）';
      console.log(chalk.cyan(`找到 ${repos.length} 个 Git 仓库${suffix}`));
    }
    return repos;
  }

  console.log(chalk.cyan(`\n找到 ${repos.length} 个 Git 仓库:\n`));
  const selected = await checkbox<string>({
    message: '选择要分析的仓库（空格选择，回车确认）',
    choices: repos.map((repo) => ({
      name: `${repo.name} (${repo.commitCount} commits)`,
      value: repo.path,
      checked: true,
    })),
  });

  if (selected.length === 0) {
    console.log(chalk.yellow('未选择任何仓库'));
    process.exit(0);
  }

  return repos.filter((repo) => selected.includes(repo.path));
}

async function buildCompareResult(
  stats: Awaited<ReturnType<typeof analyzeRepos>>,
  selectedRepos: RepoInfo[],
  timeRange: ReturnType<typeof resolveTimeRange>,
  opts: CliOptions,
  authorAliases?: AuthorAlias[]
): Promise<CompareResult | undefined> {
  if (!opts.compare || !timeRange) {
    return undefined;
  }

  const prevRange = calculateCompareRange(timeRange, opts.compare);
  if (!opts.quiet) {
    console.log(
      chalk.gray(`对比时间段：${formatDate(prevRange.from)} ~ ${formatDate(prevRange.to)}`)
    );
  }

  const prevStats = await analyzeRepos(
    {
      repos: selectedRepos,
      timeRange: prevRange,
      author: opts.author,
      quiet: true,
    },
    authorAliases
  );

  const compare = compareStats(
    stats,
    prevStats,
    {
      from: formatDate(timeRange.from),
      to: formatDate(timeRange.to),
    },
    {
      from: formatDate(prevRange.from),
      to: formatDate(prevRange.to),
    }
  );

  if (!opts.quiet && compare.highlights.length > 0) {
    console.log(chalk.cyan('\n对比亮点:'));
    compare.highlights.forEach((highlight) => {
      console.log(chalk.gray(`  - ${highlight}`));
    });
    console.log('');
  }

  return compare;
}

async function buildHistoricalContext(
  baseDir: string,
  selectedRepos: RepoInfo[],
  stats: Awaited<ReturnType<typeof analyzeRepos>>,
  timeRange: ReturnType<typeof resolveTimeRange>,
  opts: CliOptions
): Promise<{
  baseline?: BaselineSummary;
  insights?: InsightItem[];
}> {
  try {
    const repoNames = selectedRepos.map((repo) => repo.name);
    const repoPaths = selectedRepos.map((repo) => repo.path);
    const repoKey = buildRepoKey(repoPaths, repoNames, opts.period);
    const currentSnapshot = buildSnapshotFromStats({
      repoKey,
      repoNames,
      stats,
      timeRange,
      period: opts.period,
    });

    const history = await loadSnapshots(baseDir, repoKey);
    const baseline = calculateBaselineSummary([...history, currentSnapshot]);
    const insights = generateInsights(currentSnapshot, baseline, stats);

    await saveSnapshot(baseDir, currentSnapshot);
    await pruneSnapshots(baseDir, repoKey);

    return {
      baseline: hasBaselineData(baseline) ? baseline : undefined,
      insights: insights.length > 0 ? insights : undefined,
    };
  } catch (error) {
    if (!opts.quiet) {
      console.log(
        chalk.yellow(
          `历史快照生成失败，已跳过增强分析: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }

    return {};
  }
}

function hasBaselineData(baseline: BaselineSummary): boolean {
  return baseline.weekly.length > 0 || baseline.monthly.length > 0;
}

function normalizeCliOptions(rawOpts: CliRawOptions): CliOptions {
  return {
    period: getStringOption(rawOpts.period, 'all'),
    from: getOptionalString(rawOpts.from),
    to: getOptionalString(rawOpts.to),
    author: getOptionalString(rawOpts.author),
    output: getStringOption(rawOpts.output, 'commit-report.html'),
    open: getBooleanOption(rawOpts.open, true),
    depth: getNumberOption(rawOpts.depth, 20, 'depth'),
    format: getReportFormat(rawOpts.format),
    quiet: getBooleanOption(rawOpts.quiet, false),
    compare: getOptionalString(rawOpts.compare),
    template: getOptionalString(rawOpts.template),
    config: getOptionalString(rawOpts.config),
    alias: getOptionalString(rawOpts.alias),
  };
}

function getStringOption(value: unknown, defaultValue: string): string {
  return typeof value === 'string' && value.length > 0 ? value : defaultValue;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getBooleanOption(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

function getNumberOption(
  value: unknown,
  defaultValue: number,
  optionName: string
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (value === undefined) {
    return defaultValue;
  }

  throw new Error(`无效的 ${optionName} 参数: ${String(value)}`);
}

function getReportFormat(value: unknown): ReportFormat {
  const format = getStringOption(value, 'html');
  if (format === 'html' || format === 'json' || format === 'markdown') {
    return format;
  }
  throw new Error(`不支持的输出格式: ${format}`);
}

async function loadAuthorAliases(aliasPath?: string): Promise<AuthorAlias[] | undefined> {
  if (!aliasPath) return undefined;

  try {
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(aliasPath, 'utf-8');
    return JSON.parse(content) as AuthorAlias[];
  } catch (error) {
    throw new Error(
      `无法加载别名文件 ${aliasPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function checkGitInstalled(): Promise<void> {
  const { execSync } = await import('node:child_process');
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    console.error(chalk.red('请先安装 Git'));
    process.exit(1);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n已取消操作'));
  process.exit(0);
});

program.parse();
