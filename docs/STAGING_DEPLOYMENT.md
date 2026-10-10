# SpotDiary Staging Deployment Execution Guide

---

## 1. Staging Architecture & Deployment Overview

SpotDiary uses a monorepo structure with a **Next.js 14 App Router** web/API backend (`apps/web`), an **Expo React Native** mobile client (`apps/mobile`), a shared TypeScript validation and business logic library (`packages/shared`), and a **MongoDB** database.

```
                              ┌────────────────────────────────────────┐
                              │      Google Places API (New)           │
                              └───────────────────┬────────────────────┘
                                                  │ (Server-side proxy only)
                                                  ▼
┌──────────────────────────┐         ┌────────────────────────────────────────┐         ┌──────────────────────────┐
│ Next.js Web Client       │         │        Next.js App Router API          │         │ Expo Android APK Client  │
│ - Responsive UI          │         │ - Containerized Node.js 20+            │         │ - EAS Preview Profile    │
│ - HTTPS Cookies          │<───────>│ - Native MongoDB connection pool       │<───────>│ - Bearer Token Header    │
│ - S3/CDN Photo Rendering │         │ - Streaming multipart 5MB body support │         │ - SecureStore Tokens     │
└──────────────────────────┘         └───────────────────┬────────────────────┘         └──────────────────────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                           ┌────────────────────────────┐ ┌───────────────────────────┐
                           │   MongoDB Atlas (Staging)  │ │   AWS S3 / S3-Compatible  │
                           │ - M0 (Free) or M10 Cluster │ │ - SigV4 Direct PUT/DELETE │
                           │ - Connection Pool Capped   │ │ - CloudFront / Public CDN │
                           │ - IP Access Restrictions   │ │ - 5MB & Magic-Byte Guards │
                           └────────────────────────────┘ └───────────────────────────┘
```

### Hosting Platform Requirements
- **Runtime:** Node.js `>= 18.17.0` (Recommended: **Node.js 20 LTS**).
- **Package Manager:** `npm >= 9.0.0`.
- **Target Platform:** Containerized Node.js (AWS App Runner, Railway, Render, Fly.io, or DigitalOcean App Platform).
- **Why Containerized PaaS instead of Vercel Serverless:** Serverless hosting platforms impose a hard **4.5 MB request payload limit** (`FUNCTION_PAYLOAD_TOO_LARGE`). SpotDiary permits photo uploads up to 5.0 MB; uploads between 4.5 MB and 5.0 MB are dropped by serverless edge proxies before reaching Next.js. Containerized hosting allows full streaming multipart body handling and steady MongoDB connection pooling.

---

## 2. Required Environment Variables

> [!CAUTION]
> Never commit `.env` or `.env.local` files to git. Never print real credentials in logs or CI/CD pipelines. Never prefix backend secrets with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

Configure these variables in your staging hosting dashboard (e.g. Railway, Render, AWS App Runner):

```env
# -------------------------------------------------------------
# Runtime Settings
# -------------------------------------------------------------
NODE_ENV=production
PORT=3000

# -------------------------------------------------------------
# Canonical URLs
# -------------------------------------------------------------
APP_URL=https://staging.spotdiary.app
NEXT_PUBLIC_APP_URL=https://staging.spotdiary.app

# -------------------------------------------------------------
# Database (MongoDB Atlas Staging)
# -------------------------------------------------------------
MONGODB_URI=mongodb+srv://<STAGING_DB_USER>:<STAGING_DB_PASS>@<STAGING_CLUSTER>.mongodb.net/spotdiary_staging?retryWrites=true&w=majority&maxPoolSize=20

# -------------------------------------------------------------
# Authentication (MANDATORY: Minimum 32 random characters in production)
# -------------------------------------------------------------
JWT_SECRET=<GENERATED_64_CHAR_HEX_SECRET>

# -------------------------------------------------------------
# Google Places Platform (Server-side only)
# -------------------------------------------------------------
GOOGLE_MAPS_API_KEY=your_staging_google_maps_api_key_here

# -------------------------------------------------------------
# Object Storage (Persistent Media)
# -------------------------------------------------------------
STORAGE_TYPE=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=spotdiary-staging-media
AWS_ACCESS_KEY_ID=your_staging_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_staging_aws_secret_access_key_here

# -------------------------------------------------------------
# Transactional Email (Resend OR SMTP)
# -------------------------------------------------------------
RESEND_API_KEY=your_staging_resend_api_key_here
EMAIL_FROM=SpotDiary Staging <noreply@staging.spotdiary.app>
```

---

## 3. Safe Secret-Generation Instructions

Generate cryptographic secrets locally using standard OpenSSL or Node.js crypto utilities:

```bash
# Generate 64-character hex JWT secret (256 bits of entropy)
openssl rand -hex 32

# Alternative using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> [!IMPORTANT]
> Never use placeholder values (e.g., `audit-test-jwt-secret...`) in production or staging. If `JWT_SECRET` is shorter than 32 characters, the server will refuse to start in production.

---

## 4. Database Setup (MongoDB Atlas Staging)

### Step 1: Provision Isolated Staging Database
1. In MongoDB Atlas, create a dedicated project: `SpotDiary-Staging`.
2. Deploy a free **M0 Sandbox** or **M10 Dedicated** cluster in `ap-south-1` (Mumbai).
3. Name the database `spotdiary_staging`.

### Step 2: Least-Privilege Database User
Create a dedicated database user restricted only to `spotdiary_staging`:
- Role: `readWrite` on `spotdiary_staging` only. Do not assign `atlasAdmin` or cluster-wide roles.

### Step 3: Network Access Restrictions
- In **Network Access**, add the static IP addresses or CIDR block of your staging hosting provider (or `0.0.0.0/0` with strong password authentication if dynamic egress IPs are used).

### Step 4: Run Index Initialization
Before serving traffic, run the idempotent index initialization script to create required unique, sparse, and compound indexes:
```bash
MONGODB_URI="<YOUR_STAGING_MONGODB_URI>" node apps/web/scripts/init_mongo_indexes.mjs
```

Indexes created:
- `users`: `{ email: 1 }` (unique), `{ id: 1 }` (unique, sparse)
- `password_resets`: `{ token_hash: 1 }` (unique), `{ email: 1 }`, `{ expires_at: 1 }`
- `visits`: `{ user_id: 1, id: 1 }`, `{ user_id: 1, visited_at: -1 }`, `{ user_id: 1, place_id: 1 }`
- `saved_places`: `{ user_id: 1, place_id: 1 }` (unique)
- `collections`: `{ user_id: 1, id: 1 }`, `{ visibility: 1 }`
- `visit_photos`: `{ visit_id: 1 }`, `{ user_id: 1 }`, `{ id: 1 }` (unique, sparse)

---

## 5. Photo Storage Setup (AWS S3 Staging)

### Step 1: Create S3 Bucket
1. Create bucket: `spotdiary-staging-media` in `ap-south-1`.
2. Disable "Block all public access" if using public S3 URLs (or front with a CloudFront CDN distribution with Origin Access Control).

### Step 2: Bucket CORS Policy
Add the following CORS configuration to allow image loads from the web app:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": [
      "https://staging.spotdiary.app",
      "https://*.spotdiary.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Step 3: Bucket Public Read Policy (if not using CloudFront)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadVisitPhotos",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::spotdiary-staging-media/uploads/visits/*"
    }
  ]
}
```

### Step 4: Least-Privilege IAM User
Create an IAM user `spotdiary-staging-app` with only PUT and DELETE permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::spotdiary-staging-media/uploads/visits/*"
    }
  ]
}
```

---

## 6. Email Setup (Resend / SendGrid Staging)

1. **Create Account:** Sign up at [Resend](https://resend.com) or SendGrid.
2. **Domain Verification:** Add DNS records to your domain (`staging.spotdiary.app` or root domain):
   - **SPF:** `v=spf1 include:amazonses.com ~all` (or provider specific)
   - **DKIM:** CNAME records provided by Resend
   - **DMARC:** `v=DMARC1; p=none; rua=mailto:dmarc@spotdiary.app`
3. **API Key:** Create a restricted Sending-Only API Key and save as `RESEND_API_KEY`.

---

## 7. Android Mobile APK Build (Expo EAS)

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Log into Expo
```bash
eas login
```

### Step 3: Verify `eas.json` Profile
The `apps/mobile/eas.json` file is configured with the `preview` profile:
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://staging.spotdiary.app"
      }
    }
  }
}
```

### Step 4: Run EAS Android Build
```bash
cd apps/mobile
eas build --platform android --profile preview
```

### Step 5: Verify Built APK
1. Download the generated `.apk` from the EAS Build URL.
2. Confirm the APK points to staging:
   ```bash
   # Extract bundle and verify staging endpoint
   unzip -p spotdiary.apk "assets/index.android.bundle" | grep -o "https://staging.spotdiary.app"
   ```
3. Confirm no backend secrets are present:
   ```bash
   unzip -p spotdiary.apk "assets/index.android.bundle" | grep -i "MONGODB_URI" # Must return empty
   ```

---

## 8. Staging Smoke-Test Checklist

Run these tests against the staging domain immediately following deployment:

- [ ] **1. Health & Database Status:**
  ```bash
  curl -i https://staging.spotdiary.app/api/db-status
  # Must return 200 with configured: true, connected: true
  ```
- [ ] **2. Auth Unauthorized Guard:**
  ```bash
  curl -i https://staging.spotdiary.app/api/auth/me
  # Must return 200 with authenticated: false
  ```
- [ ] **3. User Registration:**
  ```bash
  curl -i -X POST https://staging.spotdiary.app/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke_test@example.com","password":"StrongPassword123!","displayName":"Smoke Tester"}'
  # Must return 200 with JWT token and Set-Cookie
  ```
- [ ] **4. Google Places Search Proxy:**
  ```bash
  curl -i "https://staging.spotdiary.app/api/places/search?query=cafe&locality=Baner"
  # Must return 200 with array of places
  ```
- [ ] **5. Photo Upload Error Guards:**
  - Content-Length > 5MB returns `413 Payload Too Large`.
  - Non-image file returns `415 Unsupported Media Type`.
  - Unauthenticated upload returns `401 Unauthorized`.
- [ ] **6. Password Reset Enumeration Protection:**
  ```bash
  curl -i -X POST https://staging.spotdiary.app/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"nonexistent_user@example.com"}'
  # Must return 200 with generic success message
  ```

---

## 9. Rollback Guidance

1. **Code / Container Rollback:**
   - On Railway / Render / AWS App Runner: Open the dashboard, navigate to **Deployments**, and trigger **Rollback** to the preceding deployment hash.
2. **Database Rollback:**
   - In MongoDB Atlas, navigate to **Cluster > Backup > Restore** to restore to a point-in-time snapshot prior to deployment.
3. **Mobile Rollback:**
   - If an issue is discovered in the preview APK, revert git commit, rebuild with EAS, and distribute the updated APK.

---

## 10. Cost Warnings & Budget Controls

| Service | Staging Cost Tier | Budget Guard / Alert |
|---|---|---|
| **Google Places API** | Free $200 monthly credit | **Set GCP Billing Alerts at $25 and $50.** Restrict API key to staging server IP in GCP Console. |
| **AWS S3** | < $1 / month | Enable AWS Budget alert at $5. |
| **MongoDB Atlas** | $0 (M0 Free Tier) | Free tier provides 512 MB storage and 500 connections. |
| **Hosting PaaS** | $5 - $15 / month | Configure spending caps on Railway/Render. |
| **Resend / SendGrid** | $0 (Free Tier) | Resend free tier includes 3,000 emails/month (100/day). |
| **Expo EAS** | $0 (Free Tier) | 30 Android builds/month free. |

---

## 11. Known Operational Limitations

1. **Email Domain Reputation:** Newly configured custom domains sending through Resend or SendGrid may temporarily deliver emails to Spam/Junk folders until DKIM and SPF records propagate (typically 24–48 hours).
2. **Google Places Media Quotas:** Google Places photo requests via `/api/places/photo` are cached for 24 hours (`Cache-Control: public, max-age=86400`) to minimize duplicate API charges.
3. **Localhost vs LAN Testing:** The physical Android APK will not connect to a local development machine unless `EXPO_PUBLIC_API_BASE_URL` points to an externally reachable staging HTTPS domain or valid LAN IP.
