from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from typing import List, Optional

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.config import settings
from app.models.user import User, UserRole
from app.schemas.user_schema import UserOut, UserCreate, UserUpdate, PasswordResetRequest, LoginRequest
from app.core.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    username: str = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user

def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Owner or Admin privileges required"
        )
    return current_user

@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Universal login supporting both JSON payload (React frontend)
    and Form-encoded payload (OAuth2 standard & Swagger UI).
    """
    content_type = request.headers.get("content-type", "")
    username = ""
    password = ""

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = str(body.get("username", "")).strip()
            password = str(body.get("password", ""))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
    else:
        try:
            form = await request.form()
            username = str(form.get("username", "")).strip()
            password = str(form.get("password", ""))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid Form data")

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive account")

    # If plain_password not set, sync it on successful login
    if not user.plain_password:
        user.plain_password = password

    user.last_login = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    log_action(db, user_id=user.id, action_type="LOGIN", entity="USER", entity_id=str(user.id))
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user)
    }

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

# --- Staff / User Administration (Owner Only) ---

@router.get("/users", response_model=List[UserOut])
def list_all_users(current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    """Owner only: List all staff and admin accounts including plain passwords for admin view."""
    users = db.query(User).order_by(User.id).all()
    # Backfill default passwords for display if empty
    for u in users:
        if not u.plain_password:
            if u.username in ['admin', 'somesh']:
                u.plain_password = 'somesh123'
            elif u.username == 'staff':
                u.plain_password = 'staff'
            elif u.username == 'cashier':
                u.plain_password = 'cashier'
    db.commit()
    return users

@router.post("/users", response_model=UserOut)
def create_staff_user(
    user_in: UserCreate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Owner only: Create a new cashier / staff account."""
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{user_in.username}' already exists")

    hashed_pw = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        password_hash=hashed_pw,
        plain_password=user_in.password,
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=user_in.is_active
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(db, user_id=current_user.id, action_type="CREATE_USER", entity="USER", entity_id=str(user.id), details={"username": user.username, "role": user.role.value})
    return user

@router.put("/users/{user_id}", response_model=UserOut)
def update_staff_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Owner only: Edit staff details, role, or password."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_in.username and user_in.username.strip():
        check_dup = db.query(User).filter(User.username == user_in.username.strip(), User.id != user_id).first()
        if check_dup:
            raise HTTPException(status_code=400, detail=f"Username '{user_in.username}' is already taken")
        user.username = user_in.username.strip()

    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password:
        user.password_hash = get_password_hash(user_in.password)
        user.plain_password = user_in.password

    db.commit()
    db.refresh(user)
    log_action(db, user_id=current_user.id, action_type="UPDATE_USER", entity="USER", entity_id=str(user.id))
    return user

@router.post("/users/reset-password")
def reset_staff_password(
    req: PasswordResetRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Owner only: 1-click password reset for counter staff."""
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(req.new_password)
    user.plain_password = req.new_password
    db.commit()
    log_action(db, user_id=current_user.id, action_type="RESET_PASSWORD", entity="USER", entity_id=str(user.id))
    return {"message": f"Password for {user.username} reset successfully", "plain_password": req.new_password}

@router.delete("/users/{user_id}")
def deactivate_staff_user(
    user_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Owner only: Deactivate staff account."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own active owner account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()
    return {"message": f"User {user.username} deactivated"}
