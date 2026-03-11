/**
 * ISO 8601 周标识计算工具
 *
 * ISO 8601 规则：
 * - 一周从周一开始，到周日结束
 * - 每年的第一周是包含该年第一个周四的那一周
 * - 周四所在的周决定该周属于哪一年
 *
 * 跨年边界示例：
 * - 2025-12-29 (Mon) 到 2026-01-04 (Sun) 属于 2026-W01
 * - 2024-12-30 (Mon) 到 2025-01-05 (Sun) 属于 2025-W01
 */

/**
 * 获取 ISO 周标识 (YYYY-Www 格式)
 * 使用 UTC 时间确保跨时区一致性
 */
export function getISOWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * 获取月份标识 (YYYY-MM 格式)
 * 使用 UTC 时间确保跨时区一致性
 */
export function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
