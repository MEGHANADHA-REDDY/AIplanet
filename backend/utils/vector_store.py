import chromadb
from chromadb.config import Settings

chroma_client = chromadb.Client(Settings(
    persist_directory="./chroma_data"
))

def get_chroma_collection(name="default"):
    return chroma_client.get_or_create_collection(name=name) 