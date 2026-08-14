from database import SessionLocal, engine, Base
from models.user import User, UserRole
from core.security import get_password_hash

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def seed_users():
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
    
    db.commit()

if __name__ == "__main__":
    seed_users()
    db.close()
    print("Database seeding complete!")
