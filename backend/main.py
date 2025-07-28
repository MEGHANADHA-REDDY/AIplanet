from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import documents, chat
from routes import workflow

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix="/documents")
app.include_router(chat.router, prefix="/chat")
app.include_router(workflow.router, prefix="/workflow")

@app.get("/")
def read_root():
    return {"message": "Backend is running!"} 