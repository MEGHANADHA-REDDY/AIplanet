from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os
from utils.db import get_db_connection
from services.text_extractor import extract_text_from_file
from services.embeddings import split_text_into_chunks, store_embeddings_in_chroma, test_openai_connection
from datetime import datetime

router = APIRouter()
UPLOAD_DIR = "uploaded_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/test-openai")
def test_openai_api():
    """Test OpenAI API connection and generate a haiku."""
    try:
        from openai import OpenAI
        
        # Debug: Check if API key is loaded
        api_key = os.getenv('OPENAI_API_KEY', '')
        print(f"API Key loaded: {api_key[:20]}..." if api_key else "No API key found")
        
        if not api_key:
            return {
                "status": "error",
                "error": "No OpenAI API key found in environment variables",
                "api_working": False
            }
        
        client = OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "write a haiku about ai"}],
            max_tokens=50
        )
        
        return {
            "status": "success",
            "haiku": response.choices[0].message.content,
            "api_working": True
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "api_working": False
        }

@router.post("/upload")
def upload_document(file: UploadFile = File(...)):
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    
    # Save the file
    with open(file_location, "wb") as f:
        f.write(file.file.read())
    
    # Extract text from the file
    try:
        extracted_text = extract_text_from_file(file_location)
    except Exception as e:
        # If text extraction fails, still save the document but mark it as failed
        extracted_text = ""
        print(f"Text extraction failed for {file.filename}: {str(e)}")
    
    # Store metadata and text in DB
    conn = get_db_connection()
    cur = conn.cursor()
    
    # First, let's add a text_content column to our documents table if it doesn't exist
    try:
        cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS text_content TEXT;")
        conn.commit()
    except:
        pass  # Column might already exist
    
    # Insert document with extracted text
    cur.execute(
        "INSERT INTO documents (filename, upload_time, status, text_content) VALUES (%s, %s, %s, %s) RETURNING id;",
        (file.filename, datetime.utcnow(), 'processed' if extracted_text else 'uploaded', extracted_text)
    )
    doc_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    
    # Generate embeddings if text was extracted
    chunks_processed = 0
    if extracted_text:
        try:
            # Split text into chunks
            text_chunks = split_text_into_chunks(extracted_text)
            
            # Store embeddings in ChromaDB
            chunks_processed = store_embeddings_in_chroma(text_chunks, doc_id, file.filename)
            
            # Update status to indicate embeddings were generated
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE documents SET status = 'embedded' WHERE id = %s;", (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
            
        except Exception as e:
            print(f"Embedding generation failed for {file.filename}: {str(e)}")
    
    return {
        "id": doc_id, 
        "filename": file.filename,
        "text_extracted": bool(extracted_text),
        "text_length": len(extracted_text) if extracted_text else 0,
        "chunks_processed": chunks_processed,
        "embeddings_generated": chunks_processed > 0
    }

@router.get("/")
def list_documents():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, filename, upload_time, status FROM documents ORDER BY upload_time DESC;")
    docs = [
        {"id": row[0], "filename": row[1], "upload_time": row[2], "status": row[3]}
        for row in cur.fetchall()
    ]
    cur.close()
    conn.close()
    return docs

@router.get("/{doc_id}/text")
def get_document_text(doc_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT filename, text_content FROM documents WHERE id = %s;", (doc_id,))
    result = cur.fetchone()
    cur.close()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="Document not found")
    
    filename, text_content = result
    return {
        "id": doc_id,
        "filename": filename,
        "text_content": text_content or "",
        "text_length": len(text_content) if text_content else 0
    }

@router.post("/{doc_id}/reprocess")
def reprocess_document(doc_id: int):
    """Reprocess an existing document to extract text and generate embeddings."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get document info
    cur.execute("SELECT filename FROM documents WHERE id = %s;", (doc_id,))
    result = cur.fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Document not found")
    
    filename = result[0]
    file_location = os.path.join(UPLOAD_DIR, filename)
    
    # Check if file exists
    if not os.path.exists(file_location):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Extract text from the file
    try:
        extracted_text = extract_text_from_file(file_location)
        status = 'processed'
        print(f"Text extraction successful for {filename}, length: {len(extracted_text)}")
    except Exception as e:
        extracted_text = ""
        status = 'uploaded'
        print(f"Text extraction failed for {filename}: {str(e)}")
    
    # Update the document with extracted text
    cur.execute(
        "UPDATE documents SET text_content = %s, status = %s WHERE id = %s;",
        (extracted_text, status, doc_id)
    )
    conn.commit()
    cur.close()
    conn.close()
    
    # Generate embeddings if text was extracted
    chunks_processed = 0
    if extracted_text:
        try:
            print(f"Starting embedding generation for {filename}")
            
            # Split text into chunks
            text_chunks = split_text_into_chunks(extracted_text)
            print(f"Text split into {len(text_chunks)} chunks")
            
            # Store embeddings in ChromaDB
            chunks_processed = store_embeddings_in_chroma(text_chunks, doc_id, filename)
            print(f"Successfully processed {chunks_processed} chunks")
            
            # Update status to indicate embeddings were generated
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE documents SET status = 'embedded' WHERE id = %s;", (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
            
        except Exception as e:
            print(f"Embedding generation failed for {filename}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    return {
        "id": doc_id,
        "filename": filename,
        "text_extracted": bool(extracted_text),
        "text_length": len(extracted_text) if extracted_text else 0,
        "chunks_processed": chunks_processed,
        "embeddings_generated": chunks_processed > 0,
        "status": 'embedded' if chunks_processed > 0 else status
    } 