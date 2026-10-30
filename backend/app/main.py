from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import models
from app.database import Base, engine
from app.routes.auth import router as auth_router
from app.routes.patients import router as patients_router
from app.routes.analysis import router as analysis_router




Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LiTwinX API",
    version="0.2.0",
    description=(
        "Research backend for liver CT segmentation, explainable AI and "
        "patient-linked analysis history"
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):517\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(analysis_router)


@app.get("/")
def root():
    return {
        "message": "LiTwinX backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "LiTwinX Backend",
        "version": "0.2.0"
    }
