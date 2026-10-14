import os
import sys
from database import engine, Base
from models.client import Client, ClientTransaction

def run_migration():
    print("[Migration] Creating clients and client_transactions tables...")
    try:
        Base.metadata.create_all(bind=engine, tables=[Client.__table__, ClientTransaction.__table__])
        print("[Migration] Success: clients and client_transactions tables verified/created.")
    except Exception as e:
        print(f"[Migration Error] {e}")

if __name__ == "__main__":
    run_migration()
