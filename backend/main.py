from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine, Base
from routers import auth, trip, workforce, site

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Fleet and Workforce Management API",
    description="API for unified mobile application handling RBAC, Logistics, and Workforce",
    version="1.0.0"
)

# Configure CORS for the mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(site.router)
app.include_router(auth.router)
app.include_router(trip.router)
app.include_router(workforce.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the Fleet and Workforce Management API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
