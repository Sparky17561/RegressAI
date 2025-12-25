import { useState } from 'react';
import { Header } from '@/components/Header';
import { ConfigPanel } from '@/components/ConfigPanel';
import { TestCaseList } from '@/components/TestCaseList';
import { ResponseComparison } from '@/components/ResponseComparison';
import { ResultsPanel } from '@/components/ResultsPanel';
import { VersionHistory } from '@/components/VersionHistory';
import { useAnalysis } from '@/hooks/useAnalysis';

const Index = () => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
  
  const {
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
  } = useAnalysis();

  const selectedTestCase = testCases.find(tc => tc.id === selectedTestCaseId) || null;

  return (
    <div className="min-h-screen bg-background">
      <Header onHistoryClick={() => setHistoryOpen(true)} />
      
      <main className="p-6">
        <div className="grid grid-cols-12 gap-6 max-w-[1800px] mx-auto">
          {/* Left Column - Config & Test Cases */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <ConfigPanel 
              config={config}
              onConfigChange={setConfig}
              onAnalyze={runAnalysis}
              isAnalyzing={isAnalyzing}
            />
            <TestCaseList 
              testCases={testCases}
              selectedId={selectedTestCaseId}
              onSelect={setSelectedTestCaseId}
            />
          </div>
          
          {/* Middle Column - Response Comparison */}
          <div className="col-span-12 lg:col-span-4">
            <ResponseComparison testCase={selectedTestCase} />
          </div>
          
          {/* Right Column - Results */}
          <div className="col-span-12 lg:col-span-4">
            <ResultsPanel 
              deterministicFlags={deterministicFlags}
              deterministicScore={deterministicScore}
              judgeResult={judgeResult}
              cookedness={cookedness}
              insights={insights}
            />
          </div>
        </div>
      </main>

      <VersionHistory 
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        versions={versions}
        onSelectVersion={loadVersion}
      />
    </div>
  );
};

export default Index;
