import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { serializeStats } from './serialize.js';
import type { CommitStats, ReportOptions, ReportData } from '../types/index.js';

/**
 * 生成 JSON 格式报告
 * quiet 模式下输出到 stdout，否则写入文件
 */
export async function generateJsonReport(
  stats: CommitStats,
  options: ReportOptions
): Promise<void> {
  const reportData: ReportData = {
    stats: serializeStats(stats),
    generatedAt: new Date().toISOString(),
    timeRange: options.timeRange
      ? {
          from: options.timeRange.from.toISOString().split('T')[0],
          to: options.timeRange.to.toISOString().split('T')[0],
        }
      : null,
    repos: options.repoNames,
    compare: options.compare,
  };

  const json = JSON.stringify(reportData, null, 2);

  if (options.quiet && options.outputPath === 'commit-report.html') {
    process.stdout.write(json + '\n');
    return;
  }

  const outputPath = resolve(
    process.cwd(),
    options.outputPath.replace(/\.html$/, '.json')
  );
  await writeFile(outputPath, json, 'utf-8');

  if (!options.quiet) {
    console.log(chalk.green(`✓ JSON 报告已生成: ${chalk.cyan(outputPath)}`));
  }
}
