from pydantic import BaseModel
from typing import Optional, List
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
    staff_name: Optional[str] = None
    staff_designation: Optional[str] = None
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
    staff_name: Optional[str] = None
    staff_designation: Optional[str] = None
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
    staff_name: Optional[str] = None
    staff_designation: Optional[str] = None
    class Config: from_attributes = True

# VEHICLE REPAIRS & MAINTENANCE REQUESTS
class VehicleRepairBase(BaseModel):
    staff_id: Optional[int] = None
    vehicle_number: str
    issue_description: str
    estimated_cost: Optional[float] = 0.0
    actual_cost: Optional[float] = 0.0
    receipt_photo_url: Optional[str] = None
    admin_notes: Optional[str] = None
    site_id: Optional[int] = 1

class VehicleRepairCreate(VehicleRepairBase):
    pass

class VehicleRepairUpdateStatus(BaseModel):
    status: str # APPROVED, REJECTED, COMPLETED
    actual_cost: Optional[float] = None
    admin_notes: Optional[str] = None

class VehicleRepairResponse(VehicleRepairBase):
    id: int
    status: str
    created_at: datetime.datetime
    staff_name: Optional[str] = None
    staff_designation: Optional[str] = None
    class Config: from_attributes = True

# VEHICLES EMI & COMPLIANCE VAULT
class VehicleEMIBase(BaseModel):
    vehicle_number: str
    registration_date: Optional[datetime.date] = None
    permit_valid_upto: Optional[datetime.date] = None
    permit_fee: Optional[float] = 0.0
    emi_amount: Optional[float] = 0.0
    emi_due_date: Optional[datetime.date] = None
    insurance_expiry: Optional[datetime.date] = None
    insurance_premium: Optional[float] = 0.0
    fitness_expiry: Optional[datetime.date] = None
    fitness_fee: Optional[float] = 0.0
    road_tax_expiry: Optional[datetime.date] = None
    road_tax_amount: Optional[float] = 0.0
    pucc_expiry: Optional[datetime.date] = None
    pucc_fee: Optional[float] = 0.0
    financier: Optional[str] = None
    notes: Optional[str] = None
    document_url: Optional[str] = None
    site_id: Optional[int] = 1

class VehicleEMICreate(VehicleEMIBase):
    pass

class VehicleEMIUpdate(BaseModel):
    vehicle_number: Optional[str] = None
    registration_date: Optional[datetime.date] = None
    permit_valid_upto: Optional[datetime.date] = None
    permit_fee: Optional[float] = None
    emi_amount: Optional[float] = None
    emi_due_date: Optional[datetime.date] = None
    insurance_expiry: Optional[datetime.date] = None
    insurance_premium: Optional[float] = None
    fitness_expiry: Optional[datetime.date] = None
    fitness_fee: Optional[float] = None
    road_tax_expiry: Optional[datetime.date] = None
    road_tax_amount: Optional[float] = None
    pucc_expiry: Optional[datetime.date] = None
    pucc_fee: Optional[float] = None
    financier: Optional[str] = None
    notes: Optional[str] = None
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

# VEHICLE TYRES MANAGEMENT
class VehicleTyreItemCreate(BaseModel):
    serial_number: str
    purchase_date: Optional[datetime.date] = None
    tyre_position: Optional[str] = None
    brand_model: Optional[str] = None
    purchase_cost: Optional[float] = 0.0
    odometer_at_fitting: Optional[float] = 0.0
    status: Optional[str] = "FITTED"
    notes: Optional[str] = None

class VehicleTyresBatchCreate(BaseModel):
    vehicle_number: str
    vehicle_id: Optional[int] = None
    site_id: Optional[int] = 1
    purchase_date: Optional[datetime.date] = None
    tyres: List[VehicleTyreItemCreate]

class VehicleTyreCreate(BaseModel):
    vehicle_number: str
    vehicle_id: Optional[int] = None
    site_id: Optional[int] = 1
    serial_number: str
    purchase_date: Optional[datetime.date] = None
    tyre_position: Optional[str] = None
    brand_model: Optional[str] = None
    purchase_cost: Optional[float] = 0.0
    odometer_at_fitting: Optional[float] = 0.0
    status: Optional[str] = "FITTED"
    notes: Optional[str] = None

class VehicleTyreUpdate(BaseModel):
    vehicle_number: Optional[str] = None
    vehicle_id: Optional[int] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[datetime.date] = None
    tyre_position: Optional[str] = None
    brand_model: Optional[str] = None
    purchase_cost: Optional[float] = None
    odometer_at_fitting: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    site_id: Optional[int] = None

class VehicleTyreResponse(BaseModel):
    id: int
    site_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    vehicle_number: str
    purchase_date: Optional[datetime.date] = None
    serial_number: str
    tyre_position: Optional[str] = None
    brand_model: Optional[str] = None
    purchase_cost: Optional[float] = 0.0
    odometer_at_fitting: Optional[float] = 0.0
    status: Optional[str] = "FITTED"
    notes: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    class Config: from_attributes = True



