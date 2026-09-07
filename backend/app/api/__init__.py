from fastapi import APIRouter

from app.api.auth_router import router as auth_router
from app.api.category_router import router as category_router
from app.api.inventory_router import router as inventory_router
from app.api.billing_router import router as billing_router
from app.api.barcode_router import router as barcode_router
from app.api.vendor_router import router as vendor_router
from app.api.customer_router import router as customer_router
from app.api.returns_router import router as returns_router
from app.api.expense_router import router as expense_router
from app.api.dashboard_router import router as dashboard_router
from app.api.reports_router import router as reports_router
from app.api.settings_router import router as settings_router
from app.api.backup_router import router as backup_router
from app.api.ai_router import router as ai_router
from app.api.alerts_router import router as alerts_router
from app.api.whatsapp_router import router as whatsapp_router
from app.api.procurement_router import router as procurement_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(category_router)
api_router.include_router(inventory_router)
api_router.include_router(billing_router)
api_router.include_router(barcode_router)
api_router.include_router(vendor_router)
api_router.include_router(customer_router)
api_router.include_router(returns_router)
api_router.include_router(expense_router)
api_router.include_router(dashboard_router)
api_router.include_router(reports_router)
api_router.include_router(settings_router)
api_router.include_router(backup_router)
api_router.include_router(ai_router)
api_router.include_router(alerts_router)
api_router.include_router(whatsapp_router)
api_router.include_router(procurement_router)
