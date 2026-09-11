from datetime import datetime, timedelta, date, time
from typing import Tuple, Optional, Any
from sqlalchemy import func, text

# Indian Standard Time (IST) offset is UTC+5:30 (Dhule / Maharashtra, India)
IST_OFFSET = timedelta(hours=5, minutes=30)

def get_ist_now() -> datetime:
    """Returns the current datetime in Indian Standard Time (IST)."""
    return datetime.utcnow() + IST_OFFSET

def get_ist_today() -> date:
    """Returns today's date in Indian Standard Time (IST)."""
    return get_ist_now().date()

def get_ist_day_bounds_in_utc(target_date: Optional[date] = None) -> Tuple[datetime, datetime]:
    """
    Returns (start_utc, end_utc) corresponding to 00:00:00 to 23:59:59.999999 of the IST day.
    For example: for 2026-09-12 (IST):
      start_utc = 2026-09-11 18:30:00
      end_utc   = 2026-09-12 18:29:59.999999
    """
    if target_date is None:
        target_date = get_ist_today()
    elif isinstance(target_date, str):
        target_date = datetime.strptime(target_date.strip(), "%Y-%m-%d").date()
    
    ist_start = datetime.combine(target_date, time.min)
    ist_end = datetime.combine(target_date, time.max)
    
    utc_start = ist_start - IST_OFFSET
    utc_end = ist_end - IST_OFFSET
    return utc_start, utc_end

def get_ist_month_bounds_in_utc(year: Optional[int] = None, month: Optional[int] = None) -> Tuple[datetime, datetime]:
    """
    Returns (start_utc, end_utc) for the entire IST calendar month.
    """
    ist_now = get_ist_now()
    y = year or ist_now.year
    m = month or ist_now.month
    
    ist_start = datetime(y, m, 1, 0, 0, 0, 0)
    if m == 12:
        next_start = datetime(y + 1, 1, 1, 0, 0, 0, 0)
    else:
        next_start = datetime(y, m + 1, 1, 0, 0, 0, 0)
    ist_end = next_start - timedelta(microseconds=1)
    
    utc_start = ist_start - IST_OFFSET
    utc_end = ist_end - IST_OFFSET
    return utc_start, utc_end

def get_ist_year_bounds_in_utc(year: Optional[int] = None) -> Tuple[datetime, datetime]:
    """
    Returns (start_utc, end_utc) for the entire IST calendar year.
    """
    ist_now = get_ist_now()
    y = year or ist_now.year
    
    ist_start = datetime(y, 1, 1, 0, 0, 0, 0)
    ist_end = datetime(y, 12, 31, 23, 59, 59, 999999)
    
    utc_start = ist_start - IST_OFFSET
    utc_end = ist_end - IST_OFFSET
    return utc_start, utc_end

def convert_utc_to_ist(utc_dt: Optional[datetime]) -> Optional[datetime]:
    """Converts a UTC datetime object to IST datetime."""
    if utc_dt is None:
        return None
    return utc_dt + IST_OFFSET

def get_ist_date_expr(column: Any, dialect_name: str = "postgresql", fmt: str = "YYYY-MM-DD") -> Any:
    """
    Returns a SQL expression that formats UTC column into an IST date string (e.g. 'YYYY-MM-DD' or 'YYYY-MM').
    Compatible with both PostgreSQL and SQLite.
    """
    if dialect_name == "postgresql":
        if fmt == "YYYY-MM":
            return func.to_char(column + text("INTERVAL '330 minutes'"), 'YYYY-MM')
        return func.to_char(column + text("INTERVAL '330 minutes'"), 'YYYY-MM-DD')
    else:
        # SQLite
        if fmt == "YYYY-MM":
            return func.strftime('%Y-%m', column, '+330 minutes')
        return func.strftime('%Y-%m-%d', column, '+330 minutes')

