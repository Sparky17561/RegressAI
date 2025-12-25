import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TestCase } from '@/types';

interface TestCaseListProps {
  testCases: TestCase[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TestCaseList({ testCases, selectedId, onSelect }: TestCaseListProps) {
  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (testCases.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
            <span className="w-2 h-2 bg-muted-foreground rounded-full" />
            Test Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No test cases yet</p>
            <p className="text-xs mt-1">Run an analysis to generate test cases</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full" />
          Test Cases
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            {testCases.filter(t => t.status === 'completed').length}/{testCases.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-4 pt-0">
            {testCases.map((testCase, index) => (
              <button
                key={testCase.id}
                onClick={() => onSelect(testCase.id)}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  selectedId === testCase.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-secondary/50 hover:bg-secondary border border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground font-mono mt-0.5">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {testCase.question}
                    </p>
                  </div>
                  {getStatusIcon(testCase.status)}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
