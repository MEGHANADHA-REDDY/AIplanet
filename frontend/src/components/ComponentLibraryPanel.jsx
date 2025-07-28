import React from 'react';
import './ComponentLibraryPanel.css';

const ComponentLibraryPanel = () => {
  const components = [
    {
      id: 'user-query',
      type: 'userQuery',
      label: 'User Query',
      description: 'Accepts user queries via interface',
      icon: '💬',
      color: '#4CAF50'
    },
    {
      id: 'knowledge-base',
      type: 'knowledgeBase',
      label: 'Knowledge Base',
      description: 'Upload and process documents',
      icon: '📚',
      color: '#2196F3'
    },
    {
      id: 'llm-engine',
      type: 'llmEngine',
      label: 'LLM Engine',
      description: 'Generate responses using AI models',
      icon: '🤖',
      color: '#FF9800'
    },
    {
      id: 'output',
      type: 'output',
      label: 'Output',
      description: 'Display final response to user',
      icon: '📤',
      color: '#9C27B0'
    }
  ];

  const onDragStart = (event, nodeType, componentData) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: nodeType,
      data: componentData
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="component-library-panel">
      <h3>Component Library</h3>
      <div className="components-grid">
        {components.map((component) => (
          <div
            key={component.id}
            className="component-item"
            draggable
            onDragStart={(event) => onDragStart(event, component.type, component)}
            style={{ borderColor: component.color }}
          >
            <div className="component-icon" style={{ backgroundColor: component.color }}>
              {component.icon}
            </div>
            <div className="component-info">
              <h4>{component.label}</h4>
              <p>{component.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentLibraryPanel; 