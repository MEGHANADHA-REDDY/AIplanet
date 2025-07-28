# AIplanet - No-Code/Low-Code AI Workflow Builder

<div align="center">
  <img src="https://img.shields.io/badge/React-19.1.0-blue?logo=react" alt="React Version">
  <img src="https://img.shields.io/badge/FastAPI-0.104.1-green?logo=fastapi" alt="FastAPI Version">
  <img src="https://img.shields.io/badge/Python-3.13-yellow?logo=python" alt="Python Version">
  <img src="https://img.shields.io/badge/License-MIT-brightgreen" alt="License">
</div>

## 🚀 Overview

AIplanet is a powerful full-stack web application that enables users to visually build and interact with intelligent workflows using Large Language Models (LLMs), document knowledge bases, and interactive chat interfaces. It provides a no-code/low-code platform for creating AI-powered automation workflows.

## ✨ Features

### 🎯 Core Features
- **Visual Workflow Builder**: Drag-and-drop interface for creating AI workflows
- **Multi-Model LLM Support**: Integration with OpenAI GPT and Google Gemini
- **Document Processing**: Upload and process PDF documents with intelligent text extraction
- **Vector Database**: ChromaDB integration for semantic search and document retrieval
- **Real-time Chat Interface**: Interactive chat with AI assistants
- **Analytics Dashboard**: Monitor workflow performance and usage statistics
- **Component Library**: Reusable workflow components and templates

### 🔧 Technical Features
- **RESTful API**: FastAPI backend with comprehensive endpoints
- **Real-time Updates**: WebSocket support for live workflow updates
- **Document Management**: Upload, process, and manage documents
- **Search Integration**: Web search capabilities via SerpAPI and Brave
- **Responsive Design**: Modern UI that works on desktop and mobile

## 🛠️ Tech Stack

### Frontend
- **React 19.1.0** - Modern React with latest features
- **React Flow** - Visual workflow builder and node-based interface
- **CSS3** - Custom styling with modern design patterns
- **PWA Support** - Progressive Web App capabilities

### Backend
- **FastAPI** - High-performance Python web framework
- **Uvicorn** - ASGI server for production deployment
- **PostgreSQL** - Primary database for data persistence
- **ChromaDB** - Vector database for embeddings and semantic search

### AI & ML
- **OpenAI GPT** - Primary LLM for text generation and analysis
- **Google Gemini** - Alternative LLM provider
- **Sentence Transformers** - Text embeddings for semantic search
- **PyMuPDF** - PDF text extraction and processing

### External Services
- **SerpAPI** - Web search capabilities
- **Brave Search** - Alternative search provider

## 📁 Project Structure

```
AIplanet/
├── frontend/                 # React frontend application
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── AnalyticsDashboard.jsx
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── ComponentLibraryPanel.jsx
│   │   │   ├── WorkspacePanel.jsx
│   │   │   └── WorkflowNode.jsx
│   │   ├── App.jsx          # Main application component
│   │   └── index.js         # Application entry point
│   ├── package.json         # Frontend dependencies
│   └── .gitignore           # Frontend git ignore rules
├── backend/                  # FastAPI backend application
│   ├── models/              # Database models
│   │   ├── chatlog.py       # Chat log model
│   │   ├── document.py      # Document model
│   │   └── workflow.py      # Workflow model
│   ├── routes/              # API routes
│   │   ├── chat.py          # Chat endpoints
│   │   ├── documents.py     # Document management
│   │   └── workflow.py      # Workflow management
│   ├── services/            # Business logic services
│   │   ├── embeddings.py    # Text embedding service
│   │   ├── llm_service.py   # LLM integration
│   │   ├── text_extractor.py # Document processing
│   │   └── web_search.py    # Web search service
│   ├── utils/               # Utility functions
│   │   ├── db.py           # Database utilities
│   │   └── vector_store.py # Vector database utilities
│   ├── main.py             # FastAPI application entry point
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables (not in repo)
├── docs/                   # Documentation
├── uploaded_docs/          # Document storage
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.11 or higher)
- **PostgreSQL** (v13 or higher)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MEGHANADHA-REDDY/AIplanet.git
   cd AIplanet
   ```

2. **Set up the Backend**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Create .env file
   cp .env.example .env
   # Edit .env with your API keys and database configuration
   ```

3. **Set up the Frontend**
   ```bash
   cd ../frontend
   
   # Install dependencies
   npm install
   ```

4. **Configure Environment Variables**

   Create a `.env` file in the `backend/` directory:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/aiplanet
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Google Gemini Configuration
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Search API Configuration
   SERPAPI_KEY=your_serpapi_key_here
   BRAVE_API_KEY=your_brave_api_key_here
   
   # Application Configuration
   SECRET_KEY=your_secret_key_here
   DEBUG=True
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm start
   ```

3. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 📖 Usage Guide

### Creating Your First Workflow

1. **Access the Workspace**
   - Open the application in your browser
   - Navigate to the Workspace panel

2. **Add Components**
   - Drag components from the Component Library
   - Connect them to create a workflow

3. **Configure Components**
   - Click on each component to configure its parameters
   - Set up input/output connections

4. **Test and Deploy**
   - Use the chat interface to test your workflow
   - Monitor performance in the Analytics Dashboard

### Document Management

1. **Upload Documents**
   - Go to the Documents section
   - Upload PDF files for processing
   - Documents are automatically indexed for search

2. **Search and Retrieve**
   - Use the chat interface to ask questions about documents
   - The system will retrieve relevant information

### Chat Interface

- **Real-time Conversations**: Chat with AI assistants
- **Document Context**: Ask questions about uploaded documents
- **Workflow Integration**: Trigger workflows through chat commands

## 🔧 API Endpoints

### Documents
- `GET /documents` - List all documents
- `POST /documents/upload` - Upload a new document
- `GET /documents/{id}` - Get document details
- `DELETE /documents/{id}` - Delete a document

### Chat
- `POST /chat/send` - Send a message
- `GET /chat/history` - Get chat history
- `POST /chat/clear` - Clear chat history

### Workflows
- `GET /workflow` - List all workflows
- `POST /workflow` - Create a new workflow
- `PUT /workflow/{id}` - Update a workflow
- `DELETE /workflow/{id}` - Delete a workflow
- `POST /workflow/{id}/execute` - Execute a workflow

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   # Set production environment variables
   export DEBUG=False
   export DATABASE_URL=your_production_db_url
   ```

2. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

3. **Deploy Backend**
   ```bash
   cd backend
   uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

### Docker Deployment

```dockerfile
# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use ESLint for JavaScript/React code
- Write tests for new features
- Update documentation for API changes

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React Flow](https://reactflow.dev/) for the workflow builder
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [OpenAI](https://openai.com/) for LLM capabilities
- [ChromaDB](https://www.trychroma.com/) for vector storage

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/MEGHANADHA-REDDY/AIplanet/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MEGHANADHA-REDDY/AIplanet/discussions)
- **Email**: [meghanadreddy005@gmail.com]

---

<div align="center">
  <p>Made with ❤️ by the AIplanet Team</p>
  <p>⭐ Star this repository if you find it helpful!</p>
</div> 
