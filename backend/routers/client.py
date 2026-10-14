from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, database, dependencies
from models.client import Client, ClientTransaction
from models.user import User
import datetime

router = APIRouter(
    prefix="/clients",
    tags=["Client Khata (Khatabook)"]
)

def compute_client_metrics(client: Client):
    txns = client.transactions or []
    billed = (client.opening_balance or 0.0)
    received = 0.0
    for t in txns:
        if t.txn_type == "BILLED":
            billed += (t.amount or 0.0)
        elif t.txn_type in ["RECEIVED", "ADVANCE"]:
            received += (t.amount or 0.0)
    pending = billed - received
    return {
        "billed": billed,
        "received": received,
        "pending_balance": pending,
        "txns_count": len(txns)
    }

@router.get("/", response_model=List[schemas.client.ClientResponse])
def get_all_clients(
    site_id: Optional[int] = None,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(Client).filter(Client.is_active == True)
    if site_id:
        query = query.filter((Client.site_id == site_id) | (Client.site_id == None))
    clients = query.order_by(Client.display_order.asc(), Client.id.asc()).all()

    result = []
    for c in clients:
        m = compute_client_metrics(c)
        c_dict = {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "address": c.address,
            "opening_balance": c.opening_balance,
            "display_order": c.display_order,
            "site_id": c.site_id,
            "is_active": c.is_active,
            "created_at": c.created_at,
            "created_by": c.created_by,
            "billed": m["billed"],
            "received": m["received"],
            "pending_balance": m["pending_balance"],
            "txns_count": m["txns_count"]
        }
        result.append(c_dict)
    return result

@router.post("/", response_model=schemas.client.ClientResponse)
def create_client(
    client_in: schemas.client.ClientCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    # Find current max display order
    max_order = db.query(Client.display_order).order_by(Client.display_order.desc()).first()
    new_order = (max_order[0] + 1) if max_order and max_order[0] is not None else 0

    new_client = Client(
        name=client_in.name.strip(),
        phone=client_in.phone.strip() if client_in.phone else None,
        address=client_in.address.strip() if client_in.address else None,
        opening_balance=client_in.opening_balance or 0.0,
        display_order=client_in.display_order if client_in.display_order is not None and client_in.display_order > 0 else new_order,
        site_id=client_in.site_id,
        is_active=True,
        created_at=datetime.datetime.utcnow(),
        created_by=current_user.full_name or current_user.username
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    m = compute_client_metrics(new_client)
    return {
        "id": new_client.id,
        "name": new_client.name,
        "phone": new_client.phone,
        "address": new_client.address,
        "opening_balance": new_client.opening_balance,
        "display_order": new_client.display_order,
        "site_id": new_client.site_id,
        "is_active": new_client.is_active,
        "created_at": new_client.created_at,
        "created_by": new_client.created_by,
        "billed": m["billed"],
        "received": m["received"],
        "pending_balance": m["pending_balance"],
        "txns_count": m["txns_count"]
    }

@router.put("/{client_id}", response_model=schemas.client.ClientResponse)
def update_client(
    client_id: int,
    client_in: schemas.client.ClientUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if client_in.name is not None:
        client.name = client_in.name.strip()
    if client_in.phone is not None:
        client.phone = client_in.phone.strip() if client_in.phone else None
    if client_in.address is not None:
        client.address = client_in.address.strip() if client_in.address else None
    if client_in.opening_balance is not None:
        client.opening_balance = client_in.opening_balance
    if client_in.site_id is not None:
        client.site_id = client_in.site_id
    if client_in.display_order is not None:
        client.display_order = client_in.display_order
    if client_in.is_active is not None:
        client.is_active = client_in.is_active

    db.commit()
    db.refresh(client)

    m = compute_client_metrics(client)
    return {
        "id": client.id,
        "name": client.name,
        "phone": client.phone,
        "address": client.address,
        "opening_balance": client.opening_balance,
        "display_order": client.display_order,
        "site_id": client.site_id,
        "is_active": client.is_active,
        "created_at": client.created_at,
        "created_by": client.created_by,
        "billed": m["billed"],
        "received": m["received"],
        "pending_balance": m["pending_balance"],
        "txns_count": m["txns_count"]
    }

@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    db.delete(client)
    db.commit()
    return {"message": f"Client {client_id} and associated transactions deleted successfully"}

@router.post("/reorder")
def reorder_clients(
    reorder_in: schemas.client.ClientReorderRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    for item in reorder_in.orders:
        db.query(Client).filter(Client.id == item.id).update({"display_order": item.display_order})
    db.commit()
    return {"message": "Client order updated successfully"}

# ----------------- Client Transactions Endpoints -----------------

@router.get("/{client_id}/transactions", response_model=List[schemas.client.ClientTransactionResponse])
def get_client_transactions(
    client_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    txns = db.query(ClientTransaction).filter(ClientTransaction.client_id == client_id).order_by(ClientTransaction.date.desc(), ClientTransaction.id.desc()).all()
    return txns

@router.get("/transactions/all", response_model=List[schemas.client.ClientTransactionResponse])
def get_all_transactions(
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    txns = db.query(ClientTransaction).order_by(ClientTransaction.date.desc(), ClientTransaction.id.desc()).all()
    return txns

@router.post("/transactions", response_model=schemas.client.ClientTransactionResponse)
def create_client_transaction(
    txn_in: schemas.client.ClientTransactionCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    client = db.query(Client).filter(Client.id == txn_in.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    new_txn = ClientTransaction(
        client_id=txn_in.client_id,
        txn_type=txn_in.txn_type.upper(),
        amount=float(txn_in.amount),
        date=txn_in.date,
        payment_mode=txn_in.payment_mode or "CASH",
        notes=txn_in.notes.strip() if txn_in.notes else None,
        created_at=datetime.datetime.utcnow(),
        created_by=current_user.full_name or current_user.username
    )
    db.add(new_txn)
    db.commit()
    db.refresh(new_txn)
    return new_txn

@router.put("/transactions/{txn_id}", response_model=schemas.client.ClientTransactionResponse)
def update_client_transaction(
    txn_id: int,
    txn_in: schemas.client.ClientTransactionUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    txn = db.query(ClientTransaction).filter(ClientTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn_in.txn_type is not None:
        txn.txn_type = txn_in.txn_type.upper()
    if txn_in.amount is not None:
        txn.amount = float(txn_in.amount)
    if txn_in.date is not None:
        txn.date = txn_in.date
    if txn_in.payment_mode is not None:
        txn.payment_mode = txn_in.payment_mode
    if txn_in.notes is not None:
        txn.notes = txn_in.notes.strip() if txn_in.notes else None

    db.commit()
    db.refresh(txn)
    return txn

@router.delete("/transactions/{txn_id}")
def delete_client_transaction(
    txn_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    txn = db.query(ClientTransaction).filter(ClientTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(txn)
    db.commit()
    return {"message": f"Transaction {txn_id} deleted successfully"}
