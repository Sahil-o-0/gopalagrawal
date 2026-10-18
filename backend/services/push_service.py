import json
import urllib.request
import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from models.user import User
from models.workforce import VehicleEMI
from database import SessionLocal

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
import os
try:
    from zoneinfo import ZoneInfo
    APP_TZ = ZoneInfo(os.getenv("APP_TIMEZONE", os.getenv("TZ", "Asia/Kolkata")))
except Exception:
    APP_TZ = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

IST = APP_TZ

def send_expo_push_notifications(messages: List[dict]) -> dict:
    """
    Sends push notification batches directly to Expo Push Notification service.
    Works for Android & iOS devices even when the app is completely closed.
    """
    if not messages:
        return {"status": "no_messages"}
        
    try:
        req_data = json.dumps(messages).encode("utf-8")
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except Exception as e:
        print(f"[Push Notification Error] Failed to dispatch push messages: {e}")
        return {"error": str(e)}

def generate_due_alerts(db: Session) -> List[dict]:
    """
    Evaluates all fleet records for upcoming or overdue compliance and EMI deadlines.
    """
    today_ist = datetime.datetime.now(IST).date()
    records = db.query(VehicleEMI).all()
    alerts = []

    for r in records:
        veh = (r.vehicle_number or "Vehicle").strip().upper()

        # 1. EMI Due Alert (within 7 days or overdue)
        if r.emi_due_date:
            days = (r.emi_due_date - today_ist).days
            if days <= 7:
                amt_str = f"₹{r.emi_amount:,.0f}" if r.emi_amount else "Due"
                if days < 0:
                    status_text = f"Overdue by {abs(days)} days"
                elif days == 0:
                    status_text = "DUE TODAY"
                else:
                    status_text = f"{days} days remaining"
                
                alerts.append({
                    "title": f"⚠️ EMI Alert: {veh}",
                    "body": f"EMI of {amt_str} for {veh} is due on {r.emi_due_date.strftime('%d %b %Y')} ({status_text}).",
                    "data": {"type": "EMI", "vehicle": veh, "id": r.id}
                })

        # 2. Insurance Expiry
        if r.insurance_expiry:
            days = (r.insurance_expiry - today_ist).days
            if days <= 7:
                status_text = f"Expired {abs(days)}d ago" if days < 0 else (f"Expires today" if days == 0 else f"{days}d left")
                prem_str = f" • Premium: ₹{r.insurance_premium:,.0f}" if getattr(r, 'insurance_premium', None) else ""
                alerts.append({
                    "title": f"🛡️ Insurance Alert: {veh}",
                    "body": f"Insurance for {veh} expires on {r.insurance_expiry.strftime('%d %b %Y')}{prem_str} ({status_text}).",
                    "data": {"type": "INSURANCE", "vehicle": veh, "id": r.id}
                })

        # 3. Fitness Expiry
        if r.fitness_expiry:
            days = (r.fitness_expiry - today_ist).days
            if days <= 7:
                status_text = f"Expired {abs(days)}d ago" if days < 0 else (f"Expires today" if days == 0 else f"{days}d left")
                fee_str = f" • Fee: ₹{r.fitness_fee:,.0f}" if getattr(r, 'fitness_fee', None) else ""
                alerts.append({
                    "title": f"📋 Fitness Certificate: {veh}",
                    "body": f"Fitness for {veh} expires on {r.fitness_expiry.strftime('%d %b %Y')}{fee_str} ({status_text}).",
                    "data": {"type": "FITNESS", "vehicle": veh, "id": r.id}
                })

        # 4. Road Tax Expiry
        if getattr(r, 'road_tax_expiry', None):
            days = (r.road_tax_expiry - today_ist).days
            if days <= 7:
                status_text = f"Expired {abs(days)}d ago" if days < 0 else (f"Expires today" if days == 0 else f"{days}d left")
                tax_str = f" • Tax: ₹{r.road_tax_amount:,.0f}" if getattr(r, 'road_tax_amount', None) else ""
                alerts.append({
                    "title": f"🛣️ Road Tax Alert: {veh}",
                    "body": f"Road Tax for {veh} expires on {r.road_tax_expiry.strftime('%d %b %Y')}{tax_str} ({status_text}).",
                    "data": {"type": "ROAD_TAX", "vehicle": veh, "id": r.id}
                })

        # 5. PUCC Expiry
        if getattr(r, 'pucc_expiry', None):
            days = (r.pucc_expiry - today_ist).days
            if days <= 7:
                status_text = f"Expired {abs(days)}d ago" if days < 0 else (f"Expires today" if days == 0 else f"{days}d left")
                puc_str = f" • Fee: ₹{r.pucc_fee:,.0f}" if getattr(r, 'pucc_fee', None) else ""
                alerts.append({
                    "title": f"💨 PUCC Alert: {veh}",
                    "body": f"PUCC for {veh} expires on {r.pucc_expiry.strftime('%d %b %Y')}{puc_str} ({status_text}).",
                    "data": {"type": "PUCC", "vehicle": veh, "id": r.id}
                })

        # 6. Permit Expiry (before 2 days, 1 day, today, overdue)
        if getattr(r, 'permit_valid_upto', None):
            days = (r.permit_valid_upto - today_ist).days
            if days <= 7:
                if days < 0:
                    status_text = f"Expired {abs(days)}d ago"
                elif days == 0:
                    status_text = "Expires TODAY"
                elif days == 1:
                    status_text = "Expires TOMORROW (1 day left)"
                elif days == 2:
                    status_text = "Expires in 2 DAYS"
                else:
                    status_text = f"{days} days remaining"

                fee_str = f" • Fee: ₹{r.permit_fee:,.0f}" if getattr(r, 'permit_fee', None) else ""
                alerts.append({
                    "title": f"📜 Permit Alert: {veh}",
                    "body": f"Permit for {veh} expires on {r.permit_valid_upto.strftime('%d %b %Y')}{fee_str} ({status_text}).",
                    "data": {"type": "PERMIT", "vehicle": veh, "id": r.id}
                })

    return alerts

def send_push_to_admins(title: str, body: str, data: Optional[dict] = None) -> dict:
    """
    Sends an instant push notification to ALL active Admin devices.
    Used for Staff Login OTP dispatch and urgent security authorizations.
    """
    db = SessionLocal()
    try:
        admins = db.query(User).filter(
            User.role == "ADMIN",
            User.is_active == True,
            User.expo_push_token.isnot(None),
            User.expo_push_token != ""
        ).all()

        tokens = []
        for u in admins:
            if u.expo_push_token:
                tokens.append(u.expo_push_token)

        tokens = list(set(tokens))
        
        # 1. Expo Push Notifications
        expo_tokens = [t for t in tokens if t.startswith("ExponentPushToken[")]
        expo_res = {"sent_count": 0}
        if expo_tokens:
            messages = [
                {
                    "to": token,
                    "sound": "default",
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "priority": "high",
                    "channelId": "default"
                }
                for token in expo_tokens
            ]
            expo_res = send_expo_push_notifications(messages)

        # 2. Firebase Cloud Messaging (FCM tokens)
        fcm_tokens = [t for t in tokens if not t.startswith("ExponentPushToken[")]
        if fcm_tokens:
            try:
                from core.firebase import send_fcm_notification_to_tokens
                send_fcm_notification_to_tokens(fcm_tokens, title, body, data)
            except Exception as fe:
                print(f"[Firebase FCM Admin Send Error] {fe}")

        return {"status": "ok", "admin_count": len(admins), "tokens": len(tokens), "expo_res": expo_res}
    except Exception as e:
        print(f"[Push Service Error] Failed to send push to admins: {e}")
        return {"error": str(e)}
    finally:
        db.close()


def send_push_to_admins_and_managers(title: str, body: str, data: Optional[dict] = None, site_id: Optional[int] = None) -> dict:
    """
    Sends an instant push notification to active Admin and Manager devices.
    Used for Leave Requests, Trip Starts, and Trip Completions.
    """
    db = SessionLocal()
    try:
        users = db.query(User).filter(
            User.role.in_(["ADMIN", "MANAGER"]),
            User.is_active == True,
            User.expo_push_token.isnot(None),
            User.expo_push_token != ""
        ).all()

        tokens = []
        for u in users:
            if u.expo_push_token and u.expo_push_token.startswith("ExponentPushToken["):
                if u.role == "ADMIN" or site_id is None or u.site_id is None or u.site_id == site_id:
                    tokens.append(u.expo_push_token)

        tokens = list(set(tokens))
        if not tokens:
            return {"sent_count": 0, "message": "No push tokens found"}

        messages = [
            {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {},
                "priority": "high",
                "channelId": "default"
            }
            for token in tokens
        ]
        return send_expo_push_notifications(messages)
    except Exception as e:
        print(f"[Push Service Error] Failed to send instant push: {e}")
        return {"error": str(e)}
    finally:
        db.close()

def send_scheduled_compliance_push_notifications() -> dict:
    """
    Finds all Admin and Manager users with registered Expo push tokens,
    and sends scheduled compliance & EMI alerts directly to their phones.
    """
    db = SessionLocal()
    try:
        # Find all admin/manager push tokens
        admin_users = db.query(User).filter(
            User.role.in_(["ADMIN", "MANAGER"]),
            User.is_active == True,
            User.expo_push_token.isnot(None),
            User.expo_push_token != ""
        ).all()

        tokens = list(set([u.expo_push_token for u in admin_users if u.expo_push_token and u.expo_push_token.startswith("ExponentPushToken[")]))
        
        if not tokens:
            print("[Push Scheduler] No registered Admin/Manager Expo push tokens found.")
            return {"sent_count": 0, "message": "No push tokens found"}

        alerts = generate_due_alerts(db)
        if not alerts:
            print("[Push Scheduler] No due EMIs or compliance items to notify today.")
            return {"sent_count": 0, "message": "No pending alerts"}

        # Build notification messages for each registered device
        messages = []
        for alert in alerts:
            for token in tokens:
                messages.append({
                    "to": token,
                    "sound": "default",
                    "title": alert["title"],
                    "body": alert["body"],
                    "data": alert["data"],
                    "priority": "high",
                    "channelId": "default"
                })

        print(f"[Push Scheduler] Dispatching {len(messages)} push notifications to {len(tokens)} device(s)...")
        result = send_expo_push_notifications(messages)
        return {"sent_count": len(messages), "devices": len(tokens), "result": result}
    finally:
        db.close()

