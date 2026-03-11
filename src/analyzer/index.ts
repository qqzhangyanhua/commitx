import ora from 'ora';
import chalk from 'chalk';
import { parseGitLog } from './git-log-parser.js';
import { calculateStats, mergeStats } from './stats-calculator.js';
import { calculateAdvancedStats } from './advanced/index.js';
import { calculateTechDebt } from './tech-debt/index.js';
import { calculateToolRetentionAdoption } from './ai-retention-adoption.js';
import type { AnalyzeOptions, CommitStats } from '../types/index.js';

/**
 * 分析所有选定仓库的提交记录
 */
export async function analyzeRepos(options: AnalyzeOptions): Promise<CommitStats> {
  const { repos, timeRange, author } = options;
  const spinner = ora('分析提交记录...').start();
  const allStats: CommitStats[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    spinner.text = `分析提交记录 (${i + 1}/${repos.length}) - ${repo.name}`;

    try {
      const commits = await parseGitLog(repo.path, timeRange, author);

      if (commits.length > 100000) {
        spinner.info(
          chalk.yellow(`${repo.name} 包含 ${commits.length.toLocaleString()} 条提交，处理可能需要一些时间...`)
        );
        spinner.start();
      }

      const stats = calculateStats(commits);

      // 计算高级统计
      const advancedStats = calculateAdvancedStats(commits);

      // 计算技术债（仅单仓库场景）
      let techDebt;
      let toolRetentionAdoption;
      if (repos.length === 1) {
        spinner.text = `分析技术债 - ${repo.name}`;
        techDebt = await calculateTechDebt(commits, repo.path);
        spinner.text = `分析 AI 工具保留率/采纳率 - ${repo.name}`;
        toolRetentionAdoption = await calculateToolRetentionAdoption(
          commits,
          repo.path
        );
      }

      // 合并核心统计和高级统计
      const fullStats: CommitStats = {
        ...stats,
        ...advancedStats,
        ...(techDebt && { techDebt }),
        ...(toolRetentionAdoption && { toolRetentionAdoption }),
      };

      allStats.push(fullStats);
    } catch (error) {
      spinner.warn(
        chalk.yellow(
          `跳过仓库 ${repo.name}: ${error instanceof Error ? error.message : '未知错误'}`
        )
      );
      spinner.start();
    }
  }

  const merged = mergeStats(allStats);

  spinner.succeed(
    `分析完成: ${merged.totalCommits.toLocaleString()} 条提交, ` +
    `${merged.authors.length} 位作者, ` +
    `+${merged.linesAdded.toLocaleString()} / -${merged.linesDeleted.toLocaleString()} 行`
  );

  return merged;
}
