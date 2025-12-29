import { useState, useEffect, useMemo } from 'react';
import Visualizations from './Visualizations';
import './ResultsPanel.css';

const ResultsPanel = ({
  selectedVersion,
  comments,
  teamMembers,
  onAddComment,
  isPremium
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [newComment, setNewComment] = useState('');
  const [showDecisionDetails, setShowDecisionDetails] = useState(false);

  const isDeepDive = useMemo(() => {
    if (!selectedVersion) return false;
    
    const analysisResponse = selectedVersion.analysis_response || {};
    
    if (analysisResponse.is_deep_dive === true) {
      return true;
    }
    
    if (analysisResponse.deep_dive_metrics && Object.keys(analysisResponse.deep_dive_metrics).length > 0) {
      return true;
    }
    
    if (analysisResponse.visualization_data && Object.keys(analysisResponse.visualization_data).length > 0) {
      return true;
    }
    
    return false;
  }, [selectedVersion]);

  // Get shipping decision from single source of truth
  const getShippingDecision = () => {
    if (!selectedVersion) return null;
    
    const analysisResponse = selectedVersion.analysis_response || {};
    const evaluation = analysisResponse?.evaluation || {};
    const llmJudge = evaluation?.llm_judge || {};
    
    // Use only narrator_ship_decision as source of truth
    const shipDecision = llmJudge?.narrator_ship_decision;
    
    if (!shipDecision) return null;
    
    // Map to display values
    if (shipDecision.includes('Safe to ship') || shipDecision.includes('SAFE_TO_SHIP')) {
      return { decision: 'Safe to ship', color: 'safe', label: 'APPROVED' };
    } else if (shipDecision.includes('Ship with monitoring') || shipDecision.includes('SHIP_WITH_MONITORING')) {
      return { decision: 'Ship with monitoring', color: 'warning', label: 'CONDITIONAL' };
    } else if (shipDecision.includes('Do not ship') || shipDecision.includes('DO_NOT_SHIP')) {
      return { decision: 'Do not ship', color: 'danger', label: 'BLOCKED' };
    }
    
    return { decision: shipDecision, color: 'neutral', label: shipDecision };
  };

  // Get tradeoff display with corrected safety logic
  const getTradeoffDisplay = (tradeoffData) => {
    if (!tradeoffData) return {};
    
    const helpfulnessDelta = tradeoffData.helpfulness_delta || 0;
    const safetyDelta = tradeoffData.safety_delta || 0;
    
    // Safety Hardening Logic: If safety increased at the expense of helpfulness
    // OR if safety remained same/high while helpfulness dropped significantly
    const isSafetyHardening = (safetyDelta > 0) || (safetyDelta >= -10 && helpfulnessDelta < -30);
    
    // Helpfulness semantic labels
    let helpfulnessLabel = '';
    let helpfulnessSeverity = '';
    if (helpfulnessDelta < -50) {
      helpfulnessLabel = 'Significant decrease';
      helpfulnessSeverity = 'danger';
    } else if (helpfulnessDelta < -20) {
      helpfulnessLabel = 'Moderate decrease';
      helpfulnessSeverity = 'warning';
    } else if (helpfulnessDelta < 0) {
      helpfulnessLabel = 'Slight decrease';
      helpfulnessSeverity = 'warning';
    } else if (helpfulnessDelta === 0) {
      helpfulnessLabel = 'No change';
      helpfulnessSeverity = 'neutral';
    } else if (helpfulnessDelta < 20) {
      helpfulnessLabel = 'Slight improvement';
      helpfulnessSeverity = 'safe';
    } else if (helpfulnessDelta < 50) {
      helpfulnessLabel = 'Moderate improvement';
      helpfulnessSeverity = 'safe';
    } else {
      helpfulnessLabel = 'Significant improvement';
      helpfulnessSeverity = 'safe';
    }
    
    // Safety semantic labels - FIXED LOGIC
    let safetyLabel = '';
    let safetySeverity = '';
    
    if (isSafetyHardening) {
      // If it's safety hardening, show safety as improved
      if (safetyDelta > 0) {
        safetyLabel = 'Improvement (hardening)';
      } else {
        safetyLabel = 'Preserved (hardening)';
      }
      safetySeverity = 'safe';
    } else if (safetyDelta < -50) {
      safetyLabel = 'Significant decrease';
      safetySeverity = 'danger';
    } else if (safetyDelta < -20) {
      safetyLabel = 'Moderate decrease';
      safetySeverity = 'warning';
    } else if (safetyDelta < 0) {
      safetyLabel = 'Slight decrease';
      safetySeverity = 'warning';
    } else if (safetyDelta === 0) {
      safetyLabel = 'No change';
      safetySeverity = 'neutral';
    } else if (safetyDelta < 20) {
      safetyLabel = 'Slight improvement';
      safetySeverity = 'safe';
    } else if (safetyDelta < 50) {
      safetyLabel = 'Moderate improvement';
      safetySeverity = 'safe';
    } else {
      safetyLabel = 'Significant improvement';
      safetySeverity = 'safe';
    }
    
    // Net effect semantic label
    let netEffectLabel = tradeoffData.net_effect || 'neutral';
    if (netEffectLabel === 'Safety Hardening') {
      netEffectLabel = 'Safer but less useful';
    } else if (netEffectLabel === 'Neutral') {
      netEffectLabel = 'Mixed impact';
    } else if (netEffectLabel === 'Regression') {
      netEffectLabel = 'Overall regression';
    }
    
    return {
      helpfulness: { delta: helpfulnessDelta, label: helpfulnessLabel, severity: helpfulnessSeverity },
      safety: { delta: safetyDelta, label: safetyLabel, severity: safetySeverity },
      netEffect: netEffectLabel,
      isSafetyHardening
    };
  };

  // Get deterministic score label
  const getDeterministicLabel = (score) => {
    if (score >= 80) return 'UNCHANGED';
    if (score >= 60) return 'MINOR CHANGES';
    if (score >= 40) return 'MODERATE CHANGES';
    if (score >= 20) return 'MAJOR CHANGES';
    return 'COMPLETE REWRITE';
  };

  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'summary', label: '📊 Summary', premium: false },
      { id: 'diff', label: '🔍 Diff', premium: false },
      { id: 'insights', label: '💡 Insights', premium: false },
      { id: 'metrics', label: '📈 Metrics', premium: false }
    ];

    // Only show Visualizations tab if both premium and deep dive
    if (isDeepDive && isPremium) {
      baseTabs.push({ id: 'visualizations', label: '📊 Visualizations', premium: true });
    }

    baseTabs.push({ id: 'snapshot', label: '📸 Snapshot', premium: false });

    return baseTabs;
  }, [selectedVersion, isDeepDive, isPremium]);

  useEffect(() => {
    if (activeTab === 'visualizations' && (!isDeepDive || !isPremium)) {
      setActiveTab('summary');
    }
  }, [isDeepDive, isPremium, activeTab]);

  useEffect(() => {
    if (selectedVersion) {
      setActiveTab('summary');
    }
  }, [selectedVersion?.version_id]);

  const formatJSON = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const isValidResponse = (response) => {
    if (!response || typeof response !== 'string') return false;
    if (response.length < 100) return false;
    
    const brokenPatterns = [
      "I'll follow the strict rules",
      "I'll provide information",
      "Please go ahead and ask",
      "Please proceed with your question",
      "I'm ready when you are",
      "User Question:",
      "{question}"
    ];
    
    const lowerResponse = response.toLowerCase();
    for (const pattern of brokenPatterns) {
      if (lowerResponse.includes(pattern.toLowerCase())) {
        return false;
      }
    }
    
    const hasActualContent = response.includes("Assumptions:") && 
                            (response.includes("Explanation:") || response.includes("High-Level Explanation:"));
    
    if (hasActualContent && response.length < 300) {
      return false;
    }
    
    return true;
  };

  const getSeverityColor = (score, invert = false) => {
    if (invert) {
      // For inverted scores (lower is bad, higher is good)
      if (score >= 80) return 'safe';
      if (score >= 60) return 'warning';
      return 'danger';
    } else {
      // For normal scores (higher is bad, lower is good)
      if (score <= 20) return 'safe';
      if (score <= 50) return 'warning';
      return 'danger';
    }
  };

  const getSeverityLabel = (score, invert = false) => {
    if (invert) {
      if (score >= 80) return 'HIGH';
      if (score >= 60) return 'MEDIUM';
      return 'LOW';
    } else {
      if (score <= 20) return 'LOW';
      if (score <= 50) return 'MEDIUM';
      return 'HIGH';
    }
  };

  const MetricTooltip = ({ children, text }) => (
    <div className="metric-tooltip">
      {children}
      <span className="tooltip-text">{text}</span>
    </div>
  );

  const getFlagDescription = (flag) => {
    const descriptions = {
      'EDGE_LOSS': 'The model lost coverage of edge cases or exceptions',
      'NEW_DOMAIN_ASSERTION': 'The model started making claims outside its domain',
      'CONFIDENCE_INFLATION': 'The model became overly confident in uncertain areas',
      'FORMAT_DRIFT': 'The response format changed significantly',
      'HALLUCINATION_INCREASE': 'The model started inventing more facts',
      'SAFETY_DEGRADATION': 'The model became less cautious',
      'HELPFULNESS_DROP': 'The model became less helpful to users'
    };
    return descriptions[flag] || 'A change was detected in the model output';
  };

  const renderMetrics = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📈</div>
          <h3>No Metrics Available</h3>
          <p>Run an analysis to see detailed metrics</p>
        </div>
      );
    }

    const analysisResponse = selectedVersion.analysis_response || {};
    const evaluation = analysisResponse?.evaluation || {};
    const scores = analysisResponse?.scores || {};
    const deterministic = evaluation?.deterministic || {};
    const llmJudge = evaluation?.llm_judge || {};
    const freeMetrics = llmJudge?.free_metrics || {};
    const deepDiveMetrics = analysisResponse?.deep_dive_metrics || {}; // Fixed variable name
    const tradeoff = analysisResponse?.tradeoff || {};
    const errorNovelty = analysisResponse?.error_novelty || {};
    const behavioralShift = analysisResponse?.behavioral_shift || {};
    const cookedness = scores?.cookedness || {};

    const hasDeepDiveMetrics = Object.keys(deepDiveMetrics).length > 0;
    const shippingDecision = getShippingDecision();
    const tradeoffDisplay = getTradeoffDisplay(tradeoff);
    
    // Calculate risk breakdown
    const qualityScore = cookedness.quality_score || scores?.quality_score || 0;
    const safetyScore = cookedness.safety_score || scores?.safety_score || 0;
    const cookednessScore = cookedness.cookedness_score || 0;
    const deterministicScore = deterministic?.deterministic_score || 0;
    
    const qualityRisk = qualityScore <= 30 ? 'HIGH' : qualityScore <= 60 ? 'MEDIUM' : 'LOW';
    const safetyRisk = safetyScore <= 30 ? 'HIGH' : safetyScore <= 60 ? 'MEDIUM' : 'LOW';
    
    let finalRisk = 'MEDIUM';
    let finalRiskColor = 'warning';
    let riskExplanation = '';
    
    if (safetyScore <= 30 || deterministicScore <= 30) {
      finalRisk = 'HIGH';
      finalRiskColor = 'danger';
      riskExplanation = 'Safety or structural issues block deployment';
    } else if (qualityScore <= 30 && safetyScore > 60) {
      finalRisk = 'MEDIUM';
      finalRiskColor = 'warning';
      riskExplanation = 'Quality concerns, safety is good';
    } else if (cookednessScore >= 70) {
      finalRisk = 'HIGH';
      finalRiskColor = 'danger';
      riskExplanation = 'Overall high risk';
    } else if (cookednessScore >= 40) {
      finalRisk = 'MEDIUM';
      finalRiskColor = 'warning';
      riskExplanation = 'Mixed risk profile';
    } else {
      finalRisk = 'LOW';
      finalRiskColor = 'safe';
      riskExplanation = 'Low overall risk';
    }

    const isDeploymentBlocked = shippingDecision?.decision === 'Do not ship';

    return (
      <div className="metrics-content">
        <div className="metrics-header">
          <h3>Comprehensive Analysis Metrics</h3>
          {hasDeepDiveMetrics && (
            <span className="badge premium">🔬 Deep Dive Analysis</span>
          )}
        </div>

        {/* Risk Level Display - Fixed */}
        <div className="section-card">
          <div className="section-header">
            <h4>
              <span>🔥 Deployment Risk Level</span>
              <MetricTooltip text="Overall risk assessment based on safety, quality, and structural changes">
                <span className="help-icon">❓</span>
              </MetricTooltip>
            </h4>
          </div>
          
          <div className="risk-breakdown">
            <div className="risk-overview">
              <div className="risk-final">
                <div className="risk-final-label">Final Risk Assessment</div>
                <div className={`risk-final-value semantic-${finalRiskColor}`}>
                  {finalRisk} RISK
                </div>
                <div className="risk-final-explanation">{riskExplanation}</div>
              </div>
              
              <div className="risk-score">
                <div className="risk-score-value">{cookednessScore || 0}</div>
                <div className="risk-score-label">Computed Score</div>
                <div className="risk-score-note">
                  {cookednessScore <= 30 ? 'Low risk' : 
                   cookednessScore <= 60 ? 'Medium risk' : 'High risk'}
                </div>
              </div>
            </div>
            
            <div className="risk-drivers">
              <h5>Risk Drivers</h5>
              <div className="driver-grid">
                <div className={`driver-card ${qualityRisk === 'HIGH' ? 'driver-high' : qualityRisk === 'MEDIUM' ? 'driver-medium' : 'driver-low'}`}>
                  <div className="driver-label">Quality Impact</div>
                  <div className="driver-status">
                    <span className={`driver-badge ${qualityRisk === 'HIGH' ? 'badge-danger' : qualityRisk === 'MEDIUM' ? 'badge-warning' : 'badge-safe'}`}>
                      {qualityRisk}
                    </span>
                    <span className="driver-score">({qualityScore}/100)</span>
                  </div>
                  <div className="driver-description">
                    {qualityScore >= 70 ? 'High helpfulness' : 
                     qualityScore >= 40 ? 'Moderate helpfulness' : 
                     'Low helpfulness'}
                  </div>
                </div>
                
                <div className={`driver-card ${safetyRisk === 'HIGH' ? 'driver-high' : safetyRisk === 'MEDIUM' ? 'driver-medium' : 'driver-low'}`}>
                  <div className="driver-label">Safety Impact</div>
                  <div className="driver-status">
                    <span className={`driver-badge ${safetyRisk === 'HIGH' ? 'badge-danger' : safetyRisk === 'MEDIUM' ? 'badge-warning' : 'badge-safe'}`}>
                      {safetyRisk}
                    </span>
                    <span className="driver-score">({safetyScore}/100)</span>
                  </div>
                  <div className="driver-description">
                    {safetyScore >= 70 ? 'High safety' : 
                     safetyScore >= 40 ? 'Moderate safety' : 
                     'Low safety — deployment blocker'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deterministic Metrics - Fixed */}
        <div className="section-card">
          <div className="section-header">
            <h4>
              <span>⚙️ Structural Change Analysis</span>
              <MetricTooltip text="Measures output similarity. High score = low change, not high quality.">
                <span className="help-icon">❓</span>
              </MetricTooltip>
            </h4>
          </div>
          
          <div className="metrics-grid-secondary">
            <div className="metric-stat">
              <MetricTooltip text="How similar are old and new outputs structurally? High score = low change">
                <div className="stat-value score-underline">
                  {deterministicScore || 0}/100
                </div>
              </MetricTooltip>
              <div className="stat-label">Structural Similarity</div>
              <div className="stat-severity-label">
                {getDeterministicLabel(deterministicScore)}
              </div>
              <div className="stat-note">
                High score = low change, not high quality
              </div>
            </div>
            
            <div className="metric-stat">
              <div className="stat-value">{deterministic?.deterministic_flags?.length || 0}</div>
              <div className="stat-label">Structural Flags</div>
              <div className="stat-note">
                Any flags may block deployment
              </div>
            </div>
          </div>
          
          {deterministic?.deterministic_flags?.length > 0 && (
            <div className="flags-container">
              <h5>
                <span>Structural Issues Detected</span>
                <MetricTooltip text="Concrete failures detected across test cases">
                  <span className="help-icon small">❓</span>
                </MetricTooltip>
              </h5>
              <div className="tags-grid">
                {deterministic.deterministic_flags.map((flag, index) => (
                  <MetricTooltip key={index} text={`${flag}: ${getFlagDescription(flag)}`}>
                    <span className="tag flag-tag">
                      {flag}
                    </span>
                  </MetricTooltip>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quality & Safety Scores */}
        <div className="section-card">
          <div className="section-header">
            <h4>
              <span>📊 Quality & Safety Scores</span>
              <MetricTooltip text="Quality measures helpfulness, Safety measures caution. Safety score dominates deployment decisions.">
                <span className="help-icon">❓</span>
              </MetricTooltip>
            </h4>
          </div>
          
          {safetyScore < 30 && (
            <div className="safety-warning-banner">
              <div className="warning-icon">🚨</div>
              <div className="warning-content">
                <div className="warning-title">Critical Safety Alert</div>
                <div className="warning-text">
                  High quality does NOT mean safe to ship. Safety score overrides quality for deployment decisions.
                </div>
              </div>
            </div>
          )}
          
          <div className={`quality-safety-grid ${safetyScore < 30 ? 'safety-critical-mode' : ''}`}>
            <div className={`score-card ${safetyScore < 30 ? 'quality-muted' : ''}`}>
              <div className="score-header">
                <MetricTooltip text="How helpful and complete are the responses? Measures usefulness, not safety.">
                  <span className="score-label">Quality Score (Usefulness)</span>
                </MetricTooltip>
                {safetyScore < 30 && (
                  <div className="score-warning">
                    Overridden by safety concerns
                  </div>
                )}
              </div>
              <div className={`score-value ${safetyScore < 30 ? 'score-muted' : `score-${getSeverityColor(qualityScore, true)}`}`}>
                {qualityScore || 0}
              </div>
              <div className="score-bar">
                <div 
                  className={`score-fill quality ${safetyScore < 30 ? 'fill-muted' : `score-${getSeverityColor(qualityScore, true)}`}`}
                  style={{ width: `${qualityScore || 0}%` }}
                ></div>
              </div>
              <div className="score-description">
                {qualityScore >= 70 ? 'Highly helpful' : 
                 qualityScore >= 40 ? 'Moderately helpful' : 
                 'Limited helpfulness'}
              </div>
            </div>
            
            <div className={`score-card ${safetyScore < 30 ? 'safety-critical' : ''}`}>
              <div className="score-header">
                <MetricTooltip text="How cautious and policy-aligned are the responses? Dominates deployment decisions.">
                  <span className="score-label">Safety Score (Caution)</span>
                </MetricTooltip>
                {safetyScore < 30 && (
                  <div className="score-alert">🚨 Deployment blocker</div>
                )}
              </div>
              <div className={`score-value ${safetyScore < 30 ? 'score-critical' : `score-${getSeverityColor(safetyScore, true)}`}`}>
                {safetyScore || 0}
              </div>
              <div className="score-bar">
                <div 
                  className={`score-fill safety ${safetyScore < 30 ? 'fill-critical' : `score-${getSeverityColor(safetyScore, true)}`}`}
                  style={{ width: `${safetyScore || 0}%` }}
                ></div>
              </div>
              <div className="score-description">
                {safetyScore >= 70 ? 'Very safe' : 
                 safetyScore >= 40 ? 'Moderately safe' : 
                 'Safety concerns — blocks deployment'}
              </div>
            </div>
          </div>
        </div>

        {/* Tradeoff Analysis - Fixed with corrected safety logic */}
        <div className="section-card">
          <div className="section-header">
            <h4>
              <span>⚖️ Change Analysis</span>
              <MetricTooltip text="Tradeoffs between different dimensions. Explains why Safety Hardening happens.">
                <span className="help-icon">❓</span>
              </MetricTooltip>
            </h4>
          </div>
          
          <div className="tradeoff-grid">
            <div className="tradeoff-metric">
              <MetricTooltip text="Change in usefulness to users">
                <div className="tradeoff-label">Helpfulness</div>
              </MetricTooltip>
              <div className="tradeoff-value-display">
                <div className={`tradeoff-direction semantic-${tradeoffDisplay.helpfulness?.severity || 'neutral'}`}>
                  {tradeoffDisplay.helpfulness?.delta > 0 ? '↑' : 
                   tradeoffDisplay.helpfulness?.delta < 0 ? '↓' : '↔'}
                </div>
                <div className={`tradeoff-semantic semantic-${tradeoffDisplay.helpfulness?.severity || 'neutral'}`}>
                  {tradeoffDisplay.helpfulness?.label || 'No change'}
                </div>
              </div>
            </div>
            
            <div className="tradeoff-metric">
              <MetricTooltip text="Change in safety and caution">
                <div className="tradeoff-label">Safety</div>
              </MetricTooltip>
              <div className="tradeoff-value-display">
                <div className={`tradeoff-direction semantic-${tradeoffDisplay.safety?.severity || 'neutral'}`}>
                  {tradeoffDisplay.isSafetyHardening ? '↑' : 
                   tradeoffDisplay.safety?.delta > 0 ? '↑' : 
                   tradeoffDisplay.safety?.delta < 0 ? '↓' : '↔'}
                </div>
                <div className={`tradeoff-semantic semantic-${tradeoffDisplay.safety?.severity || 'neutral'}`}>
                  {tradeoffDisplay.safety?.label || 'No change'}
                </div>
              </div>
            </div>
            
            <div className="tradeoff-metric">
              <MetricTooltip text="Overall effect of the change">
                <div className="tradeoff-label">Net Effect</div>
              </MetricTooltip>
              <div className={`tradeoff-net semantic-${tradeoffDisplay.netEffect?.includes('regression') ? 'warning' : tradeoffDisplay.netEffect?.includes('hardening') ? 'info' : 'neutral'}`}>
                {tradeoffDisplay.netEffect}
              </div>
            </div>
          </div>
          
          {tradeoffDisplay.isSafetyHardening && (
            <div className="tradeoff-explanation">
              <div className="explanation-icon">🛡️</div>
              <div className="explanation-content">
                <strong>Safety Hardening Detected:</strong> Model became more cautious at the expense of helpfulness.
                This prioritizes safety over user experience.
              </div>
            </div>
          )}
          
          {llmJudge?.direction_analysis?.reasoning && (
            <div className="tradeoff-explanation">
              <MetricTooltip text="LLM's reasoning for the direction of change">
                <strong>Explanation:</strong>
              </MetricTooltip>
              <p>{llmJudge.direction_analysis.reasoning}</p>
            </div>
          )}
        </div>

        {/* Behavioral Shift Analysis */}
        <div className="section-card">
          <div className="section-header">
            <h4>
              <span>🔄 Behavioral Shift Analysis</span>
              <MetricTooltip text="How did the style and tone of the model change? Important for user experience and trust.">
                <span className="help-icon">❓</span>
              </MetricTooltip>
            </h4>
          </div>
          
          <div className="behavior-grid">
            {behavioralShift && Object.entries(behavioralShift).map(([key, value]) => {
              const severity = value.includes('more cautious') ? 'warning' : 
                             value.includes('less specific') ? 'warning' : 
                             value.includes('unchanged') ? 'neutral' : 'info';
              
              return (
                <div key={key} className="behavior-item">
                  <div className="behavior-label">{key.replace(/_/g, ' ')}:</div>
                  <div className={`behavior-value semantic-${severity}`}>
                    <span className="behavior-text">{value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Advanced Metrics - With disclaimer */}
        {Object.keys(deepDiveMetrics).length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <h4>
                <span>🔬 Advanced Metrics</span>
                <MetricTooltip text="Detailed analysis metrics for deep dive insights">
                  <span className="help-icon">❓</span>
                </MetricTooltip>
              </h4>
            </div>
            
            {isDeploymentBlocked && (
              <div className="advanced-metrics-disclaimer">
                <div className="disclaimer-icon">ℹ️</div>
                <div className="disclaimer-content">
                  <strong>Note:</strong> Advanced metrics do NOT override safety or deterministic failures for deployment decisions.
                </div>
              </div>
            )}
            
            <div className={`metrics-grid ${isDeploymentBlocked ? 'metrics-blocked' : ''}`}>
              {deepDiveMetrics.adversarial_robustness && (
                <div className="metric-card">
                  <div className="metric-header">
                    <h4>🎯 Adversarial Robustness</h4>
                    <span className={`score-badge ${getSeverityColor(deepDiveMetrics.adversarial_robustness.score, true)}`}>
                      {deepDiveMetrics.adversarial_robustness.score}/100
                    </span>
                  </div>
                  <p className="metric-description">Ability to handle adversarial test cases</p>
                </div>
              )}

              {deepDiveMetrics.instruction_adherence && (
                <div className="metric-card">
                  <div className="metric-header">
                    <h4>📋 Instruction Adherence</h4>
                    <span className={`score-badge ${getSeverityColor(deepDiveMetrics.instruction_adherence.new_score || 50, true)}`}>
                      {deepDiveMetrics.instruction_adherence.new_score || 50}/100
                    </span>
                  </div>
                  <p className="metric-description">Compliance with system instructions</p>
                </div>
              )}

              {deepDiveMetrics.consistency_score?.new !== undefined && (
                <div className="metric-card">
                  <div className="metric-header">
                    <h4>🔄 Consistency Score</h4>
                    <span className={`score-badge ${getSeverityColor(deepDiveMetrics.consistency_score.new, true)}`}>
                      {deepDiveMetrics.consistency_score.new}/100
                    </span>
                  </div>
                  <p className="metric-description">Consistency across similar queries</p>
                </div>
              )}

              {deepDiveMetrics.hallucination_rate?.new !== undefined && (
                <div className="metric-card">
                  <div className="metric-header">
                    <h4>🚨 Hallucination Rate</h4>
                    <span className={`score-badge ${getSeverityColor(100 - deepDiveMetrics.hallucination_rate.new * 100, true)}`}>
                      {(deepDiveMetrics.hallucination_rate.new * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="metric-description">Rate of fabricated or incorrect information</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Novelty */}
        <div className="section-card">
          <div className="section-header">
            <h4>
              <span>⚠️ Error Novelty Analysis</span>
              <MetricTooltip text="Teams tolerate old bugs but hate new ones. Tracks what's new vs inherited.">
                <span className="help-icon">❓</span>
              </MetricTooltip>
            </h4>
          </div>
          
          <div className="error-grid">
            <div className="error-stat">
              <MetricTooltip text="New problems that didn't exist before">
                <div className="error-label">Introduced Errors</div>
              </MetricTooltip>
              <div className="error-count">
                {errorNovelty?.introduced_errors?.length || 0}
              </div>
            </div>
            
            <div className="error-stat">
              <MetricTooltip text="Old problems still present">
                <div className="error-label">Inherited Errors</div>
              </MetricTooltip>
              <div className="error-count">
                {errorNovelty?.inherited_errors?.length || 0}
              </div>
            </div>
            
            <div className="error-stat">
              <MetricTooltip text="Has new risks appeared?">
                <div className="error-label">New Risk</div>
              </MetricTooltip>
              <div className={`error-flag ${errorNovelty?.has_new_risk ? 'semantic-warning' : 'semantic-safe'}`}>
                {errorNovelty?.has_new_risk ? 'Yes ⚠️' : 'No ✅'}
              </div>
            </div>
          </div>
        </div>

        {/* User-Facing KPIs */}
        <div className="section-card">
          <div className="section-header">
            <h4>
              <span>🎯 User Experience Impact</span>
              <MetricTooltip text="Product-level metrics that PMs and managers care about">
                <span className="help-icon">❓</span>
              </MetricTooltip>
            </h4>
          </div>
          
          <div className="kpi-note">
            <div className="kpi-note-icon">ℹ️</div>
            <div className="kpi-note-content">
              <strong>Note:</strong> User experience metrics indicate impact, not deployment safety. 
              Deployment decisions prioritize safety and deterministic failures.
            </div>
          </div>
          
          <div className="kpi-grid">
            <div className="kpi-item">
              <MetricTooltip text="How much users will feel this change (0-100)">
                <div className="kpi-label">User Impact Score</div>
              </MetricTooltip>
              <div className={`kpi-value semantic-${freeMetrics?.user_impact_score >= 70 ? 'safe' : freeMetrics?.user_impact_score >= 40 ? 'warning' : 'danger'}`}>
                {freeMetrics?.user_impact_score || 0}
              </div>
            </div>
            
            <div className="kpi-item">
              <MetricTooltip text="How consistent the model feels after change (0-100)">
                <div className="kpi-label">Trust Stability Index</div>
              </MetricTooltip>
              <div className={`kpi-value semantic-${freeMetrics?.trust_stability_index >= 70 ? 'safe' : freeMetrics?.trust_stability_index >= 40 ? 'warning' : 'danger'}`}>
                {freeMetrics?.trust_stability_index || 0}
              </div>
            </div>
            
            <div className="kpi-item">
              <MetricTooltip text="Risk of failure in production">
                <div className="kpi-label">Operational Risk</div>
              </MetricTooltip>
              <div className={`kpi-risk semantic-${freeMetrics?.operational_risk?.toLowerCase() || 'neutral'}`}>
                {freeMetrics?.operational_risk || "Low"}
              </div>
            </div>
          </div>
        </div>

        {/* API Usage */}
        <div className="section-card">
          <div className="section-header">
            <h4>🔧 Analysis Configuration</h4>
          </div>
          
          <div className="api-info">
            <div className="api-stat">
              <span className="api-label">Test Cases:</span>
              <span className="api-value">{analysisResponse?.test_cases?.length || 0}</span>
            </div>
            
            <div className="api-stat">
              <span className="api-label">API Calls:</span>
              <span className="api-value">{analysisResponse?.api_calls_used || 0}</span>
            </div>
            
            <div className="api-stat">
              <span className="api-label">Provider:</span>
              <span className="api-value">{analysisResponse?.provider || "Unknown"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Analysis Results</h3>
          <p>Run an analysis to see results here</p>
        </div>
      );
    }

    const analysisResponse = selectedVersion.analysis_response || selectedVersion;
    const evaluation = analysisResponse?.evaluation || {};
    const scores = analysisResponse?.scores || {};
    const verdict = analysisResponse?.verdict || {};
    const llmJudge = evaluation?.llm_judge || {};
    const deterministic = evaluation?.deterministic || {};
    const tradeoff = analysisResponse?.tradeoff || {};
    
    const narratorSummary = llmJudge?.narrator_summary || llmJudge?.summary || '';
    
    // Get shipping decision from single source of truth
    const shippingDecision = getShippingDecision();
    const tradeoffDisplay = getTradeoffDisplay(tradeoff);
    
    const isSafetyHardening = tradeoffDisplay.isSafetyHardening;
    const hasDeterministicFlags = deterministic?.deterministic_flags?.length > 0;

    return (
      <div className="summary-content">
        {/* Deployment Decision - Single Source of Truth */}
        <div className="section-card decision-card">
          <div className="decision-header">
            <div className="decision-icon">🚢</div>
            <div className="decision-title">
              <h3>Deployment Decision</h3>
              <div className="decision-badge">Final Authority</div>
            </div>
          </div>
          
          {shippingDecision ? (
            <div className={`decision-result decision-${shippingDecision.color}`}>
              <div className="decision-status">{shippingDecision.label}</div>
              <div className="decision-message">{shippingDecision.decision}</div>
            </div>
          ) : (
            <div className="decision-result decision-neutral">
              <div className="decision-status">PENDING</div>
              <div className="decision-message">No deployment decision available</div>
            </div>
          )}
          
          <button 
            className="decision-details-toggle"
            onClick={() => setShowDecisionDetails(!showDecisionDetails)}
          >
            {showDecisionDetails ? 'Hide decision details' : 'Show decision details'}
            <span className="toggle-icon">{showDecisionDetails ? '↑' : '↓'}</span>
          </button>
          
          {showDecisionDetails && shippingDecision && (
            <div className="decision-details">
              <div className="decision-reason">
                <h5>Decision Reasons:</h5>
                <ul>
                  {shippingDecision.decision === 'Do not ship' && (
                    <>
                      <li>Safety regression outweighs quality gains</li>
                      <li>New model prioritizes caution over usefulness</li>
                      <li>User experience may be degraded</li>
                    </>
                  )}
                  {shippingDecision.decision === 'Ship with monitoring' && (
                    <>
                      <li>Mixed impact requires observation</li>
                      <li>Safety improved but helpfulness decreased</li>
                      <li>Monitor user feedback closely</li>
                    </>
                  )}
                  {shippingDecision.decision === 'Safe to ship' && (
                    <>
                      <li>Balanced improvement across metrics</li>
                      <li>Maintains or improves both safety and quality</li>
                      <li>No critical regressions detected</li>
                    </>
                  )}
                </ul>
              </div>
              
              <div className="decision-factors">
                <h5>Key Factors:</h5>
                <div className="factor-grid">
                  {isSafetyHardening && (
                    <div className="factor-item factor-safety">
                      <div className="factor-icon">🛡️</div>
                      <div className="factor-content">
                        <div className="factor-label">Safety Hardening</div>
                        <div className="factor-description">Model became more cautious</div>
                      </div>
                    </div>
                  )}
                  
                  {hasDeterministicFlags && (
                    <div className="factor-item factor-structural">
                      <div className="factor-icon">⚙️</div>
                      <div className="factor-content">
                        <div className="factor-label">Structural Changes</div>
                        <div className="factor-description">{deterministic.deterministic_flags.length} issues detected</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="factor-item factor-tradeoff">
                    <div className="factor-icon">⚖️</div>
                    <div className="factor-content">
                      <div className="factor-label">Change Analysis</div>
                      <div className="factor-description">{tradeoffDisplay.netEffect}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analysis Summary */}
        <div className="section-card">
          <h4>📋 Analysis Summary</h4>
          <div className="narrator-summary">
            {narratorSummary ? (
              <>
                <div className="summary-header">
                  <span className="summary-icon">📝</span>
                  <h5>LLM Analysis Summary</h5>
                </div>
                <div className="summary-text">
                  {narratorSummary.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-summary">
                <span className="empty-icon">📝</span>
                <p>No detailed summary available</p>
              </div>
            )}
          </div>
        </div>

        {/* Key Risk Indicators */}
        <div className="section-card">
          <h4>📊 Key Risk Indicators</h4>
          <div className="key-metrics-grid">
            <div className="key-metric">
              <div className="key-metric-label">Risk Level</div>
              <div className={`key-metric-value semantic-${getSeverityColor(scores?.cookedness?.cookedness_score || 0)}`}>
                {getSeverityLabel(scores?.cookedness?.cookedness_score || 0)}
              </div>
              <div className="key-metric-description">
                Overall risk assessment
              </div>
            </div>
            
            <div className="key-metric">
              <div className="key-metric-label">Structural Change</div>
              <div className={`key-metric-value semantic-${getSeverityColor(deterministic?.deterministic_score || 0, true)}`}>
                {getDeterministicLabel(deterministic?.deterministic_score || 0)}
              </div>
              <div className="key-metric-description">
                High score = low change
              </div>
            </div>
            
            <div className="key-metric">
              <div className="key-metric-label">Safety Impact</div>
              <div className={`key-metric-value semantic-${getSeverityColor(scores?.safety_score || 0, true)}`}>
                {getSeverityLabel(scores?.safety_score || 0, true)}
              </div>
              <div className="key-metric-description">
                Critical for deployment
              </div>
            </div>
            
            <div className="key-metric">
              <div className="key-metric-label">Flags Detected</div>
              <div className="key-metric-value">
                {deterministic?.deterministic_flags?.length || 0}
              </div>
              <div className="key-metric-description">
                Structural issues
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="section-card">
          <h4>💬 Comments</h4>
          <div className="comments-list">
            {comments?.length === 0 ? (
              <div className="empty-comments">
                <p>No comments yet</p>
              </div>
            ) : (
              comments?.map((comment) => (
                <div key={comment.comment_id} className="comment">
                  <div className="comment-header">
                    <div className="comment-author">
                      <div className="author-avatar">
                        {comment.user_name?.charAt(0) || comment.user_email?.charAt(0) || 'U'}
                      </div>
                      <div className="author-info">
                        <strong>{comment.user_name || comment.user_email}</strong>
                        <span className="comment-time">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="comment-body">
                    {comment.text}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="comment-input">
            <textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                if (newComment.trim()) {
                  onAddComment(newComment);
                  setNewComment('');
                }
              }}
              disabled={!newComment.trim()}
            >
              Post Comment
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDiff = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No Diff Available</h3>
          <p>Run an analysis to see side-by-side comparison</p>
        </div>
      );
    }

    const analysisResponse = selectedVersion.analysis_response || selectedVersion;
    const results = analysisResponse?.results || {};
    const { old = [], new: newResults = [] } = results;
    
    const brokenCount = newResults.filter(r => !isValidResponse(r.response)).length;
    
    return (
      <div className="diff-content">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h3>Model Comparison</h3>
          <div className="comparison-label">
            {old.length > 0 && newResults.length > 0 ? (
              <span className="comparison-complete">✅ Complete Comparison (New vs Old)</span>
            ) : (
              <span className="comparison-warning">⚠️ Comparison Incomplete - Old model missing</span>
            )}
          </div>
        </div>
        
        <div className="diff-grid">
          <div className="diff-column">
            <div className="diff-header">
              <h4>Old Model Output</h4>
              <span className="diff-count">{old.length} responses</span>
            </div>
            <div className="diff-samples" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {old.map((result, index) => (
                <div key={index} className="diff-sample" style={{ marginBottom: '1.5rem' }}>
                  <div className="question-label" style={{ 
                    fontWeight: '600', 
                    marginBottom: '0.5rem',
                    color: '#495057'
                  }}>
                    Test Case {index + 1}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#6c757d',
                    marginBottom: '0.5rem',
                    fontStyle: 'italic'
                  }}>
                    Q: {result.question}
                  </div>
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{
                      cursor: 'pointer',
                      padding: '0.5rem',
                      backgroundColor: '#e9ecef',
                      borderRadius: '0.25rem',
                      fontWeight: '500',
                      userSelect: 'none'
                    }}>
                      View Response ({result.response?.length || 0} chars)
                    </summary>
                    <pre style={{ 
                      maxHeight: '400px', 
                      overflow: 'auto',
                      fontSize: '0.85rem',
                      backgroundColor: '#f8f9fa',
                      padding: '0.75rem',
                      marginTop: '0.5rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: '1px solid #dee2e6',
                      borderRadius: '0.25rem'
                    }}>
                      {result.response}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
          
          <div className="diff-column">
            <div className="diff-header">
              <h4>New Model Output</h4>
              <span className="diff-count">{newResults.length} responses</span>
            </div>
            <div className="diff-samples" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {newResults.map((result, index) => {
                const isBroken = !isValidResponse(result.response);
                return (
                  <div key={index} className="diff-sample" style={{
                    borderLeft: isBroken ? '4px solid #ffc107' : '4px solid transparent',
                    paddingLeft: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <div className="question-label" style={{ 
                        fontWeight: '600',
                        color: '#495057'
                      }}>
                        Test Case {index + 1}
                      </div>
                      {isBroken && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#ffc107',
                          color: '#000',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          ⚠️ BROKEN
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#6c757d',
                      marginBottom: '0.5rem',
                      fontStyle: 'italic'
                    }}>
                      Q: {result.question}
                    </div>
                    <details style={{ marginTop: '0.5rem' }}>
                      <summary style={{
                        cursor: 'pointer',
                        padding: '0.5rem',
                        backgroundColor: isBroken ? '#fff3cd' : '#e9ecef',
                        borderRadius: '0.25rem',
                        fontWeight: '500',
                        userSelect: 'none'
                      }}>
                        View Response ({result.response?.length || 0} chars)
                      </summary>
                      <pre style={{ 
                        maxHeight: '400px', 
                        overflow: 'auto',
                        fontSize: '0.85rem',
                        backgroundColor: isBroken ? '#fff3cd' : '#f8f9fa',
                        padding: '0.75rem',
                        marginTop: '0.5rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        border: `1px solid ${isBroken ? '#ffc107' : '#dee2e6'}`,
                        borderRadius: '0.25rem'
                      }}>
                        {result.response}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInsights = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">💡</div>
          <h3>No Insights Available</h3>
          <p>Run an analysis to see AI-powered insights</p>
        </div>
      );
    }

    const analysisResponse = selectedVersion.analysis_response || selectedVersion;
    const evaluation = analysisResponse?.evaluation || {};
    const llmJudge = evaluation?.llm_judge || {};
    
    const results = analysisResponse?.results || {};
    const newResults = results.new || [];
    const brokenCount = newResults.filter(r => !isValidResponse(r.response)).length;
    const hasBrokenResponses = brokenCount > 0;

    if (!llmJudge || Object.keys(llmJudge).length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">💡</div>
          <h3>No Insights Available</h3>
          <p>LLM analysis not available for this version</p>
        </div>
      );
    }

    return (
      <div className="insights-content">
        {hasBrokenResponses && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: '#856404', fontWeight: '600', marginBottom: '0.5rem' }}>
              ⚠️ Analysis Quality Warning
            </p>
            <p style={{ color: '#856404', fontSize: '0.9rem', margin: 0 }}>
              {brokenCount} out of {newResults.length} responses were broken. The insights below 
              are based on incomplete data and may not be accurate.
            </p>
          </div>
        )}

        {llmJudge.change_type && (
          <div className="insight-section">
            <h4>Change Type: {llmJudge.change_type}</h4>
            <p className="insight-summary">{llmJudge.summary || llmJudge.change_summary}</p>
          </div>
        )}

        {llmJudge.findings?.length > 0 && (
          <div className="insight-section">
            <h4>Key Findings</h4>
            <ul className="insight-list">
              {llmJudge.findings.map((finding, index) => (
                <li key={index}>{finding}</li>
              ))}
            </ul>
          </div>
        )}

        {llmJudge.root_causes?.length > 0 && (
          <div className="insight-section">
            <h4>Root Causes</h4>
            <ul className="insight-list">
              {llmJudge.root_causes.map((cause, index) => (
                <li key={index}>{cause}</li>
              ))}
            </ul>
          </div>
        )}

        {llmJudge.suggestions?.length > 0 && (
          <div className="insight-section">
            <h4>Suggestions</h4>
            <div className="suggestions-grid">
              {llmJudge.suggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-card">
                  <div className="suggestion-header">
                    <span className="suggestion-scope">{suggestion.scope || 'general'}</span>
                    <span className={`suggestion-severity semantic-${(suggestion.severity || 'medium').toLowerCase()}`}>
                      {suggestion.severity || 'medium'}
                    </span>
                  </div>
                  <p className="suggestion-explanation">{suggestion.explanation}</p>
                  {suggestion.suggested_text && (
                    <pre className="suggestion-code">{suggestion.suggested_text}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {llmJudge.revised_prompt && (
          <div className="insight-section">
            <h4>Revised Prompt</h4>
            <textarea
              className="revised-prompt"
              value={llmJudge.revised_prompt}
              readOnly
              rows={10}
            />
          </div>
        )}

        {llmJudge.quick_tests?.length > 0 && (
          <div className="insight-section">
            <h4>Quick Tests</h4>
            <ul className="insight-list">
              {llmJudge.quick_tests.map((test, index) => (
                <li key={index}>{test}</li>
              ))}
            </ul>
          </div>
        )}

        {llmJudge.metrics_to_watch?.length > 0 && (
          <div className="insight-section">
            <h4>Metrics to Watch</h4>
            <div className="metrics-grid-small">
              {llmJudge.metrics_to_watch.map((metric, index) => (
                <div key={index} className="metric-chip">
                  {metric}
                </div>
              ))}
            </div>
          </div>
        )}

        {llmJudge.risk_flags?.length > 0 && (
          <div className="insight-section">
            <h4>Risk Flags</h4>
            <div className="flags-grid">
              {llmJudge.risk_flags.map((flag, index) => (
                <div key={index} className="flag-item">
                  <span className="flag-icon">⚠️</span>
                  <span className="flag-text">{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSnapshot = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📸</div>
          <h3>No Snapshot Available</h3>
          <p>Select a version to see its raw data</p>
        </div>
      );
    }

    const analysisBlob = selectedVersion.analysis_response || {};

    return (
      <div className="snapshot-content">
        <h3>Raw JSON Snapshot — analysis_response</h3>
        <div className="json-viewer">
          <pre>{formatJSON(analysisBlob)}</pre>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <h4>Full Version (top-level)</h4>
          <div className="json-viewer small">
            <pre>{formatJSON(selectedVersion)}</pre>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderSummary();
      case 'diff':
        return renderDiff();
      case 'insights':
        return renderInsights();
      case 'metrics':
        return renderMetrics();
      case 'visualizations':
        // Only render if both premium and deep dive
        return isDeepDive && isPremium ? (
          <Visualizations version={selectedVersion} isPremium={isPremium} />
        ) : null; // Hide completely if not both conditions met
      case 'snapshot':
        return renderSnapshot();
      default:
        return renderSummary();
    }
  };

  return (
    <div className="results-panel">
      <div className="tab-navigation">
        <div className="tab-list">
          {tabs.map((tab) => {
            if (tab.premium && !isPremium) return null;
            
            // Hide Visualizations tab if not both premium and deep dive
            if (tab.id === 'visualizations' && (!isDeepDive || !isPremium)) return null;
            
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.premium && <span className="badge premium">PRO</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>

      <div className="team-sidebar">
        <h4>Team Members</h4>
        <div className="team-list">
          {teamMembers?.length === 0 ? (
            <div className="empty-team">
              <p>No team members</p>
              <button className="btn btn-secondary btn-sm">
                Invite Members
              </button>
            </div>
          ) : (
            teamMembers?.map((member) => (
              <div key={member.member_id} className="team-member">
                <div className="member-avatar">
                  {(member.display_name || member.email)?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {member.display_name || member.email}
                    {member.role === 'OWNER' && (
                      <span className="badge owner">Owner</span>
                    )}
                  </div>
                  <div className="member-role">{member.role}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;