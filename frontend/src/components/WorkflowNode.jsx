import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const WorkflowNode = memo(({ data, selected }) => {
  const getNodeStyle = (type) => {
    const baseStyle = {
      padding: '16px',
      borderRadius: '16px',
      border: '2px solid',
      minWidth: '180px',
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      boxShadow: selected 
        ? '0 0 0 3px rgba(102, 126, 234, 0.3), 0 12px 32px rgba(0,0,0,0.15)' 
        : '0 8px 24px rgba(0,0,0,0.1)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden'
    };

    const typeStyles = {
      userQuery: {
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))'
      },
      knowledgeBase: {
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05))'
      },
      llmEngine: {
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))'
      },
      output: {
        borderColor: '#9C27B0',
        backgroundColor: 'rgba(156, 39, 176, 0.1)',
        background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.1), rgba(156, 39, 176, 0.05))'
      }
    };

    return { ...baseStyle, ...typeStyles[type] };
  };

  const getIcon = (type) => {
    const icons = {
      userQuery: '💬',
      knowledgeBase: '📚',
      llmEngine: '🤖',
      output: '📤'
    };
    return icons[type] || '📋';
  };

  const getIconStyle = (type) => {
    const iconColors = {
      userQuery: 'linear-gradient(135deg, #4CAF50, #45a049)',
      knowledgeBase: 'linear-gradient(135deg, #2196F3, #1976D2)',
      llmEngine: 'linear-gradient(135deg, #FF9800, #F57C00)',
      output: 'linear-gradient(135deg, #9C27B0, #7B1FA2)'
    };
    return iconColors[type] || 'linear-gradient(135deg, #667eea, #764ba2)';
  };

  return (
    <div style={getNodeStyle(data.type)}>
      {/* Glow effect for selected nodes */}
      {selected && (
        <div style={{
          position: 'absolute',
          top: '-2px',
          left: '-2px',
          right: '-2px',
          bottom: '-2px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3))',
          zIndex: -1,
          animation: 'pulse 2s infinite'
        }} />
      )}
      
      <Handle
        type="target"
        position={Position.Top}
        style={{ 
          background: getIconStyle(data.type),
          width: '12px',
          height: '12px',
          border: '3px solid #fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          top: '-6px'
        }}
      />
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          background: getIconStyle(data.type),
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Icon glow effect */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)',
            borderRadius: '12px'
          }} />
          <span style={{ position: 'relative', zIndex: 1 }}>{getIcon(data.type)}</span>
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: '700', 
            fontSize: '16px', 
            color: '#2d3748',
            marginBottom: '4px',
            lineHeight: '1.2'
          }}>
            {data.label}
          </div>
          {data.description && (
            <div style={{ 
              fontSize: '12px', 
              color: '#718096', 
              marginTop: '2px',
              lineHeight: '1.3',
              fontWeight: '500'
            }}>
              {data.description}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ 
          background: getIconStyle(data.type),
          width: '12px',
          height: '12px',
          border: '3px solid #fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          bottom: '-6px'
        }}
      />
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';

export default WorkflowNode; 