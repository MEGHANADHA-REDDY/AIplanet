import os
from openai import OpenAI
from typing import List
import chromadb
from chromadb.config import Settings

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY', ''))

def test_openai_connection():
    """Test the OpenAI API connection."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=10
        )
        return True
    except Exception as e:
        print(f"OpenAI API test failed: {str(e)}")
        return False

def generate_embeddings_local(text: str) -> List[float]:
    """
    Generate embeddings using local sentence-transformers model.
    
    Args:
        text (str): The text to generate embeddings for
        
    Returns:
        List[float]: The embedding vector
    """
    try:
        from sentence_transformers import SentenceTransformer
        
        # Load the model (this will download it on first use)
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Generate embeddings
        embedding = model.encode(text)
        
        # Convert to list of floats
        return embedding.tolist()
        
    except Exception as e:
        raise Exception(f"Error generating local embeddings: {str(e)}")

def generate_embeddings(text: str) -> List[float]:
    """
    Generate embeddings for a given text using OpenAI's text-embedding-ada-002 model.
    Falls back to local embeddings if OpenAI API fails.
    
    Args:
        text (str): The text to generate embeddings for
        
    Returns:
        List[float]: The embedding vector
    """
    try:
        response = client.embeddings.create(
            input=text,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"OpenAI embedding failed, using local model: {str(e)}")
        return generate_embeddings_local(text)

def split_text_into_chunks(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """
    Split text into overlapping chunks for better embedding generation.
    
    Args:
        text (str): The text to split
        chunk_size (int): Maximum size of each chunk
        overlap (int): Number of characters to overlap between chunks
        
    Returns:
        List[str]: List of text chunks
    """
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
        
        if start >= len(text):
            break
    
    return chunks

def store_embeddings_in_chroma(text_chunks: List[str], document_id: int, filename: str):
    """
    Store text chunks and their embeddings in ChromaDB.
    
    Args:
        text_chunks (List[str]): List of text chunks
        document_id (int): ID of the document
        filename (str): Name of the file
    """
    try:
        # Initialize ChromaDB client
        client_chroma = chromadb.Client(Settings(persist_directory="./chroma_data"))
        collection = client_chroma.get_or_create_collection(name="documents")
        
        # Generate embeddings for each chunk
        embeddings = []
        metadatas = []
        ids = []
        
        for i, chunk in enumerate(text_chunks):
            embedding = generate_embeddings(chunk)
            embeddings.append(embedding)
            
            metadata = {
                "document_id": document_id,
                "filename": filename,
                "chunk_index": i,
                "chunk_size": len(chunk)
            }
            metadatas.append(metadata)
            
            # Create unique ID for each chunk
            chunk_id = f"doc_{document_id}_chunk_{i}"
            ids.append(chunk_id)
        
        # Add to ChromaDB collection
        collection.add(
            embeddings=embeddings,
            documents=text_chunks,
            metadatas=metadatas,
            ids=ids
        )
        
        return len(text_chunks)
        
    except Exception as e:
        raise Exception(f"Error storing embeddings in ChromaDB: {str(e)}")

def search_similar_chunks(query: str, n_results: int = 5):
    """
    Search for similar text chunks based on a query.
    
    Args:
        query (str): The search query
        n_results (int): Number of results to return
        
    Returns:
        List: List of similar chunks with metadata
    """
    try:
        # Initialize ChromaDB client
        client_chroma = chromadb.Client(Settings(persist_directory="./chroma_data"))
        collection = client_chroma.get_or_create_collection(name="documents")
        
        # Generate embedding for the query
        query_embedding = generate_embeddings(query)
        
        # Search for similar chunks
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        return results
        
    except Exception as e:
        raise Exception(f"Error searching similar chunks: {str(e)}") 