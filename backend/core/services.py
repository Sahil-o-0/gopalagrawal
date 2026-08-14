import os
from fpdf import FPDF
from googleapiclient.discovery import build
from google.oauth2 import service_account
from datetime import datetime

# --- GOOGLE DRIVE SETUP ---
# In production, these credentials would be securely loaded from a JSON file.
# We are stubbing the Drive initialization for when the Client provides their JSON key.
SCOPES = ['https://www.googleapis.com/auth/drive.file']
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'path/to/credentials.json')

def get_drive_service():
    try:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds)
        return service
    except Exception as e:
        print(f"Drive Service uninitialized: {e}")
        return None

def create_pdf_report(ledgers):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    pdf.cell(200, 10, txt="Gopal Ji Fleet - Monthly Financial Ledger", ln=1, align='C')
    pdf.cell(200, 10, txt=f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=1, align='C')
    
    for l in ledgers:
        pdf.cell(200, 10, txt=f"Trip: {l.trip_id} | Billed: {l.total_amount_billed} | Pending: {l.amount_pending}", ln=1, align='L')
        
    file_path = f"/tmp/ledger_report_{datetime.now().strftime('%Y%m%d')}.pdf"
    pdf.output(file_path)
    return file_path

def backup_to_drive(file_path):
    service = get_drive_service()
    if not service:
        print(f"Simulating Cloud Backup to Google Drive for: {file_path}")
        return True
        
    # Actual implementation when credentials are provided
    # file_metadata = {'name': os.path.basename(file_path)}
    # media = MediaFileUpload(file_path, mimetype='application/pdf')
    # file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    # return file.get('id')
    return True

# --- FIREBASE CLOUD MESSAGING SETUP ---

def send_push_notification(fcm_token: str, title: str, body: str):
    """
    Stub for Firebase Cloud Messaging.
    To be implemented when the Client provides their FCM Service Account Key.
    """
    print(f"Simulating Push Notification to {fcm_token}")
    print(f"Title: {title}")
    print(f"Body: {body}")
    return True
