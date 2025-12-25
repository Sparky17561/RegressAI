import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TestCase } from '@/types';

interface ResponseComparisonProps {
  testCase: TestCase | null;
}

export function ResponseComparison({ testCase }: ResponseComparisonProps) {
  if (!testCase) {
    return (
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
            <span className="w-2 h-2 bg-muted-foreground rounded-full" />
            Response Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Select a test case to compare responses</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full" />
          Response Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Question */}
          <div className="bg-secondary/50 rounded-md p-3">
            <p className="text-xs text-muted-foreground mb-1">Question</p>
            <p className="text-sm text-foreground">{testCase.question}</p>
          </div>

          {/* Responses Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* OLD Response */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-destructive/20 text-destructive text-xs font-medium px-2 py-1 rounded">
                  OLD
                </span>
              </div>
              <ScrollArea className="h-[200px] rounded-md border border-border bg-secondary/30">
                <div className="p-3">
                  {testCase.oldResponse ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap font-mono">
                      {testCase.oldResponse}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {testCase.status === 'running' ? 'Fetching...' : 'No response'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* NEW Response */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-success/20 text-success text-xs font-medium px-2 py-1 rounded">
                  NEW
                </span>
              </div>
              <ScrollArea className="h-[200px] rounded-md border border-border bg-secondary/30">
                <div className="p-3">
                  {testCase.newResponse ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap font-mono">
                      {testCase.newResponse}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {testCase.status === 'running' ? 'Fetching...' : 'No response'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
