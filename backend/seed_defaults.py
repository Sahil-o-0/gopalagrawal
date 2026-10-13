from database import SessionLocal, engine, Base
import models
from models.user import User, UserRole
from models.site import Site
from core.security import get_password_hash

def run():
    print("Creating all tables via Base.metadata.create_all...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed users
        users = [
            {"username": "admin", "password": "123", "role": UserRole.ADMIN},
            {"username": "manager", "password": "123", "role": UserRole.MANAGER},
            {"username": "staff", "password": "123", "role": UserRole.STAFF},
        ]
        for u in users:
            if not db.query(User).filter(User.username == u["username"]).first():
                user = User(
                    username=u["username"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"]
                )
                db.add(user)
                print(f"Created {u['role']} user: {u['username']}")

        # Seed sites
        default_sites = [
            {"name": "Main Site / HQ", "code": "HQ-01", "location": "Headquarters Yard"},
            {"name": "North Quarry Site", "code": "NQ-02", "location": "North Sector"},
            {"name": "West Yard Site", "code": "WY-03", "location": "West Industrial Zone"},
        ]
        for s in default_sites:
            existing = db.query(Site).filter(Site.name == s["name"]).first()
            if not existing:
                site = Site(name=s["name"], code=s["code"], location=s["location"], status="ACTIVE")
                db.add(site)
                print(f"Created site: {s['name']}")

        db.commit()
        print("Seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    run()
