import asyncio
import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine, Base
from routers import auth, trip, workforce, site, reports, client
from services.push_service import send_scheduled_compliance_push_notifications

# Create the database tables
import os
try:
    from zoneinfo import ZoneInfo
    APP_TZ = ZoneInfo(os.getenv("APP_TIMEZONE", os.getenv("TZ", "Asia/Kolkata")))
except Exception:
    APP_TZ = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

IST = APP_TZ

async def background_notification_scheduler():
    """
    Continuous background loop that monitors IST time.
    Sends push notifications at 11:00 AM IST and 4:00 PM IST directly to devices.
    """
    print("[Scheduler] Background compliance push notification scheduler started.")
    last_sent_slot = None

    while True:
        try:
            now_ist = datetime.datetime.now(IST)
            current_hour = now_ist.hour
            current_minute = now_ist.minute
            current_date_str = now_ist.strftime("%Y-%m-%d")

            # Slots: 11:00 AM (hour 11) and 4:00 PM (hour 16)
            if current_hour in [11, 16] and current_minute == 0:
                slot_key = f"{current_date_str}_{current_hour}"
                if last_sent_slot != slot_key:
                    last_sent_slot = slot_key
                    print(f"[Scheduler] Triggering scheduled push notifications for slot: {slot_key} (IST: {now_ist})")
                    loop = asyncio.get_running_loop()
                    await loop.run_in_executor(None, send_scheduled_compliance_push_notifications)
        except Exception as e:
            print(f"[Scheduler Error] Exception in push notification scheduler loop: {e}")

        # Sleep for 30 seconds between checks
        await asyncio.sleep(30)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler_task = asyncio.create_task(background_notification_scheduler())
    yield
    # Shutdown
    scheduler_task.cancel()

app = FastAPI(
    title="Fleet and Workforce Management API",
    description="API for unified mobile application handling RBAC, Logistics, and Workforce",
    version="1.0.0",
    lifespan=lifespan
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
app.include_router(reports.router)
app.include_router(client.router)


import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/firebase-phone-auth.html")
def get_firebase_phone_auth():
    html_path = os.path.join(STATIC_DIR, "firebase-phone-auth.html")
    if os.path.exists(html_path):
        return FileResponse(html_path, media_type="text/html")
    return {"error": "Page not found"}

@app.get("/")
def read_root():
    return {"message": "Welcome to the Fleet and Workforce Management API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}


