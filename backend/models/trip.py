from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime
from database import Base

class TripLog(Base):
    __tablename__ = "trip_logs"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"))
    
    # Machinery Details
    vehicle_number = Column(String(50), index=True)
    origin = Column(String(255), nullable=True)
    destination = Column(String(255), nullable=True)
    material_type = Column(String(100))
    weight_tons = Column(Float)
    
    # Logbook
    start_meter_reading = Column(Float, nullable=True, default=0.0)
    end_meter_reading = Column(Float, nullable=True, default=0.0)
    total_km = Column(Float, nullable=True, default=0.0) # Calculated backend-side or app-side
    
    # Fuel Tracking
    diesel_liters = Column(Float, default=0.0)
    diesel_cost = Column(Float, default=0.0)
    
    # Pictures (Base64 Strings for MVP)
    loading_photo_url = Column(Text, nullable=True)
    unloading_photo_url = Column(Text, nullable=True)
    odometer_photo_url = Column(Text, nullable=True)
    receipt_photo_url = Column(Text, nullable=True)
    
    # Status & Freight Accounting
    status = Column(String(20), default="PENDING") # PENDING, VALIDATED
    bhada = Column(Float, default=0.0) # Total Freight
    advance_freight_received = Column(Float, default=0.0) # Received at loading
    pending_freight = Column(Float, default=0.0) # Remaining to be collected
    freight_status = Column(String(20), default="PENDING") # PENDING, PARTIAL, PAID
    freight_notes = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationship
    staff = relationship("User", backref="trips")
    site = relationship("Site", backref="trip_logs")

