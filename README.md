# Cicero Online

A simple system for your shop and online selling: products, wholesale cost and selling price, stock, sales and parcels, suppliers (the stores or people you buy from), pending and paid supplier money, and expenses.

- **Frontend:** Next.js (React)
- **Backend:** Python (FastAPI) in `api/index.py`
- **Database:** a local file (SQLite) on your computer, or free PostgreSQL (Neon) for online use
- **Cost:** free (Vercel Hobby plan, Neon free tier, GitHub)

---

## 1. What you need installed (one time)

| Tool | Download | Check it works |
|---|---|---|
| Node.js 20 or newer (LTS) | https://nodejs.org | `node -v` |
| Python 3.10 or newer | https://python.org (on Windows, tick **"Add Python to PATH"**) | `python --version` |
| Git | https://git-scm.com | `git --version` |

---

## 2. Run on your computer

### Easiest way (Windows)
Unzip the folder and **double-click `start-windows.bat`**. The first run takes a few minutes. Then open **http://localhost:3000**.

### Manual way (Windows: Command Prompt or PowerShell)
```bash
cd cicero-online
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
npm install
npm run dev
```
**Mac or Linux:** use `python3 -m venv .venv` and then `source .venv/bin/activate`. Everything else is the same.

Then open **http://localhost:3000**.

**Every time after that:**
```bash
cd cicero-online
.venv\Scripts\activate
npm run dev
```

- Your data is saved in the file `cicero.db` inside the project folder. Back it up, or use **Settings → Download backup**.
- **Faster everyday mode:** `npm run desktop` builds an optimized version and runs it.
- **Password on your computer:** copy `.env.example` to `.env` and set `APP_PASSWORD=yourpassword`.

---

## 3. Put it online (GitHub + Vercel, free)

### Step A: Create a free database (Neon)
Vercel can't store files permanently, so the online version needs a database.
1. Go to https://neon.tech and sign up for free.
2. Create a project, for example `cicero`, in the region closest to you (Singapore or Frankfurt work well for Pakistan).
3. Copy the **connection string**. It looks like
   `postgresql://user:password@ep-xxxx.aws.neon.tech/neondb?sslmode=require`

### Step B: Upload the code to GitHub
Create an **empty private repository** on https://github.com/new named `cicero-online`. Then, inside the project folder, run:
```bash
git init
git add .
git commit -m "Cicero Online first version"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/cicero-online.git
git push -u origin main
```

### Step C: Deploy on Vercel
1. Go to https://vercel.com, sign up with GitHub, then **Add New → Project**, and import `cicero-online`.
2. Framework: **Next.js** (detected automatically). Leave the build settings as they are.
3. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `APP_PASSWORD` | a strong password (required: the site is public) |
   | `SECRET_KEY` | any long random text |

4. Click **Deploy**. You get a link like `https://cicero-online.vercel.app`.

### Updating later
Change the code and run:
```bash
git add .
git commit -m "update"
git push
```
Vercel redeploys automatically.

---

## 4. Use the same data on your computer and online (optional)

Put the **same Neon `DATABASE_URL`** in your local `.env` file. Your computer, your phone and the website will then all show the same data. If you leave it empty, your computer keeps its own separate offline data in `cicero.db`.

**Move local data to the online version:** in the local app, go to **Settings → Download backup**. Then, on the online site, go to **Settings → Restore from file**.

---

## 5. Supplier logins (supplier portal)

Each supplier can get their own username and password. When they log in, they see **only their own account**: goods they gave you, payments you made, and the pending balance. If you allow it, they can also see how many of their products are sold or still in stock. They **never** see your sales, profit, other suppliers or your private notes.

1. In **Settings → Website link**, add your Vercel address, e.g. `https://cicero-online.vercel.app`.
2. Go to **Suppliers** and click the 🔑 key icon on a supplier (or **Login access** on their statement page).
3. Click **Create login**, then **Send on WhatsApp** or **Copy message**.
4. The supplier opens the link, chooses **Supplier**, and logs in. They can change their password themselves.
5. To block a supplier, untick **Login is active**. To reset a forgotten password, set a new one in the same window.

⚠️ **Always set `APP_PASSWORD` on Vercel.** Without it, anyone with the link can open your full owner dashboard. To log in as the owner, choose the **Owner** tab on the login page.

## 6. Updating the code without losing data

Your local data lives in `cicero.db`, which is never inside the zip or on GitHub. To update with a new zip:
```bash
# 1. stop the app (Ctrl + C), then make a safety copy of the data
cp ~/Desktop/store/cicero-online/cicero.db ~/Desktop/cicero-backup.db
# 2. copy the new files OVER the old folder (this adds/replaces files, never deletes cicero.db)
rsync -a ~/Downloads/cicero-online/ ~/Desktop/store/cicero-online/
# 3. start again
cd ~/Desktop/store/cicero-online && source .venv/bin/activate && npm install && npm run dev
```
New features only ever add new tables, so old data stays as it is. Online (Neon) data is not affected by code updates at all.

---

## 7. How the money is calculated

- **Stock in** (taking products from a supplier) adds to your stock and adds to what you owe that supplier.
- **Payment** reduces what you owe. **Pending = opening balance + stock taken − paid.**
- **Sale profit** = what the customer pays − product cost − courier cost − packing/other cost.
- A **returned** parcel puts the goods back in stock. Its profit becomes minus the courier and packing cost (your loss on that parcel).
- A **cancelled** order is ignored completely.
- **Net profit** = sales profit − expenses.
- **Payments to receive** = sales marked "Not received" (COD still with the courier, or customer credit).

## 8. Project structure
```
api/index.py          Python backend (all API routes + database tables)
app/                  Next.js pages (dashboard, sales, products, stock-in, suppliers, payments, expenses, settings)
components/           Shared UI (forms, modals, sidebar)
lib/                  API helper + formatting
requirements.txt      Python packages
next.config.mjs       Sends /api/* to Python (localhost:8000 locally, serverless function on Vercel)
```
API docs (while running locally): http://localhost:8000/api/docs

## Troubleshooting
- **"Can't connect to the server"**: the Python part isn't running. Use `npm run dev` (it starts both parts), and make sure the `.venv` is activated first.
- **`python` not found on Windows**: reinstall Python with "Add to PATH" ticked, or try `py` instead of `python`.
- **Port 3000 or 8000 busy**: close the other running copy of the app.
- **Vercel shows the "data is temporary" banner**: `DATABASE_URL` isn't set in Vercel. Add it, then redeploy.
