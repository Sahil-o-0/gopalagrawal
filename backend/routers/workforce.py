from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import datetime
import schemas, database, dependencies
from models.workforce import Attendance, FinancialLedger, LeaveRequest, AdvanceWageRequest, VehicleEMI, StaffLedger, DailyLedger, VehicleRepairRequest, VehicleTyreRecord
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
    # Only ADMIN and MANAGER can mark for others. STAFF can only mark for themselves.
    if current_user.role == "STAFF" and attendance.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="Staff can only mark their own attendance")

    target_date = attendance.date if attendance.date else datetime.date.today()

    # Only ADMIN and MANAGER can mark past attendance.
    if current_user.role == "STAFF" and target_date < datetime.date.today():
        raise HTTPException(status_code=403, detail="Staff cannot mark attendance for previous days")

    # Determine default hours worked
    default_hours = 0.0
    if attendance.hours_worked is not None and attendance.hours_worked > 0:
        default_hours = float(attendance.hours_worked)
    elif attendance.status == "PRESENT":
        default_hours = 8.0
    elif attendance.status == "HALF_DAY":
        default_hours = 4.0

    # Prevent duplicate attendance for the requested date / update existing
    existing = db.query(Attendance).filter(
        Attendance.staff_id == attendance.staff_id,
        Attendance.date == target_date
    ).first()

    if existing:
        if current_user.role in ["ADMIN", "MANAGER"]:
            existing.status = attendance.status
            if attendance.notes is not None:
                existing.notes = attendance.notes
            if attendance.site_id is not None:
                existing.site_id = attendance.site_id
            if attendance.punch_in_time is not None:
                existing.punch_in_time = attendance.punch_in_time
            if attendance.punch_out_time is not None:
                existing.punch_out_time = attendance.punch_out_time
            existing.hours_worked = default_hours
            existing.recorded_by_id = current_user.id
            db.commit()
            db.refresh(existing)
            return existing
        else:
            raise HTTPException(status_code=409, detail="Attendance already marked for this date")

    att_data = attendance.model_dump()
    if not att_data.get("site_id"):
        att_data["site_id"] = current_user.site_id or 1
    att_data["hours_worked"] = default_hours

    new_record = Attendance(
        **att_data,
        recorded_by_id=current_user.id if (current_user.role in ["ADMIN", "MANAGER"] and attendance.staff_id != current_user.id) else None
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

    # Read target staff member (Admin and Manager can specify other staff; otherwise defaults to current logged-in user)
    target_staff_id = punch.staff_id if (punch.staff_id and current_user.role in ["ADMIN", "MANAGER"]) else current_user.id

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
            notes=punch.notes or f"Punched-in by {current_user.username}",
            site_id=punch.site_id or current_user.site_id or 1,
            punch_in_time=now,
            punch_in_photo_url=punch.photo,
            punch_in_location=punch.location,
            hours_worked=8.0,
            recorded_by_id=current_user.id if target_staff_id != current_user.id else None
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
    skip: int = 0, limit: int = 500, 
    site_id: Optional[int] = Query(None),
    staff_id: Optional[int] = Query(None),
    date: Optional[datetime.date] = Query(None),
    start_date: Optional[datetime.date] = Query(None),
    end_date: Optional[datetime.date] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(Attendance)
    if current_user.role == "STAFF":
        query = query.filter(Attendance.staff_id == current_user.id)
    elif current_user.role == "MANAGER":
        if staff_id is not None:
            query = query.filter(Attendance.staff_id == staff_id)
        elif site_id is not None:
            query = query.filter(Attendance.site_id == site_id)
        elif current_user.site_id:
            query = query.filter(Attendance.site_id == current_user.site_id)
    elif current_user.role == "ADMIN":
        if staff_id is not None:
            query = query.filter(Attendance.staff_id == staff_id)
        if site_id is not None:
            query = query.filter(Attendance.site_id == site_id)
            
    if date is not None:
        query = query.filter(Attendance.date == date)
    if start_date is not None:
        query = query.filter(Attendance.date >= start_date)
    if end_date is not None:
        query = query.filter(Attendance.date <= end_date)

    return query.order_by(Attendance.date.desc(), Attendance.id.desc()).offset(skip).limit(limit).all()

@router.delete("/attendance/{attendance_id}")
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can delete attendance records")
    
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    db.delete(record)
    db.commit()
    return {"message": "Attendance record deleted successfully"}

# --- LEAVES ---
@router.post("/leaves", response_model=schemas.workforce.LeaveResponse)
def request_leave(
    leave: schemas.workforce.LeaveCreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper()
    if user_role_str == "STAFF":
        target_staff_id = current_user.id
    else:
        target_staff_id = leave.staff_id or current_user.id

    leave_data = leave.model_dump()
    leave_data["staff_id"] = target_staff_id
    if not leave_data.get("site_id"):
        leave_data["site_id"] = current_user.site_id or 1

    new_leave = LeaveRequest(**leave_data, status="PENDING")
    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)

    # Dispatch instant push notification to Admin and Manager devices
    try:
        from services.push_service import send_push_to_admins_and_managers
        staff_name = current_user.full_name or current_user.username
        dates_str = f"{new_leave.start_date.strftime('%d %b')} to {new_leave.end_date.strftime('%d %b %Y')}" if new_leave.start_date and new_leave.end_date else "upcoming dates"
        send_push_to_admins_and_managers(
            title=f"🌴 Leave Request: {staff_name}",
            body=f"{staff_name} submitted a leave request for {dates_str}. Reason: {new_leave.reason or 'Personal'}",
            data={"type": "LEAVE_REQUEST", "leave_id": new_leave.id, "staff_id": new_leave.staff_id},
            site_id=new_leave.site_id
        )
    except Exception as e:
        print(f"[Push Service Error] Could not send leave notification: {e}")

    return new_leave

@router.get("/leaves", response_model=List[schemas.workforce.LeaveResponse])
def get_leaves(
    skip: int = 0, limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(LeaveRequest).options(joinedload(LeaveRequest.staff))
    if current_user.role == "STAFF":
        query = query.filter(LeaveRequest.staff_id == current_user.id)
    if site_id is not None:
        query = query.filter(LeaveRequest.site_id == site_id)
    return query.order_by(LeaveRequest.id.desc()).offset(skip).limit(limit).all()

@router.patch("/leaves/{leave_id}/status", response_model=schemas.workforce.LeaveResponse)
def update_leave_status(
    leave_id: int, 
    status_update: schemas.workforce.LeaveUpdateStatus,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave: raise HTTPException(status_code=404, detail="Leave request not found")
    leave.status = status_update.status
    
    # If approved, mark Attendance as ON_LEAVE for the range
    if status_update.status == "APPROVED" and leave.start_date and leave.end_date:
        import datetime
        curr_d = leave.start_date
        while curr_d <= leave.end_date:
            existing_att = db.query(Attendance).filter(
                Attendance.staff_id == leave.staff_id,
                Attendance.date == curr_d
            ).first()
            if existing_att:
                existing_att.status = "ON_LEAVE"
                existing_att.notes = f"Approved Leave: {leave.reason}"
            else:
                new_att = Attendance(
                    site_id=leave.site_id or 1,
                    staff_id=leave.staff_id,
                    recorded_by_id=current_user.id,
                    date=curr_d,
                    status="ON_LEAVE",
                    notes=f"Approved Leave: {leave.reason}"
                )
                db.add(new_att)
            curr_d += datetime.timedelta(days=1)

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
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role).upper()
    
    # If staff member, advance request is automatically for themselves
    if user_role_str == "STAFF":
        target_staff_id = current_user.id
    else:
        # Admin / Manager can request for themselves or for a designated staff member
        target_staff_id = advance.staff_id or current_user.id

    adv_data = advance.model_dump()
    adv_data["staff_id"] = target_staff_id
    if not adv_data.get("site_id"):
        adv_data["site_id"] = current_user.site_id or 1

    new_adv = AdvanceWageRequest(**adv_data, status="PENDING")
    db.add(new_adv)
    db.commit()
    db.refresh(new_adv)

    # Dispatch instant push notification to Admin and Manager devices
    try:
        from services.push_service import send_push_to_admins_and_managers
        staff_name = current_user.full_name or current_user.username
        send_push_to_admins_and_managers(
            title=f"💵 Advance Request: {staff_name}",
            body=f"{staff_name} requested an advance of ₹{new_adv.amount:,.0f}. Reason: {new_adv.reason or 'Personal'}",
            data={"type": "ADVANCE_REQUEST", "advance_id": new_adv.id, "staff_id": new_adv.staff_id},
            site_id=new_adv.site_id
        )
    except Exception as e:
        print(f"[Push Service Error] Could not send advance notification: {e}")

    return new_adv

@router.get("/advances", response_model=List[schemas.workforce.AdvanceResponse])
def get_advances(
    skip: int = 0, limit: int = 100, 
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(AdvanceWageRequest).options(joinedload(AdvanceWageRequest.staff))
    if current_user.role == "STAFF":
        query = query.filter(AdvanceWageRequest.staff_id == current_user.id)
    if site_id is not None:
        query = query.filter(AdvanceWageRequest.site_id == site_id)
    return query.order_by(AdvanceWageRequest.id.desc()).offset(skip).limit(limit).all()

@router.patch("/advances/{advance_id}/status", response_model=schemas.workforce.AdvanceResponse)
def update_advance_status(
    advance_id: int, 
    status_update: schemas.workforce.AdvanceUpdateStatus,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
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

# --- VEHICLE REPAIR & MAINTENANCE REQUESTS ---
@router.post("/repairs", response_model=schemas.workforce.VehicleRepairResponse)
def request_vehicle_repair(
    repair: schemas.workforce.VehicleRepairCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    if current_user.role == "STAFF" and repair.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="Staff can only submit repair requests for themselves")
    
    repair_data = repair.model_dump()
    if not repair_data.get("site_id"):
        repair_data["site_id"] = current_user.site_id or 1
    if not repair_data.get("staff_id"):
        repair_data["staff_id"] = current_user.id
        
    new_repair = VehicleRepairRequest(**repair_data, status="PENDING")
    db.add(new_repair)
    db.commit()
    db.refresh(new_repair)
    return new_repair

@router.get("/repairs", response_model=List[schemas.workforce.VehicleRepairResponse])
def get_vehicle_repairs(
    skip: int = 0, limit: int = 100,
    site_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(VehicleRepairRequest).options(joinedload(VehicleRepairRequest.staff))
    if current_user.role == "STAFF":
        query = query.filter(VehicleRepairRequest.staff_id == current_user.id)
    if site_id is not None:
        query = query.filter(VehicleRepairRequest.site_id == site_id)
    if status is not None:
        query = query.filter(VehicleRepairRequest.status == status)
    return query.order_by(VehicleRepairRequest.created_at.desc()).offset(skip).limit(limit).all()

@router.patch("/repairs/{repair_id}/status", response_model=schemas.workforce.VehicleRepairResponse)
def update_vehicle_repair_status(
    repair_id: int,
    status_update: schemas.workforce.VehicleRepairUpdateStatus,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    repair = db.query(VehicleRepairRequest).filter(VehicleRepairRequest.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Vehicle repair request not found")
        
    repair.status = status_update.status
    if status_update.actual_cost is not None:
        repair.actual_cost = status_update.actual_cost
    if status_update.admin_notes is not None:
        repair.admin_notes = status_update.admin_notes

    # If APPROVED or COMPLETED, automatically log into DailyLedger under MAINTENANCE
    if status_update.status in ["APPROVED", "COMPLETED"]:
        import datetime
        final_amount = repair.actual_cost if repair.actual_cost > 0 else repair.estimated_cost
        if final_amount > 0:
            target_site_id = repair.site_id or 1
            daily_entry = DailyLedger(
                date=datetime.date.today(),
                site_id=target_site_id,
                transaction_type="EXPENSE",
                category="MAINTENANCE",
                amount=final_amount,
                description=f"Repair: {repair.vehicle_number} - {repair.issue_description}",
                reference_id=repair.id,
                reference_type="VEHICLE_REPAIR"
            )
            db.add(daily_entry)
            
    db.commit()
    db.refresh(repair)
    return repair

# --- APPROVALS UNIFIED SUMMARY ---
@router.get("/approvals/summary")
def get_approvals_summary(
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    adv_query = db.query(AdvanceWageRequest).filter(AdvanceWageRequest.status == "PENDING")
    leave_query = db.query(LeaveRequest).filter(LeaveRequest.status == "PENDING")
    repair_query = db.query(VehicleRepairRequest).filter(VehicleRepairRequest.status == "PENDING")
    
    if current_user.role == "STAFF":
        adv_query = adv_query.filter(AdvanceWageRequest.staff_id == current_user.id)
        leave_query = leave_query.filter(LeaveRequest.staff_id == current_user.id)
        repair_query = repair_query.filter(VehicleRepairRequest.staff_id == current_user.id)
    elif site_id is not None:
        adv_query = adv_query.filter(AdvanceWageRequest.site_id == site_id)
        leave_query = leave_query.filter(LeaveRequest.site_id == site_id)
        repair_query = repair_query.filter(VehicleRepairRequest.site_id == site_id)
        
    pending_adv = adv_query.count()
    pending_leaves = leave_query.count()
    pending_repairs = repair_query.count()
    
    return {
        "pending_advances": pending_adv,
        "pending_leaves": pending_leaves,
        "pending_repairs": pending_repairs,
        "total_pending": pending_adv + pending_leaves + pending_repairs
    }

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
    current_user: User = Depends(dependencies.get_manager_user)
):
    import datetime
    ledger_data = ledger.model_dump()
    if not ledger_data.get("site_id"):
        ledger_data["site_id"] = 1

    # Deduplication check for automated references (e.g. TRIP, CLIENT_TXN)
    ref_id = ledger_data.get("reference_id")
    ref_type = ledger_data.get("reference_type")
    cat = ledger_data.get("category")
    if ref_id and ref_type:
        existing = db.query(DailyLedger).filter(
            DailyLedger.reference_id == ref_id,
            DailyLedger.reference_type == ref_type,
            DailyLedger.category == cat
        ).first()
        if existing:
            # Update existing entry rather than creating a duplicate
            existing.amount = ledger_data.get("amount", existing.amount)
            existing.transaction_type = ledger_data.get("transaction_type", existing.transaction_type)
            existing.description = ledger_data.get("description", existing.description)
            if ledger_data.get("date"):
                existing.date = ledger_data.get("date")
            db.commit()
            db.refresh(existing)
            return existing

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
    current_user: User = Depends(dependencies.get_manager_user)
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

# --- VEHICLE EMIs & COMPLIANCE ---
def _advance_date_by_months(d, months: int):
    import datetime
    if not d:
        d = datetime.date.today()
    elif isinstance(d, str):
        try:
            d = datetime.date.fromisoformat(d.split('T')[0])
        except Exception:
            d = datetime.date.today()
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    days_in_month = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(d.day, days_in_month[month - 1])
    return datetime.date(year, month, day)

@router.post("/emi", response_model=schemas.workforce.VehicleEMIResponse)
def add_emi_record(
    emi: schemas.workforce.VehicleEMICreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
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
    current_user: User = Depends(dependencies.get_manager_user)
):
    query = db.query(VehicleEMI)
    if site_id is not None:
        query = query.filter(VehicleEMI.site_id == site_id)
    return query.offset(skip).limit(limit).all()

@router.patch("/emi/{emi_id}/mark_paid", response_model=schemas.workforce.VehicleEMIResponse)
def mark_emi_paid(
    emi_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    return mark_compliance_cost_paid(emi_id=emi_id, cost_type="EMI", db=db, current_user=current_user)

@router.patch("/emi/{emi_id}/mark_cost_paid", response_model=schemas.workforce.VehicleEMIResponse)
def mark_compliance_cost_paid(
    emi_id: int,
    cost_type: str = Query("EMI"), # EMI, INSURANCE, PERMIT, FITNESS, ROAD_TAX, PUCC
    amount: Optional[float] = Query(None),
    record_in_ledger: bool = Query(True),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    import datetime
    from models.workforce import DailyLedger
    from services.push_service import send_push_to_admins_and_managers

    emi = db.query(VehicleEMI).filter(VehicleEMI.id == emi_id).first()
    if not emi:
        raise HTTPException(status_code=404, detail="Vehicle compliance record not found")

    cost_type_upper = (cost_type or "EMI").upper()
    veh_num = (emi.vehicle_number or "Vehicle").strip().upper()
    paid_amount = 0.0
    title = ""
    body = ""

    if cost_type_upper == "EMI":
        next_date = _advance_date_by_months(emi.emi_due_date, 1)
        emi.emi_due_date = next_date
        paid_amount = amount if amount is not None else float(emi.emi_amount or 0.0)
        title = f"✅ EMI Paid: {veh_num}"
        body = f"EMI of ₹{paid_amount:,.0f} marked paid by {current_user.full_name or current_user.username}. Next due: {next_date.strftime('%d %b %Y')}."
        ledger_desc = f"Monthly EMI payment for {veh_num} (Next due: {next_date.strftime('%d %b %Y')})"

    elif cost_type_upper == "INSURANCE":
        next_date = _advance_date_by_months(emi.insurance_expiry, 12)
        emi.insurance_expiry = next_date
        paid_amount = amount if amount is not None else float(emi.insurance_premium or 0.0)
        title = f"🛡️ Insurance Renewed: {veh_num}"
        body = f"Insurance premium of ₹{paid_amount:,.0f} marked renewed by {current_user.full_name or current_user.username}. Valid upto: {next_date.strftime('%d %b %Y')}."
        ledger_desc = f"Insurance renewal premium for {veh_num} (Valid upto: {next_date.strftime('%d %b %Y')})"

    elif cost_type_upper == "PERMIT":
        next_date = _advance_date_by_months(emi.permit_valid_upto, 12)
        emi.permit_valid_upto = next_date
        paid_amount = amount if amount is not None else float(emi.permit_fee or 0.0)
        title = f"📜 Permit Renewed: {veh_num}"
        body = f"Permit fee of ₹{paid_amount:,.0f} marked paid by {current_user.full_name or current_user.username}. Valid upto: {next_date.strftime('%d %b %Y')}."
        ledger_desc = f"Permit fee renewal for {veh_num} (Valid upto: {next_date.strftime('%d %b %Y')})"

    elif cost_type_upper == "FITNESS":
        next_date = _advance_date_by_months(emi.fitness_expiry, 12)
        emi.fitness_expiry = next_date
        paid_amount = amount if amount is not None else float(emi.fitness_fee or 0.0)
        title = f"📋 Fitness Certificate Renewed: {veh_num}"
        body = f"Fitness fee of ₹{paid_amount:,.0f} marked paid by {current_user.full_name or current_user.username}. Valid upto: {next_date.strftime('%d %b %Y')}."
        ledger_desc = f"Fitness certificate fee for {veh_num} (Valid upto: {next_date.strftime('%d %b %Y')})"

    elif cost_type_upper == "ROAD_TAX":
        next_date = _advance_date_by_months(emi.road_tax_expiry, 12)
        emi.road_tax_expiry = next_date
        paid_amount = amount if amount is not None else float(emi.road_tax_amount or 0.0)
        title = f"🛣️ Road Tax Paid: {veh_num}"
        body = f"Road tax of ₹{paid_amount:,.0f} marked paid by {current_user.full_name or current_user.username}. Valid upto: {next_date.strftime('%d %b %Y')}."
        ledger_desc = f"Road tax payment for {veh_num} (Valid upto: {next_date.strftime('%d %b %Y')})"

    elif cost_type_upper == "PUCC":
        next_date = _advance_date_by_months(emi.pucc_expiry, 6)
        emi.pucc_expiry = next_date
        paid_amount = amount if amount is not None else float(emi.pucc_fee or 0.0)
        title = f"💨 PUCC Renewed: {veh_num}"
        body = f"PUCC fee of ₹{paid_amount:,.0f} marked paid by {current_user.full_name or current_user.username}. Valid upto: {next_date.strftime('%d %b %Y')}."
        ledger_desc = f"PUCC pollution check fee for {veh_num} (Valid upto: {next_date.strftime('%d %b %Y')})"

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cost type: {cost_type}")

    # Record automatically in daily ledger if requested
    if record_in_ledger and paid_amount > 0:
        ledger_entry = DailyLedger(
            site_id=emi.site_id or 1,
            date=datetime.date.today(),
            transaction_type="EXPENSE",
            category="MAINTENANCE",
            amount=paid_amount,
            description=ledger_desc,
            reference_id=emi.id,
            reference_type="VEHICLE_COMPLIANCE"
        )
        db.add(ledger_entry)

    db.commit()
    db.refresh(emi)

    # Trigger separate instant push notification to admins & managers
    try:
        send_push_to_admins_and_managers(
            title=title,
            body=body,
            data={"screen": "ComplianceVault", "id": emi.id, "type": cost_type_upper},
            site_id=emi.site_id
        )
    except Exception as e:
        print(f"Failed to dispatch cost payment push alert: {e}")

    return emi

@router.patch("/emi/{emi_id}", response_model=schemas.workforce.VehicleEMIResponse)
def update_emi_record(
    emi_id: int,
    emi_update: schemas.workforce.VehicleEMIUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
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
    current_user: User = Depends(dependencies.get_manager_user)
):
    emi = db.query(VehicleEMI).filter(VehicleEMI.id == emi_id).first()
    if not emi: raise HTTPException(status_code=404, detail="EMI record not found")
    
    db.delete(emi)
    db.commit()
    return None

def send_expo_push_notification(tokens: list, title: str, body: str, data: dict = None):
    """Helper to send push notifications via Expo Push API"""
    import urllib.request
    import json
    if not tokens:
        return
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken[")]
    if not valid_tokens:
        return
    
    messages = []
    for tok in valid_tokens:
        messages.append({
            "to": tok,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
        })
    
    try:
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=json.dumps(messages).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            pass
    except Exception as e:
        print(f"Expo push notification error: {e}")

@router.post("/emi/send-due-reminders")
def send_due_compliance_reminders(
    days_threshold: int = 2,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    """Sends push notifications for EMIs, insurance, or fitness due within days_threshold (default 2 days)"""
    import datetime
    today = datetime.date.today()
    target_date = today + datetime.timedelta(days=days_threshold)
    
    # Query admin & manager push tokens
    admins_and_managers = db.query(User).filter(
        User.role.in_(["ADMIN", "MANAGER"]),
        User.expo_push_token.isnot(None)
    ).all()
    push_tokens = [u.expo_push_token for u in admins_and_managers if u.expo_push_token]
    
    all_emis = db.query(VehicleEMI).all()
    alerts_triggered = []
    
    for item in all_emis:
        # Check EMI
        if item.emi_due_date and today <= item.emi_due_date <= target_date:
            days_left = (item.emi_due_date - today).days
            title = f"💳 EMI Due: {item.vehicle_number}"
            body = f"EMI of ₹{item.emi_amount:,.0f} is due in {days_left} day(s) on {item.emi_due_date}."
            send_expo_push_notification(push_tokens, title, body, {"screen": "ComplianceVault", "id": item.id})
            alerts_triggered.append({"vehicle": item.vehicle_number, "type": "EMI", "days_left": days_left})
            
        # Check Insurance
        if item.insurance_expiry and today <= item.insurance_expiry <= target_date:
            days_left = (item.insurance_expiry - today).days
            title = f"🛡️ Insurance Expiring: {item.vehicle_number}"
            body = f"Vehicle insurance policy expires in {days_left} day(s) on {item.insurance_expiry}."
            send_expo_push_notification(push_tokens, title, body, {"screen": "ComplianceVault", "id": item.id})
            alerts_triggered.append({"vehicle": item.vehicle_number, "type": "INSURANCE", "days_left": days_left})

        # Check Fitness
        if item.fitness_expiry and today <= item.fitness_expiry <= target_date:
            days_left = (item.fitness_expiry - today).days
            title = f"📋 Fitness Expiring: {item.vehicle_number}"
            body = f"Fitness certificate expires in {days_left} day(s) on {item.fitness_expiry}."
            send_expo_push_notification(push_tokens, title, body, {"screen": "ComplianceVault", "id": item.id})
            alerts_triggered.append({"vehicle": item.vehicle_number, "type": "FITNESS", "days_left": days_left})
            
    return {
        "message": f"Processed compliance alerts. {len(alerts_triggered)} alert(s) sent.",
        "recipients_count": len(push_tokens),
        "alerts": alerts_triggered
    }

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

    # INTEGRATION: Daily Ledger (Trip Income) - Only if not already logged
    import datetime
    existing_daily = db.query(DailyLedger).filter(
        DailyLedger.reference_id == trip.id,
        DailyLedger.reference_type == "TRIP",
        DailyLedger.category.in_(["TRIP_INCOME", "TRIP_EXPENSE"])
    ).first()
    if not existing_daily:
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

@router.post("/trigger-scheduled-alerts")
def manual_trigger_scheduled_alerts(
    current_user: User = Depends(dependencies.get_current_active_user)
):
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    from services.push_service import send_scheduled_compliance_push_notifications
    return send_scheduled_compliance_push_notifications()

# --- VEHICLE TYRES MANAGEMENT ---
@router.get("/tyres", response_model=List[schemas.workforce.VehicleTyreResponse])
def get_tyres(
    site_id: Optional[int] = Query(None),
    vehicle_number: Optional[str] = Query(None),
    vehicle_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    query = db.query(VehicleTyreRecord)
    if site_id is not None:
        query = query.filter(VehicleTyreRecord.site_id == site_id)
    if vehicle_number:
        query = query.filter(VehicleTyreRecord.vehicle_number.ilike(f"%{vehicle_number.strip()}%"))
    if vehicle_id:
        query = query.filter(VehicleTyreRecord.vehicle_id == vehicle_id)
    return query.order_by(VehicleTyreRecord.purchase_date.desc(), VehicleTyreRecord.id.desc()).all()

@router.post("/tyres", response_model=schemas.workforce.VehicleTyreResponse)
def create_tyre(
    tyre: schemas.workforce.VehicleTyreCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    data = tyre.model_dump()
    if not data.get("site_id"):
        data["site_id"] = 1
    # Check if vehicle exists in EMI vault to link vehicle_id
    if not data.get("vehicle_id") and data.get("vehicle_number"):
        veh = db.query(VehicleEMI).filter(VehicleEMI.vehicle_number == data["vehicle_number"]).first()
        if veh:
            data["vehicle_id"] = veh.id

    new_tyre = VehicleTyreRecord(**data)
    db.add(new_tyre)
    db.commit()
    db.refresh(new_tyre)
    return new_tyre

@router.post("/tyres/batch", response_model=List[schemas.workforce.VehicleTyreResponse])
def create_tyres_batch(
    payload: schemas.workforce.VehicleTyresBatchCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    site_id = payload.site_id or 1
    vehicle_number = payload.vehicle_number.strip().upper()
    vehicle_id = payload.vehicle_id

    if not vehicle_id:
        veh = db.query(VehicleEMI).filter(VehicleEMI.vehicle_number == vehicle_number).first()
        if veh:
            vehicle_id = veh.id

    created_records = []
    for item in payload.tyres:
        t_data = item.model_dump()
        t_purchase_date = t_data.get("purchase_date") or payload.purchase_date or datetime.date.today()
        
        new_tyre = VehicleTyreRecord(
            site_id=site_id,
            vehicle_id=vehicle_id,
            vehicle_number=vehicle_number,
            purchase_date=t_purchase_date,
            serial_number=t_data.get("serial_number", "").strip(),
            tyre_position=t_data.get("tyre_position"),
            brand_model=t_data.get("brand_model"),
            purchase_cost=t_data.get("purchase_cost", 0.0),
            odometer_at_fitting=t_data.get("odometer_at_fitting", 0.0),
            status=t_data.get("status", "FITTED"),
            notes=t_data.get("notes")
        )
        db.add(new_tyre)
        created_records.append(new_tyre)

    db.commit()
    for rec in created_records:
        db.refresh(rec)
    return created_records

@router.patch("/tyres/{tyre_id}", response_model=schemas.workforce.VehicleTyreResponse)
def update_tyre(
    tyre_id: int,
    tyre_update: schemas.workforce.VehicleTyreUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    tyre_rec = db.query(VehicleTyreRecord).filter(VehicleTyreRecord.id == tyre_id).first()
    if not tyre_rec:
        raise HTTPException(status_code=404, detail="Tyre record not found")

    update_data = tyre_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tyre_rec, key, value)

    db.commit()
    db.refresh(tyre_rec)
    return tyre_rec

@router.delete("/tyres/{tyre_id}")
def delete_tyre(
    tyre_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    tyre_rec = db.query(VehicleTyreRecord).filter(VehicleTyreRecord.id == tyre_id).first()
    if not tyre_rec:
        raise HTTPException(status_code=404, detail="Tyre record not found")

    db.delete(tyre_rec)
    db.commit()
    return {"message": "Tyre record deleted successfully", "id": tyre_id}



