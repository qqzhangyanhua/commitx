import type { CliOptions, TimeRange } from '../types/index.js';

const PERIOD_REGEX = /^(\d+)(d|m|y)$/;

/**
 * 解析时间预设字符串，返回起止时间范围
 * 'all' 表示不限时间（从 1970 年至今）
 */
export function parsePeriod(period: string): TimeRange | null {
  if (period === 'all') {
    return null;
  }

  const match = PERIOD_REGEX.exec(period);
  if (!match) {
    throw new Error(`无效的时间预设: "${period}"，支持格式: 7d, 1m, 3m, 6m, 1y, all`);
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const to = new Date();
  const from = new Date();

  switch (unit) {
    case 'd':
      from.setDate(from.getDate() - amount);
      break;
    case 'm':
      from.setMonth(from.getMonth() - amount);
      break;
    case 'y':
      from.setFullYear(from.getFullYear() - amount);
      break;
  }

  return { from, to };
}

/**
 * 解析日期字符串 YYYY-MM-DD
 */
function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`无效的日期格式: "${dateStr}"，请使用 YYYY-MM-DD 格式`);
  }
  return date;
}

/**
 * 根据 CLI 参数解析最终的时间范围
 * --from / --to 优先于 --period
 * 返回 null 表示不限时间
 */
export function resolveTimeRange(opts: CliOptions): TimeRange | null {
  if (opts.from || opts.to) {
    const to = opts.to ? parseDate(opts.to) : new Date();
    const from = opts.from ? parseDate(opts.from) : (() => {
      const d = new Date(to);
      d.setMonth(d.getMonth() - 3);
      return d;
    })();

    if (from > to) {
      throw new Error('起始日期不能晚于结束日期');
    }

    return { from, to };
  }

  return parsePeriod(opts.period);
}

/**
 * 根据当前时间范围和 --compare 参数计算对比时间段
 * 返回与当前范围等长的前一段时间
 */
export function calculateCompareRange(
  currentRange: TimeRange,
  comparePeriod?: string
): TimeRange {
  if (comparePeriod && comparePeriod !== 'previous') {
    const parsed = parsePeriod(comparePeriod);
    if (parsed) {
      const duration = parsed.to.getTime() - parsed.from.getTime();
      return {
        from: new Date(parsed.from.getTime() - duration),
        to: parsed.from,
      };
    }
  }

  const duration = currentRange.to.getTime() - currentRange.from.getTime();
  return {
    from: new Date(currentRange.from.getTime() - duration),
    to: new Date(currentRange.from.getTime()),
  };
}
