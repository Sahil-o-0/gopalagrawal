from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TripLogBase(BaseModel):
    vehicle_number: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    material_type: str
    weight_tons: float
    start_meter_reading: Optional[float] = 0.0
    end_meter_reading: Optional[float] = 0.0
    diesel_liters: Optional[float] = 0.0
    diesel_rate: Optional[float] = 0.0
    diesel_cost: Optional[float] = 0.0
    site_id: Optional[int] = 1
    
    loading_photo_url: Optional[str] = None
    unloading_photo_url: Optional[str] = None
    odometer_photo_url: Optional[str] = None
    receipt_photo_url: Optional[str] = None
    bhada: Optional[float] = 0.0
    advance_freight_received: Optional[float] = 0.0
    pending_freight: Optional[float] = 0.0
    freight_status: Optional[str] = "PENDING"
    freight_notes: Optional[str] = None

    # Trade, Client & Dispatch Integration
    trade_type: Optional[str] = "TRIP" # PURCHASE, SALE, TRIP
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    transporter_name: Optional[str] = None
    vehicle_source: Optional[str] = "OWN"
    rate_type: Optional[str] = "TON" # TON, TRIP, HOURLY
    rate: Optional[float] = 0.0

    # Optional Time Tracking
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_minutes: Optional[float] = 0.0
    hourly_rate: Optional[float] = 0.0

class TripLogCreate(TripLogBase):
    staff_id: Optional[int] = None # Admin can specify a staff member

class TripLogResponse(TripLogBase):
    id: int
    staff_id: Optional[int] = None
    site_id: Optional[int] = 1
    total_km: Optional[float] = 0.0
    status: str
    bhada: float
    advance_freight_received: float
    pending_freight: float
    freight_status: str
    freight_notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class TripLogUpdateStatus(BaseModel):
    status: str # e.g. "VALIDATED", "REJECTED"
    bhada: Optional[float] = None
    freight_notes: Optional[str] = None
    weight_tons: Optional[float] = None
    rate_type: Optional[str] = None
    rate: Optional[float] = None
    hourly_rate: Optional[float] = None
    total_minutes: Optional[float] = None

class TripCompleteDriver(BaseModel):
    start_meter_reading: float
    end_meter_reading: float
    loading_photo_url: Optional[str] = None
    unloading_photo_url: Optional[str] = None
    odometer_photo_url: Optional[str] = None
    receipt_photo_url: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_minutes: Optional[float] = 0.0
    diesel_liters: Optional[float] = 0.0
    diesel_rate: Optional[float] = 0.0
    diesel_cost: Optional[float] = 0.0

class TripFreightPayment(BaseModel):
    amount_paid: float
    notes: Optional[str] = None
    payment_mode: Optional[str] = "CASH" # CASH, BANK, UPI
