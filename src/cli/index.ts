import { Command } from 'commander';
import chalk from 'chalk';
import { checkbox } from '@inquirer/prompts';
import { scanRepositories } from '../scanner/index.js';
import { analyzeRepos } from '../analyzer/index.js';
import { generateReport } from '../reporter/index.js';
import { resolveTimeRange, calculateCompareRange } from './time-utils.js';
import { loadConfig, mergeConfigWithOpts } from './config-loader.js';
import { compareStats } from '../analyzer/compare-engine.js';
import type { CliOptions, RepoInfo, AuthorAlias, CompareResult } from '../types/index.js';

const program = new Command();

program
  .name('commit-report')
  .description('Git 提交统计工具，生成可视化 HTML 报告')
  .version('1.1.0')
  .argument('[directory]', '要扫描的目录路径', process.cwd())
  .option('-p, --period <period>', '时间预设 (7d/1m/3m/6m/1y/all)', 'all')
  .option('-f, --from <date>', '起始日期 (YYYY-MM-DD)')
  .option('-t, --to <date>', '结束日期 (YYYY-MM-DD)')
  .option('-a, --author <name>', '过滤作者')
  .option('-o, --output <file>', '输出文件名', 'commit-report.html')
  .option('--no-open', '不自动打开浏览器')
  .option('-d, --depth <number>', '最大扫描深度', '20')
  .option('--format <format>', '输出格式 (html/json/markdown)', 'html')
  .option('-q, --quiet', 'CI 静默模式，跳过交互', false)
  .option('--compare <period>', '对比前一时间段 (如 3m)')
  .option('--template <path>', '自定义 HTML 模板路径')
  .option('--config <path>', '配置文件路径')
  .option('--alias <path>', '作者别名 JSON 文件路径')
  .action(async (directory: string, opts: CliOptions) => {
    try {
      await run(directory, opts);
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_CANCEL') {
        if (!opts.quiet) console.log(chalk.yellow('\n已取消操作'));
        process.exit(0);
      }
      console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

const CLI_DEFAULTS: Record<string, unknown> = {
  period: 'all',
  output: 'commit-report.html',
  format: 'html',
  depth: '20',
  quiet: false,
};

async function run(directory: string, rawOpts: CliOptions): Promise<void> {
  await checkGitInstalled();

  const config = await loadConfig(rawOpts.config, directory);
  const opts = mergeConfigWithOpts(rawOpts, config, CLI_DEFAULTS);
  const authorAliasesFromConfig = config?.authorAliases;

  const timeRange = resolveTimeRange(opts);

  const repos = await scanRepositories({
    targetDir: directory,
    maxDepth: Number(opts.depth),
  });

  if (repos.length === 0) {
    if (!opts.quiet) console.log(chalk.red('未找到 Git 仓库'));
    process.exit(1);
  }

  let selectedRepos: RepoInfo[];

  if (opts.quiet || repos.length === 1) {
    selectedRepos = repos;
    if (!opts.quiet) {
      console.log(chalk.cyan(`找到 ${repos.length} 个 Git 仓库${repos.length === 1 ? ': ' + repos[0].name : '（静默模式，已全选）'}`));
    }
  } else {
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

    selectedRepos = repos.filter((r) => selected.includes(r.path));
  }

  if (!opts.quiet) {
    const timeRangeText = timeRange
      ? `${formatDate(timeRange.from)} ~ ${formatDate(timeRange.to)}`
      : '所有提交';
    console.log(
      chalk.gray(
        `\n已选择 ${selectedRepos.length} 个仓库，时间范围：${timeRangeText}\n`
      )
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
    console.log(chalk.yellow('该时间段无提交记录'));
  }

  let compare: CompareResult | undefined;
  if (opts.compare && timeRange) {
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
    compare = compareStats(
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
      compare.highlights.forEach((h) => console.log(chalk.gray(`  • ${h}`)));
      console.log('');
    }
  }

  await generateReport(stats, {
    outputPath: opts.output,
    autoOpen: opts.open,
    timeRange,
    repoNames: selectedRepos.map((r) => r.name),
    format: opts.format,
    quiet: opts.quiet,
    templatePath: opts.template,
    compare,
  });
}

async function loadAuthorAliases(aliasPath?: string): Promise<AuthorAlias[] | undefined> {
  if (!aliasPath) return undefined;
  try {
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(aliasPath, 'utf-8');
    return JSON.parse(content) as AuthorAlias[];
  } catch (error) {
    throw new Error(`无法加载别名文件 ${aliasPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkGitInstalled(): Promise<void> {
  const { execSync } = await import('child_process');
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
