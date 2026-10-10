# SpotDiary Staging, Production & Operations Runbook

---

## 1. Architecture & Hosting Strategy

SpotDiary comprises a **Next.js 14 App Router** web and API backend (`apps/web`), an **Expo React Native** mobile client (`apps/mobile`), a shared business logic and validation library (`packages/shared`), and a **MongoDB** persistence layer.

```
                              ┌──────────────────────────────────────┐
                              │       Google Places API (New)        │
                              └──────────────────┬───────────────────┘
                                                 │ (Server-side only)
                                                 ▼
┌─────────────────────────┐          ┌───────────────────────────────────────┐          ┌─────────────────────────┐
│ Next.js Web Client      │          │        Next.js App Router API         │          │ Expo Android/iOS Client │
│ - HTTPS Cookies         │<────────>│        - Node.js 18+ Runtime          │<────────>│ - SecureStore Tokens    │
│ - Responsive UI         │          │        - Zod Input Validation         │          │ - Bearer Auth Header    │
└─────────────────────────┘          └──────────────────┬────────────────────┘          └─────────────────────────┘
                                                        │
                                         ┌──────────────┴──────────────┐
                                         ▼                             ▼
                          ┌────────────────────────────┐ ┌───────────────────────────┐
                          │   MongoDB Atlas Cluster    │ │    AWS S3 / S3-Compatible │
                          │ - Replica Set / Auto Backup│ │ - SigV4 Signed Uploads    │
                          │ - Users, Visits, Photos    │ │ - Public / CDN Access     │
                          │ - Connection Pooling       │ │ - 5MB / Magic-Byte Checks │
                          └────────────────────────────┘ └───────────────────────────┘
```

### Hosting Architecture Comparison & Recommendation

| Component | Architecture Recommendation | Hosting Providers | Rationale |
|---|---|---|---|
| **Web & API Backend** | **Containerized Node.js (Docker / PaaS)** | AWS App Runner, Railway, Render, Fly.io, or DigitalOcean App Platform | Next.js App Router API routes execute native Node.js libraries (`mongodb`, `bcryptjs`, `crypto`, `Buffer`). Serverless platforms (e.g. Vercel) impose a strict **4.5 MB request payload limit**, which would truncate 5.0 MB photo uploads. Containerized hosting allows full 5MB+ request body streaming and maintains steady MongoDB connection pools. |
| **Database** | **MongoDB Atlas (M0 Free Tier for Staging, M10+ for Prod)** | MongoDB Atlas (AWS Region: `ap-south-1` Mumbai) | Managed replica set, automated backups, continuous monitoring, and fine-grained IP access list security. |
| **Media Storage** | **AWS S3 / Cloudflare R2 + CloudFront CDN** | AWS S3 (`ap-south-1`) or Cloudflare R2 | Ephemeral serverless disks cannot persist visit photos. SigV4 authenticated direct PUT/DELETE ensures reliable media storage. |
| **Transactional Email** | **Resend / SendGrid API** | Resend or SendGrid | Low-latency API-based dispatch with webhook support and dedicated domain DKIM/SPF verification. |
| **Mobile Client** | **Expo EAS Build** | Google Play Store Internal Track / TestFlight | Standalone native APK/AAB compiled against staging API URL (`https://staging-api.spotdiary.app`). |

---

## 2. Environment Variables & Staging Configuration

> [!CAUTION]
> Never commit `.env`, `.env.local`, or any file containing real credentials to source control.
> Never prefix backend secrets (`JWT_SECRET`, `MONGODB_URI`, `AWS_*`, `GOOGLE_MAPS_*`) with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

### A. Web Backend Staging Environment Variables (`apps/web`)

```env
# Runtime Environment
NODE_ENV=production
PORT=3000

# Canonical Public URLs
APP_URL=https://staging.spotdiary.app
NEXT_PUBLIC_APP_URL=https://staging.spotdiary.app

# Database Connection (MongoDB Atlas Staging Cluster)
# Note: maxPoolSize and retryWrites configured for connection health
MONGODB_URI=mongodb+srv://<staging_user>:<staging_password>@<staging_cluster>.mongodb.net/spotdiary_staging?retryWrites=true&w=majority&maxPoolSize=20

# JWT Cryptographic Secret (MANDATORY: Minimum 32 random characters in production)
# Generate via: openssl rand -hex 32
JWT_SECRET=your_staging_jwt_secret_min_32_chars_here

# Google Places Platform (Kept strictly server-side; NEVER exposed to clients)
GOOGLE_MAPS_API_KEY=your-staging-google-maps-api-key-here

# Object Storage Configuration (MANDATORY in production)
STORAGE_TYPE=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=spotdiary-staging-media
AWS_ACCESS_KEY_ID=your-staging-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-staging-aws-secret-access-key

# Transactional Email Delivery (Choose Resend OR SMTP)
RESEND_API_KEY=your-staging-resend-api-key
EMAIL_FROM=SpotDiary Staging <noreply@staging.spotdiary.app>
# OR:
# SMTP_HOST=smtp.sendgrid.net
# SMTP_PORT=587
# SMTP_USER=apikey
# SMTP_PASS=staging_smtp_password_here
# SMTP_FROM=noreply@staging.spotdiary.app
```

### B. Mobile App Staging Environment Variables (`apps/mobile`)

```env
# Mobile App Points to Staging Backend
EXPO_PUBLIC_API_BASE_URL=https://staging.spotdiary.app
```

---

## 3. Staging Deployment Commands & Setup Instructions

### Step 1: Pre-Deployment Build Validation
Run local verification builds before deploying code:
```powershell
# 1. Build shared contract library
npm --prefix packages/shared run build

# 2. Check TypeScript types
npx tsc -p apps/web/tsconfig.json --noEmit
npx tsc -p apps/mobile/tsconfig.json --noEmit

# 3. Compile Next.js production build
npm --prefix apps/web run build
```

### Step 2: Containerized Staging Deployment
When deploying to Docker, AWS App Runner, Railway, or Render:

**Build Command:**
```bash
npm install && npm --prefix packages/shared run build && npm --prefix apps/web run build
```

**Start Command:**
```bash
npm --prefix apps/web start
```

### Step 3: Expo Mobile Staging Build
```bash
# Install EAS CLI
npm install -g eas-cli

# Log into Expo account
eas login

# Configure project (if not already initialized)
eas build:configure

# Build Android APK for staging / device testing
eas build --platform android --profile preview
```

---

## 4. Staging Smoke Tests

Immediately following deployment to staging, execute the following smoke tests against the deployed URL:

```bash
# 1. Health & Database Connectivity Check
curl -i https://staging.spotdiary.app/api/db-status

# 2. Unauthenticated Photo Upload Rejection (Must return 401)
curl -i -X POST https://staging.spotdiary.app/api/visits/photos

# 3. Google Places API Gateway Check
curl -i "https://staging.spotdiary.app/api/places/search?query=cafe&locality=Baner"

# 4. Password Reset Rate Limiting & Account Enumeration Protection
curl -i -X POST https://staging.spotdiary.app/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com"}'
# Verify: Returns 200 with generic success message without leaking account existence
```

---

## 5. Physical Android Device Validation Plan

Perform this manual verification on a physical Android smartphone running the staging mobile build:

- [ ] **1. Clean Installation:** Install the staging `.apk` generated via EAS Build. Verify app icon, title, and splash screen display correctly.
- [ ] **2. Registration:** Create a new account with valid email and password. Verify immediate transition to the authenticated feed.
- [ ] **3. Session Persistence:** Force-close the app from Android Task Switcher. Relaunch the app. Verify session restored from `SecureStore` without login prompt.
- [ ] **4. Logout:** In Profile tab, tap Logout. Verify tokens cleared and user returned to login screen.
- [ ] **5. Password Reset Revocation:** 
  1. Log into mobile app.
  2. In a web browser, request password reset and change password.
  3. Return to mobile app and trigger an action (pull-to-refresh).
  4. Verify mobile app detects revoked session (`401`) and safely prompts to log in again.
- [ ] **6. Place Discovery & Details:** Search for cafes in Baner/Koregaon Park. Verify ratings, address, and place photo thumbnails render cleanly.
- [ ] **7. Wishlist Toggle:** Bookmark a place from details view. Verify appearance in Saved tab. Unbookmark and verify removal.
- [ ] **8. Visit Creation & Editing:** Log a visit with date, 5-star rating, ordered item ("Cold Coffee"), and partner context. Save visit. Edit visit notes and verify updates persist.
- [ ] **9. Camera & Gallery Photo Upload:** Attach a photograph from camera/gallery to the visit. Verify upload completes and image appears. Delete photograph and verify removal.
- [ ] **10. Curated Collections:** Create a private collection. Add a saved place. Toggle visibility to public. Verify state changes.
- [ ] **11. Natural Language Memory Search:** In Search tab, query *"Where did I have cold coffee with partner?"*. Verify intent parser correctly retrieves matching visit record.
- [ ] **12. Network Interruption & Recovery:** Enable Airplane Mode while browsing. Verify friendly error banner is shown without app crash. Disable Airplane Mode, tap retry, and confirm recovery.

---

## 6. Rollback Guidance

In the event of an issue on staging:
1. **Container / PaaS Rollback:**
   - On Railway / Render / AWS App Runner: Navigate to **Deployments** tab and click **Redeploy** on the last known stable deployment commit.
2. **Database Rollback:**
   - In MongoDB Atlas, point-in-time restore is available under **Cluster > Backup > Restore**. Select snapshot prior to deployment timestamp.
3. **Environment Misconfiguration:**
   - If server fails with `JWT_SECRET` or `MONGODB_URI` error, verify environment variable names in the hosting control panel and trigger a restart without code modifications.

---

## 7. Known Operational Limitations & Cost Management

1. **Google Places API Usage & Cost Alerts:**
   - Google Places API (New) charges per text search and photo request.
   - **Cost Mitigation:** Set Google Cloud Billing budget alerts at $25, $50, and $100 in the GCP Console.
   - Restrict API key to server IP addresses in GCP Console.
2. **AWS S3 Bucket CORS & Public Read:**
   - Bucket must allow `GET` from `staging.spotdiary.app` and mobile origins, or media should be fronted by CloudFront CDN.
3. **Email Provider Domain Warmup:**
   - Newly registered domains have low sender reputation. Staging should verify DNS records (SPF, DKIM, DMARC) in Resend/SendGrid to prevent emails from landing in spam folders.
