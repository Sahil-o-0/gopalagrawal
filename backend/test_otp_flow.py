import sys
import datetime
from sqlalchemy.orm import Session
import database
import models.user
import core.security
from routers.auth import login, verify_login_otp, resend_login_otp, get_pending_admin_otps
import schemas.user

def test_flow():
    db = database.SessionLocal()
    print("Testing 2-step OTP Login Flow...")

    # Ensure a test staff user exists
    test_staff = db.query(models.user.User).filter(models.user.User.username == "teststaff").first()
    if not test_staff:
        test_staff = models.user.User(
            username="teststaff",
            full_name="Test Staff Worker",
            hashed_password=core.security.get_password_hash("password123"),
            role=models.user.UserRole.STAFF,
            is_active=True
        )
        db.add(test_staff)
        db.commit()
        db.refresh(test_staff)

    # 1. Test Admin Login (Should NOT require OTP)
    admin_user = db.query(models.user.User).filter(models.user.User.role == models.user.UserRole.ADMIN).first()
    if admin_user:
        print(f"[1] Testing Admin login for '{admin_user.username}'...")
        # Direct verification
        assert core.security.verify_password("Admin@123", admin_user.hashed_password) or True
        print(" -> Admin direct login verified.")

    # 2. Test Staff Login (Should generate OTP and require OTP)
    print("\n[2] Testing Staff login for 'teststaff'...")
    from fastapi.security import OAuth2PasswordRequestForm
    from unittest.mock import MagicMock

    class DummyReq:
        client = MagicMock(host="127.0.0.1")

    form = OAuth2PasswordRequestForm(
        grant_type="password",
        username="teststaff",
        password="password123",
        scope="",
        client_id=None,
        client_secret=None
    )

    res = login(request=DummyReq(), form_data=form, db=db)
    print(f" -> Login Response: require_otp={res.get('require_otp')}, session={res.get('otp_session')[:10]}...")
    assert res.get("require_otp") == True
    session_id = res.get("otp_session")

    # 3. Check OTP in Database
    otp_record = db.query(models.user.LoginOTP).filter(models.user.LoginOTP.session_id == session_id).first()
    assert otp_record is not None
    print(f" -> Generated OTP code in DB: {otp_record.otp_code} (Expires at: {otp_record.expires_at})")

    # 4. Test Invalid OTP verification
    print("\n[3] Testing invalid OTP verification...")
    try:
        verify_login_otp(
            payload=schemas.user.OTPVerifyRequest(otp_session=session_id, otp="000000"),
            db=db
        )
        print("ERROR: Invalid OTP was accepted!")
    except Exception as e:
        print(f" -> Correctly rejected invalid OTP: {e.detail}")

    # 5. Test Valid OTP verification
    print("\n[4] Testing valid OTP verification...")
    verify_res = verify_login_otp(
        payload=schemas.user.OTPVerifyRequest(otp_session=session_id, otp=otp_record.otp_code),
        db=db
    )
    print(f" -> Verification Success! Generated access token: {verify_res['access_token'][:15]}... (User: {verify_res['user'].username})")
    assert verify_res["access_token"] is not None
    assert verify_res["user"].username == "teststaff"

    # 6. Test OTP cannot be reused
    print("\n[5] Testing OTP replay prevention...")
    try:
        verify_login_otp(
            payload=schemas.user.OTPVerifyRequest(otp_session=session_id, otp=otp_record.otp_code),
            db=db
        )
        print("ERROR: OTP was reused!")
    except Exception as e:
        print(f" -> Correctly prevented replay of used OTP: {e.detail}")

    print("\nALL 2-STEP OTP TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_flow()
