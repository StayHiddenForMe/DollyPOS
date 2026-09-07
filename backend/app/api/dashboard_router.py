from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.auth_router import get_current_user
from app.models.user import User
from app.services.analytics_service import analytics_service

router = APIRouter(tags=["Dashboard Intelligence"])

def _build_dashboard_payload(db: Session, days: int = 30):
    summary = analytics_service.get_dashboard_summary(db)
    top_products = analytics_service.get_top_selling_products(db, limit=5)
    dead_stock_preview = analytics_service.get_dead_stock(db, days=60)[:5]
    charts = analytics_service.get_analytics_charts(db, days=days)
    
    return {
        **summary,
        "top_selling_products": top_products,
        "dead_stock_preview": dead_stock_preview,
        "charts": charts
    }

@router.get("/dashboard/metrics")
@router.get("/dashboard")
@router.get("/analytics/dashboard")
def get_dashboard_metrics(
    days: int = Query(30, description="Timeline range in days (7, 30, 90, 365)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Universal dashboard live metrics endpoint."""
    return _build_dashboard_payload(db, days=days)

@router.get("/dashboard/analytics-charts")
def get_dashboard_charts(
    days: int = Query(30, description="Timeline range in days (7, 30, 90, 365)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stock-market style financial charts, cash flow, and predictive growth projections."""
    return analytics_service.get_analytics_charts(db, days=days)

