"""
Cicero Online - backend API (FastAPI)

Runs locally with uvicorn (port 8000) and on Vercel as a Python serverless function.
Database:
  * DATABASE_URL set  -> PostgreSQL (e.g. free Neon / Supabase)
  * DATABASE_URL empty -> local SQLite file "cicero.db" in the project folder
"""
import os
import hmac
import hashlib
import datetime as dt
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import re
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, ForeignKey, func, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# --------------------------------------------------------------------------- env
def _load_env():
    """Tiny .env loader for local use (Vercel injects env vars itself)."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()

APP_PASSWORD = os.environ.get("APP_PASSWORD", "")
SECRET_KEY = os.environ.get("SECRET_KEY", "cicero-online-secret")
ON_VERCEL = bool(os.environ.get("VERCEL"))

DB_URL = os.environ.get("DATABASE_URL", "").strip()
TEMP_DB = False
if DB_URL.startswith("postgres://"):
    DB_URL = "postgresql://" + DB_URL[len("postgres://"):]
if not DB_URL:
    if ON_VERCEL:  # Vercel has no permanent disk -> temporary DB, warn in UI
        DB_URL = "sqlite:////tmp/cicero.db"
        TEMP_DB = True
    else:
        DB_URL = "sqlite:///" + os.path.join(ROOT, "cicero.db")
IS_SQLITE = DB_URL.startswith("sqlite")

engine_kwargs = {"connect_args": {"check_same_thread": False}} if IS_SQLITE else {"poolclass": NullPool}
engine = create_engine(DB_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


def now():
    return dt.datetime.now().isoformat(timespec="seconds")


def today():
    return dt.date.today().isoformat()


# ------------------------------------------------------------------------ models
class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(64), primary_key=True)
    value = Column(Text, default="")


class Supplier(Base):
    """A store / wholesaler / person you buy products from."""
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(60), default="")
    address = Column(Text, default="")
    notes = Column(Text, default="")
    opening_balance = Column(Float, default=0)  # amount you already owed before using the app
    created_at = Column(String(32), default=now)


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(80), default="")
    category = Column(String(120), default="")
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    cost_price = Column(Float, default=0)  # wholesale price you pay
    sale_price = Column(Float, default=0)  # price you sell at
    opening_stock = Column(Integer, default=0)
    low_stock = Column(Integer, default=3)
    notes = Column(Text, default="")
    created_at = Column(String(32), default=now)


class Purchase(Base):
    """Stock taken from a supplier (adds to stock and to what you owe)."""
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True)
    date = Column(String(10), default=today)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String(300), default="")
    qty = Column(Integer, default=1)
    unit_cost = Column(Float, default=0)
    bill_no = Column(String(80), default="")
    notes = Column(Text, default="")
    created_at = Column(String(32), default=now)


class Payment(Base):
    """Money you paid to a supplier."""
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    date = Column(String(10), default=today)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    amount = Column(Float, default=0)
    method = Column(String(60), default="Cash")
    reference = Column(String(120), default="")
    notes = Column(Text, default="")
    created_at = Column(String(32), default=now)


class Sale(Base):
    """A shop sale or an online order / parcel."""
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    date = Column(String(10), default=today)
    channel = Column(String(20), default="shop")  # shop | online
    customer = Column(String(200), default="")
    phone = Column(String(60), default="")
    city = Column(String(120), default="")
    address = Column(Text, default="")
    courier = Column(String(80), default="")
    tracking = Column(String(120), default="")
    status = Column(String(20), default="completed")
    payment_status = Column(String(20), default="paid")  # paid | unpaid
    discount = Column(Float, default=0)
    shipping_charged = Column(Float, default=0)  # delivery charge the customer pays
    shipping_cost = Column(Float, default=0)  # what the courier charges you
    other_cost = Column(Float, default=0)  # packaging, return charges, etc.
    notes = Column(Text, default="")
    created_at = Column(String(32), default=now)


class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    name = Column(String(200), default="")
    qty = Column(Integer, default=1)
    price = Column(Float, default=0)  # selling price per unit
    cost = Column(Float, default=0)  # your cost per unit (snapshot)


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    date = Column(String(10), default=today)
    category = Column(String(120), default="General")
    amount = Column(Float, default=0)
    notes = Column(Text, default="")
    created_at = Column(String(32), default=now)


class SupplierLogin(Base):
    """Login for a supplier to see their own account (new table - existing data is untouched)."""
    __tablename__ = "supplier_logins"
    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, unique=True)
    username = Column(String(80), nullable=False, unique=True)
    password_hash = Column(String(256), nullable=False)
    active = Column(Boolean, default=True)
    show_stock = Column(Boolean, default=False)
    last_login = Column(String(32), default="")
    created_at = Column(String(32), default=now)


MODELS = [Setting, Supplier, SupplierLogin, Product, Purchase, Payment, Sale, SaleItem, Expense]
DB_ERROR = ""
try:
    Base.metadata.create_all(engine)
except Exception as e:  # shown in the UI instead of crashing
    DB_ERROR = str(e)[:300]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------------------------------------------------------------- helpers
def row(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def r2(x):
    return round(float(x or 0), 2)


def apply(obj, data: dict):
    for k, v in data.items():
        setattr(obj, k, v)


def get_or_404(db, model, id_):
    obj = db.get(model, id_)
    if not obj:
        raise HTTPException(404, "Record not found")
    return obj


def bad(msg):
    raise HTTPException(400, msg)


CHANNELS = ("shop", "online")
STATUSES = ("completed", "pending", "packed", "shipped", "delivered", "returned", "cancelled")
INACTIVE = ("returned", "cancelled")
DEFAULT_SETTINGS = {"business_name": "Cicero Online", "currency": "Rs", "owner": "", "phone": "", "address": "", "site_url": ""}


# ------------------------------------------------------------------------ schemas
class LoginIn(BaseModel):
    password: str
    username: str = ""


class SettingsIn(BaseModel):
    business_name: str = "Cicero Online"
    currency: str = "Rs"
    owner: str = ""
    phone: str = ""
    address: str = ""
    site_url: str = ""


class AccessIn(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = ""
    active: bool = True
    show_stock: bool = False


class PasswordChangeIn(BaseModel):
    current: str
    new: str = Field(min_length=6, max_length=100)


class SupplierIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = ""
    address: str = ""
    notes: str = ""
    opening_balance: float = 0


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    sku: str = ""
    category: str = ""
    supplier_id: Optional[int] = None
    cost_price: float = Field(0, ge=0)
    sale_price: float = Field(0, ge=0)
    opening_stock: int = 0
    low_stock: int = Field(3, ge=0)
    notes: str = ""


class PurchaseIn(BaseModel):
    date: str = Field(default_factory=today)
    supplier_id: int
    product_id: Optional[int] = None
    new_product_name: str = ""
    new_product_sale_price: float = 0
    description: str = ""
    qty: int = Field(1, ge=1)
    unit_cost: float = Field(0, ge=0)
    bill_no: str = ""
    notes: str = ""
    update_cost: bool = True


class PaymentIn(BaseModel):
    date: str = Field(default_factory=today)
    supplier_id: int
    amount: float = Field(gt=0)
    method: str = "Cash"
    reference: str = ""
    notes: str = ""


class SaleItemIn(BaseModel):
    product_id: Optional[int] = None
    name: str = ""
    qty: int = Field(1, ge=1)
    price: float = Field(0, ge=0)
    cost: Optional[float] = None


class SaleIn(BaseModel):
    date: str = Field(default_factory=today)
    channel: str = "shop"
    customer: str = ""
    phone: str = ""
    city: str = ""
    address: str = ""
    courier: str = ""
    tracking: str = ""
    status: str = "completed"
    payment_status: str = "paid"
    discount: float = 0
    shipping_charged: float = 0
    shipping_cost: float = 0
    other_cost: float = 0
    notes: str = ""
    items: List[SaleItemIn] = Field(min_length=1)


class StatusIn(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None


class ExpenseIn(BaseModel):
    date: str = Field(default_factory=today)
    category: str = "General"
    amount: float = Field(gt=0)
    notes: str = ""


# --------------------------------------------------------------------------- app
app = FastAPI(title="Cicero Online API", docs_url="/api/docs", openapi_url="/api/openapi.json")
OPEN_PATHS = {"/api/login", "/api/status", "/api/docs", "/api/openapi.json"}


# ------------------------------------------------------------------- auth & roles
#  owner  -> logs in with APP_PASSWORD, sees everything
#  supplier -> logs in with username/password, sees only /api/portal/* (their own account)
def _sign(payload: str) -> str:
    return payload + "." + hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _owner_fp():
    return hashlib.sha256(("owner:" + APP_PASSWORD).encode()).hexdigest()[:16]


def owner_token():
    return _sign("owner:" + _owner_fp())


def supplier_token(lg):
    return _sign(f"sup:{lg.id}:{lg.password_hash[-16:]}")


def _verify(token: str):
    if not token or "." not in token:
        return None
    payload = token.rsplit(".", 1)[0]
    return payload if hmac.compare_digest(_sign(payload).encode(), token.encode()) else None


def hash_password(pw: str) -> str:
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 120_000).hex()
    return f"pbkdf2${salt}${h}"


def check_password(pw: str, stored: str) -> bool:
    try:
        _, salt, h = stored.split("$")
    except Exception:
        return False
    return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 120_000).hex(), h)


def _deny(msg, code=401):
    return JSONResponse({"detail": msg}, status_code=code)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path.rstrip("/") or "/"
    if not path.startswith("/api") or path in OPEN_PATHS or request.method == "OPTIONS":
        return await call_next(request)

    token = request.headers.get("authorization", "").replace("Bearer ", "", 1).strip()
    payload = _verify(token)
    role = None
    if payload and payload.startswith("owner:") and APP_PASSWORD and payload == "owner:" + _owner_fp():
        role = "owner"
    elif payload and payload.startswith("sup:"):
        try:
            _, lid, fp = payload.split(":")
            db = SessionLocal()
            try:
                lg = db.get(SupplierLogin, int(lid))
            finally:
                db.close()
            if lg and lg.active and lg.password_hash[-16:] == fp:
                role = "supplier"
                request.state.supplier_id = lg.supplier_id
                request.state.login_id = lg.id
                request.state.show_stock = bool(lg.show_stock)
        except Exception:
            role = None
    elif not APP_PASSWORD and not token:
        role = "owner"  # no owner password set (local computer use)

    if role is None:
        return _deny("Please log in")
    if path.startswith("/api/portal"):
        if role != "supplier":
            return _deny("This page is for supplier logins", 403)
    elif path != "/api/me" and role != "owner":
        return _deny("Not allowed", 403)
    request.state.role = role
    return await call_next(request)


@app.get("/api/status")
def status():
    count = 0
    try:
        db = SessionLocal()
        try:
            count = db.query(SupplierLogin).filter(SupplierLogin.active.is_(True)).count()
        finally:
            db.close()
    except Exception:
        pass
    return {
        "auth_required": bool(APP_PASSWORD),
        "db": "sqlite" if IS_SQLITE else "postgres",
        "temporary_db": TEMP_DB,
        "db_error": DB_ERROR,
        "supplier_logins": count,
    }


@app.get("/api/me")
def me(request: Request):
    return {"role": request.state.role, "supplier_id": getattr(request.state, "supplier_id", None)}


@app.post("/api/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    if username:  # supplier login
        lg = db.query(SupplierLogin).filter(SupplierLogin.username == username).first()
        if not lg or not check_password(data.password, lg.password_hash):
            bad("Wrong username or password")
        if not lg.active:
            bad("This login has been turned off. Please contact the shop.")
        lg.last_login = now()
        db.commit()
        return {"token": supplier_token(lg), "role": "supplier"}
    # owner login
    if not APP_PASSWORD:
        return {"token": "", "role": "owner"}
    if not hmac.compare_digest(data.password.encode(), APP_PASSWORD.encode()):
        bad("Wrong password")
    return {"token": owner_token(), "role": "owner"}


# ---------------------------------------------------------------------- settings
def read_settings(db):
    s = dict(DEFAULT_SETTINGS)
    for r in db.query(Setting):
        s[r.key] = r.value
    return s


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    return read_settings(db)


@app.put("/api/settings")
def put_settings(data: SettingsIn, db: Session = Depends(get_db)):
    for k, v in data.model_dump().items():
        obj = db.get(Setting, k)
        if obj:
            obj.value = v
        else:
            db.add(Setting(key=k, value=v))
    db.commit()
    return read_settings(db)


# --------------------------------------------------------------------- suppliers
def supplier_sums(db):
    pur = {sid: r2(t) for sid, t in db.query(Purchase.supplier_id, func.sum(Purchase.qty * Purchase.unit_cost)).group_by(Purchase.supplier_id)}
    pay = {sid: r2(t) for sid, t in db.query(Payment.supplier_id, func.sum(Payment.amount)).group_by(Payment.supplier_id)}
    return pur, pay


def supplier_out(s, pur, pay):
    d = row(s)
    d["purchased"] = pur.get(s.id, 0)
    d["paid"] = pay.get(s.id, 0)
    d["balance"] = r2((s.opening_balance or 0) + d["purchased"] - d["paid"])
    return d


@app.get("/api/suppliers")
def list_suppliers(db: Session = Depends(get_db)):
    pur, pay = supplier_sums(db)
    logins = {lg.supplier_id: lg for lg in db.query(SupplierLogin)}
    out = []
    for s in db.query(Supplier).order_by(func.lower(Supplier.name)):
        d = supplier_out(s, pur, pay)
        lg = logins.get(s.id)
        d["portal"] = {"username": lg.username, "active": bool(lg.active)} if lg else None
        out.append(d)
    return out


@app.post("/api/suppliers")
def create_supplier(data: SupplierIn, db: Session = Depends(get_db)):
    s = Supplier(**data.model_dump())
    db.add(s)
    db.commit()
    return supplier_out(s, {}, {})


@app.put("/api/suppliers/{sid}")
def update_supplier(sid: int, data: SupplierIn, db: Session = Depends(get_db)):
    s = get_or_404(db, Supplier, sid)
    apply(s, data.model_dump())
    db.commit()
    pur, pay = supplier_sums(db)
    return supplier_out(s, pur, pay)


@app.delete("/api/suppliers/{sid}")
def delete_supplier(sid: int, db: Session = Depends(get_db)):
    s = get_or_404(db, Supplier, sid)
    if db.query(Purchase).filter(Purchase.supplier_id == sid).count() or db.query(Payment).filter(Payment.supplier_id == sid).count():
        bad("This supplier has stock or payment records. Delete those first, or just rename the supplier.")
    db.query(Product).filter(Product.supplier_id == sid).update({Product.supplier_id: None})
    db.query(SupplierLogin).filter(SupplierLogin.supplier_id == sid).delete()
    db.delete(s)
    db.commit()
    return {"ok": True}


@app.get("/api/suppliers/{sid}/ledger")
def supplier_ledger(sid: int, db: Session = Depends(get_db)):
    s = get_or_404(db, Supplier, sid)
    pnames = {p.id: p.name for p in db.query(Product.id, Product.name)}
    entries = []
    for p in db.query(Purchase).filter(Purchase.supplier_id == sid):
        name = pnames.get(p.product_id) or p.description or "Item"
        entries.append({
            "kind": "purchase", "id": p.id, "date": p.date, "created_at": p.created_at,
            "description": f"{p.qty} × {name} @ {r2(p.unit_cost):g}", "ref": p.bill_no, "notes": p.notes,
            "debit": r2(p.qty * p.unit_cost), "credit": 0,
        })
    for p in db.query(Payment).filter(Payment.supplier_id == sid):
        entries.append({
            "kind": "payment", "id": p.id, "date": p.date, "created_at": p.created_at,
            "description": f"Payment ({p.method})", "ref": p.reference, "notes": p.notes,
            "debit": 0, "credit": r2(p.amount),
        })
    entries.sort(key=lambda e: (e["date"] or "", e["created_at"] or ""))
    bal = r2(s.opening_balance)
    for e in entries:
        bal = r2(bal + e["debit"] - e["credit"])
        e["balance"] = bal
    pur, pay = supplier_sums(db)
    return {"supplier": supplier_out(s, pur, pay), "entries": entries}


# ------------------------------------------------------- supplier logins (owner side)
USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,60}$")


def access_out(lg):
    if not lg:
        return {"exists": False}
    return {"exists": True, "username": lg.username, "active": bool(lg.active),
            "show_stock": bool(lg.show_stock), "last_login": lg.last_login or "", "created_at": lg.created_at}


@app.get("/api/suppliers/{sid}/access")
def get_access(sid: int, db: Session = Depends(get_db)):
    get_or_404(db, Supplier, sid)
    return access_out(db.query(SupplierLogin).filter(SupplierLogin.supplier_id == sid).first())


@app.put("/api/suppliers/{sid}/access")
def set_access(sid: int, data: AccessIn, db: Session = Depends(get_db)):
    get_or_404(db, Supplier, sid)
    username = data.username.strip().lower()
    if not USERNAME_RE.match(username):
        bad("Username can only use small letters, numbers, dot, dash or underscore (min 3)")
    if username == "admin":
        bad("Please choose another username")
    lg = db.query(SupplierLogin).filter(SupplierLogin.supplier_id == sid).first()
    taken = db.query(SupplierLogin).filter(SupplierLogin.username == username).first()
    if taken and (not lg or taken.id != lg.id):
        bad("This username is already used by another supplier")
    pw = data.password.strip()
    if pw and len(pw) < 6:
        bad("Password must be at least 6 characters")
    if not lg:
        if not pw:
            bad("Please set a password")
        lg = SupplierLogin(supplier_id=sid, username=username, password_hash=hash_password(pw))
        db.add(lg)
    else:
        lg.username = username
        if pw:
            lg.password_hash = hash_password(pw)  # also logs the supplier out of old sessions
    lg.active = data.active
    lg.show_stock = data.show_stock
    db.commit()
    return access_out(lg)


@app.delete("/api/suppliers/{sid}/access")
def delete_access(sid: int, db: Session = Depends(get_db)):
    db.query(SupplierLogin).filter(SupplierLogin.supplier_id == sid).delete()
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------- supplier portal
@app.get("/api/portal/me")
def portal_me(request: Request, db: Session = Depends(get_db)):
    s = get_or_404(db, Supplier, request.state.supplier_id)
    lg = db.get(SupplierLogin, request.state.login_id)
    st = read_settings(db)
    return {
        "supplier": {"id": s.id, "name": s.name, "phone": s.phone},
        "username": lg.username if lg else "",
        "show_stock": request.state.show_stock,
        "business": {k: st.get(k, "") for k in ("business_name", "currency", "phone", "address", "owner")},
    }


@app.get("/api/portal/ledger")
def portal_ledger(request: Request, db: Session = Depends(get_db)):
    sid = request.state.supplier_id
    data = supplier_ledger(sid, db)
    sup = data["supplier"]
    for e in data["entries"]:
        e.pop("notes", None)  # your private notes are never shown to suppliers
    result = {
        "supplier": {k: sup[k] for k in ("id", "name", "opening_balance", "purchased", "paid", "balance")},
        "entries": data["entries"],
        "products": [],
    }
    if request.state.show_stock:
        supplied = dict(
            db.query(Purchase.product_id, func.sum(Purchase.qty))
            .filter(Purchase.supplier_id == sid, Purchase.product_id.isnot(None))
            .group_by(Purchase.product_id).all()
        )
        for p in product_list(db):
            if p["id"] in supplied:
                result["products"].append({"name": p["name"], "supplied": int(supplied[p["id"]] or 0),
                                           "sold": p["sold"], "stock": p["stock"]})
    return result


@app.post("/api/portal/password")
def portal_password(data: PasswordChangeIn, request: Request, db: Session = Depends(get_db)):
    lg = get_or_404(db, SupplierLogin, request.state.login_id)
    if not check_password(data.current, lg.password_hash):
        bad("Current password is wrong")
    lg.password_hash = hash_password(data.new)
    db.commit()
    return {"token": supplier_token(lg)}


# ---------------------------------------------------------------------- products
def stock_info(db):
    bought = dict(db.query(Purchase.product_id, func.sum(Purchase.qty)).filter(Purchase.product_id.isnot(None)).group_by(Purchase.product_id).all())
    sold = dict(
        db.query(SaleItem.product_id, func.sum(SaleItem.qty))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(SaleItem.product_id.isnot(None), Sale.status.notin_(INACTIVE))
        .group_by(SaleItem.product_id).all()
    )
    return bought, sold


def product_list(db):
    bought, sold = stock_info(db)
    sups = {s.id: s.name for s in db.query(Supplier.id, Supplier.name)}
    out = []
    for p in db.query(Product).order_by(func.lower(Product.name)):
        d = row(p)
        d["bought"] = int(bought.get(p.id) or 0)
        d["sold"] = int(sold.get(p.id) or 0)
        d["stock"] = (p.opening_stock or 0) + d["bought"] - d["sold"]
        d["supplier_name"] = sups.get(p.supplier_id, "")
        out.append(d)
    return out


@app.get("/api/products")
def list_products(db: Session = Depends(get_db)):
    return product_list(db)


@app.post("/api/products")
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    p = Product(**data.model_dump())
    db.add(p)
    db.commit()
    return row(p)


@app.put("/api/products/{pid}")
def update_product(pid: int, data: ProductIn, db: Session = Depends(get_db)):
    p = get_or_404(db, Product, pid)
    apply(p, data.model_dump())
    db.commit()
    return row(p)


@app.delete("/api/products/{pid}")
def delete_product(pid: int, db: Session = Depends(get_db)):
    p = get_or_404(db, Product, pid)
    if db.query(Purchase).filter(Purchase.product_id == pid).count() or db.query(SaleItem).filter(SaleItem.product_id == pid).count():
        bad("This product is used in stock-in or sales records, so it can't be deleted. You can edit it instead.")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- purchases (stock in)
def purchase_rows(db, items):
    sups = {s.id: s.name for s in db.query(Supplier.id, Supplier.name)}
    prods = {p.id: p.name for p in db.query(Product.id, Product.name)}
    out = []
    for p in items:
        d = row(p)
        d["total"] = r2(p.qty * p.unit_cost)
        d["supplier_name"] = sups.get(p.supplier_id, "")
        d["product_name"] = prods.get(p.product_id) or p.description or "—"
        out.append(d)
    return out


def save_purchase(db, obj, data: PurchaseIn):
    if not db.get(Supplier, data.supplier_id):
        bad("Please choose a supplier")
    pid = data.product_id
    if not pid and data.new_product_name.strip():
        np = Product(name=data.new_product_name.strip(), supplier_id=data.supplier_id,
                     cost_price=data.unit_cost, sale_price=data.new_product_sale_price)
        db.add(np)
        db.flush()
        pid = np.id
    if pid:
        p = db.get(Product, pid)
        if not p:
            bad("Product not found")
        if data.update_cost:
            p.cost_price = data.unit_cost
        if not p.supplier_id:
            p.supplier_id = data.supplier_id
    elif not data.description.strip():
        bad("Choose a product, add a new one, or write a description")
    fields = data.model_dump(exclude={"new_product_name", "new_product_sale_price", "update_cost"})
    fields["product_id"] = pid
    apply(obj, fields)


@app.get("/api/purchases")
def list_purchases(supplier_id: Optional[int] = None, date_from: str = "", date_to: str = "", db: Session = Depends(get_db)):
    q = db.query(Purchase)
    if supplier_id:
        q = q.filter(Purchase.supplier_id == supplier_id)
    if date_from:
        q = q.filter(Purchase.date >= date_from)
    if date_to:
        q = q.filter(Purchase.date <= date_to)
    return purchase_rows(db, q.order_by(Purchase.date.desc(), Purchase.id.desc()).all())


@app.post("/api/purchases")
def create_purchase(data: PurchaseIn, db: Session = Depends(get_db)):
    p = Purchase()
    save_purchase(db, p, data)
    db.add(p)
    db.commit()
    return purchase_rows(db, [p])[0]


@app.put("/api/purchases/{pid}")
def update_purchase(pid: int, data: PurchaseIn, db: Session = Depends(get_db)):
    p = get_or_404(db, Purchase, pid)
    save_purchase(db, p, data)
    db.commit()
    return purchase_rows(db, [p])[0]


@app.delete("/api/purchases/{pid}")
def delete_purchase(pid: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Purchase, pid))
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------- payments
def payment_rows(db, items):
    sups = {s.id: s.name for s in db.query(Supplier.id, Supplier.name)}
    out = []
    for p in items:
        d = row(p)
        d["supplier_name"] = sups.get(p.supplier_id, "")
        out.append(d)
    return out


@app.get("/api/payments")
def list_payments(supplier_id: Optional[int] = None, date_from: str = "", date_to: str = "", db: Session = Depends(get_db)):
    q = db.query(Payment)
    if supplier_id:
        q = q.filter(Payment.supplier_id == supplier_id)
    if date_from:
        q = q.filter(Payment.date >= date_from)
    if date_to:
        q = q.filter(Payment.date <= date_to)
    return payment_rows(db, q.order_by(Payment.date.desc(), Payment.id.desc()).all())


@app.post("/api/payments")
def create_payment(data: PaymentIn, db: Session = Depends(get_db)):
    if not db.get(Supplier, data.supplier_id):
        bad("Please choose a supplier")
    p = Payment(**data.model_dump())
    db.add(p)
    db.commit()
    return payment_rows(db, [p])[0]


@app.put("/api/payments/{pid}")
def update_payment(pid: int, data: PaymentIn, db: Session = Depends(get_db)):
    p = get_or_404(db, Payment, pid)
    if not db.get(Supplier, data.supplier_id):
        bad("Please choose a supplier")
    apply(p, data.model_dump())
    db.commit()
    return payment_rows(db, [p])[0]


@app.delete("/api/payments/{pid}")
def delete_payment(pid: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Payment, pid))
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ sales / parcels
def items_by_sale(db, ids=None):
    q = db.query(SaleItem)
    if ids is not None:
        if not ids:
            return {}
        q = q.filter(SaleItem.sale_id.in_(ids))
    out = {}
    for it in q.order_by(SaleItem.id):
        out.setdefault(it.sale_id, []).append(it)
    return out


def sale_calc(s, items):
    subtotal = sum((i.qty or 0) * (i.price or 0) for i in items)
    goods = sum((i.qty or 0) * (i.cost or 0) for i in items)
    bill = subtotal - (s.discount or 0) + (s.shipping_charged or 0)
    extra = (s.shipping_cost or 0) + (s.other_cost or 0)
    if s.status == "cancelled":
        revenue, profit = 0, 0
    elif s.status == "returned":
        revenue, profit = 0, -extra  # goods come back to stock, delivery cost is lost
    else:
        revenue, profit = bill, bill - goods - extra
    return {"subtotal": r2(subtotal), "goods_cost": r2(goods), "bill": r2(bill), "revenue": r2(revenue),
            "profit": r2(profit), "qty": sum(i.qty or 0 for i in items)}


def sale_out(s, items):
    d = row(s)
    d["items"] = [row(i) for i in items]
    d.update(sale_calc(s, items))
    return d


def save_sale(db, s, data: SaleIn):
    if data.channel not in CHANNELS:
        bad("Invalid channel")
    if data.status not in STATUSES:
        bad("Invalid status")
    if data.payment_status not in ("paid", "unpaid"):
        bad("Invalid payment status")
    apply(s, data.model_dump(exclude={"items"}))
    if s.id is None:
        db.add(s)
        db.flush()
    else:
        db.query(SaleItem).filter(SaleItem.sale_id == s.id).delete()
    for it in data.items:
        name, cost = it.name.strip(), it.cost
        if it.product_id:
            p = db.get(Product, it.product_id)
            if not p:
                bad("Product not found")
            name = name or p.name
            if cost is None:
                cost = p.cost_price
        if not name:
            bad("Each item needs a product or a name")
        db.add(SaleItem(sale_id=s.id, product_id=it.product_id or None, name=name, qty=it.qty, price=it.price, cost=cost or 0))


@app.get("/api/sales")
def list_sales(channel: str = "", status: str = "", payment_status: str = "", q: str = "",
               date_from: str = "", date_to: str = "", db: Session = Depends(get_db)):
    query = db.query(Sale)
    if channel:
        query = query.filter(Sale.channel == channel)
    if status:
        query = query.filter(Sale.status == status)
    if payment_status:
        query = query.filter(Sale.payment_status == payment_status)
    if date_from:
        query = query.filter(Sale.date >= date_from)
    if date_to:
        query = query.filter(Sale.date <= date_to)
    if q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.filter(
            func.lower(Sale.customer).like(like) | func.lower(Sale.phone).like(like)
            | func.lower(Sale.tracking).like(like) | func.lower(Sale.city).like(like)
        )
    sales = query.order_by(Sale.date.desc(), Sale.id.desc()).all()
    items = items_by_sale(db, [s.id for s in sales])
    return [sale_out(s, items.get(s.id, [])) for s in sales]


@app.post("/api/sales")
def create_sale(data: SaleIn, db: Session = Depends(get_db)):
    s = Sale()
    save_sale(db, s, data)
    db.commit()
    return sale_out(s, items_by_sale(db, [s.id]).get(s.id, []))


@app.put("/api/sales/{sid}")
def update_sale(sid: int, data: SaleIn, db: Session = Depends(get_db)):
    s = get_or_404(db, Sale, sid)
    save_sale(db, s, data)
    db.commit()
    return sale_out(s, items_by_sale(db, [s.id]).get(s.id, []))


@app.patch("/api/sales/{sid}/status")
def update_sale_status(sid: int, data: StatusIn, db: Session = Depends(get_db)):
    s = get_or_404(db, Sale, sid)
    if data.status is not None:
        if data.status not in STATUSES:
            bad("Invalid status")
        s.status = data.status
    if data.payment_status is not None:
        if data.payment_status not in ("paid", "unpaid"):
            bad("Invalid payment status")
        s.payment_status = data.payment_status
    db.commit()
    return sale_out(s, items_by_sale(db, [s.id]).get(s.id, []))


@app.delete("/api/sales/{sid}")
def delete_sale(sid: int, db: Session = Depends(get_db)):
    s = get_or_404(db, Sale, sid)
    db.query(SaleItem).filter(SaleItem.sale_id == sid).delete()
    db.delete(s)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------- expenses
@app.get("/api/expenses")
def list_expenses(date_from: str = "", date_to: str = "", db: Session = Depends(get_db)):
    q = db.query(Expense)
    if date_from:
        q = q.filter(Expense.date >= date_from)
    if date_to:
        q = q.filter(Expense.date <= date_to)
    return [row(e) for e in q.order_by(Expense.date.desc(), Expense.id.desc())]


@app.post("/api/expenses")
def create_expense(data: ExpenseIn, db: Session = Depends(get_db)):
    e = Expense(**data.model_dump())
    db.add(e)
    db.commit()
    return row(e)


@app.put("/api/expenses/{eid}")
def update_expense(eid: int, data: ExpenseIn, db: Session = Depends(get_db)):
    e = get_or_404(db, Expense, eid)
    apply(e, data.model_dump())
    db.commit()
    return row(e)


@app.delete("/api/expenses/{eid}")
def delete_expense(eid: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Expense, eid))
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------- dashboard
def month_shift(m, k):
    y, mm = map(int, m.split("-"))
    idx = y * 12 + mm - 1 - k
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


@app.get("/api/dashboard")
def dashboard(month: str = "", db: Session = Depends(get_db)):
    try:
        month = month if month and month_shift(month, 0) else dt.date.today().strftime("%Y-%m")
    except Exception:
        month = dt.date.today().strftime("%Y-%m")
    months = [month_shift(month, k) for k in range(5, -1, -1)]
    trend = {m: {"month": m, "revenue": 0, "profit": 0, "expenses": 0, "orders": 0} for m in months}

    sales = db.query(Sale).all()
    items = items_by_sale(db)
    m = {"revenue": 0, "gross_profit": 0, "orders": 0, "shop": 0, "online": 0, "items": 0}
    status_counts = {k: 0 for k in STATUSES}
    active_orders = 0
    receivable = 0
    recent = []
    for s in sales:
        c = sale_calc(s, items.get(s.id, []))
        mon = (s.date or "")[:7]
        if mon in trend and s.status != "cancelled":
            trend[mon]["revenue"] += c["revenue"]
            trend[mon]["profit"] += c["profit"]
            trend[mon]["orders"] += 1
        if mon == month:
            if s.channel == "online":
                status_counts[s.status] = status_counts.get(s.status, 0) + 1
            if s.status != "cancelled":
                m["revenue"] += c["revenue"]
                m["gross_profit"] += c["profit"]
                m["orders"] += 1
                m[s.channel] = m.get(s.channel, 0) + c["revenue"]
                if s.status != "returned":
                    m["items"] += c["qty"]
        if s.channel == "online" and s.status in ("pending", "packed", "shipped"):
            active_orders += 1
        if s.status not in INACTIVE and s.payment_status == "unpaid":
            receivable += c["bill"]
    for s in sorted(sales, key=lambda x: (x.date or "", x.id), reverse=True)[:6]:
        recent.append(sale_out(s, items.get(s.id, [])))

    expenses_month = 0
    for e in db.query(Expense):
        mon = (e.date or "")[:7]
        if mon in trend:
            trend[mon]["expenses"] += e.amount or 0
        if mon == month:
            expenses_month += e.amount or 0
    for t in trend.values():
        t["net"] = r2(t["profit"] - t["expenses"])
        for k in ("revenue", "profit", "expenses"):
            t[k] = r2(t[k])

    purchases_month = sum((p.qty or 0) * (p.unit_cost or 0) for p in db.query(Purchase) if (p.date or "")[:7] == month)
    paid_month = sum(p.amount or 0 for p in db.query(Payment) if (p.date or "")[:7] == month)

    pur, pay = supplier_sums(db)
    suppliers = [supplier_out(s, pur, pay) for s in db.query(Supplier)]
    payable = sum(s["balance"] for s in suppliers if s["balance"] > 0)
    top_suppliers = sorted([s for s in suppliers if s["balance"] > 0], key=lambda s: -s["balance"])[:5]

    products = product_list(db)
    stock_value = sum(p["stock"] * (p["cost_price"] or 0) for p in products if p["stock"] > 0)
    retail_value = sum(p["stock"] * (p["sale_price"] or 0) for p in products if p["stock"] > 0)
    low = [p for p in products if p["stock"] <= (p["low_stock"] or 0)][:8]

    return {
        "month": month,
        "revenue": r2(m["revenue"]), "gross_profit": r2(m["gross_profit"]),
        "expenses": r2(expenses_month), "net_profit": r2(m["gross_profit"] - expenses_month),
        "orders": m["orders"], "items_sold": m["items"],
        "shop_revenue": r2(m["shop"]), "online_revenue": r2(m["online"]),
        "purchases": r2(purchases_month), "paid_to_suppliers": r2(paid_month),
        "payable": r2(payable), "receivable": r2(receivable), "active_orders": active_orders,
        "stock_value": r2(stock_value), "retail_value": r2(retail_value),
        "product_count": len(products), "status_counts": status_counts,
        "top_suppliers": top_suppliers, "low_stock": low, "recent_sales": recent,
        "trend": [trend[x] for x in months],
    }


# -------------------------------------------------------------- backup / restore
@app.get("/api/backup")
def backup(db: Session = Depends(get_db)):
    return {
        "app": "cicero-online", "version": 1, "exported_at": now(),
        "data": {M.__tablename__: [row(o) for o in db.query(M)] for M in MODELS},
    }


@app.post("/api/restore")
def restore(payload: dict, db: Session = Depends(get_db)):
    data = payload.get("data")
    if payload.get("app") != "cicero-online" or not isinstance(data, dict):
        bad("This is not a Cicero Online backup file")
    try:
        for M in reversed(MODELS):
            db.query(M).delete()
        db.flush()
        for M in MODELS:
            cols = {c.name for c in M.__table__.columns}
            for r in data.get(M.__tablename__, []) or []:
                db.add(M(**{k: v for k, v in r.items() if k in cols}))
            db.flush()
        if not IS_SQLITE:
            for M in MODELS:
                if "id" in M.__table__.columns:
                    t = M.__tablename__
                    db.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), COALESCE((SELECT MAX(id) FROM {t}), 0) + 1, false)"
                    ))
        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        bad(f"Restore failed: {str(e)[:200]}")
    return {"ok": True, "counts": {k: len(v or []) for k, v in data.items()}}
