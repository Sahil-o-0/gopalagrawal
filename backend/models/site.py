from sqlalchemy import Column, Integer, String, DateTime
import datetime
from database import Base

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    location = Column(String(255), nullable=True)
    code = Column(String(50), unique=True, nullable=True)
    status = Column(String(20), default="ACTIVE", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
