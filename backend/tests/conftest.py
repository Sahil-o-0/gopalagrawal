import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import models
from database import Base
from main import app
from dependencies import get_db
from core.security import get_password_hash, create_access_token

TEST_DATABASE_URL = "sqlite:///./test_fleet.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    # Run migration logic to ensure sites table and site_id columns are populated
    from migrate_add_site_id import migrate_database
    migrate_database("./test_fleet.db")
    
    yield
    
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    if os.path.exists("./test_fleet.db"):
        try:
            os.remove("./test_fleet.db")
        except PermissionError:
            pass


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def seed_sites(db_session):
    # Default Site 1 (Main Site) is created by migration. Let's ensure Site 2 exists.
    site2 = db_session.query(models.site.Site).filter(models.site.Site.id == 2).first()
    if not site2:
        site2 = models.site.Site(
            id=2,
            name="North Quarry Site",
            location="North Region",
            code="NQ_SITE",
            status="ACTIVE"
        )
        db_session.add(site2)
        db_session.commit()
    return [db_session.query(models.site.Site).get(1), site2]

@pytest.fixture
def admin_headers(db_session, seed_sites):
    admin = db_session.query(models.user.User).filter(models.user.User.username == "admin_test").first()
    if not admin:
        admin = models.user.User(
            username="admin_test",
            hashed_password=get_password_hash("password123"),
            role="ADMIN",
            site_id=1
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)
    token = create_access_token(data={"sub": admin.username, "role": "ADMIN"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def manager_headers(db_session, seed_sites):
    manager = db_session.query(models.user.User).filter(models.user.User.username == "manager_test").first()
    if not manager:
        manager = models.user.User(
            username="manager_test",
            hashed_password=get_password_hash("password123"),
            role="MANAGER",
            site_id=1
        )
        db_session.add(manager)
        db_session.commit()
        db_session.refresh(manager)
    token = create_access_token(data={"sub": manager.username, "role": "MANAGER"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def staff_headers(db_session, seed_sites):
    staff = db_session.query(models.user.User).filter(models.user.User.username == "staff_test").first()
    if not staff:
        staff = models.user.User(
            username="staff_test",
            hashed_password=get_password_hash("password123"),
            role="STAFF",
            site_id=1
        )
        db_session.add(staff)
        db_session.commit()
        db_session.refresh(staff)
    token = create_access_token(data={"sub": staff.username, "role": "STAFF"})
    return {"Authorization": f"Bearer {token}"}
