from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
import datetime
import enum
from database import Base

class AttendanceType(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    HALF_DAY = "HALF_DAY"
    ON_LEAVE = "ON_LEAVE"

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Null if self-marked
    
    date = Column(Date, default=datetime.date.today, index=True)
    status = Column(Enum(AttendanceType), default=AttendanceType.PRESENT)
    notes = Column(String(255), nullable=True)
    
    # Punch Clock & Face Verification Fields
    punch_in_time = Column(DateTime, nullable=True)
    punch_out_time = Column(DateTime, nullable=True)
    punch_in_photo_url = Column(Text, nullable=True)
    punch_out_photo_url = Column(Text, nullable=True)
    punch_in_location = Column(String(100), nullable=True)
    punch_out_location = Column(String(100), nullable=True)
    hours_worked = Column(Float, default=0.0, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    staff = relationship("User", foreign_keys=[staff_id], backref="attendance_records")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    site = relationship("Site", backref="attendance_records")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(Date)
    end_date = Column(Date)
    reason = Column(String(255))
    status = Column(String(20), default="PENDING") # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    staff = relationship("User", backref="leave_requests")
    site = relationship("Site", backref="leave_requests")

class AdvanceWageRequest(Base):
    __tablename__ = "advance_requests"
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    reason = Column(String(255))
    status = Column(String(20), default="PENDING") # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    staff = relationship("User", backref="advance_requests")
    site = relationship("Site", backref="advance_requests")

class VehicleEMI(Base):
    __tablename__ = "vehicle_emi"
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    vehicle_number = Column(String(50), index=True)
    emi_amount = Column(Float)
    emi_due_date = Column(Date)
    document_url = Column(Text, nullable=True) # PDF or Img base64/URL
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    site = relationship("Site", backref="vehicle_emis")

class FinancialLedger(Base):
    """Tracks overall financial calculations (Profit, Pending EMI, Payments) for a specific Trip"""
    __tablename__ = "financial_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    trip_id = Column(Integer, ForeignKey("trip_logs.id"), unique=True)
    
    total_amount_billed = Column(Float, default=0.0)
    amount_received = Column(Float, default=0.0)
    amount_pending = Column(Float, default=0.0)
    
    emi_due_date = Column(Date, nullable=True)
    insurance_expiry_date = Column(Date, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    trip = relationship("TripLog", backref="ledger")
    site = relationship("Site", backref="financial_ledgers")

class StaffLedger(Base):
    """Daily or Individual transactions for Staff (Salary, Advances, Payments)"""
    __tablename__ = "staff_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    amount = Column(Float, nullable=False) # Positive for Addition (Salary), Negative for Deduction (Advance)
    transaction_type = Column(String(20), index=True) # SALARY, ADVANCE, PAYMENT, ADJUSTMENT
    description = Column(String(255), nullable=True)
    date = Column(Date, default=datetime.date.today, index=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    staff = relationship("User", backref="ledger_entries")
    site = relationship("Site", backref="staff_ledgers")

class DailyLedger(Base):
    """Overall business cash flow (Income/Expense) for the entire operation"""
    __tablename__ = "daily_ledger"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    date = Column(Date, default=datetime.date.today, index=True)
    
    transaction_type = Column(String(20), index=True) # INCOME, EXPENSE
    category = Column(String(50), index=True) # TRIP_INCOME, SALARY, ADVANCE, FUEL, MAINTENANCE, MANUAL, etc.
    amount = Column(Float, nullable=False)
    description = Column(String(255), nullable=True)
    
    # Optional references
    reference_id = Column(Integer, nullable=True) # TripLog ID or StaffLedger ID
    reference_type = Column(String(50), nullable=True) # TRIP, STAFF_LEDGER
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    site = relationship("Site", backref="daily_ledgers")

