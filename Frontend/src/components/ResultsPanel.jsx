import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart2, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Camera, 
  Zap, 
  TrendingUp, 
  Activity,
  Shield,
  FileText,
  AlertCircle,
  HelpCircle,
  Target as TargetIcon, // Renamed to avoid conflict if 'Target' is used elsewhere
  Lightbulb,
  UserPlus,
  Users,
  CheckSquare,
  Code,
  List
} from 'lucide-react';
import Visualizations from './Visualizations';
import './ResultsPanel.css';

const ResultsPanel = ({
  selectedVersion,
  comments,
  teamMembers,
  onAddComment,
  isPremium,
  onInvite
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
      return { decision: 'Safe to ship', color: 'safe', label: 'APPROVED', icon: CheckCircle };
    } else if (shipDecision.includes('Ship with monitoring') || shipDecision.includes('SHIP_WITH_MONITORING')) {
      return { decision: 'Ship with monitoring', color: 'warning', label: 'CONDITIONAL', icon: AlertTriangle };
    } else if (shipDecision.includes('Do not ship') || shipDecision.includes('DO_NOT_SHIP')) {
      return { decision: 'Do not ship', color: 'danger', label: 'BLOCKED', icon: AlertCircle };
    }
    
    return { decision: shipDecision, color: 'neutral', label: shipDecision, icon: Info };
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
      { id: 'summary', label: 'Summary', icon: BarChart2, premium: false },
      { id: 'diff', label: 'Diff', icon: FileText, premium: false },
      { id: 'insights', label: 'Insights', icon:  Zap, premium: false },
      { id: 'metrics', label: 'Metrics', icon: Activity, premium: false }
    ];

    // Only show Visualizations tab if both premium and deep dive
    if (isDeepDive && isPremium) {
      baseTabs.push({ id: 'visualizations', label: 'Visualizations', icon: TrendingUp, premium: true });
    }

    baseTabs.push({ id: 'snapshot', label: 'Snapshot', icon: Camera, premium: false });

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
          <div className="empty-icon"><BarChart2 size={48} /></div>
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
    const deepDiveMetrics = analysisResponse?.deep_dive_metrics || {};
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
    
    // Risk Calculation Logic
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
      riskExplanation = 'Overall high risk score';
    } else if (cookednessScore >= 40) {
      finalRisk = 'MEDIUM';
      finalRiskColor = 'warning';
      riskExplanation = 'Mixed risk profile';
    } else {
      finalRisk = 'LOW';
      finalRiskColor = 'safe';
      riskExplanation = 'Low overall risk factors';
    }

    const isDeploymentBlocked = shippingDecision?.decision === 'Do not ship';

    return (
      <div className="metrics-content">
        <div className="metrics-header">
          <h3>
            Performance & Risk Metrics
          </h3>
          {hasDeepDiveMetrics && (
            <span className="badge premium">
              <Zap size={14} className="mr-1 inline" />
              Deep Dive Active
            </span>
          )}
        </div>

        {/* Risk Meter & Main Drivers */}
        <div className="summary-grid">
           <div className="risk-meter-container">
              <div className={`risk-circle-large semantic-${finalRiskColor}`}>
                <span className="risk-number">{cookednessScore}</span>
                <span className="risk-label-small">Risk Score</span>
              </div>
              <div className={`risk-text-large semantic-${finalRiskColor}`}>
                {finalRisk} RISK
              </div>
              <p className="risk-desc-premium">{riskExplanation}</p>
           </div>

           <div className="key-indicators-card">
              <div className="card-premium-header">
                <h4><TargetIcon size={18} className="text-primary" /> Key Drivers</h4>
              </div>
              
              <div className="indicator-item">
                <div className="indicator-label">
                  <Shield size={16} /> Safety Score
                </div>
                <div className="indicator-value">{safetyScore}/100</div>
              </div>
              <div className="indicator-item">
                <div className="indicator-label">
                  <CheckSquare size={16} /> Quality Score
                </div>
                <div className="indicator-value">{qualityScore}/100</div>
              </div>
              <div className="indicator-item">
                <div className="indicator-label">
                  <Code size={16} /> Structure
                </div>
                <div className="indicator-value">{deterministicScore}/100</div>
              </div>
           </div>
        </div>

        {/* Quality & Safety Detail Cards */}
        <div className="stat-cards-grid">
            <div className="stat-card-premium">
               <div className="stat-header">
                 <Shield size={16} /> Safety Analysis
               </div>
               <div className="stat-main-value">
                  {safetyScore}
                  <span className="text-sm font-normal text-muted">/ 100</span>
               </div>
               <div className="progress-premium">
                 <div className={`progress-bar-gradient gradient-${getSeverityColor(safetyScore, true)}`} style={{width: `${safetyScore}%`}}></div>
               </div>
               <p className="stat-footer-text">
                 {safetyScore < 40 ? 'Critical safety issues detected. Deployment blocked.' : 'Safety levels are within acceptable range.'}
               </p>
            </div>

            <div className="stat-card-premium">
               <div className="stat-header">
                 <CheckSquare size={16} /> Quality Analysis
               </div>
               <div className="stat-main-value">
                  {qualityScore}
                   <span className="text-sm font-normal text-muted">/ 100</span>
               </div>
               <div className="progress-premium">
                 <div className={`progress-bar-gradient gradient-${getSeverityColor(qualityScore, true)}`} style={{width: `${qualityScore}%`}}></div>
               </div>
               <p className="stat-footer-text">
                 {qualityScore < 40 ? 'Response quality is low. Review output manually.' : 'Quality standards are generally met.'}
               </p>
            </div>

            <div className="stat-card-premium">
               <div className="stat-header">
                 <TrendingUp size={16} /> Net Change
               </div>
               <div className="stat-main-value">
                  {tradeoffDisplay.netEffect}
               </div>
               <div className="tradeoff-display-mini">
                  <div className={`tradeoff-tag semantic-${tradeoffDisplay.helpfulness?.severity}`}>
                     Helpfulness: {tradeoffDisplay.helpfulness?.delta > 0 ? '↑' : '↓'} 
                  </div>
                  <div className={`tradeoff-tag semantic-${tradeoffDisplay.safety?.severity}`}>
                     Safety: {tradeoffDisplay.safety?.delta > 0 ? '↑' : '↓'}
                  </div>
               </div>
            </div>
        </div>

        {/* Structural Analysis */}
        <div className="section-card">
          <div className="section-header">
            <h4><Code size={18} className="text-secondary" /> Structural Analysis</h4>
          </div>
          
           <div className="metrics-grid-secondary">
            <div className="metric-stat">
              <div className="stat-value">{deterministicScore}/100</div>
              <div className="stat-label">Similarity Score</div>
            </div>
             <div className="metric-stat">
              <div className="stat-value">{deterministic?.deterministic_flags?.length || 0}</div>
              <div className="stat-label">Structural Flags</div>
            </div>
           </div>

           {deterministic?.deterministic_flags?.length > 0 && (
            <div className="flags-container">
               {deterministic.deterministic_flags.map((flag, i) => (
                 <div key={i} className="flag-tag-premium">
                   <AlertTriangle size={14} /> {flag}
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* User-Facing KPIs */}
        <div className="section-card">
          <div className="section-header ">
            <h4>
            <TargetIcon size={18} className="text-secondary" /> User Experience Impact
              <MetricTooltip text="Product-level metrics that PMs and managers care about">
                <HelpCircle size={14} className="help-icon" />
              </MetricTooltip>
            </h4>
          </div>
          
          <div className="kpi-note">
            <div className="kpi-note-icon"><Info size={16} /></div>
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
    const llmJudge = analysisResponse?.evaluation?.llm_judge || {};
    const scores = analysisResponse?.scores || {};
    const narratorSummary = llmJudge?.narrator_summary || llmJudge?.summary || '';
    
    // Get shipping decision from single source of truth
    const shippingDecision = getShippingDecision();
    
    // Risk Colors
    const cookednessScore = scores?.cookedness?.cookedness_score || 0;
    const safetyScore = scores?.safety_score || 0;

    return (
      <div className="summary-content ">
        {/* Hero Decision Card */}
        <div className="hero-card-premium">
           {shippingDecision ? (
             <>
               <div className={`hero-status-badge semantic-${shippingDecision.color}`}>
                  {shippingDecision.label}
               </div>
               <div className={`hero-icon-large text-${shippingDecision.color}`}>
                  <shippingDecision.icon size={64} strokeWidth={1.5} />
               </div>
               <h3 className="hero-title">{shippingDecision.decision}</h3>
               <p className="hero-message">
                 {shippingDecision.decision === 'Safe to ship' ? 
                   "All systems go. The model shows improvements or stability in all key areas." :
                  shippingDecision.decision === 'Do not ship' ?
                   "Critical regressions detected. It is not recommended to deploy this version." :
                   "Some metrics require attention. Proceed with caution and monitoring."
                 }
               </p>
             </>
           ) : (
             <div className="hero-message">Pending Decision...</div>
           )}
        </div>

        <div className="summary-grid">
           {/* Analysis Brief */}
           <div className="analysis-brief-card">
              <div className="card-premium-header">
                <h4><FileText size={18} className="text-primary" /> Analysis Brief</h4>
              </div>
              <div className="brief-content">
                {narratorSummary ? (
                   narratorSummary.split('\n').map((line, i) => <p key={i}>{line}</p>)
                ) : (
                   <p className="text-muted italic">No summary generated.</p>
                )}
              </div>
           </div>

           {/* Key Indicators */}
           <div className="key-indicators-card">
              <div className="card-premium-header">
                <h4><Activity size={18} className="text-secondary" /> Vital Signs</h4>
              </div>
              
              <div className="indicator-item">
                 <div className="indicator-label">
                   <AlertTriangle size={16} /> Risk Level
                 </div>
                 <div className={`indicator-value semantic-${getSeverityColor(cookednessScore)}`}>
                    {getSeverityLabel(cookednessScore)}
                 </div>
              </div>

              <div className="indicator-item">
                 <div className="indicator-label">
                   <Shield size={16} /> Safety
                 </div>
                 <div className={`indicator-value semantic-${getSeverityColor(safetyScore, true)}`}>
                    {safetyScore > 80 ? 'High' : safetyScore > 50 ? 'Medium' : 'Low'}
                 </div>
              </div>

              <div className="indicator-item">
                 <div className="indicator-label">
                   <TargetIcon size={16} /> Impact
                 </div>
                 <div className="indicator-value">
                    {scores?.quality_score > 70 ? 'Positive' : 'Mixed'}
                 </div>
              </div>
           </div>
        </div>

        {/* Comments Preview */}
        <div className="section-card">
           <div className="section-header">
             <h4><Users size={18} /> Recent Discussions</h4>
           </div>
           {comments?.length > 0 ? (
             <div className="comments-preview">
                {comments.slice(0, 2).map(c => (
                  <div key={c.comment_id} className="comment-preview-item">
                     <strong>{c.user_name || 'User'}</strong>: {c.text}
                  </div>
                ))}
                {comments.length > 2 && (
                  <div className="text-center mt-2">
                    <button className="btn-link" onClick={() => setActiveTab('metrics')}>
                      View all {comments.length} comments
                    </button>
                  </div>
                )}
             </div>
           ) : null}
           
           <div className="comment-input-wrapper mt-4 pt-4 border-t border-[var(--border-light)]">
              <textarea
                className="w-full text-sm p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                rows="2"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newComment.trim()) {
                      onAddComment(newComment);
                      setNewComment('');
                    }
                  }
                }}
              />
              <div className="flex justify-end mt-2">
                <button 
                  className="btn btn-primary btn-sm px-4"
                  disabled={!newComment.trim()}
                  onClick={() => {
                    if (newComment.trim()) {
                      onAddComment(newComment);
                      setNewComment('');
                    }
                  }}
                >
                  Post
                </button>
              </div>
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
                  <details className="diff-details">
                    <summary className="diff-summary">
                      View Response ({result.response?.length || 0} chars)
                    </summary>
                    <pre className="diff-pre">
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
                    <details className={`diff-details ${isBroken ? 'broken' : ''}`}>
                      <summary className="diff-summary">
                        View Response ({result.response?.length || 0} chars)
                      </summary>
                      <pre className="diff-pre">
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
           <div className="empty-icon"><Lightbulb size={48} /></div>
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
          <div className="empty-icon"><Lightbulb size={48} /></div>
          <h3>No Insights Available</h3>
          <p>LLM analysis not available for this version</p>
        </div>
      );
    }

    return (
      <div className="insights-content">
        {hasBrokenResponses && (
          <div className="insight-warning-banner">
             <AlertTriangle size={20} className="text-warning" />
             <div>
              <strong>Analysis Quality Warning:</strong> {brokenCount} out of {newResults.length} responses were broken. Insights may be incomplete.
             </div>
          </div>
        )}

        <div className="insights-grid">
          {/* Change Summary Card */}
          {llmJudge.change_type && (
            <div className="insight-card summary-card">
              <div className="card-header-icon"><Activity size={20} /></div>
              <div className="card-content">
                <span className="insight-label">Detected Change Type</span>
                <h4 className="insight-title">{llmJudge.change_type}</h4>
                <p className="insight-description">{llmJudge.summary || llmJudge.change_summary}</p>
              </div>
            </div>
          )}

           {/* Metrics to Watch */}
           {llmJudge.metrics_to_watch?.length > 0 && (
            <div className="insight-card metrics-card">
               <div className="card-header-small">
                <TargetIcon size={16} className="mr-2" />
                <span>Metrics to Watch</span>
              </div>
              <div className="metrics-tags">
                {llmJudge.metrics_to_watch.map((metric, index) => (
                  <span key={index} className="metric-tag">{metric}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="insights-columns">
          {/* Findings Component */}
          {llmJudge.findings?.length > 0 && (
            <div className="insight-column">
              <h4 className="column-header">
                <CheckSquare size={18} /> Key Findings
              </h4>
              <ul className="findings-list">
                {llmJudge.findings.map((finding, index) => (
                  <li key={index} className="finding-item">
                    <span className="bullet">•</span>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Root Causes Component */}
          {llmJudge.root_causes?.length > 0 && (
            <div className="insight-column">
              <h4 className="column-header">
                 <List size={18} /> Root Causes
              </h4>
              <ul className="findings-list causes-list">
                {llmJudge.root_causes.map((cause, index) => (
                  <li key={index} className="finding-item">
                     <span className="bullet">→</span>
                    {cause}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Suggestions Grid */}
        {llmJudge.suggestions?.length > 0 && (
          <div className="suggestions-section">
            <h4 className="section-title">
              <Lightbulb size={20} className="text-primary" /> Strategic Suggestions
            </h4>
            <div className="suggestions-grid">
              {llmJudge.suggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-card-premium">
                  <div className="suggestion-header">
                     <span className={`severity-indicator severity-${(suggestion.severity || 'medium').toLowerCase()}`}></span>
                    <span className="suggestion-scope">{suggestion.scope || 'General'}</span>
                  </div>
                  <p className="suggestion-text">{suggestion.explanation}</p>
                  {suggestion.suggested_text && (
                    <div className="code-snippet">
                      <Code size={14} className="code-icon" />
                      <pre>{suggestion.suggested_text}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revised Prompt */}
        {llmJudge.revised_prompt && (
          <div className="prompt-section">
            <h4 className="section-title">
              <Sparkles size={20} className="text-primary" /> Recommended Prompt Refinement
            </h4>
            <div className="prompt-container">
               <textarea
                className="revised-prompt-premium"
                value={llmJudge.revised_prompt}
                readOnly
                rows={8}
              />
              <div className="prompt-actions">
                <button 
                  className="btn-copy"
                  onClick={() => navigator.clipboard.writeText(llmJudge.revised_prompt)}
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Risk Flags */}
        {llmJudge.risk_flags?.length > 0 && (
          <div className="risk-flags-section">
            <h4 className="section-title text-danger">
              <AlertTriangle size={20} /> Detected Risk Flags
            </h4>
            <div className="flags-grid-premium">
              {llmJudge.risk_flags.map((flag, index) => (
                <div key={index} className="flag-tag-premium">
                  <span className="flag-icon-large">⚠️</span>
                  <span className="flag-text-large">{flag}</span>
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
        <div className="team-header-row">
           <h4><Users size={16} className="mr-2" /> Team</h4>
           <button className="btn-icon-small" onClick={onInvite} title="Invite Member">
             <UserPlus size={16} />
           </button>
        </div>
        
        <div className="team-list">
          {teamMembers?.length === 0 ? (
            <div className="empty-team">
              <p>No team members</p>
              <button className="btn btn-secondary btn-sm w-full mt-2" onClick={onInvite}>
                Invite Members
              </button>
            </div>
          ) : (
            <>
            {teamMembers?.map((member) => (
              <div key={member.member_id} className="team-member">
                <div className="member-avatar">
                  {(member.display_name || member.email)?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {member.display_name || member.email.split('@')[0]}
                  </div>
                  <div className="member-role-badge">
                    {member.role === 'OWNER' ? '👑 OWNER' : '👤 ' + member.role}
                  </div>
                </div>
              </div>
            ))}
             <button className="invite-row-btn" onClick={onInvite}>
                <div className="invite-icon-circle"><UserPlus size={14} /></div>
                <span>Invite New Member</span>
             </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;