# SpotDiary — Discover Places. Save Memories. Share Experiences.

**SpotDiary** is a Pune-focused place discovery and personal experience diary platform. It blends local place discovery with a personal memory vault, allowing users to discover cafes, restaurants, bakeries, and nightlife spots across Pune (Baner, Koregaon Park, Viman Nagar, FC Road, Kothrud, Hinjawadi, etc.) while recording detailed visit diaries (ratings, ordered items, personal notes, companions, photographs) and querying them through a natural-language memory search engine.

---

## 🌟 Key Features

1. **Google Places API (New) Integration:**
   - Real-time place search across Pune localities with server-side proxying (`/api/places/search`, `/api/places/photo`).
   - Secret API keys remain strictly on the server; zero exposure in client bundles.
   - Categorization (Cafes, Bakeries, Restaurants, Clubs & Nightlife) and price-level filtering.

2. **Personal Visit Diary:**
   - Log date, 1–5 star ratings, best items ordered, notes, companions (*Solo*, *Friends*, *Partner*, *Family*, *Colleagues*), tags, and photographs.
   - Full CRUD support with cross-user IDOR protection.

3. **Natural Language Memory Search:**
   - AST-based natural language intent parser (`@spotdiary/shared`).
   - Translates natural queries (e.g. *"Where did I have cold coffee with my partner in Baner?"*) into structured search criteria.

4. **Curated Collections & Saved Places:**
   - Organize places into private or public themed collections.
   - Wishlist bookmarks with real-time toggle and synchronization across web and mobile.

5. **Secure Multi-Tier Authentication:**
   - JWT sessions with HTTP-only, secure cookies for web, and Bearer tokens for mobile.
   - Cryptographically random 256-bit password reset tokens with SHA-256 hashing at rest.
   - Immediate session revocation upon password reset using millisecond-accurate timestamps.

6. **Photo Storage Adapter:**
   - AWS SigV4 signed S3 uploads and deletions with fallback to local development storage.
   - Magic-byte inspection, 5MB file-size limits, and path traversal protection.

---

## 🏗️ Project Architecture

SpotDiary is structured as a monorepo:

```
SpotDiary/
├── apps/
│   ├── web/            # Next.js 14 App Router (Web client & API backend)
│   └── mobile/         # Expo / React Native client (Expo Router, SecureStore)
├── packages/
│   └── shared/         # Shared TypeScript contracts, Zod schemas, memory search engine
├── docs/
│   ├── RELEASE_GUIDE.md       # Staging and release candidate runbook
│   └── STAGING_DEPLOYMENT.md  # Cloud infrastructure, database & EAS build guide
├── .env.example        # Monorepo environment variable template
├── package.json        # Workspace configuration
└── README.md
```

---

## 📋 Prerequisites

- **Node.js**: `18.17.0+` (Recommended: **Node.js 20 LTS** or **22 LTS**)
- **Package Manager**: `npm >= 9.0.0`
- **Database**: MongoDB 6.x+ (Local instance or MongoDB Atlas)
- **Mobile Development** (Optional): Expo Go app on physical phone or Android Studio / Xcode emulator

---

## ⚙️ Environment Variable Setup

Copy the example environment templates and fill in the required values:

### 1. Web & API Backend (`apps/web/.env.local`)
```bash
cp apps/web/.env.example apps/web/.env.local
```

Key variables to configure in `apps/web/.env.local`:
```env
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/spotdiary
JWT_SECRET=your-secure-jwt-secret-minimum-32-chars-long
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### 2. Mobile Client (`apps/mobile/.env.local`)
```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

Key variables to configure in `apps/mobile/.env.local`:
```env
# Android Emulator loopback: http://10.0.2.2:3000
# iOS Simulator / Web: http://localhost:3000
# Physical Phone on LAN: http://<YOUR_LAN_IP>:3000
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

> [!CAUTION]
> Never commit `.env` or `.env.local` files to source control. Never place server secrets (`JWT_SECRET`, `MONGODB_URI`, `AWS_*`, `GOOGLE_MAPS_*`) in the mobile application.

---

## 🚀 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Shared Package
```bash
npm --prefix packages/shared run build
```

### 3. Initialize MongoDB Indexes
```bash
node apps/web/scripts/init_mongo_indexes.mjs
```

### 4. Start Next.js Web & API Server
```bash
npm --prefix apps/web run dev
# Server live at http://localhost:3000
```

### 5. Start Expo Mobile Application
```bash
npm --prefix apps/mobile run start
# Press 'a' for Android emulator, 'i' for iOS simulator, or scan QR code with Expo Go
```

---

## 🧪 Testing & Verification

SpotDiary includes automated test suites covering unit contracts, API endpoints, security controls, and mobile integration:

```bash
# 1. Run Shared Package Tests
npm --prefix packages/shared run test

# 2. Type-Check TypeScript
npx tsc -p apps/web/tsconfig.json --noEmit
npx tsc -p apps/mobile/tsconfig.json --noEmit

# 3. Compile Next.js Production Build
npm --prefix apps/web run build

# 4. Run Photo Upload & Error Regression Suite
node apps/web/scratch/test_phase6_photo_errors.mjs

# 5. Run End-to-End Security & Session Revocation Suite
node apps/web/scratch/test_phase5_e2e_security.mjs

# 6. Run Mobile Integration Suite
node apps/mobile/scratch/test_mobile_integration.mjs

# 7. Run Production Fail-Safe Configuration Audit
npx tsx apps/web/scratch/test_phase7_production_fail_safe.mjs
```

---

## 🌐 Staging Deployment Status

SpotDiary is currently **READY FOR STAGING**:
- **Codebase Readiness:** Zero TypeScript errors, 100% test pass rate across all suites, clean Next.js production build (`next build`).
- **Production Guard Rails:** Server enforces $\ge 32$-character `JWT_SECRET`, blocks ephemeral storage in production, and prevents fallback to unauthenticated mock data.
- **Staging Guides:** See [docs/STAGING_DEPLOYMENT.md](docs/STAGING_DEPLOYMENT.md) for step-by-step Atlas setup, AWS S3 bucket configuration, and EAS Android APK build instructions.
