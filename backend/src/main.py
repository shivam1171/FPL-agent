"""
FastAPI application entry point for FPL Agent.
"""
from fastapi import FastAPI
import warnings

# Suppress Pydantic warning about protected namespaces in langchain
warnings.filterwarnings("ignore", message=".*protected namespace.*", category=UserWarning)

from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import auth, team, transfers, chat, leagues
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="FPL Agent API",
    description="AI-powered Fantasy Premier League transfer suggestion system",
    version="1.0.0",
    debug=settings.DEBUG
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be False when allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(team.router, prefix="/api/team", tags=["Team"])
app.include_router(transfers.router, prefix="/api/transfers", tags=["Transfers"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(leagues.router, prefix="/api/leagues", tags=["Leagues"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "FPL Agent API",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "FPL Agent API",
        "docs": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
