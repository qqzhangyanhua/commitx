import type {
  CommitRecord,
  TechDebtStats,
  RiskFile,
  AIDetectionResult,
  DuplicationResult,
  RadarDimension,
  TrendPoint,
} from '../../types/index.js';
import { calculateRiskScores } from './risk-scorer.js';
import { detectAICode } from './ai-detector.js';
import { detectDuplication } from './duplication.js';
import { prioritizeActions } from './prioritizer.js';

export async function calculateTechDebt(
  commits: CommitRecord[],
  repoPath: string
): Promise<TechDebtStats> {
  if (commits.length === 0) {
    return emptyTechDebt();
  }

  const riskFiles = calculateRiskScores(commits);
  const aiDetection = await detectAICode(commits, repoPath);
  const duplication = await detectDuplication(repoPath);
  const actionItems = prioritizeActions(riskFiles);

  return {
    radar: calculateRadarDimensions(riskFiles, aiDetection, duplication),
    highRiskFiles: riskFiles.slice(0, 10),
    aiDetection,
    duplication,
    trends: calculateTrends(commits),
    actionItems,
  };
}

function calculateRadarDimensions(
  riskFiles: RiskFile[],
  aiDetection: AIDetectionResult,
  duplication: DuplicationResult
): RadarDimension[] {
  const avgComplexity = riskFiles.length > 0
    ? riskFiles.reduce((sum, file) => sum + file.complexity, 0) / riskFiles.length
    : 0;

  const avgDuplication = duplication.fileScores.length > 0
    ? duplication.fileScores.reduce((sum, file) => sum + file.score, 0) / duplication.fileScores.length
    : 0;

  const avgTestCoverage = riskFiles.length > 0
    ? riskFiles.reduce((sum, file) => sum + file.testCoverage, 0) / riskFiles.length
    : 100;

  const avgKnowledgeRisk = riskFiles.length > 0
    ? riskFiles.reduce((sum, file) => sum + file.knowledgeRisk, 0) / riskFiles.length
    : 0;

  const avgChurnRate = riskFiles.length > 0
    ? riskFiles.reduce((sum, file) => sum + file.churnRate, 0) / riskFiles.length
    : 0;

  return [
    {
      dimension: 'Complexity',
      score: Math.min(avgComplexity, 100),
      riskLevel: toRiskLevel(avgComplexity, 70, 40),
      description: '代码复杂度',
      affectedFiles: riskFiles.filter((file) => file.complexity > 70).length,
    },
    {
      dimension: 'Duplication',
      score: Math.min(avgDuplication / 10, 100),
      riskLevel: toRiskLevel(avgDuplication, 700, 400),
      description: '代码重复度',
      affectedFiles: duplication.fileScores.filter((file) => file.score > 100).length,
    },
    {
      dimension: 'Test Coverage',
      score: 100 - avgTestCoverage,
      riskLevel: avgTestCoverage < 30 ? 'high' : avgTestCoverage < 60 ? 'medium' : 'low',
      description: '测试覆盖风险',
      affectedFiles: riskFiles.filter((file) => file.testCoverage < 30).length,
    },
    {
      dimension: 'Documentation',
      score: aiDetection.suspiciousFiles.filter((file) => file.reason === 'excessive-comments').length * 10,
      riskLevel: toRiskLevel(aiDetection.suspiciousFiles.length, 10, 5),
      description: '文档完整度',
      affectedFiles: aiDetection.suspiciousFiles.length,
    },
    {
      dimension: 'Stability',
      score: avgChurnRate * 100,
      riskLevel: toRiskLevel(avgChurnRate, 0.7, 0.4),
      description: '代码稳定性',
      affectedFiles: riskFiles.filter((file) => file.churnRate > 0.7).length,
    },
    {
      dimension: 'Knowledge Risk',
      score: avgKnowledgeRisk,
      riskLevel: toRiskLevel(avgKnowledgeRisk, 70, 40),
      description: '知识集中度',
      affectedFiles: riskFiles.filter((file) => file.knowledgeRisk > 70).length,
    },
  ];
}

function toRiskLevel(
  value: number,
  highThreshold: number,
  mediumThreshold: number
): 'low' | 'medium' | 'high' {
  if (value > highThreshold) return 'high';
  if (value > mediumThreshold) return 'medium';
  return 'low';
}

function calculateTrends(commits: CommitRecord[]): TrendPoint[] {
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  const trends: TrendPoint[] = [];
  const interval = Math.max(1, Math.floor(sorted.length / 20));

  for (let i = 0; i < sorted.length; i += interval) {
    const chunk = sorted.slice(Math.max(0, i - interval), i + 1);
    const debt = chunk.reduce((sum, commit) => {
      const largeFiles = commit.files.filter((file) => file.added > 100).length;
      return sum + largeFiles;
    }, 0);

    trends.push({
      date: sorted[i].date.toISOString().split('T')[0],
      debt,
    });
  }

  return trends;
}

function emptyTechDebt(): TechDebtStats {
  return {
    radar: [],
    highRiskFiles: [],
    aiDetection: { suspiciousFiles: [], totalSuspicious: 0 },
    duplication: { clusters: [], fileScores: [] },
    trends: [],
    actionItems: [],
  };
}
