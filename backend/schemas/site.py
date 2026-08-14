from pydantic import BaseModel
from typing import Optional
import datetime

class SiteBase(BaseModel):
    name: str
    location: Optional[str] = None
    code: Optional[str] = None
    status: Optional[str] = "ACTIVE"

class SiteCreate(SiteBase):
    pass

class SiteUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    code: Optional[str] = None
    status: Optional[str] = None

class SiteResponse(SiteBase):
    id: int
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

