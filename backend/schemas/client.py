from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_balance: Optional[float] = 0.0
    site_id: Optional[int] = None
    display_order: Optional[int] = 0

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    opening_balance: Optional[float] = None
    site_id: Optional[int] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class ClientTransactionBase(BaseModel):
    txn_type: str  # BILLED, RECEIVED, ADVANCE
    amount: float
    date: str      # YYYY-MM-DD
    payment_mode: Optional[str] = "CASH"
    notes: Optional[str] = None

class ClientTransactionCreate(ClientTransactionBase):
    client_id: int

class ClientTransactionUpdate(BaseModel):
    txn_type: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    payment_mode: Optional[str] = None
    notes: Optional[str] = None

class ClientTransactionResponse(ClientTransactionBase):
    id: int
    client_id: int
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True

class ClientResponse(ClientBase):
    id: int
    is_active: bool
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    billed: Optional[float] = 0.0
    received: Optional[float] = 0.0
    pending_balance: Optional[float] = 0.0
    txns_count: Optional[int] = 0

    class Config:
        from_attributes = True

class ClientReorderItem(BaseModel):
    id: int
    display_order: int

class ClientReorderRequest(BaseModel):
    orders: List[ClientReorderItem]
