import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import type { CommitStats, ReportOptions } from '../types/index.js';

/**
 * 生成 Markdown 格式报告
 */
export async function generateMarkdownReport(
  stats: CommitStats,
  options: ReportOptions
): Promise<void> {
  const md = buildMarkdown(stats, options);

  if (options.quiet && options.outputPath === 'commit-report.html') {
    process.stdout.write(md);
    return;
  }

  const outputPath = resolve(
    process.cwd(),
    options.outputPath.replace(/\.html$/, '.md')
  );
  await writeFile(outputPath, md, 'utf-8');

  if (!options.quiet) {
    console.log(chalk.green(`✓ Markdown 报告已生成: ${chalk.cyan(outputPath)}`));
  }
}

function buildMarkdown(stats: CommitStats, options: ReportOptions): string {
  const lines: string[] = [];
  const now = new Date().toLocaleString('zh-CN');

  lines.push('# Git 提交统计报告');
  lines.push('');
  if (options.repoNames.length > 0) {
    lines.push(`**仓库**: ${options.repoNames.join(', ')}`);
  }
  if (options.timeRange) {
    const from = options.timeRange.from.toISOString().split('T')[0];
    const to = options.timeRange.to.toISOString().split('T')[0];
    lines.push(`**时间范围**: ${from} ~ ${to}`);
  }
  lines.push(`**生成时间**: ${now}`);
  lines.push('');

  lines.push('## 概要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总提交数 | ${stats.totalCommits.toLocaleString()} |`);
  lines.push(`| 新增行数 | +${stats.linesAdded.toLocaleString()} |`);
  lines.push(`| 删除行数 | -${stats.linesDeleted.toLocaleString()} |`);
  lines.push(`| 变更文件数 | ${stats.filesChanged.toLocaleString()} |`);
  lines.push(`| 活跃作者数 | ${stats.authors.length} |`);
  lines.push(`| 最长连续提交 | ${stats.timePatterns.longestStreak} 天 |`);
  lines.push('');

  lines.push('## 作者排行 (Top 10)');
  lines.push('');
  lines.push('| 排名 | 作者 | 提交数 | 新增行 | 删除行 |');
  lines.push('|------|------|--------|--------|--------|');
  const topAuthors = stats.authors
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10);
  topAuthors.forEach((a, i) => {
    lines.push(
      `| ${i + 1} | ${a.name} | ${a.commits} | +${a.linesAdded.toLocaleString()} | -${a.linesDeleted.toLocaleString()} |`
    );
  });
  lines.push('');

  lines.push('## 文件类型分布 (Top 10)');
  lines.push('');
  lines.push('| 类型 | 新增行 | 删除行 | 文件数 |');
  lines.push('|------|--------|--------|--------|');
  const topTypes = stats.fileTypes
    .sort((a, b) => (b.added + b.deleted) - (a.added + a.deleted))
    .slice(0, 10);
  topTypes.forEach((ft) => {
    lines.push(
      `| ${ft.extension || '(无扩展名)'} | +${ft.added.toLocaleString()} | -${ft.deleted.toLocaleString()} | ${ft.fileCount} |`
    );
  });
  lines.push('');

  lines.push('## 时间分布');
  lines.push('');
  lines.push(`- **最繁忙的一天**: ${stats.busiestDay.date} (${stats.busiestDay.count} 次提交)`);
  lines.push(`- **周末提交占比**: ${stats.timePatterns.weekendCommits} 次`);
  lines.push(`- **平均提交间隔**: ${stats.timePatterns.avgCommitInterval.toFixed(1)} 天`);
  lines.push('');

  if (stats.quality) {
    lines.push('## 代码质量');
    lines.push('');
    lines.push(`- **平均每次提交文件数**: ${stats.quality.avgFilesPerCommit.toFixed(1)}`);
    lines.push(`- **平均每次提交行数**: ${stats.quality.avgLinesPerCommit.toFixed(1)}`);
    lines.push(`- **代码流失率**: ${(stats.quality.churnRate * 100).toFixed(1)}%`);
    lines.push('');
  }

  if (stats.workPressure) {
    lines.push('## 工作压力指标');
    lines.push('');
    lines.push(`- **压力指数**: ${stats.workPressure.pressureScore.toFixed(0)}/100`);
    lines.push(`- **深夜提交**: ${stats.workPressure.lateNightCommits} 次`);
    lines.push(`- **周末提交**: ${stats.workPressure.weekendCommits} 次`);
    lines.push(`- **非工作时间占比**: ${(stats.workPressure.offHoursRate * 100).toFixed(1)}%`);
    lines.push('');
  }

  if (stats.aiMetrics && stats.aiMetrics.aiPercentage > 0) {
    lines.push('## AI 使用统计');
    lines.push('');
    lines.push(`- **AI 代码占比**: ${stats.aiMetrics.aiPercentage.toFixed(1)}%`);
    lines.push(`- **AI 代码行数**: ${stats.aiMetrics.totalAILines.toLocaleString()}`);
    lines.push(`- **疑似 AI 提交数**: ${stats.aiMetrics.suspiciousCommits}`);
    lines.push('');
  }

  if (options.compare) {
    const c = options.compare;
    lines.push('## 对比分析');
    lines.push('');
    lines.push(`**当前**: ${c.currentPeriod.from} ~ ${c.currentPeriod.to}`);
    lines.push(`**对比**: ${c.previousPeriod.from} ~ ${c.previousPeriod.to}`);
    lines.push('');
    lines.push('| 指标 | 变化值 | 变化率 |');
    lines.push('|------|--------|--------|');
    const d = c.delta;
    lines.push(`| 提交数 | ${d.commits.value >= 0 ? '+' : ''}${d.commits.value} | ${d.commits.percentage >= 0 ? '+' : ''}${d.commits.percentage}% |`);
    lines.push(`| 新增行 | ${d.linesAdded.value >= 0 ? '+' : ''}${d.linesAdded.value.toLocaleString()} | ${d.linesAdded.percentage >= 0 ? '+' : ''}${d.linesAdded.percentage}% |`);
    lines.push(`| 删除行 | ${d.linesDeleted.value >= 0 ? '+' : ''}${d.linesDeleted.value.toLocaleString()} | ${d.linesDeleted.percentage >= 0 ? '+' : ''}${d.linesDeleted.percentage}% |`);
    lines.push(`| 活跃作者 | ${d.activeAuthors.value >= 0 ? '+' : ''}${d.activeAuthors.value} | ${d.activeAuthors.percentage >= 0 ? '+' : ''}${d.activeAuthors.percentage}% |`);
    lines.push('');

    if (c.highlights.length > 0) {
      lines.push('### 亮点');
      lines.push('');
      c.highlights.forEach((h) => lines.push(`- ${h}`));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*由 [commit-report](https://www.npmjs.com/package/commit-report) 生成*`);
  lines.push('');

  return lines.join('\n');
}
