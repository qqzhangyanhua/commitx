import type { CommitStats, CompareResult, DeltaValue } from '../types/index.js';

function calcDelta(current: number, previous: number): DeltaValue {
  const value = current - previous;
  const percentage = previous === 0 ? (current > 0 ? 100 : 0) : ((value / previous) * 100);
  return { value, percentage: Math.round(percentage * 10) / 10 };
}

/**
 * 对比两个时间段的统计结果，生成 delta 和高亮描述
 */
export function compareStats(
  current: CommitStats,
  previous: CommitStats,
  currentPeriod: { from: string; to: string },
  previousPeriod: { from: string; to: string }
): CompareResult {
  const delta = {
    commits: calcDelta(current.totalCommits, previous.totalCommits),
    linesAdded: calcDelta(current.linesAdded, previous.linesAdded),
    linesDeleted: calcDelta(current.linesDeleted, previous.linesDeleted),
    activeAuthors: calcDelta(current.authors.length, previous.authors.length),
    filesChanged: calcDelta(current.filesChanged, previous.filesChanged),
  };

  const highlights = generateHighlights(delta, current, previous);

  return { currentPeriod, previousPeriod, delta, highlights };
}

function generateHighlights(
  delta: CompareResult['delta'],
  current: CommitStats,
  previous: CommitStats
): string[] {
  const highlights: string[] = [];

  if (Math.abs(delta.commits.percentage) >= 20) {
    const direction = delta.commits.percentage > 0 ? '增长' : '下降';
    highlights.push(`提交量${direction} ${Math.abs(delta.commits.percentage)}%`);
  }

  if (delta.activeAuthors.value > 0) {
    highlights.push(`新增 ${delta.activeAuthors.value} 位活跃贡献者`);
  } else if (delta.activeAuthors.value < 0) {
    highlights.push(`减少 ${Math.abs(delta.activeAuthors.value)} 位活跃贡献者`);
  }

  if (Math.abs(delta.linesAdded.percentage) >= 50) {
    const direction = delta.linesAdded.percentage > 0 ? '大幅增长' : '明显减少';
    highlights.push(`新增代码量${direction}`);
  }

  const currentPressure = current.workPressure?.pressureScore ?? 0;
  const previousPressure = previous.workPressure?.pressureScore ?? 0;
  if (currentPressure > previousPressure + 15) {
    highlights.push(`工作压力指数上升 (${previousPressure.toFixed(0)} → ${currentPressure.toFixed(0)})`);
  } else if (currentPressure < previousPressure - 15) {
    highlights.push(`工作压力指数下降 (${previousPressure.toFixed(0)} → ${currentPressure.toFixed(0)})`);
  }

  const currentAI = current.aiMetrics?.aiPercentage ?? 0;
  const previousAI = previous.aiMetrics?.aiPercentage ?? 0;
  if (Math.abs(currentAI - previousAI) >= 5) {
    const direction = currentAI > previousAI ? '上升' : '下降';
    highlights.push(`AI 代码占比${direction} (${previousAI.toFixed(1)}% → ${currentAI.toFixed(1)}%)`);
  }

  return highlights;
}
