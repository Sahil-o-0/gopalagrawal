from pydantic import BaseModel
from typing import Optional
from models.user import UserRole
import datetime

class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: UserRole = UserRole.STAFF
    is_active: bool = True
    site_id: Optional[int] = 1
    
    # New fields requested by user
    designation: Optional[str] = None
    profile_photo_url: Optional[str] = None
    aadhar_id: Optional[str] = None
    address: Optional[str] = None
    relative_name: Optional[str] = None
    relative_relation: Optional[str] = None
    relative_phone_number: Optional[str] = None
    opening_balance: Optional[float] = 0.0
    salary: Optional[float] = 0.0
    starting_date: Optional[datetime.date] = None
    employment_type: Optional[str] = "PERMANENT"
    aadhar_front_url: Optional[str] = None
    aadhar_back_url: Optional[str] = None
    
    created_at: Optional[datetime.datetime] = None
    created_by: Optional[str] = None
    employee_of: Optional[str] = "DEPARTMENTAL"
    department: Optional[str] = None
    employee_id_custom: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    site_id: Optional[int] = None

    designation: Optional[str] = None
    profile_photo_url: Optional[str] = None
    aadhar_id: Optional[str] = None
    address: Optional[str] = None
    relative_name: Optional[str] = None
    relative_relation: Optional[str] = None
    relative_phone_number: Optional[str] = None
    opening_balance: Optional[float] = None
    salary: Optional[float] = None
    starting_date: Optional[datetime.date] = None
    employment_type: Optional[str] = None
    aadhar_front_url: Optional[str] = None
    aadhar_back_url: Optional[str] = None
    
    created_at: Optional[datetime.datetime] = None
    created_by: Optional[str] = None
    employee_of: Optional[str] = None
    department: Optional[str] = None
    employee_id_custom: Optional[str] = None

class UserResponse(UserBase):
    id: int
    site_id: Optional[int] = 1

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: str | None = None


# DESIGNATION SCHEMAS
class DesignationBase(BaseModel):
    name: str
    category: str

class DesignationCreate(DesignationBase):
    pass

class DesignationResponse(DesignationBase):
    id: int
    class Config:
        from_attributes = True

