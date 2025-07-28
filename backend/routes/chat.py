from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.llm_service import LLMService
from services.embeddings import search_similar_chunks
from utils.db import get_db_connection
import os

router = APIRouter()
llm_service = LLMService()

class ChatRequest(BaseModel):
    query: str
    preferred_model: Optional[str] = "auto"
    use_knowledge_base: Optional[bool] = True
    max_context_chunks: Optional[int] = 3

class ChatResponse(BaseModel):
    response: str
    model_used: str
    context_used: Optional[str] = None
    success: bool
    error: Optional[str] = None

@router.get("/debug-knowledge-base")
def debug_knowledge_base():
    """
    Debug endpoint to check what's stored in the knowledge base.
    """
    try:
        import chromadb
        from chromadb.config import Settings
        
        # Initialize ChromaDB client
        client = chromadb.Client(Settings(persist_directory="./chroma_data"))
        collection = client.get_or_create_collection(name="documents")
        
        # Get all documents
        results = collection.get()
        
        return {
            "total_documents": len(results['documents']) if results['documents'] else 0,
            "document_ids": results['ids'] if results['ids'] else [],
            "metadatas": results['metadatas'] if results['metadatas'] else [],
            "sample_documents": results['documents'][:2] if results['documents'] else []  # First 2 docs
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "total_documents": 0
        }

@router.post("/query", response_model=ChatResponse)
def chat_query(request: ChatRequest):
    """
    Process a chat query with optional knowledge base context.
    """
    try:
        context = ""
        
        # Get context from knowledge base if requested
        if request.use_knowledge_base:
            try:
                # Search for similar chunks in ChromaDB
                search_results = search_similar_chunks(request.query, n_results=request.max_context_chunks)
                
                if search_results and 'documents' in search_results and search_results['documents']:
                    # Combine relevant chunks into context
                    context_chunks = []
                    for i, doc in enumerate(search_results['documents'][0]):
                        if doc:  # Check if document exists
                            context_chunks.append(f"Context {i+1}: {doc}")
                    
                    if context_chunks:
                        context = "\n\n".join(context_chunks)
                        print(f"Found {len(context_chunks)} relevant context chunks")
                    else:
                        print("No relevant context found")
                else:
                    print("No search results found")
                    
            except Exception as e:
                print(f"Error searching knowledge base: {str(e)}")
                # Continue without context if search fails
        
        # Generate response using LLM
        result = llm_service.generate_response(
            query=request.query,
            context=context,
            preferred_model=request.preferred_model
        )
        
        return ChatResponse(
            response=result["response"],
            model_used=result["model_used"],
            context_used=context if context else None,
            success=result["success"],
            error=result.get("error")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {str(e)}")

@router.get("/test-models")
def test_llm_models():
    """
    Test which LLM models are available and working.
    """
    try:
        results = llm_service.test_models()
        
        # Add debug information
        debug_info = {
            "models": results,
            "openai_available": llm_service.openai_available,
            "gemini_available": llm_service.gemini_available,
            "openai_key_present": bool(os.getenv('OPENAI_API_KEY')),
            "gemini_key_present": bool(os.getenv('GOOGLE_API_KEY'))
        }
        
        return debug_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model testing error: {str(e)}")

@router.get("/models")
def get_available_models():
    """
    Get information about available LLM models.
    """
    return {
        "available_models": {
            "openai": {
                "available": llm_service.openai_available,
                "models": ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
            },
            "gemini": {
                "available": llm_service.gemini_available,
                "models": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"]
            }
        }
    }

@router.get("/test-gemini")
def test_gemini_directly():
    """
    Test Gemini API directly to see the specific error.
    """
    try:
        import google.generativeai as genai
        
        # Check if API key is loaded
        api_key = os.getenv('GOOGLE_API_KEY', '')
        if not api_key:
            return {"error": "No Google API key found"}
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        # Try different Gemini models
        gemini_models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
        results = {}
        
        for model_name in gemini_models:
            try:
                print(f"Testing Gemini model: {model_name}")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content("Hello, how are you?")
                results[model_name] = {
                    "success": True,
                    "response": response.text
                }
                print(f"Model {model_name} works!")
                break  # Stop at first successful model
            except Exception as e:
                results[model_name] = {
                    "success": False,
                    "error": str(e)
                }
                print(f"Model {model_name} failed: {str(e)}")
        
        return {
            "api_key_present": bool(api_key),
            "models_tested": results,
            "working_model": next((name for name, result in results.items() if result["success"]), None)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "api_key_present": bool(os.getenv('GOOGLE_API_KEY', ''))
        } 