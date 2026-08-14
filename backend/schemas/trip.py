from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TripLogBase(BaseModel):
    vehicle_number: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    material_type: str
    weight_tons: float
    start_meter_reading: float
    end_meter_reading: float
    diesel_liters: Optional[float] = 0.0
    diesel_cost: Optional[float] = 0.0
    site_id: Optional[int] = 1
    
    # In a real app with file uploads, these might not be in the initial JSON payload
    loading_photo_url: Optional[str] = None
    unloading_photo_url: Optional[str] = None
    odometer_photo_url: Optional[str] = None
    receipt_photo_url: Optional[str] = None
    bhada: Optional[float] = 0.0

class TripLogCreate(TripLogBase):
    staff_id: Optional[int] = None # Admin can specify a staff member

class TripLogResponse(TripLogBase):
    id: int
    staff_id: int
    site_id: Optional[int] = 1
    total_km: float
    status: str
    bhada: float
    created_at: datetime
    
    class Config:
        from_attributes = True


class TripLogUpdateStatus(BaseModel):
    status: str # e.g. "VALIDATED", "REJECTED"
    bhada: Optional[float] = None
