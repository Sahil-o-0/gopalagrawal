from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, database, dependencies
from models.site import Site
from models.user import User

router = APIRouter(
    prefix="/sites",
    tags=["Site Management"]
)

@router.post("/", response_model=schemas.site.SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(
    site: schemas.site.SiteCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    existing_name = db.query(Site).filter(Site.name == site.name).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Site with name '{site.name}' already exists."
        )

    if site.code:
        existing_code = db.query(Site).filter(Site.code == site.code).first()
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Site with code '{site.code}' already exists."
            )

    new_site = Site(
        name=site.name,
        location=site.location,
        code=site.code,
        status=site.status or "ACTIVE"
    )
    db.add(new_site)
    db.commit()
    db.refresh(new_site)
    return new_site

@router.get("/", response_model=List[schemas.site.SiteResponse])
def get_all_sites(
    status_filter: Optional[str] = None,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    query = db.query(Site)
    if status_filter:
        query = query.filter(Site.status == status_filter.upper())
    return query.order_by(Site.id.asc()).all()

@router.get("/{site_id}", response_model=schemas.site.SiteResponse)
def get_site_by_id(
    site_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
):
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found."
        )
    return site

@router.patch("/{site_id}", response_model=schemas.site.SiteResponse)
def update_site(
    site_id: int,
    site_update: schemas.site.SiteUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: User = Depends(dependencies.get_manager_user)
):
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found."
        )

    update_data = site_update.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != site.name:
        existing = db.query(Site).filter(Site.name == update_data["name"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Site with name '{update_data['name']}' already exists."
            )

    if "code" in update_data and update_data["code"] and update_data["code"] != site.code:
        existing = db.query(Site).filter(Site.code == update_data["code"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Site with code '{update_data['code']}' already exists."
            )

    for key, value in update_data.items():
        setattr(site, key, value)

    db.commit()
    db.refresh(site)
    return site
