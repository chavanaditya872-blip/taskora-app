from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Category, User
from app.routers.deps import get_current_user
from app.schemas.all_schemas import CategoryCreate, CategoryOut

router = APIRouter()

@router.get("", response_model=List[CategoryOut])
def get_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Category).filter(Category.user_id == current_user.id).all()

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = Category(name=payload.name, color=payload.color or "#6366f1", user_id=current_user.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(cat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Category).filter(Category.id == cat_id, Category.user_id == current_user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(c)
    db.commit()
    return None
