import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeStats } from './serialize.js';
import type { CommitStats, ReportOptions, ReportData } from '../types/index.js';

/**
 * 组装完整的 HTML 报告
 */
export async function buildHtml(
  stats: CommitStats,
  options: ReportOptions
): Promise<string> {
  const template = await loadTemplate(options.templatePath);

  const reportData: ReportData = {
    stats: serializeStats(stats),
    generatedAt: new Date().toLocaleString('zh-CN'),
    timeRange: options.timeRange
      ? {
          from: options.timeRange.from.toISOString().split('T')[0],
          to: options.timeRange.to.toISOString().split('T')[0],
        }
      : null,
    repos: options.repoNames,
    compare: options.compare,
  };

  const jsonData = JSON.stringify(reportData)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  const title = options.repoNames.length > 0
    ? `${options.repoNames.join(', ')} - Git 提交统计`
    : 'Git 提交统计报告';

  return template
    .replace('__REPORT_DATA__', jsonData)
    .replace(/__REPORT_TITLE__/g, title)
    .replace(/__GENERATED_AT__/g, reportData.generatedAt)
    .replace(/__REPO_NAMES__/g, options.repoNames.join(', '))
    .replace(/__TIME_RANGE__/g, reportData.timeRange
      ? `${reportData.timeRange.from} ~ ${reportData.timeRange.to}`
      : '所有提交');
}

/**
 * 加载 HTML 模板，优先使用用户自定义模板路径
 */
export async function loadTemplate(customPath?: string): Promise<string> {
  if (customPath) {
    try {
      return await readFile(resolve(process.cwd(), customPath), 'utf-8');
    } catch {
      throw new Error(`无法加载自定义模板: ${customPath}`);
    }
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const possiblePaths = [
    resolve(currentDir, '../templates/report.html'),
    resolve(currentDir, '../../templates/report.html'),
    resolve(currentDir, '../../../templates/report.html'),
  ];

  for (const templatePath of possiblePaths) {
    try {
      return await readFile(templatePath, 'utf-8');
    } catch {
      // 继续尝试下一个路径
    }
  }

  throw new Error('无法找到 HTML 模板文件');
}
