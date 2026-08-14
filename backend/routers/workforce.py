from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, database, dependencies
from models.workforce import Attendance, FinancialLedger, LeaveRequest, AdvanceWageRequest, VehicleEMI, StaffLedger, DailyLedger
from models.trip import TripLog
from models.user import User
from core.services import create_pdf_report, backup_to_drive, send_push_notification

router = APIRouter(
    prefix="/workforce",
    tags=["Workforce and Finance"]
)

# --- ATTENDANCE ---
@router.post("/attendance", response_model=schemas.workforce.AttendanceResponse)
def record_attendance(
    attendance: schemas.workforce.AttendanceCreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    import datetime
    # Only ADMIN can mark for others. STAFF and MANAGER can only mark for themselves.
    if current_user.role in ["STAFF", "MANAGER"] and attendance.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only mark your own attendance")

    target_date = attendance.date if attendance.date else datetime.date.today()

    # Only ADMIN can mark past attendance.
    if current_user.role != "ADMIN" and target_date < datetime.date.today():
        raise HTTPException(status_code=403, detail="Only admins can mark attendance for previous days")

    # Prevent duplicate attendance for the requested date
    existing = db.query(Attendance).filter(
        Attendance.staff_id == attendance.staff_id,
        Attendance.date == target_date
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Attendance already marked for this date")

    att_data = attendance.model_dump()
    if not att_data.get("site_id"):
        att_data["site_id"] = current_user.site_id or 1

    new_record = Attendance(
        **att_data,
        recorded_by_id=current_user.id if current_user.role == "ADMIN" and attendance.staff_id != current_user.id else None
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.post("/attendance/punch", response_model=schemas.workforce.AttendanceResponse)
def punch_attendance(
    punch: schemas.workforce.PunchRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    import datetime
    today = datetime.date.today()
    now = datetime.datetime.now()

    # Read target staff member (Admin can specify other staff; otherwise defaults to current logged-in user)
    target_staff_id = punch.staff_id if (punch.staff_id and current_user.role == "ADMIN") else current_user.id

    # Find if there is an existing attendance for today
    record = db.query(Attendance).filter(
        Attendance.staff_id == target_staff_id,
        Attendance.date == today
    ).first()

    if punch.punch_type == "in":
        if record:
            raise HTTPException(status_code=400, detail="Already punched in for today.")
        
        record = Attendance(
            staff_id=target_staff_id,
            date=today,
            status="PRESENT",
            notes=punch.notes or "Self punched-in via face scan",
            site_id=punch.site_id or current_user.site_id or 1,
            punch_in_time=now,
            punch_in_photo_url=punch.photo,
            punch_in_location=punch.location,
            hours_worked=0.0
        )
        db.add(record)
    else: # punch out
        if not record:
            raise HTTPException(status_code=400, detail="Cannot punch out without punching in first.")
        if record.punch_out_time:
            raise HTTPException(status_code=400, detail="Already punched out for today.")
        
        record.punch_out_time = now
        record.punch_out_photo_url = punch.photo
        record.punch_out_location = punch.location
        if record.punch_in_time:
            diff = now - record.punch_in_time
            record.hours_worked = round(diff.total_seconds() / 3600.0, 2)
        if punch.notes:
            record.notes = (record.notes or "") + " | Out: " + punch.notes

    db.commit()
    db.refresh(record)

    # Convert native local datetimes to ISO strings for correct JSON timezone parsing on client
    resp_obj = {
        "id": record.id,
        "staff_id": record.staff_id,
        "date": record.date,
        "status": record.status,
        "notes": record.notes,
        "site_id": record.site_id,
        "punch_in_time": record.punch_in_time.isoformat() if record.punch_in_time else None,
        "punch_out_time": record.punch_out_time.isoformat() if record.punch_out_time else None,
        "punch_in_photo_url": record.punch_in_photo_url,
        "punch_out_photo_url": record.punch_out_photo_url,
        "punch_in_location": record.punch_in_location,
        "punch_out_location": record.punch_out_location,
        "hours_worked": record.hours_worked,
        "recorded_by_id": record.recorded_by_id,
        "created_at": record.created_at
    }
    return resp_obj

@router.get("/attendance", response_model=List[schemas.workforce.AttendanceResponse])
def get_attendance(
    skip: int = 0, limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(Attendance)
    if current_user.role in ["STAFF", "MANAGER"]:
        query = query.filter(Attendance.staff_id == current_user.id)
    if site_id is not None:
        query = query.filter(Attendance.site_id == site_id)
    return query.offset(skip).limit(limit).all()

# --- LEAVES ---
@router.post("/leaves", response_model=schemas.workforce.LeaveResponse)
def request_leave(
    leave: schemas.workforce.LeaveCreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    if current_user.role == "STAFF" and leave.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    leave_data = leave.model_dump()
    if not leave_data.get("site_id"):
        leave_data["site_id"] = current_user.site_id or 1

    new_leave = LeaveRequest(**leave_data, status="PENDING")
    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)
    return new_leave

@router.get("/leaves", response_model=List[schemas.workforce.LeaveResponse])
def get_leaves(
    skip: int = 0, limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(LeaveRequest)
    if current_user.role == "STAFF":
        query = query.filter(LeaveRequest.staff_id == current_user.id)
    if site_id is not None:
        query = query.filter(LeaveRequest.site_id == site_id)
    return query.offset(skip).limit(limit).all()

@router.patch("/leaves/{leave_id}/status", response_model=schemas.workforce.LeaveResponse)
def update_leave_status(
    leave_id: int, 
    status_update: schemas.workforce.LeaveUpdateStatus,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave: raise HTTPException(status_code=404, detail="Leave request not found")
    leave.status = status_update.status
    db.commit()
    db.refresh(leave)
    return leave

# --- ADVANCES ---
@router.post("/advances", response_model=schemas.workforce.AdvanceResponse)
def request_advance(
    advance: schemas.workforce.AdvanceCreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    if current_user.role == "STAFF" and advance.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    adv_data = advance.model_dump()
    if not adv_data.get("site_id"):
        adv_data["site_id"] = current_user.site_id or 1

    new_adv = AdvanceWageRequest(**adv_data, status="PENDING")
    db.add(new_adv)
    db.commit()
    db.refresh(new_adv)
    return new_adv

@router.get("/advances", response_model=List[schemas.workforce.AdvanceResponse])
def get_advances(
    skip: int = 0, limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(AdvanceWageRequest)
    if current_user.role == "STAFF":
        query = query.filter(AdvanceWageRequest.staff_id == current_user.id)
    if site_id is not None:
        query = query.filter(AdvanceWageRequest.site_id == site_id)
    return query.offset(skip).limit(limit).all()

@router.patch("/advances/{advance_id}/status", response_model=schemas.workforce.AdvanceResponse)
def update_advance_status(
    advance_id: int, 
    status_update: schemas.workforce.AdvanceUpdateStatus,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    adv = db.query(AdvanceWageRequest).filter(AdvanceWageRequest.id == advance_id).first()
    if not adv: raise HTTPException(status_code=404, detail="Advance request not found")
    adv.status = status_update.status
    
    # If approved, automatically create a ledger entry (Debit/Negative amount)
    if status_update.status == "APPROVED":
        import datetime
        target_site_id = adv.site_id or 1
        ledger_entry = StaffLedger(
            staff_id=adv.staff_id,
            site_id=target_site_id,
            amount=-abs(adv.amount), # Advances are deductions (Debit)
            transaction_type="ADVANCE",
            description=f"Approved Advance: {adv.reason}",
            date=datetime.date.today()
        )
        db.add(ledger_entry)
        db.flush() # Get ID for reference

        staff_username = adv.staff.username if adv.staff else ""
        # INTEGRATION: Daily Ledger
        daily_entry = DailyLedger(
            date=datetime.date.today(),
            site_id=target_site_id,
            transaction_type="EXPENSE",
            category="ADVANCE",
            amount=abs(adv.amount),
            description=f"Staff Advance: {staff_username} - {adv.reason}",
            reference_id=ledger_entry.id,
            reference_type="STAFF_LEDGER"
        )
        db.add(daily_entry)
        
    db.commit()
    db.refresh(adv)
    return adv

# --- STAFF LEDGER ---
@router.post("/staff-ledger", response_model=schemas.workforce.StaffLedgerResponse)
def create_staff_ledger_entry(
    ledger: schemas.workforce.StaffLedgerCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    import datetime
    ledger_data = ledger.model_dump()
    if not ledger_data.get("site_id"):
        ledger_data["site_id"] = 1
    new_entry = StaffLedger(**ledger_data)
    if not new_entry.date:
        new_entry.date = datetime.date.today()
    db.add(new_entry)
    db.flush()

    daily_type = "EXPENSE" if new_entry.transaction_type in ["SALARY", "PAYMENT"] else "INCOME"
    
    daily_entry = DailyLedger(
        date=new_entry.date or datetime.date.today(),
        site_id=new_entry.site_id or 1,
        transaction_type=daily_type,
        category=new_entry.transaction_type,
        amount=abs(new_entry.amount),
        description=f"Staff {new_entry.transaction_type}: {new_entry.description}",
        reference_id=new_entry.id,
        reference_type="STAFF_LEDGER"
    )
    db.add(daily_entry)

    db.commit()
    db.refresh(new_entry)
    return new_entry

# --- DAILY LEDGER ---
@router.post("/daily-ledger", response_model=schemas.workforce.DailyLedgerResponse)
def create_daily_ledger_entry(
    ledger: schemas.workforce.DailyLedgerCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    import datetime
    ledger_data = ledger.model_dump()
    if not ledger_data.get("site_id"):
        ledger_data["site_id"] = 1
    new_entry = DailyLedger(**ledger_data)
    if not new_entry.date:
        new_entry.date = datetime.date.today()
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry

@router.get("/daily-ledger", response_model=List[schemas.workforce.DailyLedgerResponse])
def get_daily_financial_ledger(
    date: Optional[str] = None, # YYYY-MM-DD
    month: Optional[int] = None, # 1-12
    year: Optional[int] = None, # e.g. 2024
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    from sqlalchemy import extract
    query = db.query(DailyLedger)
    if site_id is not None:
        query = query.filter(DailyLedger.site_id == site_id)
    if date:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(DailyLedger.date == target_date)
        except: pass
    if month:
        query = query.filter(extract('month', DailyLedger.date) == month)
    if year:
        query = query.filter(extract('year', DailyLedger.date) == year)
    
    return query.order_by(DailyLedger.date.desc(), DailyLedger.created_at.desc()).all()

@router.get("/staff-ledger", response_model=List[schemas.workforce.StaffLedgerResponse])
def get_daily_ledger(
    date: Optional[str] = None, # YYYY-MM-DD
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    import datetime
    query = db.query(StaffLedger)
    if site_id is not None:
        query = query.filter(StaffLedger.site_id == site_id)
    if date:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(StaffLedger.date == target_date)
        except:
            pass
    return query.order_by(StaffLedger.created_at.desc()).all()

@router.get("/staff-ledger/{staff_id}", response_model=List[schemas.workforce.StaffLedgerResponse])
def get_individual_ledger(
    staff_id: int,
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    query = db.query(StaffLedger).filter(StaffLedger.staff_id == staff_id)
    if site_id is not None:
        query = query.filter(StaffLedger.site_id == site_id)
    return query.order_by(StaffLedger.date.desc(), StaffLedger.created_at.desc()).all()

# --- VEHICLE EMIs ---
@router.post("/emi", response_model=schemas.workforce.VehicleEMIResponse)
def add_emi_record(
    emi: schemas.workforce.VehicleEMICreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    emi_data = emi.model_dump()
    if not emi_data.get("site_id"):
        emi_data["site_id"] = 1
    new_emi = VehicleEMI(**emi_data)
    db.add(new_emi)
    db.commit()
    db.refresh(new_emi)
    return new_emi

@router.get("/emi", response_model=List[schemas.workforce.VehicleEMIResponse])
def get_emi_records(
    skip: int = 0, limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    query = db.query(VehicleEMI)
    if site_id is not None:
        query = query.filter(VehicleEMI.site_id == site_id)
    return query.offset(skip).limit(limit).all()

@router.patch("/emi/{emi_id}/mark_paid", response_model=schemas.workforce.VehicleEMIResponse)
def mark_emi_paid(
    emi_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    import datetime
    from dateutil.relativedelta import relativedelta
    emi = db.query(VehicleEMI).filter(VehicleEMI.id == emi_id).first()
    if not emi: raise HTTPException(status_code=404, detail="EMI record not found")
    
    emi.emi_due_date = emi.emi_due_date + relativedelta(months=1)
    
    db.commit()
    db.refresh(emi)
    return emi

@router.patch("/emi/{emi_id}", response_model=schemas.workforce.VehicleEMIResponse)
def update_emi_record(
    emi_id: int,
    emi_update: schemas.workforce.VehicleEMIUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    emi = db.query(VehicleEMI).filter(VehicleEMI.id == emi_id).first()
    if not emi: raise HTTPException(status_code=404, detail="EMI record not found")
    
    update_data = emi_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(emi, key, value)
    
    db.commit()
    db.refresh(emi)
    return emi

@router.delete("/emi/{emi_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_emi_record(
    emi_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    emi = db.query(VehicleEMI).filter(VehicleEMI.id == emi_id).first()
    if not emi: raise HTTPException(status_code=404, detail="EMI record not found")
    
    db.delete(emi)
    db.commit()
    return None

# --- FINANCIAL LEDGER (TRIPS) ---
@router.post("/ledger", response_model=schemas.workforce.FinancialLedgerResponse)
def create_ledger_entry(
    ledger: schemas.workforce.FinancialLedgerCreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    trip = db.query(TripLog).filter(TripLog.id == ledger.trip_id).first()
    if not trip: raise HTTPException(status_code=404, detail="Trip not found")
    
    # Sync income and status to TripLog
    trip.status = "VALIDATED"
    trip.bhada = ledger.total_amount_billed
    
    existing_ledger = db.query(FinancialLedger).filter(FinancialLedger.trip_id == ledger.trip_id).first()
    if existing_ledger: raise HTTPException(status_code=400, detail="Ledger already exists")

    calculated_pending = ledger.total_amount_billed - ledger.amount_received
    target_site_id = ledger.site_id or trip.site_id or 1

    ledger_data = ledger.model_dump()
    ledger_data["site_id"] = target_site_id

    new_ledger = FinancialLedger(**ledger_data, amount_pending=calculated_pending)
    db.add(new_ledger)
    db.flush()

    # INTEGRATION: Daily Ledger (Trip Income)
    import datetime
    daily_entry = DailyLedger(
        date=datetime.date.today(),
        site_id=target_site_id,
        transaction_type="INCOME",
        category="TRIP_INCOME",
        amount=ledger.total_amount_billed,
        description=f"Trip Bhada: {trip.vehicle_number} (ID: {trip.id})",
        reference_id=trip.id,
        reference_type="TRIP"
    )
    db.add(daily_entry)

    db.commit()
    db.refresh(new_ledger)
    return new_ledger

@router.get("/ledger", response_model=List[schemas.workforce.FinancialLedgerResponse])
def get_ledgers(
    skip: int = 0, limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    query = db.query(FinancialLedger)
    if site_id is not None:
        query = query.filter(FinancialLedger.site_id == site_id)
    return query.offset(skip).limit(limit).all()

