from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, database, dependencies
from models.trip import TripLog
from models.user import User
from models.workforce import DailyLedger
import datetime

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
    # Calculate Km automatically (odometer is optional)
    start_meter = float(trip.start_meter_reading or 0.0)
    end_meter = float(trip.end_meter_reading or 0.0)
    calculated_km = 0.0
    if end_meter > 0 and start_meter > 0:
        if end_meter < start_meter:
            raise HTTPException(status_code=400, detail="End reading cannot be less than start reading")
        calculated_km = end_meter - start_meter
    elif end_meter > start_meter:
        calculated_km = end_meter - start_meter
        
    # Admin / Manager logic: auto-approve and optional staff_id selection
    trip_status = "PENDING"
    staff_id = current_user.id
    
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role)
    if user_role_str in ["ADMIN", "MANAGER"]:
        trip_status = "APPROVED"
        if trip.staff_id:
            staff_id = trip.staff_id
            
    site_id = trip.site_id or current_user.site_id or 1

    # Freight calculations
    bhada = float(trip.bhada or 0.0)
    advance_rec = float(trip.advance_freight_received or 0.0)
    pending = max(0.0, bhada - advance_rec)
    if bhada > 0:
        if advance_rec >= bhada:
            f_status = "PAID"
        elif advance_rec > 0:
            f_status = "PARTIAL"
        else:
            f_status = "PENDING"
    else:
        f_status = "PENDING"

    dump_data = trip.model_dump(exclude={"staff_id", "site_id"})
    dump_data["bhada"] = bhada
    dump_data["advance_freight_received"] = advance_rec
    dump_data["pending_freight"] = pending
    dump_data["freight_status"] = f_status

    new_trip = TripLog(
        **dump_data,
        staff_id=staff_id,
        site_id=site_id,
        total_km=calculated_km,
        status=trip_status
    )
    
    db.add(new_trip)
    db.flush()

    # If advance freight was received at loading, log into DailyLedger as TRIP_INCOME
    if advance_rec > 0:
        daily_entry = DailyLedger(
            date=datetime.date.today(),
            site_id=site_id,
            transaction_type="INCOME",
            category="TRIP_INCOME",
            amount=advance_rec,
            description=f"Trip Advance Freight: {new_trip.vehicle_number} (Trip #{new_trip.id})",
            reference_id=new_trip.id,
            reference_type="TRIP"
        )
        db.add(daily_entry)

    db.commit()
    db.refresh(new_trip)

    # Dispatch instant push notification to Admin & Manager
    try:
        from services.push_service import send_push_to_admins_and_managers
        staff_name = current_user.full_name or current_user.username
        veh = (new_trip.vehicle_number or "Vehicle").strip().upper()
        route_str = f" from {new_trip.starting_location} to {new_trip.destination}" if new_trip.starting_location and new_trip.destination else ""
        send_push_to_admins_and_managers(
            title=f"🚛 Trip Logged: {veh}",
            body=f"{staff_name} logged trip for {veh}{route_str}. Start: {new_trip.start_meter_reading} KM, End: {new_trip.end_meter_reading} KM (Total: {new_trip.total_km} KM).",
            data={"type": "TRIP_STARTED", "trip_id": new_trip.id, "vehicle": veh},
            site_id=new_trip.site_id
        )
    except Exception as e:
        print(f"[Push Service Error] Could not send trip created push: {e}")

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
    if status_update.freight_notes is not None:
        trip.freight_notes = status_update.freight_notes
    if status_update.weight_tons is not None:
        trip.weight_tons = status_update.weight_tons
    db.commit()
    db.refresh(trip)

    # Dispatch instant push notification to Admin & Manager
    try:
        from services.push_service import send_push_to_admins_and_managers
        veh = (trip.vehicle_number or "Vehicle").strip().upper()
        bhada_str = f" • Bhada: ₹{trip.bhada:,.0f}" if trip.bhada else ""
        send_push_to_admins_and_managers(
            title=f"🏁 Trip Completed/Validated: {veh}",
            body=f"Trip #{trip.id} ({veh}) validated as {trip.status}. Total: {trip.total_km} KM{bhada_str}.",
            data={"type": "TRIP_COMPLETED", "trip_id": trip.id, "vehicle": veh},
            site_id=trip.site_id
        )
    except Exception as e:
        print(f"[Push Service Error] Could not send trip validation push: {e}")

    return trip

@router.get("/vehicles")
def get_unique_vehicles(
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    """Returns a list of distinct vehicle and equipment numbers logged in the system"""
    from sqlalchemy import distinct
    query = db.query(distinct(TripLog.vehicle_number)).filter(TripLog.vehicle_number.isnot(None))
    if site_id is not None:
        query = query.filter(TripLog.site_id == site_id)
    vehicles = [r[0] for r in query.all() if r[0]]
    return vehicles

@router.get("/machinery-analytics")
def get_machinery_analytics(
    vehicle_number: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    """Aggregates machinery hours/km and diesel fuel accounting per vehicle"""
    import datetime
    query = db.query(TripLog)
    if site_id is not None:
        query = query.filter(TripLog.site_id == site_id)
    if vehicle_number:
        query = query.filter(TripLog.vehicle_number.ilike(f"%{vehicle_number}%"))
    if start_date:
        try:
            start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(TripLog.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
            query = query.filter(TripLog.created_at < end_dt)
        except ValueError:
            pass

    trips = query.order_by(TripLog.created_at.desc()).all()

    total_km = sum(t.total_km or 0.0 for t in trips)
    total_diesel_liters = sum(t.diesel_liters or 0.0 for t in trips)
    total_diesel_cost = sum(t.diesel_cost or 0.0 for t in trips)
    total_trips = len(trips)
    avg_mileage = (total_km / total_diesel_liters) if total_diesel_liters > 0 else 0.0

    return {
        "summary": {
            "total_trips": total_trips,
            "total_km": round(total_km, 2),
            "total_diesel_liters": round(total_diesel_liters, 2),
            "total_diesel_cost": round(total_diesel_cost, 2),
            "avg_mileage_km_per_liter": round(avg_mileage, 2)
        },
        "logs": trips
    }

# --- FREIGHT ACCOUNTING LEDGER ---
@router.get("/freight-ledger")
def get_freight_ledger(
    skip: int = 0, limit: int = 100,
    vehicle_number: Optional[str] = None,
    site_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None), # PENDING, PARTIAL, PAID
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    query = db.query(TripLog).filter(TripLog.bhada > 0)
    if site_id is not None:
        query = query.filter(TripLog.site_id == site_id)
    if vehicle_number and vehicle_number != "ALL":
        query = query.filter(TripLog.vehicle_number == vehicle_number)
    if status and status != "ALL":
        query = query.filter(TripLog.freight_status == status)
    if start_date:
        try:
            start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(TripLog.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
            query = query.filter(TripLog.created_at < end_dt)
        except ValueError:
            pass

    all_trips = query.order_by(TripLog.created_at.desc()).all()
    
    total_billed = sum(t.bhada or 0.0 for t in all_trips)
    total_received = sum(t.advance_freight_received or 0.0 for t in all_trips)
    total_pending = sum(t.pending_freight or 0.0 for t in all_trips)
    collection_rate = (total_received / total_billed * 100.0) if total_billed > 0 else 0.0

    paged_trips = all_trips[skip:skip+limit]

    return {
        "summary": {
            "total_freight_billed": round(total_billed, 2),
            "total_freight_received": round(total_received, 2),
            "total_freight_pending": round(total_pending, 2),
            "collection_percentage": round(collection_rate, 1),
            "total_trips": len(all_trips)
        },
        "trips": [
            {
                "id": t.id,
                "vehicle_number": t.vehicle_number,
                "origin": t.origin,
                "destination": t.destination,
                "material_type": t.material_type,
                "weight_tons": t.weight_tons,
                "bhada": t.bhada,
                "advance_freight_received": t.advance_freight_received or 0.0,
                "pending_freight": t.pending_freight or 0.0,
                "freight_status": t.freight_status or "PENDING",
                "freight_notes": t.freight_notes,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "staff_username": t.staff.username if t.staff else None
            }
            for t in paged_trips
        ]
    }

@router.post("/{trip_id}/record-freight-payment")
def record_freight_payment(
    trip_id: int,
    payment: schemas.trip.TripFreightPayment,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    trip = db.query(TripLog).filter(TripLog.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    amount = float(payment.amount_paid)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")
        
    current_received = trip.advance_freight_received or 0.0
    trip.advance_freight_received = current_received + amount
    trip.pending_freight = max(0.0, (trip.bhada or 0.0) - trip.advance_freight_received)
    
    if trip.pending_freight <= 0:
        trip.freight_status = "PAID"
    else:
        trip.freight_status = "PARTIAL"
        
    if payment.notes:
        existing_notes = trip.freight_notes or ""
        trip.freight_notes = f"{existing_notes}; {payment.notes}".strip("; ")

    # INTEGRATION: Automatically record in DailyLedger as TRIP_INCOME
    target_site_id = trip.site_id or 1
    daily_entry = DailyLedger(
        date=datetime.date.today(),
        site_id=target_site_id,
        transaction_type="INCOME",
        category="TRIP_INCOME",
        amount=amount,
        description=f"Freight Payment: {trip.vehicle_number} (Trip #{trip.id}) - {payment.payment_mode or 'CASH'}",
        reference_id=trip.id,
        reference_type="TRIP"
    )
    db.add(daily_entry)
    
    db.commit()
    db.refresh(trip)
    return {
        "success": True,
        "trip_id": trip.id,
        "advance_freight_received": trip.advance_freight_received,
        "pending_freight": trip.pending_freight,
        "freight_status": trip.freight_status
    }

