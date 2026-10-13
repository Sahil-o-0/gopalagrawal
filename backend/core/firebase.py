import os
import json
from typing import Optional, List, Dict, Any

_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    
    try:
        import firebase_admin
        from firebase_admin import credentials

        # Check for credential file in backend root
        cred_paths = [
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase_credentials.json"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "gopal-agrawal-80aea-firebase-adminsdk-fbsvc-8b1734a1eb.json"),
            "firebase_credentials.json",
            "gopal-agrawal-80aea-firebase-adminsdk-fbsvc-8b1734a1eb.json"
        ]

        cred_file = None
        for path in cred_paths:
            if os.path.exists(path):
                cred_file = path
                break

        if cred_file:
            cred = credentials.Certificate(cred_file)
            _firebase_app = firebase_admin.initialize_app(cred, {
                'projectId': 'gopal-agrawal-80aea'
            })
            print(f"[Firebase] Firebase Admin SDK initialized successfully using {cred_file}")
            return _firebase_app
        else:
            print("[Firebase Warning] Firebase credentials file not found.")
            return None
    except Exception as e:
        print(f"[Firebase Error] Could not initialize Firebase Admin SDK: {e}")
        return None

def send_fcm_notification_to_tokens(tokens: List[str], title: str, body: str, data: Optional[Dict[str, str]] = None) -> dict:
    """
    Sends a Firebase Cloud Messaging notification to a list of device FCM registration tokens.
    """
    if not tokens:
        return {"status": "no_tokens", "sent": 0}
        
    app = get_firebase_app()
    if not app:
        return {"status": "firebase_not_initialized", "error": "Firebase Admin SDK not ready"}

    try:
        from firebase_admin import messaging

        str_data = {str(k): str(v) for k, v in (data or {}).items()}

        messages = [
            messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=str_data,
                token=token,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default",
                        channel_id="default",
                        priority="high",
                        default_sound=True,
                        default_vibrate_timings=True
                    )
                )
            )
            for token in tokens
        ]

        response = messaging.send_each(messages)
        print(f"[Firebase FCM] Sent {response.success_count} messages, failed: {response.failure_count}")
        return {
            "status": "success",
            "sent_count": response.success_count,
            "failure_count": response.failure_count
        }
    except Exception as e:
        print(f"[Firebase FCM Error] {e}")
        return {"status": "error", "error": str(e)}

def send_fcm_notification_to_topic(topic: str, title: str, body: str, data: Optional[Dict[str, str]] = None) -> dict:
    """
    Sends a notification to all devices subscribed to a topic (e.g. 'admin_alerts').
    """
    app = get_firebase_app()
    if not app:
        return {"status": "firebase_not_initialized"}

    try:
        from firebase_admin import messaging

        str_data = {str(k): str(v) for k, v in (data or {}).items()}
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=str_data,
            topic=topic,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    sound="default",
                    channel_id="default",
                    priority="high"
                )
            )
        )
        msg_id = messaging.send(message)
        return {"status": "success", "message_id": msg_id}
    except Exception as e:
        print(f"[Firebase Topic Error] {e}")
        return {"status": "error", "error": str(e)}

def verify_firebase_phone_otp(session_info: str, code: str) -> bool:
    """
    Validates a Google Firebase SMS Phone Auth code against the verification session.
    """
    if not session_info or not code:
        return False
    try:
        import requests
        url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=AIzaSyBWikwx4W3Lzo9ZBkv6fzroWArNqWWvvi4"
        payload = {
            "sessionInfo": session_info.strip(),
            "code": code.strip()
        }
        res = requests.post(url, json=payload, timeout=8)
        if res.status_code == 200:
            data = res.json()
            if "idToken" in data or "phoneNumber" in data or "localId" in data:
                print(f"[Firebase Phone Verify] Successfully verified phone OTP for {data.get('phoneNumber')}")
                return True
        print(f"[Firebase Phone Verify] Verification response ({res.status_code}): {res.text}")
        return False
    except Exception as e:
        print(f"[Firebase Phone Verify Error] Exception verifying OTP: {e}")
        return False
