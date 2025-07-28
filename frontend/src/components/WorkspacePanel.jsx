import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';
import WorkflowNode from './WorkflowNode';
import AnalyticsDashboard from './AnalyticsDashboard';
import './WorkspacePanel.css';

// Move nodeTypes outside component to prevent React Flow warning
const nodeTypes = {
  userQuery: WorkflowNode,
  knowledgeBase: WorkflowNode,
  llmEngine: WorkflowNode,
  output: WorkflowNode
};

const WORKFLOW_RUN_API = 'http://localhost:8000/workflow/run';
const WORKFLOW_SAVE_API = 'http://localhost:8000/workflow/workflows/save';
const WORKFLOW_LOAD_API = 'http://localhost:8000/workflow/workflows';

const REQUIRED_COMPONENTS = ['userQuery', 'llmEngine', 'output'];

const WorkspacePanel = ({ chatPanelRef, workflowConfig, updateWorkflowConfig, getNodeConfig }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflowConfig.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflowConfig.edges || []);
  const [selectedNode, setSelectedNode] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runQuery, setRunQuery] = useState('');
  const [runLoading, setRunLoading] = useState(false);
  const [runResponse, setRunResponse] = useState(null);
  const [runError, setRunError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [nodeConfigs, setNodeConfigs] = useState(workflowConfig.nodeConfigs || {}); // Store config for each node
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [loadId, setLoadId] = useState('');
  const [loadStatus, setLoadStatus] = useState('');
  const [workflowList, setWorkflowList] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [showExecutionLogs, setShowExecutionLogs] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const reactFlowWrapper = useRef(null);

  // Memoize the workflow config to prevent unnecessary updates
  const currentWorkflowConfig = useMemo(() => ({
    nodes,
    edges,
    nodeConfigs,
    currentWorkflowId,
  }), [nodes, edges, nodeConfigs, currentWorkflowId]);

  // Only update parent when workflow config actually changes
  useEffect(() => {
    updateWorkflowConfig(currentWorkflowConfig);
  }, [currentWorkflowConfig, updateWorkflowConfig]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));

      const position = {
        x: event.clientX - reactFlowBounds.left - 75, // Center the node better
        y: event.clientY - reactFlowBounds.top - 40,
      };

      const newNode = {
        id: `${data.type}-${Date.now()}`,
        type: data.type,
        position,
        data: {
          label: data.data.label,
          description: data.data.description,
          type: data.type
        }
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onNodeDelete = useCallback((deleted) => {
    setNodes((nds) => nds.filter((node) => !deleted.some((d) => d.id === node.id)));
    setSelectedNode(null);
  }, [setNodes]);

  const onEdgeDelete = useCallback((deleted) => {
    setEdges((eds) => eds.filter((edge) => !deleted.some((d) => d.id === edge.id)));
  }, [setEdges]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Workflow validation logic
  const validateWorkflow = () => {
    // 1. Check required components
    const nodeTypeList = nodes.map(n => n.type);
    for (const comp of REQUIRED_COMPONENTS) {
      if (!nodeTypeList.includes(comp)) {
        return `Missing required component: ${{
          userQuery: 'User Query',
          llmEngine: 'LLM Engine',
          output: 'Output'
        }[comp]}`;
      }
    }
    // 2. Check connections (simple linear path)
    // Build adjacency list
    const adj = {};
    nodes.forEach(n => { adj[n.id] = []; });
    edges.forEach(e => { adj[e.source].push(e.target); });
    // Find User Query node
    const userNode = nodes.find(n => n.type === 'userQuery');
    if (!userNode) return 'User Query node missing.';
    // Traverse from User Query
    let current = userNode;
    let visited = new Set([current.id]);
    let order = [current.type];
    while (adj[current.id] && adj[current.id].length > 0) {
      const nextId = adj[current.id][0];
      if (visited.has(nextId)) return 'Cycle detected in workflow.';
      visited.add(nextId);
      const nextNode = nodes.find(n => n.id === nextId);
      if (!nextNode) return 'Broken connection in workflow.';
      order.push(nextNode.type);
      current = nextNode;
    }
    // Must end with Output
    if (current.type !== 'output') return 'Workflow must end with Output component.';
    // Must have LLM Engine before Output
    if (!order.includes('llmEngine')) return 'LLM Engine must be present before Output.';
    // Optionally, check for Knowledge Base in the path
    // 3. Check for unconnected nodes
    if (visited.size !== nodes.length) return 'All nodes must be connected in a single path.';
    // 4. (Optional) Check Knowledge Base config
    // ...
    return '';
  };

  const handleRunWorkflow = () => {
    const error = validateWorkflow();
    if (error) {
      setValidationError(error);
      return;
    }
    setShowRunModal(true);
    setRunQuery('');
    setRunResponse(null);
    setRunError('');
  };

  const handleRunModalClose = () => {
    setShowRunModal(false);
    setRunQuery('');
    setRunResponse(null);
    setRunError('');
  };

  const reactFlowInstance = useRef(null);

  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
  }, []);

  const handleFitView = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.fitView({ padding: 0.1 });
    }
  };

  const handleRunSubmit = async () => {
    if (!runQuery.trim()) return;
    setRunLoading(true);
    setRunResponse(null);
    setRunError('');
    
    try {
      // Get LLM Engine node configuration
      const llmNode = nodes.find(n => n.type === 'llmEngine');
      const llmConfig = llmNode ? nodeConfigs[llmNode.id] || {
        model: 'gemini',
        temperature: 0.7,
        useKnowledgeBase: true,
        maxContextChunks: 3
      } : {
        model: 'gemini',
        temperature: 0.7,
        useKnowledgeBase: true,
        maxContextChunks: 3
      };

      console.log('DEBUG: LLM Config being sent:', llmConfig);
      console.log('DEBUG: All nodeConfigs:', nodeConfigs);

      const res = await fetch(WORKFLOW_RUN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: { 
            nodes, 
            edges,
            configs: nodeConfigs // Include all node configurations
          },
          query: runQuery,
          preferred_model: llmConfig.model,
          temperature: llmConfig.temperature,
          use_knowledge_base: llmConfig.useKnowledgeBase,
          max_context_chunks: llmConfig.maxContextChunks
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRunResponse(data.response);
        // Add workflow result to chat panel
        if (chatPanelRef.current) {
          chatPanelRef.current.addWorkflowResult(runQuery, data.response, data.model_used);
        }
        // Close modal after a short delay to show the result
        setTimeout(() => {
          handleRunModalClose();
        }, 1500);
      } else {
        setRunError(data.error || 'Workflow execution failed.');
      }
    } catch (err) {
      setRunError('Network error. Please try again.');
    }
    setRunLoading(false);
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, size: f.size, status: 'uploading' }))]);
    
    // Upload each file to the backend
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('http://localhost:8000/documents/upload', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
          // Update file status to success
          setUploadedFiles(prev => prev.map(f => 
            f.name === file.name 
              ? { ...f, status: 'success', id: result.id, textExtracted: result.text_extracted }
              : f
          ));
          console.log(`File ${file.name} uploaded successfully:`, result);
        } else {
          // Update file status to error
          setUploadedFiles(prev => prev.map(f => 
            f.name === file.name 
              ? { ...f, status: 'error', error: result.detail || 'Upload failed' }
              : f
          ));
          console.error(`File ${file.name} upload failed:`, result);
        }
      } catch (error) {
        // Update file status to error
        setUploadedFiles(prev => prev.map(f => 
          f.name === file.name 
            ? { ...f, status: 'error', error: 'Network error' }
            : f
        ));
        console.error(`File ${file.name} upload error:`, error);
      }
    }
  };

  const clearUploadedFiles = () => {
    setUploadedFiles([]);
  };

  const closeValidationError = () => setValidationError('');

  // Configuration handlers
  const updateNodeConfig = (nodeId, config) => {
    setNodeConfigs(prev => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], ...config }
    }));
  };

  const handleModelChange = (nodeId, model) => {
    updateNodeConfig(nodeId, { model });
  };

  const handleTemperatureChange = (nodeId, temperature) => {
    updateNodeConfig(nodeId, { temperature: parseFloat(temperature) });
  };

  // Save workflow handler
  const handleSaveWorkflow = async () => {
    if (!saveName.trim()) return;
    setSaveStatus('Saving...');
    try {
      const res = await fetch(WORKFLOW_SAVE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName,
          definition: currentWorkflowConfig
        })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentWorkflowId(data.id);
        
        // Save chat history for this workflow
        await saveChatHistory(data.id);
        
        setSaveStatus('Saved!');
        setTimeout(() => {
          setShowSaveModal(false);
          setSaveStatus('');
        }, 1000);
      } else {
        setSaveStatus('Error: ' + (data.error || 'Failed to save.'));
      }
    } catch (err) {
      setSaveStatus('Network error.');
    }
  };

  // Save chat history
  const saveChatHistory = async (workflowId) => {
    if (!workflowId || !chatPanelRef.current) return;
    
    try {
      const chatMessages = chatPanelRef.current.getMessages();
      if (chatMessages.length === 0) return;
      
      const res = await fetch(`${WORKFLOW_LOAD_API.replace('/workflows', '')}/chat-history/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId,
          messages: chatMessages
        })
      });
      
      const data = await res.json();
      if (!data.success) {
        console.error('Failed to save chat history:', data.error);
      }
    } catch (err) {
      console.error('Error saving chat history:', err);
    }
  };

  // Load chat history
  const loadChatHistory = async (workflowId) => {
    if (!workflowId || !chatPanelRef.current) return;
    
    try {
      const res = await fetch(`${WORKFLOW_LOAD_API.replace('/workflows', '')}/chat-history/${workflowId}`);
      const data = await res.json();
      
      if (data.success && data.messages.length > 0) {
        chatPanelRef.current.loadMessages(data.messages);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  // Load workflow list
  const loadWorkflowList = async () => {
    setLoadingWorkflows(true);
    try {
      const res = await fetch(WORKFLOW_LOAD_API);
      const data = await res.json();
      if (data.success) {
        setWorkflowList(data.workflows);
      } else {
        console.error('Failed to load workflows:', data.error);
      }
    } catch (err) {
      console.error('Network error loading workflows:', err);
    }
    setLoadingWorkflows(false);
  };

  // Load workflow handler
  const handleLoadWorkflow = async (workflowId) => {
    setLoadStatus('Loading...');
    try {
      const res = await fetch(`${WORKFLOW_LOAD_API}/${workflowId}`);
      const data = await res.json();
      if (data.success) {
        // Overwrite local state with loaded workflow
        setNodes(data.definition.nodes || []);
        setEdges(data.definition.edges || []);
        setNodeConfigs(data.definition.nodeConfigs || {});
        setCurrentWorkflowId(workflowId);
        
        // Load chat history for this workflow
        await loadChatHistory(workflowId);
        
        setLoadStatus('Loaded!');
        setTimeout(() => {
          setShowLoadModal(false);
          setLoadStatus('');
        }, 1000);
      } else {
        setLoadStatus('Error: ' + (data.error || 'Failed to load.'));
      }
    } catch (err) {
      setLoadStatus('Network error.');
    }
  };

  // Load workflows when modal opens
  useEffect(() => {
    if (showLoadModal) {
      loadWorkflowList();
    }
  }, [showLoadModal]);

  // Load execution logs
  const loadExecutionLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${WORKFLOW_LOAD_API.replace('/workflows', '')}/execution-logs?limit=100`);
      const data = await res.json();
      if (data.success) {
        setExecutionLogs(data.logs);
      } else {
        console.error('Failed to load execution logs:', data.error);
      }
    } catch (err) {
      console.error('Network error loading execution logs:', err);
    }
    setLoadingLogs(false);
  };

  // Load execution logs when modal opens
  useEffect(() => {
    if (showExecutionLogs) {
      loadExecutionLogs();
    }
  }, [showExecutionLogs]);

  // Load templates
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`${WORKFLOW_LOAD_API.replace('/workflows', '')}/templates`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      } else {
        console.error('Failed to load templates:', data.error);
      }
    } catch (err) {
      console.error('Network error loading templates:', err);
    }
    setLoadingTemplates(false);
  };

  // Load templates when modal opens
  useEffect(() => {
    if (showTemplates) {
      loadTemplates();
    }
  }, [showTemplates]);

  // Load template into workspace
  const loadTemplate = (template) => {
    // Clear current workspace
    setNodes([]);
    setEdges([]);
    setNodeConfigs({});
    setCurrentWorkflowId(null);
    
    // Load template
    setNodes(template.definition.nodes || []);
    setEdges(template.definition.edges || []);
    setNodeConfigs(template.definition.configs || {});
    
    // Close template modal
    setShowTemplates(false);
    
    // Show success message
    console.log(`Template "${template.name}" loaded successfully!`);
  };

  return (
    <div className="workspace-panel" ref={reactFlowWrapper}>
      {/* Validation Error Modal */}
      {validationError && (
        <div className="workflow-modal-backdrop">
          <div className="workflow-modal">
            <h3>Workflow Error</h3>
            <div style={{ color: '#e53e3e', fontWeight: 600, fontSize: 16, marginBottom: 16 }}>{validationError}</div>
            <button className="modal-btn" onClick={closeValidationError}>Close</button>
          </div>
        </div>
      )}
      
      {/* Always visible workflow controls */}
      <div className="workflow-controls">
        {nodes.length > 0 && (
          <button 
            className="run-workflow-btn"
            onClick={handleRunWorkflow}
          >
            🚀 Run Workflow
          </button>
        )}
        <button 
          className="fit-view-btn"
          onClick={handleFitView}
        >
          🔍 Fit View
        </button>
        <button className="fit-view-btn" onClick={() => setShowSaveModal(true)}>Save Workflow</button>
        <button className="fit-view-btn" onClick={() => setShowLoadModal(true)}>Load Workflow</button>
        <button className="fit-view-btn" onClick={() => setShowExecutionLogs(true)}>📊 Execution Logs</button>
        <button className="fit-view-btn" onClick={() => setShowTemplates(true)}>📋 Templates</button>
        <button className="fit-view-btn" onClick={() => setShowAnalytics(true)}>📈 Analytics</button>
      </div>
      
      {showRunModal && (
        <div className="workflow-modal-backdrop">
          <div className="workflow-modal">
            <button className="modal-close" onClick={handleRunModalClose}>&times;</button>
            <h3>Run Workflow</h3>
            <label htmlFor="workflow-query">Enter your query:</label>
            <textarea
              id="workflow-query"
              value={runQuery}
              onChange={e => setRunQuery(e.target.value)}
              placeholder="Type your question for the workflow..."
              disabled={runLoading}
            />
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleRunSubmit} disabled={runLoading || !runQuery.trim()}>
                {runLoading ? 'Running...' : 'Run'}
              </button>
              <button className="modal-btn" onClick={handleRunModalClose} disabled={runLoading}>Cancel</button>
            </div>
            {runResponse && (
              <div className="modal-response">
                <strong>Response:</strong>
                <div>{runResponse}</div>
              </div>
            )}
            {runError && <div className="modal-error">{runError}</div>}
          </div>
        </div>
      )}

      {/* Save Workflow Modal */}
      {showSaveModal && (
        <div className="workflow-modal-backdrop">
          <div className="workflow-modal">
            <h3>Save Workflow</h3>
            <label>Workflow Name:</label>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Enter a name"
              style={{ width: '100%', marginBottom: 16 }}
            />
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleSaveWorkflow} disabled={!saveName.trim() || saveStatus === 'Saving...'}>
                {saveStatus === 'Saving...' ? 'Saving...' : 'Save'}
              </button>
              <button className="modal-btn" onClick={() => setShowSaveModal(false)} disabled={saveStatus === 'Saving...'}>Cancel</button>
            </div>
            {saveStatus && <div className="modal-response">{saveStatus}</div>}
          </div>
        </div>
      )}

      {/* Load Workflow Modal */}
      {showLoadModal && (
        <div className="workflow-modal-backdrop">
          <div className="workflow-modal">
            <h3>Load Workflow</h3>
            {loadingWorkflows ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading workflows...</div>
            ) : workflowList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No saved workflows found.
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
                {workflowList.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="workflow-list-item"
                    onClick={() => handleLoadWorkflow(workflow.id)}
                    style={{
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      background: '#f9f9f9',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.background = '#f9f9f9'}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{workflow.name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      ID: {workflow.id} • Created: {new Date(workflow.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => setShowLoadModal(false)}>Close</button>
            </div>
            {loadStatus && <div className="modal-response">{loadStatus}</div>}
          </div>
        </div>
      )}

      {/* Execution Logs Modal */}
      {showExecutionLogs && (
        <div className="workflow-modal-backdrop">
          <div className="workflow-modal" style={{ maxWidth: '800px', maxHeight: '80vh' }}>
            <h3>📊 Execution Logs</h3>
            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading execution logs...</div>
            ) : executionLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No execution logs found.
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '16px' }}>
                {executionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="execution-log-item"
                    style={{
                      padding: '16px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      background: log.success ? '#f8fff8' : '#fff8f8',
                      borderLeft: `4px solid ${log.success ? '#4CAF50' : '#f44336'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 'bold', color: log.success ? '#2E7D32' : '#C62828' }}>
                        {log.success ? '✅ Success' : '❌ Failed'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Query:</strong> {log.query}
                    </div>
                    {log.success && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Response:</strong> 
                        <div style={{ 
                          maxHeight: '100px', 
                          overflowY: 'auto', 
                          background: '#f5f5f5', 
                          padding: '8px', 
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}>
                          {log.response}
                        </div>
                      </div>
                    )}
                    {!log.success && log.error && (
                      <div style={{ marginBottom: '8px', color: '#C62828' }}>
                        <strong>Error:</strong> {log.error}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666' }}>
                      <span><strong>Model:</strong> {log.model_used}</span>
                      {log.execution_time && (
                        <span><strong>Time:</strong> {log.execution_time.toFixed(2)}s</span>
                      )}
                      {log.workflow_id && (
                        <span><strong>Workflow ID:</strong> {log.workflow_id}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => setShowExecutionLogs(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="workflow-modal-backdrop">
          <div className="workflow-modal" style={{ maxWidth: '900px', maxHeight: '80vh' }}>
            <h3>📋 Workflow Templates</h3>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
              Choose a pre-built template to get started quickly. Templates include optimized configurations for common use cases.
            </p>
            {loadingTemplates ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading templates...</div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No templates available.
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '16px' }}>
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="template-item"
                    style={{
                      padding: '20px',
                      border: '1px solid #ddd',
                      borderRadius: '12px',
                      marginBottom: '16px',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,250,252,0.9))',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.05)';
                    }}
                    onClick={() => loadTemplate(template)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 8px 0', color: '#2d3748', fontSize: '18px' }}>{template.name}</h4>
                        <div style={{ 
                          background: '#667eea', 
                          color: 'white', 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {template.category}
                        </div>
                      </div>
                      <button 
                        style={{
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                      >
                        Use Template
                      </button>
                    </div>
                    <p style={{ margin: '0 0 12px 0', color: '#4a5568', lineHeight: '1.5' }}>
                      {template.description}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {template.tags.map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            background: 'rgba(102, 126, 234, 0.1)',
                            color: '#667eea',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => setShowTemplates(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Dashboard */}
      <AnalyticsDashboard 
        isVisible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />

      {selectedNode && (
        <div className="config-panel">
          <div className="config-header">
            <h3>Configure {selectedNode.data.label}</h3>
            <button 
              className="close-config-btn"
              onClick={() => setSelectedNode(null)}
            >
              ×
            </button>
          </div>
          
          {selectedNode.type === 'knowledgeBase' && (
            <div className="config-content">
              <div className="upload-section">
                <h4>📄 Upload Documents</h4>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileUpload}
                  className="file-input"
                />
                <p className="upload-hint">Supported: PDF, TXT, DOC, DOCX</p>
                
                {uploadedFiles.length > 0 && (
                  <div className="uploaded-files">
                    <h5>Uploaded Files:</h5>
                    <ul>
                      {uploadedFiles.map((file, idx) => (
                        <li key={idx} className={`file-item ${file.status}`}>
                          <div className="file-name">{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>
                          <div className="file-status">
                            {file.status === 'uploading' && <span className="status-uploading">⏳ Uploading...</span>}
                            {file.status === 'success' && (
                              <span className="status-success">
                                ✅ Uploaded {file.textExtracted ? '(Text extracted)' : '(No text extracted)'}
                              </span>
                            )}
                            {file.status === 'error' && (
                              <span className="status-error">❌ {file.error}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button className="clear-files-btn" onClick={clearUploadedFiles}>Clear Files</button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {selectedNode.type === 'llmEngine' && (
            <div className="config-content">
              <div className="llm-config">
                <h4>🤖 LLM Configuration</h4>
                <div className="config-item">
                  <label>Model:</label>
                  <select 
                    value={nodeConfigs[selectedNode.id]?.model || 'gemini'}
                    onChange={(e) => handleModelChange(selectedNode.id, e.target.value)}
                  >
                    <option value="gemini">Gemini 1.5 Pro</option>
                    <option value="openai">OpenAI GPT-4o-mini</option>
                  </select>
                </div>
                <div className="config-item">
                  <label>Temperature:</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={nodeConfigs[selectedNode.id]?.temperature || 0.7}
                    onChange={(e) => handleTemperatureChange(selectedNode.id, e.target.value)}
                  />
                  <span>{nodeConfigs[selectedNode.id]?.temperature || 0.7}</span>
                </div>
                <div className="config-item">
                  <label htmlFor="web-search-toggle">Enable Web Search</label>
                  <input
                    id="web-search-toggle"
                    type="checkbox"
                    checked={nodeConfigs[selectedNode.id]?.useWebSearch || false}
                    onChange={e => updateNodeConfig(selectedNode.id, { ...nodeConfigs[selectedNode.id], useWebSearch: e.target.checked })}
                  />
                  <span style={{marginLeft: 8, fontSize: 13, color: '#888', cursor: 'pointer'}} title="If enabled, the LLM will use web search to fetch real-time information for your query.">?</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        onInit={onInit}
        attributionPosition="bottom-left"
        onNodesDelete={onNodeDelete}
        onEdgesDelete={onEdgeDelete}
      >
        <Controls />
        <Background color="#aaa" gap={16} />
        <MiniMap
          nodeColor={(node) => {
            const colors = {
              userQuery: '#4CAF50',
              knowledgeBase: '#2196F3',
              llmEngine: '#FF9800',
              output: '#9C27B0'
            };
            return colors[node.data?.type] || '#999';
          }}
        />
      </ReactFlow>
    </div>
  );
};

export default WorkspacePanel; 