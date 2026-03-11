import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { buildHtml } from './html-builder.js';
import { generateJsonReport } from './json-reporter.js';
import { generateMarkdownReport } from './markdown-reporter.js';
import type { CommitStats, ReportOptions } from '../types/index.js';

export { serializeStats } from './serialize.js';

/**
 * 根据 format 路由到对应的报告生成器
 */
export async function generateReport(
  stats: CommitStats,
  options: ReportOptions
): Promise<void> {
  switch (options.format) {
    case 'json':
      return generateJsonReport(stats, options);
    case 'markdown':
      return generateMarkdownReport(stats, options);
    case 'html':
    default:
      return generateHtmlReport(stats, options);
  }
}

/**
 * 生成 HTML 报告并可选地打开浏览器
 */
async function generateHtmlReport(
  stats: CommitStats,
  options: ReportOptions
): Promise<void> {
  const spinner = options.quiet ? null : ora('生成报告...').start();

  try {
    const html = await buildHtml(stats, options);
    const outputPath = resolve(process.cwd(), options.outputPath);

    await writeFile(outputPath, html, 'utf-8');
    if (spinner) {
      spinner.succeed(`报告已生成: ${chalk.cyan(outputPath)}`);
    }

    if (options.autoOpen && !options.quiet) {
      await open(outputPath);
      console.log(chalk.green('✓ 已在浏览器中打开'));
    }
  } catch (error) {
    if (spinner) spinner.fail('生成报告失败');
    throw error;
  }
}
