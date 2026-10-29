# Putting «نبض» online (free)

Three free services, each doing one job:

| Part | Service | Free limit that matters |
|---|---|---|
| Database | **Supabase** | 500 MB. Pauses only after 7 days with no activity, and our reminder clock queries it every minute. |
| Server (API + reminders) | **Render** | Sleeps after 15 min with no visitors. Step 3 keeps it awake. 750 h/month covers one service all month. |
| Website | **GitHub Pages** | The repo must be public. |
| Keep-awake | **UptimeRobot** | Checks every 5 min. |

Time needed: about 45 minutes. Sign up to every service with your GitHub account. None of them asks for a card.

You will collect a few values along the way. Keep them in a notepad (not in the repo):

- `DATABASE_URL`: from step 1
- `JWT_SECRET`: from step 2
- the server address, e.g. `https://nabd-api.onrender.com`: from step 2

---

## 1. Database (Supabase)

1. Go to **supabase.com → Start your project → Continue with GitHub**.
2. **New project**:
   - Name: `nabd`
   - Database password: press **Generate a password**, then copy it.
     If you type your own, use **only letters and digits**. Characters like `@ # / : ?` break the connection link.
   - Region: **Central EU (Frankfurt)**, the closest to Syria.
   - Under *Security options*, **untick "Enable Data API"** (if you miss it: Project Settings → Data API → turn it off). We don't use it, and leaving it on exposes the tables through Supabase's own API.
   - Create, then wait 1–2 minutes.
3. Press **Connect** (top of the page) → **Connection String** → choose **Session pooler**.
   Use *Session pooler*, not *Direct connection*. Render can't reach the direct address.
   Copy the link. It looks like:
   ```
   postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` (including the brackets) with your password. **This is your `DATABASE_URL`.**
4. Create the tables and load the medicine catalog from your laptop. Open PowerShell in the project folder:
   ```powershell
   $env:DATABASE_URL = "paste-your-DATABASE_URL-here"
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" $env:DATABASE_URL -f database\database_setup.sql
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" $env:DATABASE_URL -f database\medicines_catalog.sql
   ```
   The catalog takes a minute. A line like `unrecognized configuration parameter` is harmless. An error on `CREATE TABLE` is not, so stop and check.
5. Create the demo account in the online database, still in the same window:
   ```powershell
   cd server
   npm run seed:demo
   cd ..
   Remove-Item Env:DATABASE_URL
   ```
   The last line matters. Without it, anything you run in this window afterwards talks to the **online** database instead of your local one.

Check: in Supabase → **Table Editor** you should see `users`, `members`, `medicines_catalog` (6818 rows), and so on.

---

## 2. Server (Render)

1. Go to **render.com → Get Started → GitHub**.
2. **New + → Web Service** → pick the `medtrack` repository (allow Render to see it if asked).
3. Fill in:
   | Field | Value |
   |---|---|
   | Name | `nabd-api` (if taken, add something, e.g. `nabd-api-iust`) |
   | Branch | `redesign-bolt` (later `main`, after merging) |
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `node index.js` |
   | Instance Type | **Free** |
4. **Environment Variables** → add each of these:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | from step 1 |
   | `JWT_SECRET` | a new random value. Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output |
   | `VAPID_PUBLIC` | copy from `server/.env` |
   | `VAPID_PRIVATE` | copy from `server/.env` |
   | `VAPID_SUBJECT` | copy from `server/.env` |
   | `TZ` | `Asia/Damascus`. Without it, every reminder arrives 3 hours off |
   | `PUBLIC_URL` | `https://waseemnasser.github.io/medtrack` (doctor-share and QR links point here) |
   | `TRUST_PROXY` | `1` |
   | `NODE_VERSION` | `22` |
5. **Deploy Web Service**. The first build takes 2–4 minutes. The log should end with
   `Server running on port 10000` (Render chooses the port).
6. Open `https://nabd-api.onrender.com/api/health` (use your own name). You should see `{"ok":true,...}`.
   **This address (without `/api/health`) is your server address.**

Every `git push` to that branch redeploys the server by itself.

---

## 3. Keep the server awake (UptimeRobot)

A sleeping server sends no reminders. A visit every 5 minutes keeps it awake.

1. Go to **uptimerobot.com → Register for FREE**.
2. **New monitor** → type **HTTP(s)** → URL: `https://nabd-api.onrender.com/api/health` → interval **5 minutes** → Create.

---

## 4. Website (GitHub Pages)

1. Create the file `client/.env.production` with one line (your server address + `/api`):
   ```
   VITE_API_URL=https://nabd-api.onrender.com/api
   ```
   This isn't a secret. Commit it so the team builds the same site.
2. Publish:
   ```powershell
   cd client
   npm run deploy:pages
   ```
   This builds the site and pushes it to the `gh-pages` branch.
3. Only the first time: on GitHub → repo **Settings → Pages** → *Source: Deploy from a branch* → `gh-pages` / `(root)` → Save.
   If the repo is private, make it public first (**Settings → General → Danger Zone → Change visibility**). Free Pages needs a public repo.
4. Wait 1–2 minutes, then open **https://waseemnasser.github.io/medtrack/**

To update the site later, run `npm run deploy:pages` again.

---

## 5. Testing checklist

Do these in order. Tick each one.

**Laptop**
- [ ] The landing page opens, and «ابدأ الآن» leads to the login/register screens.
- [ ] Log in with `demo@nabd.test` / `nabd-demo-2026`. The very first request after a sleep can take up to a minute, which is normal on the free tier.
- [ ] Today, the family, a profile, appointments and the emergency card all show data.
- [ ] Search for a medicine in Arabic in the add-medicine form (the catalog is online).

**Phone** (this is what hosting makes possible)
- [ ] Open the site address on the phone.
- [ ] Install it. Android/Chrome: **⋮ → Install app**. iPhone/Safari: **Share → Add to Home Screen** (iOS 16.4 or later).
- [ ] Open «نبض» **from the home-screen icon** (on iPhone, notifications only work this way).
- [ ] Account → turn notifications on → «إرسال إشعار تجريبي». It should arrive within seconds.
- [ ] Real reminder: add a medicine with a dose **3 minutes from now**, close the app, wait. The «حان وقت الجرعة» notification should arrive on time (Damascus time).
- [ ] Emergency card → create a share link → open it on a **second** phone. It must work without logging in.
- [ ] Voice confirmation: works in Chrome on Android. Safari support is limited, so use the tap button there.

**Team**
- [ ] Each partner registers their own account on the site and adds a family member and a medicine.

---

## When something goes wrong

| What you see | Cause and fix |
|---|---|
| Render log: `password authentication failed` | The password in `DATABASE_URL` is wrong, or still has the `[ ]` brackets. |
| On your laptop, `psql` says `server closed the connection unexpectedly` or `timeout expired` | Your network blocks port 5432. For the laptop steps only, change `:5432/` to `:6543/` in the link (`$env:DATABASE_URL = $env:DATABASE_URL -replace ':5432/', ':6543/'`). Keep `:5432` on Render. |
| Render log: `ENETUNREACH` or `ENOTFOUND` | You used the *Direct connection* link. Use **Session pooler**. |
| Site says it can't reach the server | `VITE_API_URL` is wrong, missing `/api`, or the site was published before you created the file. Fix it and run `npm run deploy:pages` again. |
| Reminders arrive 3 hours early or late | `TZ` is missing on Render. |
| No notification on iPhone | The app was opened from Safari, not from the home-screen icon. |
| «محاولات كثيرة» on login | The protection limit is 10 logins per 15 minutes per address. Wait. |
| Everything is slow at first, then fine | The server was asleep. Check that the UptimeRobot monitor is running. |

Logs: Render → your service → **Logs**. Reminders show up as `[push] تذكير: ...` lines.
