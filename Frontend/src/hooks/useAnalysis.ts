import { useState, useCallback } from 'react';
import type { 
  AnalysisConfig, 
  TestCase, 
  DeterministicFlag, 
  JudgeResult, 
  CookednessResult, 
  Insight,
  AnalysisVersion 
} from '@/types';

const defaultConfig: AnalysisConfig = {
  oldApiEndpoint: '',
  newApiEndpoint: '',
  promptTemplate: '{"prompt": "{{question}}"}',
  responseExtractionPath: 'response',
  goal: '',
  manualQuestions: [],
  numCases: 10,
};

// Mock data for demonstration
const generateMockTestCases = (config: AnalysisConfig): TestCase[] => {
  const questions = config.manualQuestions.length > 0 
    ? config.manualQuestions 
    : [
        "What is the capital of France?",
        "Explain quantum computing in simple terms.",
        "What are the risks of investing in cryptocurrency?",
        "How do I handle user authentication securely?",
        "What are the legal implications of AI-generated content?",
      ];

  return questions.map((question, i) => ({
    id: `tc-${Date.now()}-${i}`,
    question,
    status: 'pending' as const,
  }));
};

const mockResponses = {
  old: [
    "Paris is the capital of France.",
    "Quantum computing uses quantum bits or qubits which can exist in superposition.",
    "Cryptocurrency investments carry high volatility risks.",
    "Use secure password hashing and implement proper session management.",
    "AI-generated content raises complex copyright questions.",
  ],
  new: [
    "Paris is the capital city of France, located in the north-central part of the country.",
    "Quantum computing leverages quantum mechanics principles like superposition and entanglement.",
    "Crypto investments are highly volatile. Consider regulatory risks and potential fraud.",
    "Implement OAuth 2.0, use bcrypt for passwords, and enable MFA for critical operations.",
    "The legal status of AI content varies by jurisdiction. Some may lack copyright protection.",
  ],
};

export function useAnalysis() {
  const [config, setConfig] = useState<AnalysisConfig>(defaultConfig);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [deterministicFlags, setDeterministicFlags] = useState<DeterministicFlag[]>([]);
  const [deterministicScore, setDeterministicScore] = useState(0);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [cookedness, setCookedness] = useState<CookednessResult | null>(null);
  const [insights, setInsights] = useState<Insight | null>(null);
  const [versions, setVersions] = useState<AnalysisVersion[]>([]);

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setDeterministicFlags([]);
    setJudgeResult(null);
    setCookedness(null);
    setInsights(null);

    // Generate test cases
    const cases = generateMockTestCases(config);
    setTestCases(cases);

    // Simulate execution
    for (let i = 0; i < cases.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setTestCases(prev => prev.map((tc, idx) => 
        idx === i 
          ? { 
              ...tc, 
              status: 'running' as const 
            }
          : tc
      ));

      await new Promise(resolve => setTimeout(resolve, 800));

      setTestCases(prev => prev.map((tc, idx) => 
        idx === i 
          ? { 
              ...tc, 
              status: 'completed' as const,
              oldResponse: mockResponses.old[idx % mockResponses.old.length],
              newResponse: mockResponses.new[idx % mockResponses.new.length],
            }
          : tc
      ));
    }

    // Generate deterministic analysis
    await new Promise(resolve => setTimeout(resolve, 500));
    const flags: DeterministicFlag[] = [
      {
        type: 'DETAIL_LOSS',
        severity: 'low',
        description: 'Some historical context was omitted in the NEW response.',
        testCaseId: cases[0]?.id || '',
      },
      {
        type: 'EDGE_CASE_LOSS',
        severity: 'medium',
        description: 'The NEW response does not address edge cases for regulatory changes.',
        testCaseId: cases[2]?.id || '',
      },
    ];
    setDeterministicFlags(flags);
    setDeterministicScore(35);

    // Generate judge result
    await new Promise(resolve => setTimeout(resolve, 500));
    setJudgeResult({
      verdict: 'Improved',
      summary: 'The NEW model provides more detailed and actionable responses with better coverage.',
      riskFlags: [],
      confidence: 85,
    });

    // Generate cookedness score
    await new Promise(resolve => setTimeout(resolve, 300));
    setCookedness({
      score: 25,
      severity: 'Safe',
      factors: ['Consistent formatting', 'Accurate facts', 'No hallucinations detected'],
    });

    // Generate insights
    await new Promise(resolve => setTimeout(resolve, 400));
    setInsights({
      rootCause: 'The NEW model was trained with more recent data and improved prompting.',
      suggestions: [
        'Consider adding explicit edge case handling in the prompt template.',
        'Add examples of expected format in the system prompt.',
        'Test with adversarial inputs to ensure robustness.',
      ],
      revisedPrompt: '{"prompt": "{{question}}", "system": "Provide detailed, accurate responses. Always consider edge cases."}',
    });

    // Save version
    const newVersion: AnalysisVersion = {
      id: `v-${Date.now()}`,
      caseId: 'case-1',
      version: versions.length + 1,
      timestamp: new Date(),
      config: { ...config },
      testCases: cases.map((tc, i) => ({
        ...tc,
        status: 'completed' as const,
        oldResponse: mockResponses.old[i % mockResponses.old.length],
        newResponse: mockResponses.new[i % mockResponses.new.length],
      })),
      deterministicFlags: flags,
      deterministicScore: 35,
      judgeResult: {
        verdict: 'Improved',
        summary: 'The NEW model provides more detailed and actionable responses.',
        riskFlags: [],
        confidence: 85,
      },
      cookedness: {
        score: 25,
        severity: 'Safe',
        factors: ['Consistent formatting', 'Accurate facts'],
      },
      insights: {
        rootCause: 'Improved training data and prompting.',
        suggestions: ['Add edge case handling', 'Include format examples'],
      },
    };

    setVersions(prev => [newVersion, ...prev]);
    setIsAnalyzing(false);
  }, [config, versions.length]);

  const loadVersion = useCallback((version: AnalysisVersion) => {
    setConfig(version.config);
    setTestCases(version.testCases);
    setDeterministicFlags(version.deterministicFlags);
    setDeterministicScore(version.deterministicScore);
    setJudgeResult(version.judgeResult);
    setCookedness(version.cookedness);
    setInsights(version.insights);
  }, []);

  return {
    config,
    setConfig,
    isAnalyzing,
    testCases,
    deterministicFlags,
    deterministicScore,
    judgeResult,
    cookedness,
    insights,
    versions,
    runAnalysis,
    loadVersion,
  };
}
