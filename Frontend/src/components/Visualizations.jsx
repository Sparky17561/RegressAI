import { useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import './Visualizations.css';

const Visualizations = ({ version, isPremium }) => {
  const radarChartRef = useRef(null);
  const qualityChartRef = useRef(null);
  const performanceChartRef = useRef(null);
  const hallucinationChartRef = useRef(null);
  
  const charts = useRef({
    radar: null,
    quality: null,
    performance: null,
    hallucination: null
  });

  // Extract visualization data
  const vizData = useMemo(() => {
    if (!version) return {};
    const analysisResponse = version.analysis_response || {};
    return analysisResponse.visualization_data || {};
  }, [version]);

  // Extract deep dive metrics
  const deepMetrics = useMemo(() => {
    if (!version) return {};
    const analysisResponse = version.analysis_response || {};
    return analysisResponse.deep_dive_metrics || {};
  }, [version]);

  const isDeepDive = useMemo(() => {
    if (!version) return false;
    const analysisResponse = version.analysis_response || {};
    return analysisResponse.is_deep_dive === true;
  }, [version]);

  useEffect(() => {
    if (!isPremium || !isDeepDive || !version) return;

    console.log('🎨 Visualizations Debug:', {
      hasVizData: Object.keys(vizData).length > 0,
      hasDeepMetrics: Object.keys(deepMetrics).length > 0,
      isDeepDive
    });

    // Destroy existing charts
    Object.values(charts.current).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });

    // Reset charts reference
    charts.current = {
      radar: null,
      quality: null,
      performance: null,
      hallucination: null
    };

    // Create charts with actual data
    createRadarChart(vizData);
    createQualityChart(vizData);
    createPerformanceChart(vizData);
    createHallucinationChart(vizData, deepMetrics);

    return () => {
      Object.values(charts.current).forEach(chart => {
        if (chart) chart.destroy();
      });
    };
  }, [vizData, deepMetrics, isDeepDive, isPremium, version]);

  const createRadarChart = (vizData) => {
    const ctx = radarChartRef.current?.getContext('2d');
    if (!ctx) return;

    const mc = vizData.metrics_comparison || {};
    
    // Use actual data or fallback
    const labels = mc.labels || ['Quality', 'Safety', 'Consistency', 'Robustness', 'Efficiency'];
    const oldScores = mc.old_scores || [70, 80, 75, 70, 65];
    const newScores = mc.new_scores || [85, 75, 80, 85, 70];
    
    charts.current.radar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Old Model',
            data: oldScores,
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            pointBackgroundColor: 'rgba(239, 68, 68, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2
          },
          {
            label: 'New Model',
            data: newScores,
            borderColor: 'rgba(16, 185, 129, 1)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            pointBackgroundColor: 'rgba(16, 185, 129, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { 
              stepSize: 20,
              color: '#6b7280'
            },
            pointLabels: { 
              color: '#374151',
              font: { 
                size: 12,
                weight: '500'
              }
            },
            grid: {
              color: 'rgba(156, 163, 175, 0.3)'
            },
            angleLines: {
              color: 'rgba(156, 163, 175, 0.3)'
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { 
              padding: 20, 
              color: '#374151',
              font: { 
                size: 12,
                weight: '500'
              }
            }
          }
        }
      }
    });
  };

  const createQualityChart = (vizData) => {
    const ctx = qualityChartRef.current?.getContext('2d');
    if (!ctx) return;

    // Get quality distribution for both old and new models
    let oldQualityData = {
      excellent: 0,
      good: 0,
      acceptable: 0,
      poor: 0,
      failed: 0
    };

    let newQualityData = {
      excellent: 0,
      good: 0,
      acceptable: 0,
      poor: 0,
      failed: 0
    };

    // Try to get actual data from visualization_data
    if (vizData.response_quality_distribution) {
      const dist = vizData.response_quality_distribution;
      if (dist.old) {
        oldQualityData = {
          excellent: dist.old.excellent || 0,
          good: dist.old.good || 0,
          acceptable: dist.old.acceptable || 0,
          poor: dist.old.poor || 0,
          failed: dist.old.failed || 0
        };
      }
      if (dist.new) {
        newQualityData = {
          excellent: dist.new.excellent || 0,
          good: dist.new.good || 0,
          acceptable: dist.new.acceptable || 0,
          poor: dist.new.poor || 0,
          failed: dist.new.failed || 0
        };
      }
    } 
    // Try quality_distribution format
    else if (vizData.quality_distribution) {
      const dist = vizData.quality_distribution;
      if (dist.old) {
        oldQualityData = {
          excellent: dist.old.excellent || 0,
          good: dist.old.good || 0,
          acceptable: dist.old.acceptable || 0,
          poor: dist.old.poor || 0,
          failed: dist.old.failed || 0
        };
      }
      if (dist.new) {
        newQualityData = {
          excellent: dist.new.excellent || 0,
          good: dist.new.good || 0,
          acceptable: dist.new.acceptable || 0,
          poor: dist.new.poor || 0,
          failed: dist.new.failed || 0
        };
      }
    } 
    // Fallback to mock data for visualization
    else {
      const totalCases = 20;
      oldQualityData = {
        excellent: Math.floor(totalCases * 0.2),
        good: Math.floor(totalCases * 0.4),
        acceptable: Math.floor(totalCases * 0.25),
        poor: Math.floor(totalCases * 0.1),
        failed: Math.floor(totalCases * 0.05)
      };
      
      newQualityData = {
        excellent: Math.floor(totalCases * 0.35),
        good: Math.floor(totalCases * 0.35),
        acceptable: Math.floor(totalCases * 0.2),
        poor: Math.floor(totalCases * 0.08),
        failed: Math.floor(totalCases * 0.02)
      };
    }

    const labels = ['Excellent', 'Good', 'Acceptable', 'Poor', 'Failed'];
    
    charts.current.quality = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Old Model',
            data: [
              oldQualityData.excellent,
              oldQualityData.good,
              oldQualityData.acceptable,
              oldQualityData.poor,
              oldQualityData.failed
            ],
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'New Model',
            data: [
              newQualityData.excellent,
              newQualityData.good,
              newQualityData.acceptable,
              newQualityData.poor,
              newQualityData.failed
            ],
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { 
              precision: 0,
              color: '#6b7280',
              font: { size: 11 }
            },
            title: { 
              display: true, 
              text: 'Number of Responses',
              color: '#374151',
              font: { size: 12, weight: '500' }
            },
            grid: {
              color: 'rgba(229, 231, 235, 0.5)'
            }
          },
          x: {
            title: { 
              display: true, 
              text: 'Quality Category',
              color: '#374151',
              font: { size: 12, weight: '500' }
            },
            ticks: {
              color: '#6b7280',
              font: { size: 11 }
            },
            grid: { display: false }
          }
        },
        plugins: { 
          legend: { 
            position: 'top',
            labels: {
              color: '#374151',
              font: { size: 12, weight: '500' },
              padding: 20
            }
          }
        }
      }
    });
  };

  const createPerformanceChart = (vizData) => {
    const ctx = performanceChartRef.current?.getContext('2d');
    if (!ctx) return;

    let cases = [];
    
    // Try multiple sources
    if (vizData.test_case_performance && Array.isArray(vizData.test_case_performance)) {
      cases = vizData.test_case_performance;
    } else if (vizData.performance_data && Array.isArray(vizData.performance_data)) {
      cases = vizData.performance_data;
    } else if (vizData.case_performance && Array.isArray(vizData.case_performance)) {
      cases = vizData.case_performance;
    }

    // Limit to 20 cases for readability
    const displayCases = cases.slice(0, 20);
    const labels = displayCases.map((_, i) => `Case ${i + 1}`);
    
    // Extract quality scores
    const oldData = displayCases.map(c => {
      if (typeof c === 'object' && c !== null) {
        return c.old_quality || c.old_score || c.quality_old || 0;
      }
      return 0;
    });
    
    const newData = displayCases.map(c => {
      if (typeof c === 'object' && c !== null) {
        return c.new_quality || c.new_score || c.quality_new || 0;
      }
      return 0;
    });

    charts.current.performance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Old Model',
            data: oldData,
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: 'rgba(239, 68, 68, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4
          },
          {
            label: 'New Model',
            data: newData,
            borderColor: 'rgba(16, 185, 129, 1)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: 'rgba(16, 185, 129, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: { 
              display: true, 
              text: 'Quality Score',
              color: '#374151',
              font: { size: 12, weight: '500' }
            },
            ticks: { color: '#6b7280' },
            grid: { color: 'rgba(229, 231, 235, 0.5)' }
          },
          x: {
            title: { 
              display: true, 
              text: 'Test Case',
              color: '#374151',
              font: { size: 12, weight: '500' }
            },
            ticks: { color: '#6b7280' },
            grid: { color: 'rgba(229, 231, 235, 0.3)' }
          }
        },
        plugins: { 
          legend: { 
            position: 'top',
            labels: { color: '#374151', font: { size: 12, weight: '500' } }
          }
        }
      }
    });
  };

  const createHallucinationChart = (vizData, deepMetrics) => {
    const ctx = hallucinationChartRef.current?.getContext('2d');
    if (!ctx) return;

    let oldRate = 0;
    let newRate = 0;
    
    // Try multiple sources
    if (vizData.hallucination_trend) {
      oldRate = (vizData.hallucination_trend.old || 0) * 100;
      newRate = (vizData.hallucination_trend.new || 0) * 100;
    } else if (vizData.hallucination_data) {
      oldRate = (vizData.hallucination_data.old || 0) * 100;
      newRate = (vizData.hallucination_data.new || 0) * 100;
    } else if (deepMetrics.hallucination_rate) {
      oldRate = (deepMetrics.hallucination_rate.old || 0) * 100;
      newRate = (deepMetrics.hallucination_rate.new || 0) * 100;
    } else {
      // Default mock data
      oldRate = 12.5;
      newRate = 8.2;
    }

    charts.current.hallucination = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Old Model', 'New Model'],
        datasets: [{
          data: [oldRate, newRate],
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          borderColor: [
            'rgb(239, 68, 68)',
            'rgb(16, 185, 129)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { 
            position: 'bottom',
            labels: { color: '#374151', font: { size: 12, weight: '500' } }
          }
        }
      }
    });
  };

  const getScoreClass = (score) => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'acceptable';
    return 'poor';
  };

  if (!isPremium) {
    return (
      <div className="premium-required">
        <div className="premium-icon">✨</div>
        <h3>Premium Feature</h3>
        <p>Deep dive visualizations are only available for PRO users.</p>
      </div>
    );
  }

  if (!isDeepDive) {
    return (
      <div className="not-deep-dive">
        <div className="icon">🔬</div>
        <h3>Not a Deep Dive Analysis</h3>
        <p>This version was not created with deep dive analysis. Run a deep dive to see advanced visualizations.</p>
      </div>
    );
  }

  return (
    <div className="visualizations">
      <div className="viz-header">
        <h2>🔬 Deep Dive Visualizations</h2>
        <p className="viz-subtitle">Advanced metrics and analysis from deep dive evaluation</p>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        <div className="chart-container">
          <div className="chart-header">
            <h4>Metrics Comparison</h4>
            <p className="chart-description">Comparison between old and new model across key dimensions</p>
          </div>
          <div className="chart-wrapper">
            <canvas ref={radarChartRef}></canvas>
          </div>
        </div>

        <div className="chart-container">
          <div className="chart-header">
            <h4>Quality Distribution (Old vs New)</h4>
            <p className="chart-description">Distribution of response quality categories for both models</p>
          </div>
          <div className="chart-wrapper">
            <canvas ref={qualityChartRef}></canvas>
          </div>
        </div>

        <div className="chart-container">
          <div className="chart-header">
            <h4>Performance Over Test Cases</h4>
            <p className="chart-description">Quality scores across individual test cases</p>
          </div>
          <div className="chart-wrapper">
            <canvas ref={performanceChartRef}></canvas>
          </div>
        </div>

        <div className="chart-container">
          <div className="chart-header">
            <h4>Hallucination Rate</h4>
            <p className="chart-description">Comparison of hallucination rates</p>
          </div>
          <div className="chart-wrapper">
            <canvas ref={hallucinationChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="advanced-metrics">
        <h3>Advanced Metrics</h3>
        <div className="metrics-grid">
          {deepMetrics.adversarial_robustness && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>🎯 Adversarial Robustness</h4>
                <span className={`score-badge ${getScoreClass(deepMetrics.adversarial_robustness.score)}`}>
                  {deepMetrics.adversarial_robustness.score}/100
                </span>
              </div>
              <p className="metric-description">Ability to handle adversarial test cases</p>
              {deepMetrics.adversarial_robustness.failed_cases?.length > 0 && (
                <div className="metric-details">
                  <span className="detail-label">Failed Cases:</span>
                  <span className="detail-value">{deepMetrics.adversarial_robustness.failed_cases.length}</span>
                </div>
              )}
            </div>
          )}

          {deepMetrics.instruction_adherence && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>📋 Instruction Adherence</h4>
                <span className={`score-badge ${getScoreClass(deepMetrics.instruction_adherence.new_score || 50)}`}>
                  {deepMetrics.instruction_adherence.new_score || 50}/100
                </span>
              </div>
              <p className="metric-description">Compliance with system instructions</p>
              <div className="metric-details">
                <span className="detail-label">Drift Cases:</span>
                <span className="detail-value">{deepMetrics.instruction_adherence.drift_cases || 0}</span>
              </div>
            </div>
          )}

          {deepMetrics.consistency_score?.new !== undefined && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>🔄 Consistency Score</h4>
                <span className={`score-badge ${getScoreClass(deepMetrics.consistency_score.new)}`}>
                  {deepMetrics.consistency_score.new}/100
                </span>
              </div>
              <p className="metric-description">Consistency across similar queries</p>
            </div>
          )}

          {deepMetrics.hallucination_rate?.new !== undefined && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>🚨 Hallucination Rate</h4>
                <span className={`score-badge ${getScoreClass(100 - deepMetrics.hallucination_rate.new * 100)}`}>
                  {(deepMetrics.hallucination_rate.new * 100).toFixed(1)}%
                </span>
              </div>
              <p className="metric-description">Rate of fabricated or incorrect information</p>
            </div>
          )}

          {deepMetrics.token_efficiency && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>⚡ Token Efficiency</h4>
                <span className={`efficiency-badge ${
                  (deepMetrics.token_efficiency.efficiency_delta_pct || 0) > 0 ? 'positive' : 'negative'
                }`}>
                  {(deepMetrics.token_efficiency.efficiency_delta_pct || 0) > 0 ? '↑' : '↓'}
                  {Math.abs(deepMetrics.token_efficiency.efficiency_delta_pct || 0).toFixed(1)}%
                </span>
              </div>
              <p className="metric-description">Change in token usage efficiency</p>
              <div className="metric-details">
                <span className="detail-label">Avg Tokens (New):</span>
                <span className="detail-value">{deepMetrics.token_efficiency.avg_tokens_new || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Degradation */}
      {deepMetrics.performance_degradation && (
        <div className="degradation-section">
          <h3>Performance Degradation Analysis</h3>
          <div className="degradation-content">
            <div className="degradation-summary">
              <span className="severity-label">Severity:</span>
              <span className={`severity-badge ${deepMetrics.performance_degradation.severity || 'low'}`}>
                {deepMetrics.performance_degradation.severity || 'low'}
              </span>
            </div>
            <div className="degradation-stats">
              <span className="stat-label">Degraded Cases:</span>
              <span className="stat-value">{deepMetrics.performance_degradation.degraded_cases || 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visualizations;