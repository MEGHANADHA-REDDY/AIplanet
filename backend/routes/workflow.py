from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.llm_service import LLMService
from services.embeddings import search_similar_chunks
from services.web_search import web_search
from utils.db import get_db_connection
import json
from datetime import datetime

router = APIRouter()
llm_service = LLMService()

class WorkflowRunRequest(BaseModel):
    workflow: Dict[str, Any]  # Should contain nodes, edges, configs
    query: str
    preferred_model: Optional[str] = "auto"
    temperature: Optional[float] = 0.7
    use_knowledge_base: Optional[bool] = True
    max_context_chunks: Optional[int] = 3

class WorkflowRunResponse(BaseModel):
    response: str
    model_used: str
    context_used: Optional[str] = None
    success: bool
    error: Optional[str] = None

@router.post("/run", response_model=WorkflowRunResponse)
def run_workflow(request: WorkflowRunRequest):
    """
    Execute a workflow: process the query through the workflow definition.
    Now supports custom configuration from the frontend and execution logging.
    """
    import time
    start_time = time.time()
    
    try:
        context = ""
        use_web_search = False
        # Extract useWebSearch from LLM Engine node config if present
        llm_node = None
        llm_config = {}
        selected_model = request.preferred_model  # Default fallback
        if request.workflow and 'nodes' in request.workflow and 'configs' in request.workflow:
            for n in request.workflow['nodes']:
                if n.get('type') == 'llmEngine':
                    llm_node = n
                    break
            if llm_node:
                node_id = llm_node['id']
                llm_config = request.workflow['configs'].get(node_id, {})
                use_web_search = llm_config.get('useWebSearch', False)
                # Use the model from the LLM Engine configuration
                selected_model = llm_config.get('model', request.preferred_model)
        
        print(f"DEBUG: Selected model: {selected_model}")
        print(f"DEBUG: LLM config: {llm_config}")
        # Knowledge base context
        if request.use_knowledge_base:
            try:
                search_results = search_similar_chunks(request.query, n_results=request.max_context_chunks)
                if search_results and 'documents' in search_results and search_results['documents']:
                    context_chunks = []
                    for i, doc in enumerate(search_results['documents'][0]):
                        if doc:
                            context_chunks.append(f"Context {i+1}: {doc}")
                    if context_chunks:
                        context = "\n\n".join(context_chunks)
            except Exception as e:
                print(f"Error searching knowledge base: {str(e)}")
        # Web search context
        web_context = ""
        if use_web_search:
            try:
                web_results = web_search(request.query, num_results=3)
                if web_results:
                    web_context = "\n\n".join([f"Web Result {i+1}: {r}" for i, r in enumerate(web_results)])
            except Exception as e:
                print(f"Web search error: {str(e)}")
        # Combine contexts
        full_context = context
        if web_context:
            full_context = (context + "\n\n" + web_context) if context else web_context
        result = llm_service.generate_response(
            query=request.query,
            context=full_context,
            preferred_model=selected_model,
            temperature=request.temperature
        )
        
        execution_time = time.time() - start_time
        
        # Log the execution
        log_execution(
            query=request.query,
            response=result["response"],
            model_used=result["model_used"],
            success=result["success"],
            error=result.get("error"),
            workflow_id=None,  # TODO: Extract workflow ID if available
            execution_time=execution_time
        )
        
        return WorkflowRunResponse(
            response=result["response"],
            model_used=result["model_used"],
            context_used=full_context if full_context else None,
            success=result["success"],
            error=result.get("error")
        )
    except Exception as e:
        execution_time = time.time() - start_time
        # Log failed execution
        log_execution(
            query=request.query,
            response="",
            model_used="unknown",
            success=False,
            error=str(e),
            workflow_id=None,
            execution_time=execution_time
        )
        raise HTTPException(status_code=500, detail=f"Workflow execution error: {str(e)}")

class WorkflowSaveRequest(BaseModel):
    name: str
    definition: Dict[str, Any]  # Should contain nodes, edges, configs

class WorkflowSaveResponse(BaseModel):
    id: int
    name: str
    success: bool
    error: Optional[str] = None

@router.post("/workflows/save", response_model=WorkflowSaveResponse)
def save_workflow(request: WorkflowSaveRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO workflows (name, definition) VALUES (%s, %s) RETURNING id;",
            (request.name, json.dumps(request.definition))
        )
        workflow_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return WorkflowSaveResponse(id=workflow_id, name=request.name, success=True)
    except Exception as e:
        return WorkflowSaveResponse(id=-1, name=request.name, success=False, error=str(e))

class WorkflowLoadResponse(BaseModel):
    id: int
    name: str
    definition: Dict[str, Any]
    created_at: str
    success: bool
    error: Optional[str] = None

@router.get("/workflows/{workflow_id}", response_model=WorkflowLoadResponse)
def load_workflow(workflow_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name, definition, created_at FROM workflows WHERE id = %s;", (workflow_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return WorkflowLoadResponse(id=-1, name="", definition={}, created_at="", success=False, error="Workflow not found")
        return WorkflowLoadResponse(
            id=row[0],
            name=row[1],
            definition=row[2],
            created_at=row[3].isoformat(),
            success=True
        )
    except Exception as e:
        return WorkflowLoadResponse(id=-1, name="", definition={}, created_at="", success=False, error=str(e))

class WorkflowListItem(BaseModel):
    id: int
    name: str
    created_at: str

class WorkflowListResponse(BaseModel):
    workflows: List[WorkflowListItem]
    success: bool
    error: Optional[str] = None

@router.get("/workflows", response_model=WorkflowListResponse)
def list_workflows():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name, created_at FROM workflows ORDER BY created_at DESC;")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        workflows = [
            WorkflowListItem(
                id=row[0],
                name=row[1],
                created_at=row[2].isoformat()
            )
            for row in rows
        ]
        
        return WorkflowListResponse(workflows=workflows, success=True)
    except Exception as e:
        return WorkflowListResponse(workflows=[], success=False, error=str(e)) 

class ExecutionLog(BaseModel):
    id: int
    workflow_id: Optional[int]
    query: str
    response: str
    model_used: str
    success: bool
    error: Optional[str] = None
    execution_time: Optional[float] = None
    timestamp: str

class ExecutionLogsResponse(BaseModel):
    logs: List[ExecutionLog]
    success: bool
    error: Optional[str] = None

def log_execution(query: str, response: str, model_used: str, success: bool, error: str = None, workflow_id: int = None, execution_time: float = None):
    """Log workflow execution to database"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO execution_logs (workflow_id, query, response, model_used, success, error, execution_time, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (workflow_id, query, response, model_used, success, error, execution_time, datetime.utcnow())
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error logging execution: {str(e)}")

@router.get("/execution-logs", response_model=ExecutionLogsResponse)
def get_execution_logs(limit: int = 50, offset: int = 0):
    """Get execution logs with pagination"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, workflow_id, query, response, model_used, success, error, execution_time, timestamp
            FROM execution_logs
            ORDER BY timestamp DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        logs = [
            ExecutionLog(
                id=row[0],
                workflow_id=row[1],
                query=row[2],
                response=row[3],
                model_used=row[4],
                success=row[5],
                error=row[6],
                execution_time=row[7],
                timestamp=row[8].isoformat() if row[8] else None
            )
            for row in rows
        ]
        
        return ExecutionLogsResponse(logs=logs, success=True)
    except Exception as e:
        return ExecutionLogsResponse(logs=[], success=False, error=str(e))

@router.get("/execution-logs/{workflow_id}", response_model=ExecutionLogsResponse)
def get_workflow_execution_logs(workflow_id: int, limit: int = 50, offset: int = 0):
    """Get execution logs for a specific workflow"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, workflow_id, query, response, model_used, success, error, execution_time, timestamp
            FROM execution_logs
            WHERE workflow_id = %s
            ORDER BY timestamp DESC
            LIMIT %s OFFSET %s
            """,
            (workflow_id, limit, offset)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        logs = [
            ExecutionLog(
                id=row[0],
                workflow_id=row[1],
                query=row[2],
                response=row[3],
                model_used=row[4],
                success=row[5],
                error=row[6],
                execution_time=row[7],
                timestamp=row[8].isoformat() if row[8] else None
            )
            for row in rows
        ]
        
        return ExecutionLogsResponse(logs=logs, success=True)
    except Exception as e:
        return ExecutionLogsResponse(logs=[], success=False, error=str(e)) 

class ChatMessage(BaseModel):
    id: Optional[int] = None
    workflow_id: Optional[int] = None
    sender: str  # 'user' or 'bot'
    message: str
    model_used: Optional[str] = None
    is_workflow: Optional[bool] = False
    timestamp: Optional[str] = None

class ChatHistoryRequest(BaseModel):
    workflow_id: int
    messages: List[ChatMessage]

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessage]
    success: bool
    error: Optional[str] = None

@router.post("/chat-history/save", response_model=ChatHistoryResponse)
def save_chat_history(request: ChatHistoryRequest):
    """Save chat history for a workflow"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Clear existing chat history for this workflow
        cur.execute("DELETE FROM chatlogs WHERE workflow_id = %s", (request.workflow_id,))
        
        # Insert new chat messages
        for msg in request.messages:
            cur.execute(
                """
                INSERT INTO chatlogs (workflow_id, user_message, bot_response, timestamp)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    request.workflow_id,
                    msg.message if msg.sender == 'user' else '',
                    msg.message if msg.sender == 'bot' else '',
                    datetime.utcnow()
                )
            )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return ChatHistoryResponse(messages=request.messages, success=True)
    except Exception as e:
        return ChatHistoryResponse(messages=[], success=False, error=str(e))

@router.get("/chat-history/{workflow_id}", response_model=ChatHistoryResponse)
def get_chat_history(workflow_id: int):
    """Get chat history for a workflow"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, workflow_id, user_message, bot_response, timestamp
            FROM chatlogs 
            WHERE workflow_id = %s 
            ORDER BY timestamp ASC
            """,
            (workflow_id,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        messages = []
        for row in rows:
            # Add user message if exists
            if row[2]:  # user_message
                messages.append(ChatMessage(
                    id=row[0],
                    workflow_id=row[1],
                    sender='user',
                    message=row[2],
                    timestamp=row[4].isoformat() if row[4] else None
                ))
            # Add bot message if exists
            if row[3]:  # bot_response
                messages.append(ChatMessage(
                    id=row[0],
                    workflow_id=row[1],
                    sender='bot',
                    message=row[3],
                    timestamp=row[4].isoformat() if row[4] else None
                ))
        
        return ChatHistoryResponse(messages=messages, success=True)
    except Exception as e:
        return ChatHistoryResponse(messages=[], success=False, error=str(e)) 

class WorkflowTemplate(BaseModel):
    id: Optional[int] = None
    name: str
    description: str
    category: str
    definition: Dict[str, Any]  # Contains nodes, edges, configs
    tags: List[str] = []
    created_at: Optional[str] = None

class TemplateListResponse(BaseModel):
    templates: List[WorkflowTemplate]
    success: bool
    error: Optional[str] = None

# Pre-built workflow templates
DEFAULT_TEMPLATES = [
    {
        "name": "Document Q&A Assistant",
        "description": "Upload documents and ask questions about their content. Perfect for research, document analysis, and knowledge extraction.",
        "category": "Document Analysis",
        "tags": ["documents", "qa", "research", "analysis"],
        "definition": {
            "nodes": [
                {
                    "id": "userQuery-1",
                    "type": "userQuery",
                    "position": {"x": 100, "y": 100},
                    "data": {
                        "label": "User Query",
                        "description": "Accepts user queries via interface.",
                        "type": "userQuery"
                    }
                },
                {
                    "id": "knowledgeBase-1",
                    "type": "knowledgeBase",
                    "position": {"x": 100, "y": 250},
                    "data": {
                        "label": "Knowledge Base",
                        "description": "Upload and process documents.",
                        "type": "knowledgeBase"
                    }
                },
                {
                    "id": "llmEngine-1",
                    "type": "llmEngine",
                    "position": {"x": 100, "y": 400},
                    "data": {
                        "label": "LLM Engine",
                        "description": "Generate responses using AI models.",
                        "type": "llmEngine"
                    }
                },
                {
                    "id": "output-1",
                    "type": "output",
                    "position": {"x": 100, "y": 550},
                    "data": {
                        "label": "Output",
                        "description": "Display final response to user.",
                        "type": "output"
                    }
                }
            ],
            "edges": [
                {"id": "e1-2", "source": "userQuery-1", "target": "knowledgeBase-1"},
                {"id": "e2-3", "source": "knowledgeBase-1", "target": "llmEngine-1"},
                {"id": "e3-4", "source": "llmEngine-1", "target": "output-1"}
            ],
            "configs": {
                "llmEngine-1": {
                    "model": "gemini",
                    "temperature": 0.7,
                    "useKnowledgeBase": True,
                    "maxContextChunks": 3,
                    "useWebSearch": False
                }
            }
        }
    },
    {
        "name": "Web Research Assistant",
        "description": "Search the web for real-time information and get AI-powered insights. Great for current events, research, and fact-checking.",
        "category": "Web Research",
        "tags": ["web", "research", "current-events", "fact-checking"],
        "definition": {
            "nodes": [
                {
                    "id": "userQuery-1",
                    "type": "userQuery",
                    "position": {"x": 100, "y": 100},
                    "data": {
                        "label": "User Query",
                        "description": "Accepts user queries via interface.",
                        "type": "userQuery"
                    }
                },
                {
                    "id": "llmEngine-1",
                    "type": "llmEngine",
                    "position": {"x": 100, "y": 250},
                    "data": {
                        "label": "LLM Engine",
                        "description": "Generate responses using AI models.",
                        "type": "llmEngine"
                    }
                },
                {
                    "id": "output-1",
                    "type": "output",
                    "position": {"x": 100, "y": 400},
                    "data": {
                        "label": "Output",
                        "description": "Display final response to user.",
                        "type": "output"
                    }
                }
            ],
            "edges": [
                {"id": "e1-2", "source": "userQuery-1", "target": "llmEngine-1"},
                {"id": "e2-3", "source": "llmEngine-1", "target": "output-1"}
            ],
            "configs": {
                "llmEngine-1": {
                    "model": "gemini",
                    "temperature": 0.8,
                    "useKnowledgeBase": False,
                    "maxContextChunks": 3,
                    "useWebSearch": True
                }
            }
        }
    },
    {
        "name": "Content Generation Assistant",
        "description": "Generate creative content like articles, stories, and marketing copy. Perfect for writers, marketers, and content creators.",
        "category": "Content Creation",
        "tags": ["content", "writing", "creative", "marketing"],
        "definition": {
            "nodes": [
                {
                    "id": "userQuery-1",
                    "type": "userQuery",
                    "position": {"x": 100, "y": 100},
                    "data": {
                        "label": "User Query",
                        "description": "Accepts user queries via interface.",
                        "type": "userQuery"
                    }
                },
                {
                    "id": "llmEngine-1",
                    "type": "llmEngine",
                    "position": {"x": 100, "y": 250},
                    "data": {
                        "label": "LLM Engine",
                        "description": "Generate responses using AI models.",
                        "type": "llmEngine"
                    }
                },
                {
                    "id": "output-1",
                    "type": "output",
                    "position": {"x": 100, "y": 400},
                    "data": {
                        "label": "Output",
                        "description": "Display final response to user.",
                        "type": "output"
                    }
                }
            ],
            "edges": [
                {"id": "e1-2", "source": "userQuery-1", "target": "llmEngine-1"},
                {"id": "e2-3", "source": "llmEngine-1", "target": "output-1"}
            ],
            "configs": {
                "llmEngine-1": {
                    "model": "gemini",
                    "temperature": 0.9,
                    "useKnowledgeBase": False,
                    "maxContextChunks": 3,
                    "useWebSearch": False
                }
            }
        }
    }
]

@router.get("/templates", response_model=TemplateListResponse)
def get_workflow_templates():
    """Get all available workflow templates"""
    try:
        # For now, return the default templates
        # In the future, this could be stored in the database
        templates = []
        for i, template in enumerate(DEFAULT_TEMPLATES):
            templates.append(WorkflowTemplate(
                id=i + 1,
                name=template["name"],
                description=template["description"],
                category=template["category"],
                definition=template["definition"],
                tags=template["tags"],
                created_at=datetime.utcnow().isoformat()
            ))
        
        return TemplateListResponse(templates=templates, success=True)
    except Exception as e:
        return TemplateListResponse(templates=[], success=False, error=str(e))

@router.get("/templates/{template_id}", response_model=WorkflowTemplate)
def get_workflow_template(template_id: int):
    """Get a specific workflow template"""
    try:
        if template_id <= 0 or template_id > len(DEFAULT_TEMPLATES):
            raise HTTPException(status_code=404, detail="Template not found")
        
        template = DEFAULT_TEMPLATES[template_id - 1]
        return WorkflowTemplate(
            id=template_id,
            name=template["name"],
            description=template["description"],
            category=template["category"],
            definition=template["definition"],
            tags=template["tags"],
            created_at=datetime.utcnow().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

class AnalyticsData(BaseModel):
    total_workflows: int
    total_executions: int
    success_rate: float
    avg_response_time: float
    model_usage: Dict[str, int]
    workflow_popularity: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]
    daily_stats: List[Dict[str, Any]]

class AnalyticsResponse(BaseModel):
    success: bool
    data: Optional[AnalyticsData] = None
    error: Optional[str] = None

# Analytics helper functions
def get_analytics_data():
    """Get comprehensive analytics data"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Total workflows
        cur.execute("SELECT COUNT(*) FROM workflows")
        total_workflows = cur.fetchone()[0]
        
        # Total executions
        cur.execute("SELECT COUNT(*) FROM execution_logs")
        total_executions = cur.fetchone()[0]
        
        # Success rate
        cur.execute("SELECT COUNT(*) FROM execution_logs WHERE success = true")
        successful_executions = cur.fetchone()[0]
        success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0
        
        # Average response time
        cur.execute("SELECT AVG(execution_time) FROM execution_logs WHERE success = true")
        avg_response_time = cur.fetchone()[0] or 0
        
        # Model usage
        cur.execute("""
            SELECT model_used, COUNT(*) as count 
            FROM execution_logs 
            GROUP BY model_used 
            ORDER BY count DESC
        """)
        model_usage = {row[0]: row[1] for row in cur.fetchall()}
        
        # Workflow popularity (top 10)
        cur.execute("""
            SELECT w.name, COUNT(e.id) as execution_count, 
                   AVG(e.execution_time) as avg_time,
                   COUNT(CASE WHEN e.success THEN 1 END) as success_count
            FROM workflows w
            LEFT JOIN execution_logs e ON w.id = e.workflow_id
            GROUP BY w.id, w.name
            ORDER BY execution_count DESC
            LIMIT 10
        """)
        workflow_popularity = []
        for row in cur.fetchall():
            workflow_popularity.append({
                "name": row[0] or "Unnamed Workflow",
                "execution_count": row[1] or 0,
                "avg_time": float(row[2]) if row[2] else 0,
                "success_rate": (row[3] / row[1] * 100) if row[1] and row[1] > 0 else 0
            })
        
        # Recent activity (last 20 executions)
        cur.execute("""
            SELECT e.query, e.response, e.model_used, e.success, e.execution_time, e.timestamp,
                   w.name as workflow_name
            FROM execution_logs e
            LEFT JOIN workflows w ON e.workflow_id = w.id
            ORDER BY e.timestamp DESC
            LIMIT 20
        """)
        recent_activity = []
        for row in cur.fetchall():
            recent_activity.append({
                "query": row[0][:100] + "..." if len(row[0]) > 100 else row[0],
                "response": row[1][:100] + "..." if len(row[1]) > 100 else row[1],
                "model_used": row[2],
                "success": row[3],
                "execution_time": float(row[4]) if row[4] else 0,
                "timestamp": row[5].isoformat() if row[5] else None,
                "workflow_name": row[6] or "Direct Query"
            })
        
        # Daily stats (last 7 days)
        cur.execute("""
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as total_executions,
                COUNT(CASE WHEN success THEN 1 END) as successful_executions,
                AVG(execution_time) as avg_time
            FROM execution_logs
            WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
        """)
        daily_stats = []
        for row in cur.fetchall():
            daily_stats.append({
                "date": row[0].isoformat() if row[0] else None,
                "total_executions": row[1],
                "successful_executions": row[2],
                "success_rate": (row[2] / row[1] * 100) if row[1] and row[1] > 0 else 0,
                "avg_time": float(row[3]) if row[3] else 0
            })
        
        cur.close()
        conn.close()
        
        return AnalyticsData(
            total_workflows=total_workflows,
            total_executions=total_executions,
            success_rate=round(success_rate, 2),
            avg_response_time=round(avg_response_time, 2),
            model_usage=model_usage,
            workflow_popularity=workflow_popularity,
            recent_activity=recent_activity,
            daily_stats=daily_stats
        )
        
    except Exception as e:
        print(f"Error getting analytics data: {str(e)}")
        return None

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics():
    """Get comprehensive analytics data"""
    try:
        data = get_analytics_data()
        if data:
            return AnalyticsResponse(success=True, data=data)
        else:
            return AnalyticsResponse(success=False, error="Failed to retrieve analytics data")
    except Exception as e:
        return AnalyticsResponse(success=False, error=str(e))

@router.get("/analytics/summary")
def get_analytics_summary():
    """Get quick analytics summary for dashboard widgets"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Quick stats
        cur.execute("SELECT COUNT(*) FROM workflows")
        total_workflows = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM execution_logs")
        total_executions = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM execution_logs WHERE success = true")
        successful_executions = cur.fetchone()[0]
        
        cur.execute("SELECT AVG(execution_time) FROM execution_logs WHERE success = true")
        avg_time = cur.fetchone()[0] or 0
        
        # Today's stats
        cur.execute("""
            SELECT COUNT(*) FROM execution_logs 
            WHERE DATE(timestamp) = CURRENT_DATE
        """)
        today_executions = cur.fetchone()[0]
        
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "data": {
                "total_workflows": total_workflows,
                "total_executions": total_executions,
                "successful_executions": successful_executions,
                "success_rate": round((successful_executions / total_executions * 100) if total_executions > 0 else 0, 2),
                "avg_response_time": round(avg_time, 2),
                "today_executions": today_executions
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)} 