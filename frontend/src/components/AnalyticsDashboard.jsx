import React, { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = ({ isVisible, onClose }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(null);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('http://localhost:8000/workflow/analytics');
      const data = await response.json();
      
      if (data.success) {
        setAnalyticsData(data.data);
        setError('');
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Network error loading analytics');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchAnalytics();
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchAnalytics, 30000);
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isVisible]);

  const formatTime = (seconds) => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    return `${seconds.toFixed(2)}s`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (success) => {
    return success ? '#4CAF50' : '#f44336';
  };

  const getModelColor = (model) => {
    const colors = {
      'gemini': '#4285F4',
      'openai': '#10A37F',
      'gpt-4o-mini': '#10A37F',
      'gpt-4': '#10A37F'
    };
    return colors[model] || '#666';
  };

  if (!isVisible) return null;

  return (
    <div className="analytics-backdrop">
      <div className="analytics-modal">
        <div className="analytics-header">
          <h2>📊 Analytics Dashboard</h2>
          <div className="analytics-controls">
            <button 
              className="refresh-btn"
              onClick={fetchAnalytics}
              disabled={loading}
            >
              🔄 Refresh
            </button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>❌ {error}</p>
            <button onClick={fetchAnalytics}>Retry</button>
          </div>
        ) : analyticsData ? (
          <div className="analytics-content">
            {/* Summary Cards */}
            <div className="summary-cards">
              <div className="summary-card">
                <div className="card-icon">📋</div>
                <div className="card-content">
                  <h3>{analyticsData.total_workflows}</h3>
                  <p>Total Workflows</p>
                </div>
              </div>
              
              <div className="summary-card">
                <div className="card-icon">🚀</div>
                <div className="card-content">
                  <h3>{analyticsData.total_executions}</h3>
                  <p>Total Executions</p>
                </div>
              </div>
              
              <div className="summary-card">
                <div className="card-icon">✅</div>
                <div className="card-content">
                  <h3>{analyticsData.success_rate}%</h3>
                  <p>Success Rate</p>
                </div>
              </div>
              
              <div className="summary-card">
                <div className="card-icon">⏱️</div>
                <div className="card-content">
                  <h3>{formatTime(analyticsData.avg_response_time)}</h3>
                  <p>Avg Response Time</p>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-section">
              {/* Model Usage Chart */}
              <div className="chart-container">
                <h3>🤖 Model Usage</h3>
                <div className="model-usage-chart">
                  {Object.entries(analyticsData.model_usage).map(([model, count]) => (
                    <div key={model} className="model-bar">
                      <div className="model-label">{model}</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill"
                          style={{ 
                            width: `${(count / Math.max(...Object.values(analyticsData.model_usage))) * 100}%`,
                            backgroundColor: getModelColor(model)
                          }}
                        ></div>
                      </div>
                      <div className="model-count">{count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflow Popularity */}
              <div className="chart-container">
                <h3>📈 Popular Workflows</h3>
                <div className="workflow-popularity">
                  {analyticsData.workflow_popularity.slice(0, 5).map((workflow, index) => (
                    <div key={index} className="workflow-item">
                      <div className="workflow-info">
                        <div className="workflow-name">{workflow.name}</div>
                        <div className="workflow-stats">
                          <span>{workflow.execution_count} executions</span>
                          <span>{workflow.success_rate.toFixed(1)}% success</span>
                          <span>{formatTime(workflow.avg_time)} avg time</span>
                        </div>
                      </div>
                      <div className="workflow-bar">
                        <div 
                          className="workflow-fill"
                          style={{ 
                            width: `${(workflow.execution_count / Math.max(...analyticsData.workflow_popularity.map(w => w.execution_count))) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="recent-activity">
              <h3>🕒 Recent Activity</h3>
              <div className="activity-list">
                {analyticsData.recent_activity.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-header">
                      <span className="activity-time">{formatDateTime(activity.timestamp)}</span>
                      <span 
                        className="activity-status"
                        style={{ color: getStatusColor(activity.success) }}
                      >
                        {activity.success ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="activity-content">
                      <div className="activity-query">
                        <strong>Query:</strong> {activity.query}
                      </div>
                      <div className="activity-details">
                        <span className="activity-model" style={{ color: getModelColor(activity.model_used) }}>
                          {activity.model_used}
                        </span>
                        <span className="activity-time">{formatTime(activity.execution_time)}</span>
                        <span className="activity-workflow">{activity.workflow_name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Stats */}
            <div className="daily-stats">
              <h3>📅 Last 7 Days</h3>
              <div className="daily-chart">
                {analyticsData.daily_stats.map((day, index) => (
                  <div key={index} className="day-bar">
                    <div className="day-label">{formatDate(day.date)}</div>
                    <div className="day-bars">
                      <div 
                        className="day-executions"
                        style={{ height: `${(day.total_executions / Math.max(...analyticsData.daily_stats.map(d => d.total_executions))) * 100}%` }}
                        title={`${day.total_executions} executions`}
                      ></div>
                      <div 
                        className="day-success"
                        style={{ height: `${(day.successful_executions / Math.max(...analyticsData.daily_stats.map(d => d.total_executions))) * 100}%` }}
                        title={`${day.successful_executions} successful`}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AnalyticsDashboard; 