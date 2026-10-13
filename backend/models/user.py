from sqlalchemy import Column, Integer, String, Boolean, Enum, ForeignKey, Float, Text, Date, DateTime
from sqlalchemy.orm import relationship
import enum
from database import Base
import datetime

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    STAFF = "STAFF"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, default=1, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    phone_number = Column(String(15), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STAFF, nullable=False)
    is_active = Column(Boolean, default=True)

    # Expanded details requested by the user
    designation = Column(String(100), nullable=True) # basic role/title e.g. Driver, Loader, Supervisor
    profile_photo_url = Column(Text, nullable=True) # clicked photo
    aadhar_id = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    relative_name = Column(String(100), nullable=True)
    relative_relation = Column(String(50), nullable=True)
    relative_phone_number = Column(String(15), nullable=True)
    opening_balance = Column(Float, default=0.0, nullable=False)
    salary = Column(Float, default=0.0, nullable=False)
    starting_date = Column(Date, nullable=True)
    employment_type = Column(String(20), default="PERMANENT", nullable=False) # PERMANENT or TRIAL
    aadhar_front_url = Column(Text, nullable=True)
    aadhar_back_url = Column(Text, nullable=True)
    
    # Audit trail & Profile fields
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_by = Column(String(50), nullable=True)
    employee_of = Column(String(50), default="DEPARTMENTAL") # DEPARTMENTAL or CONTRACTOR
    department = Column(String(100), nullable=True)
    employee_id_custom = Column(String(50), nullable=True)
    assigned_vehicle = Column(String(255), nullable=True)
    expo_push_token = Column(String(255), nullable=True)

    site = relationship("Site", backref="users")


class Designation(Base):
    __tablename__ = "designations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(50), nullable=False, default="WORKER") # ADMIN, MANAGER, WORKER


class LoginOTP(Base):
    __tablename__ = "login_otps"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    otp_code = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    ip_address = Column(String(50), nullable=True)
    firebase_verification_id = Column(String(255), nullable=True)

    user = relationship("User", backref="login_otps")




