import datetime
import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Form, Query, Body, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, database, dependencies
from models.user import User, UserRole, LoginOTP
from core.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from services.push_service import send_push_to_admins

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
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(dependencies.get_db)
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated. Please contact Admin.")

    # 1. ADMIN USER -> Direct login without OTP
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role_str == "ADMIN":
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "role": role_str}, expires_delta=access_token_expires
        )
        return {
            "require_otp": False,
            "access_token": access_token, 
            "token_type": "bearer",
            "user": user
        }

    # 2. NON-ADMIN USERS (Manager, Staff) -> 2-Step OTP Verification
    # Invalidate previous unused OTPs for this user
    db.query(LoginOTP).filter(
        LoginOTP.user_id == user.id,
        LoginOTP.is_used == False
    ).update({"is_used": True})
    db.commit()

    # Generate cryptographically secure 6-digit numeric OTP
    otp_code = f"{secrets.randbelow(900000) + 100000:06d}"
    session_id = secrets.token_urlsafe(32)
    now_utc = datetime.datetime.utcnow()
    expires_at = now_utc + timedelta(minutes=10)

    client_ip = request.client.host if request.client else None

    login_otp = LoginOTP(
        session_id=session_id,
        user_id=user.id,
        otp_code=otp_code,
        created_at=now_utc,
        expires_at=expires_at,
        is_used=False,
        attempts=0,
        ip_address=client_ip
    )
    db.add(login_otp)
    db.commit()

    # Dispatch instant Push Notification & Firebase alert to all active Admin accounts
    user_display = user.full_name or user.username
    designation_text = f" ({user.designation})" if user.designation else f" ({role_str})"
    
    push_title = f"🔐 Staff Login OTP: {otp_code}"
    push_body = f"User '{user_display}'{designation_text} is logging in. Share OTP: {otp_code} (Valid for 10 min)."
    
    send_push_to_admins(
        title=push_title,
        body=push_body,
        data={
            "type": "STAFF_LOGIN_OTP",
            "username": user.username,
            "otp_code": otp_code,
            "session_id": session_id,
            "user_id": str(user.id)
        }
    )

    # Fetch active admin phone numbers for client-side Firebase SMS trigger
    admins = db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()
    admin_phones = [u.phone_number.strip() for u in admins if u.phone_number and u.phone_number.strip()]

    return {
        "require_otp": True,
        "otp_session": session_id,
        "user_hint": f"{user_display}{designation_text}",
        "admin_phones": admin_phones,
        "message": f"A 6-digit verification code has been sent to Admin for '{user.username}'. Please obtain the OTP from your Admin to log in."
    }

@router.post("/verify-login-otp", response_model=schemas.user.Token)
def verify_login_otp(
    payload: schemas.user.OTPVerifyRequest,
    db: Session = Depends(dependencies.get_db)
):
    now_utc = datetime.datetime.utcnow()
    
    otp_record = db.query(LoginOTP).filter(
        LoginOTP.session_id == payload.otp_session,
        LoginOTP.is_used == False
    ).first()

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP session. Please try logging in again."
        )

    if otp_record.expires_at < now_utc:
        otp_record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired (10 min limit). Please request a new OTP."
        )

    otp_record.attempts += 1
    if otp_record.attempts > 5:
        otp_record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect OTP attempts. Please log in again."
        )

    clean_entered_otp = payload.otp.strip()
    is_valid = False

    # 1. Match backend internal OTP code
    if clean_entered_otp == otp_record.otp_code:
        is_valid = True

    # 2. Match Google Firebase SMS Phone Auth code
    firebase_id = payload.verification_id or getattr(otp_record, 'firebase_verification_id', None)
    if not is_valid and firebase_id:
        from core.firebase import verify_firebase_phone_otp
        if verify_firebase_phone_otp(firebase_id, clean_entered_otp):
            is_valid = True

    if not is_valid:
        db.commit()
        remaining = max(0, 5 - otp_record.attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect OTP. Please check the code shared by your Admin. ({remaining} attempts left)"
        )

    # Valid OTP
    otp_record.is_used = True
    db.commit()

    user = db.query(User).filter(User.id == otp_record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="User account not found or inactive")

    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": role_str}, expires_delta=access_token_expires
    )

    return {
        "require_otp": False,
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/resend-login-otp")
def resend_login_otp(
    payload: schemas.user.OTPResendRequest,
    db: Session = Depends(dependencies.get_db)
):
    otp_record = db.query(LoginOTP).filter(
        LoginOTP.session_id == payload.otp_session
    ).first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="Session not found. Please log in again.")

    user = db.query(User).filter(User.id == otp_record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="User not found or inactive.")

    # Invalidate previous OTP
    otp_record.is_used = True
    db.commit()

    # Generate new OTP & session
    otp_code = f"{secrets.randbelow(900000) + 100000:06d}"
    new_session_id = secrets.token_urlsafe(32)
    now_utc = datetime.datetime.utcnow()
    expires_at = now_utc + timedelta(minutes=10)

    new_login_otp = LoginOTP(
        session_id=new_session_id,
        user_id=user.id,
        otp_code=otp_code,
        created_at=now_utc,
        expires_at=expires_at,
        is_used=False,
        attempts=0
    )
    db.add(new_login_otp)
    db.commit()

    # Dispatch notifications to Admins
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    user_display = user.full_name or user.username
    designation_text = f" ({user.designation})" if user.designation else f" ({role_str})"
    
    push_title = f"🔐 Resent Staff Login OTP: {otp_code}"
    push_body = f"User '{user_display}'{designation_text} requested a new OTP: {otp_code} (Valid for 10 min)."
    
    send_push_to_admins(
        title=push_title,
        body=push_body,
        data={
            "type": "STAFF_LOGIN_OTP",
            "username": user.username,
            "otp_code": otp_code,
            "session_id": new_session_id,
            "user_id": str(user.id)
        }
    )

    admins = db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()
    admin_phones = [u.phone_number.strip() for u in admins if u.phone_number and u.phone_number.strip()]

    return {
        "status": "success",
        "otp_session": new_session_id,
        "admin_phones": admin_phones,
        "message": f"A new OTP has been sent to the Admin for '{user.username}'."
    }

@router.post("/register-firebase-session")
def register_firebase_session(
    payload: schemas.user.FirebaseSessionRegister,
    db: Session = Depends(dependencies.get_db)
):
    """
    Associates the Google Firebase Phone Auth verification ID with the OTP login session.
    """
    otp_record = db.query(LoginOTP).filter(
        LoginOTP.session_id == payload.otp_session,
        LoginOTP.is_used == False
    ).first()
    if otp_record:
        otp_record.firebase_verification_id = payload.verification_id
        db.commit()
        return {"status": "success", "session_id": payload.otp_session}
    return {"status": "session_not_found"}

@router.get("/admin/pending-otps", response_model=List[schemas.user.PendingOTPResponse])
def get_pending_admin_otps(
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    """
    Returns active OTPs created in the last 15 minutes for Admin live view.
    """
    fifteen_mins_ago = datetime.datetime.utcnow() - timedelta(minutes=15)
    records = db.query(LoginOTP, User).join(User, LoginOTP.user_id == User.id).filter(
        LoginOTP.created_at >= fifteen_mins_ago
    ).order_by(LoginOTP.created_at.desc()).limit(20).all()

    results = []
    for otp, u in records:
        role_str = u.role.value if hasattr(u.role, 'value') else str(u.role)
        results.append({
            "id": otp.id,
            "session_id": otp.session_id,
            "username": u.username,
            "full_name": u.full_name,
            "role": role_str,
            "otp_code": otp.otp_code,
            "created_at": otp.created_at,
            "expires_at": otp.expires_at,
            "is_used": otp.is_used
        })
    return results


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

import io
import base64
from PIL import Image

def optimize_image_to_webp(image_data_uri: str, max_size=(600, 600), quality=90) -> str:
    """Converts a Base64 / DataURI image to high-quality compressed WebP format for fast reloads."""
    if not image_data_uri or not isinstance(image_data_uri, str) or not image_data_uri.startswith("data:image"):
        return image_data_uri
    try:
        header, b64_str = image_data_uri.split(",", 1)
        image_bytes = base64.b64decode(b64_str)
        img = Image.open(io.BytesIO(image_bytes))
        
        # Handle transparency & color modes for WebP
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            pass # WebP natively supports RGBA
        elif img.mode != "RGB":
            img = img.convert("RGB")
            
        # Resize thumbnail maintaining aspect ratio
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        output_buffer = io.BytesIO()
        img.save(output_buffer, format="WEBP", quality=quality, method=6)
        webp_b64 = base64.b64encode(output_buffer.getvalue()).decode("utf-8")
        return f"data:image/webp;base64,{webp_b64}"
    except Exception as e:
        print(f"WebP optimization fallback: {e}")
        return image_data_uri

@router.post("/users", response_model=schemas.user.UserResponse)
def create_staff_manager_user(
    user: schemas.user.UserCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_admin_user)
):
    from models.user import UserRole
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed_password = get_password_hash(user.password)
    photo_webp = optimize_image_to_webp(user.profile_photo_url) if user.profile_photo_url else None

    new_user = User(
        username=user.username,
        full_name=user.full_name,
        phone_number=user.phone_number,
        hashed_password=hashed_password,
        role=user.role, # Allowed: STAFF, MANAGER
        site_id=user.site_id or 1,
        designation=user.designation,
        profile_photo_url=photo_webp,
        aadhar_id=user.aadhar_id,
        address=user.address,
        relative_name=user.relative_name,
        relative_relation=user.relative_relation,
        relative_phone_number=user.relative_phone_number,
        opening_balance=user.opening_balance or 0.0,
        salary=user.salary or 0.0,
        starting_date=user.starting_date,
        employment_type=user.employment_type or "PERMANENT",
        employee_of=user.employee_of or "DEPARTMENTAL",
        department=user.department,
        employee_id_custom=user.employee_id_custom,
        assigned_vehicle=user.assigned_vehicle,
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
    current_user: User = Depends(dependencies.get_current_active_user)
):
    from models.user import UserRole
    # Allow Admin, Manager, or the User themselves to update profile
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this profile")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_data = user_update.model_dump(exclude_unset=True)
    
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")
        
    if "profile_photo_url" in update_data and update_data["profile_photo_url"]:
        update_data["profile_photo_url"] = optimize_image_to_webp(update_data["profile_photo_url"])

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

@router.post("/push-token")
def register_push_token(
    payload: schemas.user.PushTokenUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    current_user.expo_push_token = payload.push_token
    db.commit()
    return {"message": "Push token registered successfully", "token": payload.push_token}

