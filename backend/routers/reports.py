import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_

from dependencies import get_current_user, get_db
from models.user import User
from models.workforce import DailyLedger, VehicleEMI, StaffLedger, VehicleRepairRequest
from models.trip import TripLog

router = APIRouter(prefix="/reports", tags=["Advanced Reporting"])

@router.get("/financial-dashboard")
def get_financial_dashboard(
    period: str = Query("monthly", regex="^(monthly|yearly)$"),
    year: int = Query(default=datetime.date.today().year),
    month: Optional[int] = Query(default=datetime.date.today().month),
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    High-level financial view of Monthly / Yearly Net Profit:
    Earnings minus (Diesel + Maintenance + Salary + EMI + Others)
    """
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to access financial dashboard")

    # Date range setup
    if period == "monthly":
        start_date = datetime.date(year, month, 1)
        if month == 12:
            end_date = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            end_date = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    else: # yearly
        start_date = datetime.date(year, 1, 1)
        end_date = datetime.date(year, 12, 31)

    # Base query for daily ledger entries
    ledger_query = db.query(DailyLedger).filter(
        DailyLedger.date >= start_date,
        DailyLedger.date <= end_date
    )
    if site_id:
        ledger_query = ledger_query.filter(DailyLedger.site_id == site_id)
    
    entries = ledger_query.all()

    # Aggregate ledger entries
    total_earnings = 0.0
    diesel_expense = 0.0
    maintenance_expense = 0.0
    salary_expense = 0.0
    advance_expense = 0.0
    emi_expense = 0.0
    other_expense = 0.0

    for entry in entries:
        amt = entry.amount or 0.0
        ttype = (entry.transaction_type or "").upper()
        cat = (entry.category or "").upper()

        if ttype == "INCOME" or cat in ["TRIP_INCOME", "INCOME"]:
            total_earnings += amt
        else: # EXPENSE
            if cat in ["FUEL", "DIESEL"]:
                diesel_expense += amt
            elif cat in ["MAINTENANCE", "REPAIR"]:
                maintenance_expense += amt
            elif cat in ["SALARY"]:
                salary_expense += amt
            elif cat in ["ADVANCE"]:
                advance_expense += amt
            elif cat in ["EMI"]:
                emi_expense += amt
            else:
                other_expense += amt

    # Also calculate trips during this period
    trip_query = db.query(TripLog).filter(
        TripLog.created_at >= datetime.datetime.combine(start_date, datetime.time.min),
        TripLog.created_at <= datetime.datetime.combine(end_date, datetime.time.max)
    )
    if site_id:
        trip_query = trip_query.filter(TripLog.site_id == site_id)
    trips = trip_query.all()

    trip_diesel_cost = sum((t.diesel_cost or 0.0) for t in trips)
    trip_freight_billed = sum((t.bhada or 0.0) for t in trips)
    trip_freight_received = sum((t.advance_freight_received or 0.0) for t in trips)
    trip_freight_pending = sum((t.pending_freight or 0.0) for t in trips)

    # If ledger has no trip income yet, incorporate freight received
    if total_earnings == 0 and trip_freight_received > 0:
        total_earnings = trip_freight_received

    # If ledger fuel expense is 0, use trip diesel cost
    if diesel_expense == 0 and trip_diesel_cost > 0:
        diesel_expense = trip_diesel_cost

    total_expenses = diesel_expense + maintenance_expense + salary_expense + advance_expense + emi_expense + other_expense
    net_profit = total_earnings - total_expenses
    profit_margin = round((net_profit / total_earnings * 100), 2) if total_earnings > 0 else 0.0

    # Monthly breakdown for trend charts (if yearly period or 12-month trailing)
    monthly_trend = []
    if period == "yearly":
        for m in range(1, 13):
            m_start = datetime.date(year, m, 1)
            if m == 12:
                m_end = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
            else:
                m_end = datetime.date(year, m + 1, 1) - datetime.timedelta(days=1)
            
            m_entries = [e for e in entries if m_start <= e.date <= m_end]
            m_income = sum(e.amount for e in m_entries if e.transaction_type == "INCOME" or e.category in ["TRIP_INCOME", "INCOME"])
            m_expense = sum(e.amount for e in m_entries if e.transaction_type == "EXPENSE" or e.category not in ["TRIP_INCOME", "INCOME"])
            
            # Incorporate trips if ledger empty for this month
            m_trips = [t for t in trips if m_start <= t.created_at.date() <= m_end]
            if m_income == 0:
                m_income = sum((t.advance_freight_received or 0.0) for t in m_trips)
            if m_expense == 0:
                m_expense = sum((t.diesel_cost or 0.0) for t in m_trips)

            monthly_trend.append({
                "month": m,
                "month_name": m_start.strftime("%b"),
                "earnings": round(m_income, 2),
                "expenses": round(m_expense, 2),
                "net_profit": round(m_income - m_expense, 2)
            })

    return {
        "period": period,
        "year": year,
        "month": month,
        "month_name": datetime.date(year, month or 1, 1).strftime("%B") if period == "monthly" else None,
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "summary": {
            "total_earnings": round(total_earnings, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit": round(net_profit, 2),
            "profit_margin_percent": profit_margin,
            "status": "PROFITABLE" if net_profit >= 0 else "LOSS"
        },
        "expense_breakdown": {
            "diesel": round(diesel_expense, 2),
            "maintenance": round(maintenance_expense, 2),
            "salary": round(salary_expense, 2),
            "advance": round(advance_expense, 2),
            "emi": round(emi_expense, 2),
            "other": round(other_expense, 2)
        },
        "freight_metrics": {
            "total_billed": round(trip_freight_billed, 2),
            "total_received": round(trip_freight_received, 2),
            "total_pending": round(trip_freight_pending, 2),
            "trips_count": len(trips)
        },
        "monthly_trend": monthly_trend
    }

@router.get("/automated-alerts")
def get_automated_alerts(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Automated Alerts: Detects EMIs and compliance items due in 2 days (or overdue).
    """
    today = datetime.date.today()
    two_days_ahead = today + datetime.timedelta(days=2)

    query = db.query(VehicleEMI)
    if site_id:
        query = query.filter(VehicleEMI.site_id == site_id)
    records = query.all()

    alerts = []

    for r in records:
        # 1. EMI Due Alert
        if r.emi_due_date:
            days_diff = (r.emi_due_date - today).days
            if days_diff <= 2:
                severity = "CRITICAL" if days_diff < 0 else ("HIGH" if days_diff == 0 else "WARNING")
                msg = f"EMI of ₹{r.emi_amount:,.0f} for {r.vehicle_number} is due on {r.emi_due_date.strftime('%d %b %Y')} ({days_diff} days left)."
                if days_diff < 0:
                    msg = f"OVERDUE: EMI of ₹{r.emi_amount:,.0f} for {r.vehicle_number} was due on {r.emi_due_date.strftime('%d %b %Y')} ({abs(days_diff)} days ago)."
                elif days_diff == 0:
                    msg = f"DUE TODAY: EMI of ₹{r.emi_amount:,.0f} for {r.vehicle_number} is due today!"
                
                alerts.append({
                    "id": f"emi_{r.id}",
                    "type": "EMI",
                    "vehicle_number": r.vehicle_number,
                    "amount": r.emi_amount,
                    "financier": r.financier,
                    "due_date": r.emi_due_date.isoformat(),
                    "days_until_due": days_diff,
                    "severity": severity,
                    "message": msg,
                    "is_due_in_2_days": 0 <= days_diff <= 2
                })

        # 2. Insurance Expiry Alert
        if r.insurance_expiry:
            days_diff = (r.insurance_expiry - today).days
            if days_diff <= 2:
                severity = "CRITICAL" if days_diff < 0 else "WARNING"
                amount_str = f" (Premium: ₹{r.insurance_premium:,.0f})" if r.insurance_premium else ""
                msg = f"Insurance for {r.vehicle_number} expires on {r.insurance_expiry.strftime('%d %b %Y')}{amount_str}."
                alerts.append({
                    "id": f"ins_{r.id}",
                    "type": "INSURANCE",
                    "vehicle_number": r.vehicle_number,
                    "amount": r.insurance_premium or 0,
                    "financier": None,
                    "due_date": r.insurance_expiry.isoformat(),
                    "days_until_due": days_diff,
                    "severity": severity,
                    "message": msg,
                    "is_due_in_2_days": 0 <= days_diff <= 2
                })

        # 3. Fitness Expiry Alert
        if r.fitness_expiry:
            days_diff = (r.fitness_expiry - today).days
            if days_diff <= 2:
                severity = "CRITICAL" if days_diff < 0 else "WARNING"
                amount_str = f" (Fee: ₹{r.fitness_fee:,.0f})" if r.fitness_fee else ""
                msg = f"Fitness Certificate for {r.vehicle_number} expires on {r.fitness_expiry.strftime('%d %b %Y')}{amount_str}."
                alerts.append({
                    "id": f"fit_{r.id}",
                    "type": "FITNESS",
                    "vehicle_number": r.vehicle_number,
                    "amount": r.fitness_fee or 0,
                    "financier": None,
                    "due_date": r.fitness_expiry.isoformat(),
                    "days_until_due": days_diff,
                    "severity": severity,
                    "message": msg,
                    "is_due_in_2_days": 0 <= days_diff <= 2
                })

        # 4. Road Tax Expiry Alert
        if getattr(r, 'road_tax_expiry', None):
            days_diff = (r.road_tax_expiry - today).days
            if days_diff <= 2:
                severity = "CRITICAL" if days_diff < 0 else "WARNING"
                amount_str = f" (Tax: ₹{r.road_tax_amount:,.0f})" if getattr(r, 'road_tax_amount', None) else ""
                msg = f"Road Tax for {r.vehicle_number} expires on {r.road_tax_expiry.strftime('%d %b %Y')}{amount_str}."
                alerts.append({
                    "id": f"tax_{r.id}",
                    "type": "ROAD_TAX",
                    "vehicle_number": r.vehicle_number,
                    "amount": getattr(r, 'road_tax_amount', 0) or 0,
                    "financier": None,
                    "due_date": r.road_tax_expiry.isoformat(),
                    "days_until_due": days_diff,
                    "severity": severity,
                    "message": msg,
                    "is_due_in_2_days": 0 <= days_diff <= 2
                })

        # 5. PUCC Expiry Alert
        if getattr(r, 'pucc_expiry', None):
            days_diff = (r.pucc_expiry - today).days
            if days_diff <= 2:
                severity = "CRITICAL" if days_diff < 0 else "WARNING"
                amount_str = f" (Fee: ₹{r.pucc_fee:,.0f})" if getattr(r, 'pucc_fee', None) else ""
                msg = f"PUCC for {r.vehicle_number} expires on {r.pucc_expiry.strftime('%d %b %Y')}{amount_str}."
                alerts.append({
                    "id": f"pucc_{r.id}",
                    "type": "PUCC",
                    "vehicle_number": r.vehicle_number,
                    "amount": getattr(r, 'pucc_fee', 0) or 0,
                    "financier": None,
                    "due_date": r.pucc_expiry.isoformat(),
                    "days_until_due": days_diff,
                    "severity": severity,
                    "message": msg,
                    "is_due_in_2_days": 0 <= days_diff <= 2
                })

    # Sort alerts: CRITICAL first, then by days_until_due ascending
    severity_order = {"CRITICAL": 0, "HIGH": 1, "WARNING": 2}
    alerts.sort(key=lambda x: (severity_order.get(x["severity"], 3), x["days_until_due"]))

    due_in_2_days_count = sum(1 for a in alerts if a["is_due_in_2_days"])

    return {
        "today": today.isoformat(),
        "total_alerts": len(alerts),
        "due_in_2_days_count": due_in_2_days_count,
        "alerts": alerts
    }
