import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import type {
  BaselineSummary,
  CommitStats,
  InsightItem,
  MetricBaseline,
  ReportOptions,
  SnapshotMetricKey,
} from '../types/index.js';

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

  appendInsights(lines, options.insights);
  appendBaselines(lines, options.baseline);

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
  [...stats.authors]
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10)
    .forEach((author, index) => {
      lines.push(
        `| ${index + 1} | ${author.name} | ${author.commits} | +${author.linesAdded.toLocaleString()} | -${author.linesDeleted.toLocaleString()} |`
      );
    });
  lines.push('');

  lines.push('## 文件类型分布 (Top 10)');
  lines.push('');
  lines.push('| 类型 | 新增行 | 删除行 | 文件数 |');
  lines.push('|------|--------|--------|--------|');
  [...stats.fileTypes]
    .sort((a, b) => (b.added + b.deleted) - (a.added + a.deleted))
    .slice(0, 10)
    .forEach((fileType) => {
      lines.push(
        `| ${fileType.extension || '(无扩展名)'} | +${fileType.added.toLocaleString()} | -${fileType.deleted.toLocaleString()} | ${fileType.fileCount} |`
      );
    });
  lines.push('');

  lines.push('## 时间分布');
  lines.push('');
  lines.push(`- **最忙的一天**: ${stats.busiestDay.date} (${stats.busiestDay.count} 次提交)`);
  lines.push(`- **周末提交占比**: ${(stats.timePatterns.weekendCommits * 100).toFixed(1)}%`);
  lines.push(`- **平均提交间隔**: ${stats.timePatterns.avgCommitInterval.toFixed(1)} 天`);
  lines.push('');

  lines.push('## 质量指标');
  lines.push('');
  lines.push(`- **平均每次提交文件数**: ${stats.quality.avgFilesPerCommit.toFixed(1)}`);
  lines.push(`- **平均每次提交行数**: ${stats.quality.avgLinesPerCommit.toFixed(1)}`);
  lines.push(`- **代码流失率**: ${(stats.quality.churnRate * 100).toFixed(1)}%`);
  lines.push('');

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
    lines.push(`- **可疑 AI 提交数**: ${stats.aiMetrics.suspiciousCommits}`);
    lines.push('');
  }

  if (options.compare) {
    const compare = options.compare;
    lines.push('## 对比分析');
    lines.push('');
    lines.push(`**当前**: ${compare.currentPeriod.from} ~ ${compare.currentPeriod.to}`);
    lines.push(`**对比**: ${compare.previousPeriod.from} ~ ${compare.previousPeriod.to}`);
    lines.push('');
    lines.push('| 指标 | 变化值 | 变化率 |');
    lines.push('|------|--------|--------|');
    lines.push(
      `| 提交数 | ${formatDelta(compare.delta.commits.value)} | ${formatDelta(compare.delta.commits.percentage)}% |`
    );
    lines.push(
      `| 新增行数 | ${formatDelta(compare.delta.linesAdded.value)} | ${formatDelta(compare.delta.linesAdded.percentage)}% |`
    );
    lines.push(
      `| 删除行数 | ${formatDelta(compare.delta.linesDeleted.value)} | ${formatDelta(compare.delta.linesDeleted.percentage)}% |`
    );
    lines.push(
      `| 活跃作者 | ${formatDelta(compare.delta.activeAuthors.value)} | ${formatDelta(compare.delta.activeAuthors.percentage)}% |`
    );
    lines.push('');

    if (compare.highlights.length > 0) {
      lines.push('### 亮点');
      lines.push('');
      compare.highlights.forEach((highlight) => lines.push(`- ${highlight}`));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*由 [commit-report](https://www.npmjs.com/package/commit-report) 生成*');
  lines.push('');

  return lines.join('\n');
}

function appendInsights(lines: string[], insights?: InsightItem[]): void {
  if (!insights || insights.length === 0) {
    return;
  }

  lines.push('## 异常摘要');
  lines.push('');
  insights.forEach((insight) => {
    lines.push(`### ${insight.title}`);
    lines.push('');
    lines.push(`- **严重级别**: ${formatSeverity(insight.severity)}`);
    lines.push(`- **证据**: ${insight.evidence}`);
    lines.push(`- **影响**: ${insight.impact}`);
    lines.push(`- **建议**: ${insight.suggestion}`);
    lines.push('');
  });
}

function appendBaselines(lines: string[], baseline?: BaselineSummary): void {
  if (!baseline || (baseline.weekly.length === 0 && baseline.monthly.length === 0)) {
    return;
  }

  lines.push('## 趋势基线');
  lines.push('');
  appendBaselineSection(lines, '周基线', baseline.weekly);
  appendBaselineSection(lines, '月基线', baseline.monthly);
}

function appendBaselineSection(
  lines: string[],
  title: string,
  baselines: MetricBaseline[]
): void {
  if (baselines.length === 0) {
    return;
  }

  lines.push(`### ${title}`);
  lines.push('');
  lines.push('| 指标 | 当前值 | 上期值 | 均值 | 趋势 | 变化 |');
  lines.push('|------|--------|--------|------|------|------|');
  baselines.forEach((item) => {
    lines.push(
      `| ${formatMetricLabel(item.metric)} | ${formatMetricValue(item.current, item.metric)} | ${formatOptionalMetricValue(item.previous, item.metric)} | ${formatOptionalMetricValue(item.average, item.metric)} | ${formatTrend(item.trend)} | ${formatChange(item.changePercentage)} |`
    );
  });
  lines.push('');
}

function formatMetricLabel(metric: SnapshotMetricKey): string {
  const labels: Record<SnapshotMetricKey, string> = {
    totalCommits: '提交数',
    linesAdded: '新增行数',
    linesDeleted: '删除行数',
    activeAuthors: '活跃作者',
    filesChanged: '变更文件数',
    aiPercentage: 'AI 占比',
    busFactor: 'Bus Factor',
    stabilityScore: '稳定性评分',
    pressureScore: '压力指数',
    highRiskFiles: '高风险文件',
    staleBranches: '陈旧分支',
  };

  return labels[metric];
}

function formatMetricValue(value: number, metric: SnapshotMetricKey): string {
  return metric === 'aiPercentage'
    ? `${value.toFixed(1)}%`
    : value.toLocaleString('zh-CN');
}

function formatOptionalMetricValue(
  value: number | undefined,
  metric: SnapshotMetricKey
): string {
  return value === undefined ? '-' : formatMetricValue(value, metric);
}

function formatTrend(trend: MetricBaseline['trend']): string {
  if (trend === 'up') return '上升';
  if (trend === 'down') return '下降';
  if (trend === 'flat') return '持平';
  return '样本不足';
}

function formatSeverity(severity: InsightItem['severity']): string {
  if (severity === 'critical') return '高';
  if (severity === 'warning') return '中';
  return '低';
}

function formatChange(value: number | undefined): string {
  if (value === undefined) return '样本不足';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('zh-CN')}`;
}
