from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, database, dependencies
from models.trip import TripLog
from models.user import User

router = APIRouter(
    prefix="/trips",
    tags=["Logistics and Trips"]
)

@router.post("/", response_model=schemas.trip.TripLogResponse)
def create_trip(
    trip: schemas.trip.TripLogCreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    # Calculate Km automatically
    calculated_km = trip.end_meter_reading - trip.start_meter_reading
    if calculated_km < 0:
        raise HTTPException(status_code=400, detail="End reading cannot be less than start reading")
        
    # Admin logic: auto-approve and optional staff_id selection
    trip_status = "PENDING"
    staff_id = current_user.id
    
    if current_user.role == "ADMIN":
        trip_status = "APPROVED"
        if trip.staff_id:
            staff_id = trip.staff_id
            
    site_id = trip.site_id or current_user.site_id or 1

    new_trip = TripLog(
        **trip.model_dump(exclude={"staff_id", "site_id"}),
        staff_id=staff_id,
        site_id=site_id,
        total_km=calculated_km,
        status=trip_status
    )
    
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    return new_trip

# Managers and Admins can view all trips
@router.get("/", response_model=List[schemas.trip.TripLogResponse])
def get_all_trips(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    vehicle_number: Optional[str] = None,
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)  # Only Manager+
):
    import datetime
    query = db.query(TripLog)
    if site_id is not None:
        query = query.filter(TripLog.site_id == site_id)
    if start_date:
        try:
            start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(TripLog.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date. Use YYYY-MM-DD.")
    if end_date:
        try:
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
            query = query.filter(TripLog.created_at < end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date. Use YYYY-MM-DD.")
    if vehicle_number:
        query = query.filter(TripLog.vehicle_number.ilike(f"%{vehicle_number}%"))
        
    trips = query.order_by(TripLog.created_at.desc()).offset(skip).limit(limit).all()
    return trips

# Staff can view their own trips
@router.get("/my-trips", response_model=List[schemas.trip.TripLogResponse])
def get_my_trips(
    skip: int = 0, 
    limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(TripLog).filter(TripLog.staff_id == current_user.id)
    if site_id is not None:
        query = query.filter(TripLog.site_id == site_id)
    trips = query.offset(skip).limit(limit).all()
    return trips


# Managers can validate a trip
@router.patch("/{trip_id}/status", response_model=schemas.trip.TripLogResponse)
def update_trip_status(
    trip_id: int, 
    status_update: schemas.trip.TripLogUpdateStatus,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user) # Only Manager+
):
    trip = db.query(TripLog).filter(TripLog.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    trip.status = status_update.status
    if status_update.bhada is not None:
        trip.bhada = status_update.bhada
    db.commit()
    db.refresh(trip)
    return trip
