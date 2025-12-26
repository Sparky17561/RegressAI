import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!version || !isPremium) return;

    const vizData = version.visualization_data;
    const deepMetrics = version.deep_dive_metrics;

    if (!vizData && !deepMetrics) return;

    // Destroy existing charts
    Object.values(charts.current).forEach(chart => {
      if (chart) chart.destroy();
    });

    // Create charts
    createRadarChart(vizData);
    createQualityChart(vizData);
    createPerformanceChart(vizData);
    createHallucinationChart(vizData);

    // Cleanup
    return () => {
      Object.values(charts.current).forEach(chart => {
        if (chart) chart.destroy();
      });
    };
  }, [version, isPremium]);

  const createRadarChart = (vizData) => {
    const ctx = radarChartRef.current?.getContext('2d');
    if (!ctx || !vizData?.metrics_comparison) return;

    charts.current.radar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: vizData.metrics_comparison.labels || ['Quality', 'Safety', 'Consistency', 'Robustness', 'Efficiency'],
        datasets: [
          {
            label: 'Old Model',
            data: vizData.metrics_comparison.old_scores || [70, 80, 75, 70, 65],
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            pointBackgroundColor: 'rgba(239, 68, 68, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(239, 68, 68, 1)'
          },
          {
            label: 'New Model',
            data: vizData.metrics_comparison.new_scores || [85, 75, 80, 85, 70],
            borderColor: 'rgba(16, 185, 129, 1)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            pointBackgroundColor: 'rgba(16, 185, 129, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(16, 185, 129, 1)'
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
              stepSize: 20
            },
            pointLabels: {
              font: {
                size: 11
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              font: {
                size: 12
              }
            }
          }
        }
      }
    });
  };

  const createQualityChart = (vizData) => {
    const ctx = qualityChartRef.current?.getContext('2d');
    if (!ctx || !vizData?.quality_distribution) return;

    const dist = vizData.quality_distribution;
    charts.current.quality = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Excellent', 'Good', 'Acceptable', 'Poor', 'Failed'],
        datasets: [{
          label: 'Response Count',
          data: [
            dist.excellent || 0,
            dist.good || 0,
            dist.acceptable || 0,
            dist.poor || 0,
            dist.failed || 0
          ],
          backgroundColor: [
            'rgba(16, 185, 129, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgb(16, 185, 129)',
            'rgb(34, 197, 94)',
            'rgb(245, 158, 11)',
            'rgb(249, 115, 22)',
            'rgb(239, 68, 68)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            },
            title: {
              display: true,
              text: 'Number of Responses'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Quality Category'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  };

  const createPerformanceChart = (vizData) => {
    const ctx = performanceChartRef.current?.getContext('2d');
    if (!ctx || !vizData?.test_case_performance) return;

    const cases = vizData.test_case_performance || [];
    const labels = cases.map((_, i) => `Case ${i + 1}`);
    
    charts.current.performance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Old Model',
            data: cases.map(c => c.old_quality || 0),
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: false,
            tension: 0.4
          },
          {
            label: 'New Model',
            data: cases.map(c => c.new_quality || 0),
            borderColor: 'rgba(16, 185, 129, 1)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.4
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
              text: 'Quality Score'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Test Case'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  };

  const createHallucinationChart = (vizData) => {
    const ctx = hallucinationChartRef.current?.getContext('2d');
    if (!ctx || !vizData?.hallucination_data) return;

    const h = vizData.hallucination_data;
    charts.current.hallucination = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Old Model', 'New Model'],
        datasets: [{
          data: [
            (h.old_rate || 0) * 100,
            (h.new_rate || 0) * 100
          ],
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          borderColor: [
            'rgb(239, 68, 68)',
            'rgb(16, 185, 129)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.label}: ${context.raw.toFixed(1)}%`;
              }
            }
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
        <button className="btn btn-premium">
          Upgrade to PRO
        </button>
      </div>
    );
  }

  if (!version?.is_deep_dive) {
    return (
      <div className="not-deep-dive">
        <div className="icon">🔬</div>
        <h3>Not a Deep Dive Analysis</h3>
        <p>This version was not created with deep dive analysis. Run a deep dive to see advanced visualizations.</p>
        <button className="btn btn-primary">
          Run Deep Dive
        </button>
      </div>
    );
  }

  const deepMetrics = version.deep_dive_metrics || {};

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
            <h4>Quality Distribution</h4>
            <p className="chart-description">Distribution of response quality categories</p>
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
              <p className="metric-description">
                Ability to handle adversarial test cases
              </p>
              {deepMetrics.adversarial_robustness.failed_cases?.length > 0 && (
                <div className="metric-details">
                  <span className="detail-label">Failed Cases:</span>
                  <span className="detail-value">
                    {deepMetrics.adversarial_robustness.failed_cases.length}
                  </span>
                </div>
              )}
            </div>
          )}

          {deepMetrics.instruction_adherence && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>📋 Instruction Adherence</h4>
                <span className={`score-badge ${getScoreClass(deepMetrics.instruction_adherence.score)}`}>
                  {deepMetrics.instruction_adherence.score}/100
                </span>
              </div>
              <p className="metric-description">
                Compliance with system instructions
              </p>
              <div className="metric-details">
                <span className="detail-label">Drift Rate:</span>
                <span className="detail-value">
                  {((deepMetrics.instruction_adherence.drift_rate || 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {deepMetrics.consistency_score !== undefined && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>🔄 Consistency Score</h4>
                <span className={`score-badge ${getScoreClass(deepMetrics.consistency_score)}`}>
                  {deepMetrics.consistency_score}/100
                </span>
              </div>
              <p className="metric-description">
                Consistency across similar queries
              </p>
            </div>
          )}

          {deepMetrics.hallucination_rate !== undefined && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>🚨 Hallucination Rate</h4>
                <span className={`score-badge ${getScoreClass(100 - deepMetrics.hallucination_rate * 100)}`}>
                  {(deepMetrics.hallucination_rate * 100).toFixed(1)}%
                </span>
              </div>
              <p className="metric-description">
                Rate of fabricated or incorrect information
              </p>
            </div>
          )}

          {deepMetrics.safety_breakdown && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>🛡️ Safety Score</h4>
                <span className={`score-badge ${getScoreClass(deepMetrics.safety_breakdown.safety_score)}`}>
                  {deepMetrics.safety_breakdown.safety_score}/100
                </span>
              </div>
              <p className="metric-description">
                Safety and harm prevention measures
              </p>
              {deepMetrics.safety_breakdown.refused_appropriately !== undefined && (
                <div className="metric-details">
                  <span className="detail-label">Appropriate Refusals:</span>
                  <span className="detail-value">
                    {deepMetrics.safety_breakdown.refused_appropriately}
                  </span>
                </div>
              )}
            </div>
          )}

          {deepMetrics.token_efficiency && (
            <div className="metric-card">
              <div className="metric-header">
                <h4>⚡ Token Efficiency</h4>
                <span className={`efficiency-badge ${
                  (deepMetrics.token_efficiency.efficiency_delta || 0) > 0 ? 'positive' : 'negative'
                }`}>
                  {(deepMetrics.token_efficiency.efficiency_delta || 0) > 0 ? '↑' : '↓'}
                  {Math.abs(deepMetrics.token_efficiency.efficiency_delta || 0).toFixed(1)}%
                </span>
              </div>
              <p className="metric-description">
                Change in token usage efficiency
              </p>
              <div className="metric-details">
                <span className="detail-label">Avg Tokens:</span>
                <span className="detail-value">
                  {deepMetrics.token_efficiency.avg_tokens_new || 0}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edge Cases Analysis */}
      {deepMetrics.edge_case_handling?.length > 0 && (
        <div className="edge-cases-section">
          <h3>Edge Case Handling</h3>
          <div className="edge-cases-grid">
            {deepMetrics.edge_case_handling.map((edgeCase, index) => (
              <div 
                key={index}
                className={`edge-case-card ${edgeCase.handled_well ? 'success' : 'failure'}`}
              >
                <div className="edge-case-header">
                  <h4>{edgeCase.case_type}</h4>
                  <span className={`edge-case-badge ${edgeCase.handled_well ? 'success' : 'failure'}`}>
                    {edgeCase.handled_well ? '✓ Handled Well' : '✗ Failed'}
                  </span>
                </div>
                <p className="edge-case-description">
                  {edgeCase.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Degradation */}
      {deepMetrics.performance_degradation && (
        <div className="degradation-section">
          <h3>Performance Degradation Analysis</h3>
          <div className="degradation-content">
            {deepMetrics.performance_degradation.degraded_on?.length > 0 && (
              <div className="degradation-list">
                <h4>⚠️ Degraded On:</h4>
                <ul>
                  {deepMetrics.performance_degradation.degraded_on.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {deepMetrics.performance_degradation.improved_on?.length > 0 && (
              <div className="improvement-list">
                <h4>✅ Improved On:</h4>
                <ul>
                  {deepMetrics.performance_degradation.improved_on.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {deepMetrics.performance_degradation.regression_severity && (
              <div className="severity-indicator">
                <span className="severity-label">Regression Severity:</span>
                <span className={`severity-badge ${deepMetrics.performance_degradation.regression_severity}`}>
                  {deepMetrics.performance_degradation.regression_severity}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Visualizations;