import { AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DeterministicFlag, JudgeResult, CookednessResult, Insight } from '@/types';

interface ResultsPanelProps {
  deterministicFlags: DeterministicFlag[];
  deterministicScore: number;
  judgeResult: JudgeResult | null;
  cookedness: CookednessResult | null;
  insights: Insight | null;
}

export function ResultsPanel({ 
  deterministicFlags, 
  deterministicScore, 
  judgeResult, 
  cookedness, 
  insights 
}: ResultsPanelProps) {
  const getVerdictIcon = (verdict: JudgeResult['verdict']) => {
    switch (verdict) {
      case 'Improved':
        return <TrendingUp className="w-5 h-5 text-success" />;
      case 'Regression':
        return <TrendingDown className="w-5 h-5 text-destructive" />;
      default:
        return <Minus className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getVerdictColor = (verdict: JudgeResult['verdict']) => {
    switch (verdict) {
      case 'Improved':
        return 'bg-success/20 text-success border-success/30';
      case 'Regression':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground border-muted-foreground/30';
    }
  };

  const getSeverityColor = (severity: DeterministicFlag['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/20 text-destructive';
      case 'high':
        return 'bg-warning/20 text-warning';
      case 'medium':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCookednessColor = (severity: CookednessResult['severity']) => {
    switch (severity) {
      case 'Safe':
        return 'text-success';
      case 'Risky':
        return 'text-warning';
      default:
        return 'text-destructive';
    }
  };

  return (
    <div className="space-y-4">
      {/* Verdict Card */}
      {judgeResult && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full" />
              Verdict
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${getVerdictColor(judgeResult.verdict)}`}>
              {getVerdictIcon(judgeResult.verdict)}
              <div>
                <p className="font-semibold text-lg">{judgeResult.verdict}</p>
                <p className="text-sm opacity-80">{judgeResult.summary}</p>
              </div>
            </div>
            
            {judgeResult.riskFlags.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Risk Flags</p>
                <div className="flex flex-wrap gap-2">
                  {judgeResult.riskFlags.map((flag, i) => (
                    <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence:</span>
              <Progress value={judgeResult.confidence} className="flex-1 h-2" />
              <span className="text-xs text-foreground font-mono">{judgeResult.confidence}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cookedness Score */}
      {cookedness && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
              <span className="w-2 h-2 bg-warning rounded-full" />
              Cookedness Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="text-center">
                <p className={`text-4xl font-bold ${getCookednessColor(cookedness.severity)}`}>
                  {cookedness.score}
                </p>
                <p className={`text-sm ${getCookednessColor(cookedness.severity)}`}>
                  {cookedness.severity}
                </p>
              </div>
              <div className="flex-1 ml-6">
                <Progress 
                  value={cookedness.score} 
                  className="h-3"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Factors</p>
              <div className="flex flex-wrap gap-2">
                {cookedness.factors.map((factor, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deterministic Flags */}
      {deterministicFlags.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
              <span className="w-2 h-2 bg-destructive rounded-full" />
              Deterministic Analysis
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                Score: {deterministicScore}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 p-4 pt-0">
                {deterministicFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-md">
                    <Badge className={getSeverityColor(flag.severity)}>
                      {flag.severity.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">{flag.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Root Cause</p>
              <p className="text-sm text-foreground">{insights.rootCause}</p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Suggestions</p>
              <ul className="space-y-2">
                {insights.suggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>

            {insights.revisedPrompt && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Revised Prompt</p>
                <pre className="bg-secondary rounded-md p-3 text-xs text-foreground overflow-x-auto">
                  {insights.revisedPrompt}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!judgeResult && !cookedness && deterministicFlags.length === 0 && !insights && (
        <Card className="bg-card border-border">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">No analysis results yet</p>
              <p className="text-xs mt-1">Run an analysis to see the results</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
