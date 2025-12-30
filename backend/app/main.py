from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as analyze_router
from app.mock_llms import router as mock_router
from app.api.razorpay_routes import router as razorpay_router
from app.config import MongoDB

# ============================================
# LIFESPAN EVENTS (MongoDB connection)
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, cleanup on shutdown"""
    # Startup
    print("🚀 Starting RegressAI...")
    MongoDB.get_client()
    print("✅ MongoDB connected")
    
    yield
    
    # Shutdown
    print("🔌 Shutting down...")
    MongoDB.close()
    print("✅ MongoDB disconnected")

# ============================================
# APP INITIALIZATION
# ============================================

app = FastAPI(
    title="RegressAI",
    description="Version control and regression testing for LLM APIs",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite
        "http://localhost:3000",   # CRA
        "https://regress-ai.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static & templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# API routers (JSON only)
app.include_router(analyze_router, prefix="/api")
app.include_router(mock_router)
app.include_router(razorpay_router)
# ============================================
# HTML ROUTES
# ============================================

@app.get("/", response_class=HTMLResponse)
def landing(request: Request):
    """Landing page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
def login(request: Request):
    """Login page"""
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/app", response_class=HTMLResponse)
def app_ui(request: Request):
    """Main application interface"""
    return templates.TemplateResponse("app.html", {"request": request})

# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "RegressAI",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)