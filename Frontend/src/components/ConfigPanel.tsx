import { useState } from 'react';
import { Play, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AnalysisConfig } from '@/types';

interface ConfigPanelProps {
  config: AnalysisConfig;
  onConfigChange: (config: AnalysisConfig) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function ConfigPanel({ config, onConfigChange, onAnalyze, isAnalyzing }: ConfigPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const updateConfig = (key: keyof AnalysisConfig, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  const addManualQuestion = () => {
    updateConfig('manualQuestions', [...config.manualQuestions, '']);
  };

  const updateManualQuestion = (index: number, value: string) => {
    const updated = [...config.manualQuestions];
    updated[index] = value;
    updateConfig('manualQuestions', updated);
  };

  const removeManualQuestion = (index: number) => {
    updateConfig('manualQuestions', config.manualQuestions.filter((_, i) => i !== index));
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full" />
          Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Endpoints */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">OLD API Endpoint</Label>
            <div className="flex gap-2">
              <span className="bg-destructive/20 text-destructive text-xs font-medium px-2 py-2 rounded-l-md border border-r-0 border-border">
                OLD
              </span>
              <Input
                placeholder="https://api.example.com/v1/old"
                value={config.oldApiEndpoint}
                onChange={(e) => updateConfig('oldApiEndpoint', e.target.value)}
                className="bg-input border-border rounded-l-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">NEW API Endpoint</Label>
            <div className="flex gap-2">
              <span className="bg-success/20 text-success text-xs font-medium px-2 py-2 rounded-l-md border border-r-0 border-border">
                NEW
              </span>
              <Input
                placeholder="https://api.example.com/v2/new"
                value={config.newApiEndpoint}
                onChange={(e) => updateConfig('newApiEndpoint', e.target.value)}
                className="bg-input border-border rounded-l-none"
              />
            </div>
          </div>
        </div>

        {/* Goal */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Evaluation Goal</Label>
          <Textarea
            placeholder="Describe what you want to evaluate... e.g., 'Compare response accuracy and safety for financial queries'"
            value={config.goal}
            onChange={(e) => updateConfig('goal', e.target.value)}
            className="bg-input border-border min-h-[80px] resize-none"
          />
        </div>

        {/* Advanced Options */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
              Advanced Options
              {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Prompt Template */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Prompt Template</Label>
              <Textarea
                placeholder='{"prompt": "{{question}}", "max_tokens": 500}'
                value={config.promptTemplate}
                onChange={(e) => updateConfig('promptTemplate', e.target.value)}
                className="bg-input border-border font-mono text-sm min-h-[100px]"
              />
            </div>

            {/* Response Extraction Path */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Response Extraction Path</Label>
              <Input
                placeholder="response.choices[0].text"
                value={config.responseExtractionPath}
                onChange={(e) => updateConfig('responseExtractionPath', e.target.value)}
                className="bg-input border-border font-mono text-sm"
              />
            </div>

            {/* Number of Test Cases */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Number of Generated Test Cases</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={config.numCases}
                onChange={(e) => updateConfig('numCases', parseInt(e.target.value) || 10)}
                className="bg-input border-border w-24"
              />
            </div>

            {/* Manual Questions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Manual Test Questions</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addManualQuestion}
                  className="text-primary hover:text-primary/80"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              {config.manualQuestions.map((question, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Question ${index + 1}`}
                    value={question}
                    onChange={(e) => updateManualQuestion(index, e.target.value)}
                    className="bg-input border-border"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeManualQuestion(index)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Analyze Button */}
        <Button 
          onClick={onAnalyze} 
          disabled={isAnalyzing || !config.oldApiEndpoint || !config.newApiEndpoint || !config.goal}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Analysis
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
