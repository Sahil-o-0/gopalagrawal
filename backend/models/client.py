from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(255), nullable=True)
    opening_balance = Column(Float, default=0.0, nullable=False)
    display_order = Column(Integer, default=0, index=True)
    site_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_by = Column(String(100), nullable=True)

    transactions = relationship("ClientTransaction", back_populates="client", cascade="all, delete-orphan", order_by="desc(ClientTransaction.date)")

class ClientTransaction(Base):
    __tablename__ = "client_transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    txn_type = Column(String(20), nullable=False)  # BILLED, RECEIVED, ADVANCE
    amount = Column(Float, nullable=False)
    date = Column(String(50), nullable=False)      # YYYY-MM-DD
    payment_mode = Column(String(50), default="CASH", nullable=True)  # CASH, ONLINE, CHEQUE
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_by = Column(String(100), nullable=True)

    client = relationship("Client", back_populates="transactions")
