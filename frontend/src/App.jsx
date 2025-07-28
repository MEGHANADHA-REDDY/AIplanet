import React, { useRef, useState, useCallback } from 'react';
import ComponentLibraryPanel from './components/ComponentLibraryPanel';
import WorkspacePanel from './components/WorkspacePanel';
import ChatPanel from './components/ChatPanel';
import './App.css';

function App() {
  const chatPanelRef = useRef();
  const [workflowConfig, setWorkflowConfig] = useState({
    nodes: [],
    edges: [],
    nodeConfigs: {},
    currentWorkflowId: null,
  });

  // Memoized getNodeConfig function
  const getNodeConfig = useCallback(
    (nodeId, nodeConfigs = workflowConfig.nodeConfigs) =>
      nodeConfigs[nodeId] || {
        model: 'gemini',
        temperature: 0.7,
        useKnowledgeBase: true,
        maxContextChunks: 3,
        useWebSearch: false,
      },
    [workflowConfig.nodeConfigs]
  );

  const updateWorkflowConfig = useCallback((newConfig) => {
    setWorkflowConfig(newConfig);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: '12px', verticalAlign: 'middle' }}
          >
            <path 
              d="M12 2.5L13.5 4H10.5L12 2.5Z" 
              fill="white"
            />
            <path 
              d="M12 2.5L12 8L10.5 4L12 2.5Z" 
              fill="white"
            />
            <path 
              d="M12 2.5L12 8L13.5 4L12 2.5Z" 
              fill="white"
            />
            <path 
              d="M12 8L8 12L12 16L16 12L12 8Z" 
              fill="white"
            />
            <path 
              d="M12 16L12 21.5L10.5 20L12 16Z" 
              fill="white"
            />
            <path 
              d="M12 16L12 21.5L13.5 20L12 16Z" 
              fill="white"
            />
            <path 
              d="M8 12L4 12L6 10L8 12Z" 
              fill="white"
            />
            <path 
              d="M16 12L20 12L18 10L16 12Z" 
              fill="white"
            />
          </svg>
          Aiplanet Workflow Builder
        </h1>
        <p>Build intelligent workflows with drag & drop</p>
      </header>
      <main className="app-main">
        <ComponentLibraryPanel />
        <WorkspacePanel 
          chatPanelRef={chatPanelRef} 
          workflowConfig={workflowConfig}
          updateWorkflowConfig={updateWorkflowConfig}
          getNodeConfig={getNodeConfig}
        />
        <ChatPanel 
          ref={chatPanelRef} 
          workflowConfig={workflowConfig}
          getNodeConfig={getNodeConfig}
          currentWorkflowId={workflowConfig.currentWorkflowId}
        />
      </main>
    </div>
  );
}

export default App; 