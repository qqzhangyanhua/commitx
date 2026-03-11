import ora from 'ora';
import chalk from 'chalk';
import { parseGitLog } from './git-log-parser.js';
import { calculateStats, mergeStats } from './stats-calculator.js';
import { calculateAdvancedStats } from './advanced/index.js';
import { calculateTechDebt } from './tech-debt/index.js';
import { calculateToolRetentionAdoption } from './ai-retention-adoption.js';
import { calculateBranchStats } from './branch-stats.js';
import type { AnalyzeOptions, CommitStats, AuthorAlias } from '../types/index.js';

export { resolveAuthors } from './author-resolver.js';

/**
 * 分析所有选定仓库的提交记录
 */
export async function analyzeRepos(
  options: AnalyzeOptions,
  authorAliases?: AuthorAlias[]
): Promise<CommitStats> {
  const { repos, timeRange, author, quiet } = options;
  const spinner = quiet ? null : ora('分析提交记录...').start();
  const allStats: CommitStats[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    if (spinner) {
      spinner.text = `分析提交记录 (${i + 1}/${repos.length}) - ${repo.name}`;
    }

    try {
      let commits = await parseGitLog(repo.path, timeRange, author);

      if (authorAliases && authorAliases.length > 0) {
        const { resolveAuthors } = await import('./author-resolver.js');
        commits = resolveAuthors(commits, authorAliases);
      }

      if (commits.length > 100000 && spinner) {
        spinner.info(
          chalk.yellow(`${repo.name} 包含 ${commits.length.toLocaleString()} 条提交，处理可能需要一些时间...`)
        );
        spinner.start();
      }

      const stats = calculateStats(commits);
      const advancedStats = calculateAdvancedStats(commits);

      let techDebt;
      let toolRetentionAdoption;
      let branchStats;
      if (repos.length === 1) {
        if (spinner) spinner.text = `分析技术债 - ${repo.name}`;
        techDebt = await calculateTechDebt(commits, repo.path);
        if (spinner) spinner.text = `分析 AI 工具保留率/采纳率 - ${repo.name}`;
        toolRetentionAdoption = await calculateToolRetentionAdoption(
          commits,
          repo.path
        );
        if (spinner) spinner.text = `分析分支统计 - ${repo.name}`;
        try {
          branchStats = calculateBranchStats(repo.path);
        } catch {
          // branch analysis is best-effort
        }
      }

      const fullStats: CommitStats = {
        ...stats,
        ...advancedStats,
        ...(techDebt && { techDebt }),
        ...(toolRetentionAdoption && { toolRetentionAdoption }),
        ...(branchStats && { branchStats }),
      };

      allStats.push(fullStats);
    } catch (error) {
      if (spinner) {
        spinner.warn(
          chalk.yellow(
            `跳过仓库 ${repo.name}: ${error instanceof Error ? error.message : '未知错误'}`
          )
        );
        spinner.start();
      }
    }
  }

  const merged = mergeStats(allStats);

  if (spinner) {
    spinner.succeed(
      `分析完成: ${merged.totalCommits.toLocaleString()} 条提交, ` +
      `${merged.authors.length} 位作者, ` +
      `+${merged.linesAdded.toLocaleString()} / -${merged.linesDeleted.toLocaleString()} 行`
    );
  }

  return merged;
}
