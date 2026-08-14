import sys
import os
from fastapi.testclient import TestClient

from main import app
from models.user import User
from core.security import create_access_token
from sqlalchemy.orm import sessionmaker
from database import engine

Session = sessionmaker(bind=engine)
session = Session()
user = session.query(User).first()
token = create_access_token(data={"sub": user.username})
session.close()

client = TestClient(app)
try:
    response = client.get("/workforce/daily-ledger?month=3&year=2026", headers={"Authorization": f"Bearer {token}"})
    print("STATUS:", response.status_code)
    print("TEXT:", response.text)
except Exception as e:
    import traceback
    with open("error_log.txt", "w") as f:
        traceback.print_exc(file=f)
    print("Error saved to error_log.txt")
