"""
E2E Test Harness Configuration and Fixtures for Fleet & Workforce Management.
"""

import sys
import os
import datetime
import pytest

# Ensure backend directory and venv site-packages are in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
venv_site_packages = os.path.join(backend_dir, "venv", "Lib", "site-packages")
if os.path.exists(venv_site_packages) and venv_site_packages not in sys.path:
    sys.path.insert(0, venv_site_packages)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from database import Base, get_db
import dependencies
from main import app

from models.user import User, UserRole
from models.trip import TripLog
from models.workforce import (
    Attendance, AttendanceType, LeaveRequest, AdvanceWageRequest,
    VehicleEMI, FinancialLedger, StaffLedger, DailyLedger
)
from core.security import get_password_hash, create_access_token

# Define Site model if not already defined in backend.models.site
try:
    from models.site import Site
except ImportError:
    class Site(Base):
        __tablename__ = "sites"

        id = Column(Integer, primary_key=True, index=True)
        name = Column(String(100), nullable=False)
        location = Column(String(255), nullable=True)
        code = Column(String(50), unique=True, index=True, nullable=False)
        status = Column(String(20), default="ACTIVE")
        created_at = Column(DateTime, default=datetime.datetime.utcnow)


# --- DB SEED HELPERS ---

def seed_default_site(db: Session) -> Site:
    """Ensure default site (id=1, 'Main Site / HQ', code='SITE-001') is seeded."""
    existing = db.query(Site).filter(Site.id == 1).first()
    if not existing:
        seed_site = Site(
            id=1,
            name="Main Site / HQ",
            location="Headquarters",
            code="SITE-001",
            status="ACTIVE"
        )
        db.add(seed_site)
        db.commit()
        db.refresh(seed_site)
        return seed_site
    return existing


def seed_default_users(db: Session) -> dict:
    """Ensure default users (admin, manager, staff) exist in DB."""
    users_spec = [
        {"username": "admin", "password": "admin123", "role": UserRole.ADMIN, "full_name": "System Administrator"},
        {"username": "manager", "password": "manager123", "role": UserRole.MANAGER, "full_name": "Site Manager"},
        {"username": "staff", "password": "staff123", "role": UserRole.STAFF, "full_name": "Field Worker"},
    ]
    created = {}
    for spec in users_spec:
        user = db.query(User).filter(User.username == spec["username"]).first()
        if not user:
            user = User(
                username=spec["username"],
                hashed_password=get_password_hash(spec["password"]),
                role=spec["role"],
                full_name=spec["full_name"],
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        created[spec["username"]] = user
    return created


# --- FIXTURES ---

@pytest.fixture(scope="function")
def db_session():
    """Isolated SQLite in-memory test database fixture."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    seed_default_site(session)
    seed_default_users(session)

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient fixture with DB dependency override."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[dependencies.get_db] = _override_get_db
    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


# --- AUTHENTICATION HEADER HELPERS ---

def make_auth_headers(username: str, role: str) -> dict:
    role_str = role.value if hasattr(role, "value") else str(role)
    token = create_access_token(data={"sub": username, "role": role_str})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers():
    return make_auth_headers("admin", UserRole.ADMIN)


@pytest.fixture
def manager_auth_headers():
    return make_auth_headers("manager", UserRole.MANAGER)


@pytest.fixture
def staff_auth_headers():
    return make_auth_headers("staff", UserRole.STAFF)


# --- DOMAIN HELPER UTILITIES ---

class E2EHelpers:
    """Helper utilities for creating domain entities during testing."""

    @staticmethod
    def create_site(db: Session, name="Test Site", location="Zone A", code=None, status="ACTIVE") -> Site:
        if code is None:
            code = f"SITE-{datetime.datetime.now().microsecond}"
        site = Site(name=name, location=location, code=code, status=status)
        db.add(site)
        db.commit()
        db.refresh(site)
        return site

    @staticmethod
    def create_user(db: Session, username="test_user", password="password123", role=UserRole.STAFF, full_name="Test User") -> User:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user = User(
                username=username,
                hashed_password=get_password_hash(password),
                role=role,
                full_name=full_name,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def create_trip_log(db: Session, staff_id: int, vehicle_number="KA-01-EQ-100", site_id=1, **kwargs) -> TripLog:
        init_kwargs = {
            "staff_id": staff_id,
            "vehicle_number": vehicle_number,
            "origin": kwargs.get("origin", "Quarry A"),
            "destination": kwargs.get("destination", "Plant B"),
            "material_type": kwargs.get("material_type", "Coal"),
            "weight_tons": kwargs.get("weight_tons", 10.0),
            "start_meter_reading": kwargs.get("start_meter_reading", 100.0),
            "end_meter_reading": kwargs.get("end_meter_reading", 150.0),
            "total_km": kwargs.get("total_km", 50.0),
            "diesel_liters": kwargs.get("diesel_liters", 20.0),
            "diesel_cost": kwargs.get("diesel_cost", 1800.0),
            "status": kwargs.get("status", "PENDING"),
            "bhada": kwargs.get("bhada", 5000.0)
        }
        if hasattr(TripLog, "site_id"):
            init_kwargs["site_id"] = site_id

        trip = TripLog(**init_kwargs)
        if hasattr(trip, "site_id"):
            setattr(trip, "site_id", site_id)

        db.add(trip)
        db.commit()
        db.refresh(trip)
        return trip

    @staticmethod
    def create_daily_ledger_entry(db: Session, site_id=1, amount=1000.0, transaction_type="INCOME", category="TRIP_INCOME", description="Logistics payment", entry_date=None, **kwargs) -> DailyLedger:
        if entry_date is None:
            entry_date = datetime.date.today()

        init_kwargs = {
            "date": entry_date,
            "transaction_type": transaction_type,
            "category": category,
            "amount": amount,
            "description": description,
            "reference_id": kwargs.get("reference_id"),
            "reference_type": kwargs.get("reference_type")
        }
        if hasattr(DailyLedger, "site_id"):
            init_kwargs["site_id"] = site_id

        entry = DailyLedger(**init_kwargs)
        if hasattr(entry, "site_id"):
            setattr(entry, "site_id", site_id)

        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def create_attendance_entry(db: Session, staff_id: int, site_id=1, status=AttendanceType.PRESENT, att_date=None, recorded_by_id=None, notes=None, **kwargs) -> Attendance:
        if att_date is None:
            att_date = datetime.date.today()

        init_kwargs = {
            "staff_id": staff_id,
            "recorded_by_id": recorded_by_id,
            "date": att_date,
            "status": status,
            "notes": notes
        }
        if hasattr(Attendance, "site_id"):
            init_kwargs["site_id"] = site_id

        att = Attendance(**init_kwargs)
        if hasattr(att, "site_id"):
            setattr(att, "site_id", site_id)

        db.add(att)
        db.commit()
        db.refresh(att)
        return att

    @staticmethod
    def create_leave_request(db: Session, staff_id: int, site_id=1, start_date=None, end_date=None, reason="Medical leave", status="PENDING", **kwargs) -> LeaveRequest:
        if start_date is None:
            start_date = datetime.date.today()
        if end_date is None:
            end_date = datetime.date.today() + datetime.timedelta(days=2)

        init_kwargs = {
            "staff_id": staff_id,
            "start_date": start_date,
            "end_date": end_date,
            "reason": reason,
            "status": status
        }
        if hasattr(LeaveRequest, "site_id"):
            init_kwargs["site_id"] = site_id

        leave = LeaveRequest(**init_kwargs)
        if hasattr(leave, "site_id"):
            setattr(leave, "site_id", site_id)

        db.add(leave)
        db.commit()
        db.refresh(leave)
        return leave

    @staticmethod
    def create_advance_request(db: Session, staff_id: int, site_id=1, amount=500.0, reason="Festival advance", status="PENDING", **kwargs) -> AdvanceWageRequest:
        init_kwargs = {
            "staff_id": staff_id,
            "amount": amount,
            "reason": reason,
            "status": status
        }
        if hasattr(AdvanceWageRequest, "site_id"):
            init_kwargs["site_id"] = site_id

        adv = AdvanceWageRequest(**init_kwargs)
        if hasattr(adv, "site_id"):
            setattr(adv, "site_id", site_id)

        db.add(adv)
        db.commit()
        db.refresh(adv)
        return adv

    @staticmethod
    def create_vehicle_emi(db: Session, vehicle_number="KA-01-EQ-100", emi_amount=15000.0, site_id=1, emi_due_date=None, **kwargs) -> VehicleEMI:
        if emi_due_date is None:
            emi_due_date = datetime.date.today() + datetime.timedelta(days=15)

        init_kwargs = {
            "vehicle_number": vehicle_number,
            "emi_amount": emi_amount,
            "emi_due_date": emi_due_date,
            "document_url": kwargs.get("document_url")
        }
        if hasattr(VehicleEMI, "site_id"):
            init_kwargs["site_id"] = site_id

        emi = VehicleEMI(**init_kwargs)
        if hasattr(emi, "site_id"):
            setattr(emi, "site_id", site_id)

        db.add(emi)
        db.commit()
        db.refresh(emi)
        return emi

    @staticmethod
    def create_staff_ledger_entry(db: Session, staff_id: int, site_id=1, amount=5000.0, transaction_type="SALARY", description="Monthly payout", entry_date=None, **kwargs) -> StaffLedger:
        if entry_date is None:
            entry_date = datetime.date.today()

        init_kwargs = {
            "staff_id": staff_id,
            "amount": amount,
            "transaction_type": transaction_type,
            "description": description,
            "date": entry_date
        }
        if hasattr(StaffLedger, "site_id"):
            init_kwargs["site_id"] = site_id

        entry = StaffLedger(**init_kwargs)
        if hasattr(entry, "site_id"):
            setattr(entry, "site_id", site_id)

        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry


@pytest.fixture
def helpers():
    """Fixture providing access to E2E domain object creation helpers."""
    return E2EHelpers
