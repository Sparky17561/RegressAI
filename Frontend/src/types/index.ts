export interface TestCase {
  id: string;
  question: string;
  oldResponse?: string;
  newResponse?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface DeterministicFlag {
  type: 'DETAIL_LOSS' | 'ASSUMPTION_LOSS' | 'EDGE_CASE_LOSS' | 'SAFETY_COMPROMISE' | 'FORMAT_CHANGE' | 'COVERAGE_GAP';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  testCaseId: string;
}

export interface JudgeResult {
  verdict: 'Improved' | 'Regression' | 'Neutral';
  summary: string;
  riskFlags: string[];
  confidence: number;
}

export interface CookednessResult {
  score: number;
  severity: 'Safe' | 'Risky' | 'Deeply Cooked';
  factors: string[];
}

export interface Insight {
  rootCause: string;
  suggestions: string[];
  revisedPrompt?: string;
}

export interface AnalysisVersion {
  id: string;
  caseId: string;
  version: number;
  timestamp: Date;
  config: AnalysisConfig;
  testCases: TestCase[];
  deterministicFlags: DeterministicFlag[];
  deterministicScore: number;
  judgeResult: JudgeResult;
  cookedness: CookednessResult;
  insights: Insight;
}

export interface AnalysisConfig {
  oldApiEndpoint: string;
  newApiEndpoint: string;
  promptTemplate: string;
  responseExtractionPath: string;
  goal: string;
  manualQuestions: string[];
  numCases: number;
}

export interface AnalysisCase {
  id: string;
  name: string;
  createdAt: Date;
  versions: AnalysisVersion[];
}
