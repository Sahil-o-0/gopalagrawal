from pydantic import BaseModel
from typing import Optional
import datetime
from .trip import TripLogResponse

# ATTENDANCE
class AttendanceBase(BaseModel):
    staff_id: int
    date: Optional[datetime.date] = None # Defaults to today in DB
    status: str
    notes: Optional[str] = None
    site_id: Optional[int] = 1
    
    # New punch clock fields
    punch_in_time: Optional[datetime.datetime] = None
    punch_out_time: Optional[datetime.datetime] = None
    punch_in_photo_url: Optional[str] = None
    punch_out_photo_url: Optional[str] = None
    punch_in_location: Optional[str] = None
    punch_out_location: Optional[str] = None
    hours_worked: Optional[float] = 0.0

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    id: int
    recorded_by_id: Optional[int] = None
    created_at: datetime.datetime
    class Config: from_attributes = True

class PunchRequest(BaseModel):
    punch_type: str # "in" or "out"
    photo: str # base64
    notes: Optional[str] = None
    site_id: Optional[int] = None
    location: Optional[str] = None # coordinates e.g. "Lat: 22.3, Lon: 82.1"
    staff_id: Optional[int] = None

# LEAVES
class LeaveBase(BaseModel):
    staff_id: Optional[int] = None
    start_date: datetime.date
    end_date: datetime.date
    reason: str
    site_id: Optional[int] = 1

class LeaveCreate(LeaveBase):
    pass

class LeaveUpdateStatus(BaseModel):
    status: str

class LeaveResponse(LeaveBase):
    id: int
    status: str
    created_at: datetime.datetime
    class Config: from_attributes = True

# ADVANCE WAGES
class AdvanceBase(BaseModel):
    staff_id: Optional[int] = None
    amount: float
    reason: str
    site_id: Optional[int] = 1

class AdvanceCreate(AdvanceBase):
    pass

class AdvanceUpdateStatus(BaseModel):
    status: str

class AdvanceResponse(AdvanceBase):
    id: int
    status: str
    created_at: datetime.datetime
    class Config: from_attributes = True

# VEHICLES EMI
class VehicleEMIBase(BaseModel):
    vehicle_number: str
    emi_amount: float
    emi_due_date: datetime.date
    document_url: Optional[str] = None
    site_id: Optional[int] = 1

class VehicleEMICreate(VehicleEMIBase):
    pass

class VehicleEMIUpdate(BaseModel):
    vehicle_number: Optional[str] = None
    emi_amount: Optional[float] = None
    emi_due_date: Optional[datetime.date] = None
    document_url: Optional[str] = None
    site_id: Optional[int] = None

class VehicleEMIResponse(VehicleEMIBase):
    id: int
    created_at: datetime.datetime
    class Config: from_attributes = True

# FINANCIAL LEDGER
class FinancialLedgerBase(BaseModel):
    trip_id: int
    total_amount_billed: float
    amount_received: float
    emi_due_date: Optional[datetime.date] = None
    insurance_expiry_date: Optional[datetime.date] = None
    site_id: Optional[int] = 1

class FinancialLedgerCreate(FinancialLedgerBase):
    pass

class FinancialLedgerResponse(FinancialLedgerBase):
    id: int
    amount_pending: float
    created_at: datetime.datetime
    updated_at: datetime.datetime
    class Config: from_attributes = True

# STAFF LEDGER
class StaffLedgerBase(BaseModel):
    staff_id: Optional[int] = None
    amount: float
    transaction_type: str # SALARY, ADVANCE, PAYMENT, ADJUSTMENT
    description: Optional[str] = None
    date: Optional[datetime.date] = None
    site_id: Optional[int] = 1

class StaffLedgerCreate(StaffLedgerBase):
    pass

class StaffLedgerResponse(StaffLedgerBase):
    id: int
    created_at: datetime.datetime
    class Config: from_attributes = True

# DAILY LEDGER
class DailyLedgerBase(BaseModel):
    date: Optional[datetime.date] = None
    transaction_type: str # INCOME, EXPENSE
    category: str # TRIP_INCOME, SALARY, ADVANCE, FUEL, MAINTENANCE, MANUAL, etc.
    amount: float
    description: Optional[str] = None
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    site_id: Optional[int] = 1

class DailyLedgerCreate(DailyLedgerBase):
    pass

class DailyLedgerResponse(DailyLedgerBase):
    id: int
    created_at: datetime.datetime
    class Config: from_attributes = True


