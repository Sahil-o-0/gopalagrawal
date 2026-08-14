from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Form, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, database, dependencies
from models.user import User
from core.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/register", response_model=schemas.user.UserResponse)
def register(user: schemas.user.UserCreate, db: Session = Depends(dependencies.get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        hashed_password=hashed_password,
        role=user.role,
        is_active=user.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.user.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(dependencies.get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user
    }

# --- ADMIN SIGNUP & USER MANAGEMENT ---

@router.post("/signup", response_model=schemas.user.UserResponse)
def signup_admin(
    username: str = Form(...),
    password: str = Form(...),
    secret_key: str = Form(...),
    db: Session = Depends(dependencies.get_db)
):
    if secret_key != "Pujyamalik3107@#":
        raise HTTPException(status_code=403, detail="Invalid admin secret key")
        
    db_user = db.query(User).filter(User.username == username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed_password = get_password_hash(password)
    new_user = User(
        username=username,
        hashed_password=hashed_password,
        role="ADMIN"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/users", response_model=List[schemas.user.UserResponse])
def get_all_users(
    skip: int = 0, limit: int = 100,
    site_id: Optional[int] = Query(None),
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    query = db.query(User)
    if site_id is not None:
        query = query.filter(User.site_id == site_id)
    users = query.offset(skip).limit(limit).all()
    return users

@router.post("/users", response_model=schemas.user.UserResponse)
def create_staff_manager_user(
    user: schemas.user.UserCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        full_name=user.full_name,
        phone_number=user.phone_number,
        hashed_password=hashed_password,
        role=user.role, # Allowed: STAFF, MANAGER
        site_id=user.site_id or 1,
        designation=user.designation,
        profile_photo_url=user.profile_photo_url,
        aadhar_id=user.aadhar_id,
        address=user.address,
        relative_name=user.relative_name,
        relative_relation=user.relative_relation,
        relative_phone_number=user.relative_phone_number,
        opening_balance=user.opening_balance or 0.0,
        salary=user.salary or 0.0,
        starting_date=user.starting_date,
        employment_type=user.employment_type or "PERMANENT",
        aadhar_front_url=user.aadhar_front_url,
        aadhar_back_url=user.aadhar_back_url,
        created_by=current_user.username
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user



@router.patch("/users/{user_id}", response_model=schemas.user.UserResponse)
def update_user(
    user_id: int,
    user_update: schemas.user.UserUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_data = user_update.model_dump(exclude_unset=True)
    
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
        
    for key, value in update_data.items():
        setattr(db_user, key, value)
        
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted"}


# --- DESIGNATION ENDPOINTS ---

@router.get("/designations/", response_model=List[schemas.user.DesignationResponse])
def get_designations(
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    from models.user import Designation
    return db.query(Designation).all()

@router.post("/designations/", response_model=schemas.user.DesignationResponse)
def create_designation(
    designation: schemas.user.DesignationCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    from models.user import Designation
    existing = db.query(Designation).filter(Designation.name == designation.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Designation already exists")
    
    new_desig = Designation(name=designation.name, category=designation.category)
    db.add(new_desig)
    db.commit()
    db.refresh(new_desig)
    return new_desig

@router.delete("/designations/{designation_id}/")
def delete_designation(
    designation_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    from models.user import Designation
    db_desig = db.query(Designation).filter(Designation.id == designation_id).first()
    if not db_desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    db.delete(db_desig)
    db.commit()
    return {"message": "Designation deleted"}
