import { GitCommit, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AnalysisVersion } from '@/types';

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: AnalysisVersion[];
  onSelectVersion: (version: AnalysisVersion) => void;
}

export function VersionHistory({ open, onOpenChange, versions, onSelectVersion }: VersionHistoryProps) {
  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'Improved':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'Regression':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCookednessColor = (score: number) => {
    if (score <= 30) return 'text-success';
    if (score <= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-foreground flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-primary" />
            Version History
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)] mt-6">
          {versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitCommit className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No versions yet</p>
              <p className="text-xs mt-1">Each analysis creates an immutable snapshot</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {versions.map((version, index) => (
                <button
                  key={version.id}
                  onClick={() => {
                    onSelectVersion(version);
                    onOpenChange(false);
                  }}
                  className="w-full text-left"
                >
                  <Card className="bg-secondary/50 border-border hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                              <span className="text-xs font-mono text-primary">v{version.version}</span>
                            </div>
                            {index < versions.length - 1 && (
                              <div className="absolute top-8 left-1/2 w-0.5 h-6 bg-border -translate-x-1/2" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {version.config.goal.slice(0, 50)}...
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(version.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-1">
                          {getVerdictIcon(version.judgeResult.verdict)}
                          <span className="text-xs text-muted-foreground">{version.judgeResult.verdict}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-mono ${getCookednessColor(version.cookedness.score)}`}>
                            {version.cookedness.score}
                          </span>
                          <span className="text-xs text-muted-foreground">cookedness</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-foreground">
                            {version.testCases.length}
                          </span>
                          <span className="text-xs text-muted-foreground">cases</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
