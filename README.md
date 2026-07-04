# LiveMap - Rental Marketplace MVP (Phase 1)

LiveMap is a geospatial, lead-generation rental marketplace MVP built for Node.js + Express, Prisma ORM, PostgreSQL + PostGIS, and React (Vite + TS + Leaflet).

It supports three actors: Tenants, Property Owners, and Super Admins.

---

## Folder Structure

```
c:\tmp
  ├── backend/               # Node.js + Express + TypeScript Backend
  │    ├── src/
  │    │    ├── config/      # Cloudinary and environment config
  │    │    ├── routes/      # Thin Zod-validated routes
  │    │    ├── services/    # Core business logic (Prisma, raw SQL geospatial queries)
  │    │    ├── middleware/  # Auth gates, rate-limiters, error handlers
  │    │    ├── prisma/      # schema.prisma, postgis SQL scripts, seed.ts
  │    │    ├── index.ts     # Express server setup
  │    │    └── tests/       # Jest integration test cases
  │    ├── package.json
  │    └── tsconfig.json
  │
  └── frontend/              # React + Vite + TypeScript Frontend (PWA Installable)
       ├── public/
       │    ├── manifest.json # PWA configuration
       │    └── sw.js        # Service worker offline caching
       ├── src/
       │    ├── components/  # Navbar, Leaflet MapSearch
       │    ├── context/     # AuthContext (JWT, verify email OTP, session state)
       │    ├── pages/       # Home search, details, dashboards, login/register
       │    ├── styles/      # index.css (Dark glassmorphism styles)
       │    ├── utils/       # API wrapper
       │    └── main.tsx / App.tsx
       ├── package.json
       └── index.html
```

---

## Prerequisites

- **Node.js**: LTS version (v18+)
- **Database**: PostgreSQL (v12+) with **PostGIS** extension enabled. (e.g. Supabase, Render PostgreSQL, or a local Postgres instance).

---

## Backend Setup & Environment Variables

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Update the variables inside `.env`:
   - `DATABASE_URL`: Use the **pooled** connection string (PgBouncer, port `6543`) for running the application.
   - `DIRECT_URL`: Use the **direct** connection string (port `5432`) to run migrations.
   - `JWT_SECRET`: Secret key for signing tokens.
   - `FRONTEND_URL`: URL of the deployed frontend (e.g., `https://your-app.vercel.app`) to authorize CORS credentials.
   - **Cloudinary Keys**:
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`

4. Run database migrations using the direct url connection:
   - For local development:
     ```bash
     npm run prisma:migrate
     ```
   - For production deploys (runs non-interactively in build steps):
     ```bash
     npx prisma migrate deploy --schema=src/prisma/schema.prisma
     ```

5. Enable the PostGIS geography columns, spatial index, and synchronization trigger:
   *Execute the SQL script located at `src/prisma/postgis_setup.sql` on your PostgreSQL database using a client like DBeaver, pgAdmin, or psql command:*
   ```bash
   psql -U your_user -d your_db -f src/prisma/postgis_setup.sql
   ```

6. Seed default users (blocked in production mode automatically):
   ```bash
   npm run db:seed
   ```

7. Start the backend development server:
   ```bash
   npm run dev
   ```

---

## Frontend Setup & Environment Variables

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Create a `.env` file inside `frontend/` and configure:
   - `VITE_LOCATION_IQ_API_KEY`: LocationIQ geocoder token for geocoding street addresses to lat/lng.
   - `VITE_MAP_TILE_URL` (Optional): Production tile URL from providers like Stadia Maps or MapTiler. (e.g., `https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key={apiKey}`). Defaults to free CartoDB Dark Matter if empty.
   - `VITE_MAP_API_KEY` (Optional): API key for the map tile provider.
   - `VITE_MAP_ATTRIBUTION` (Optional): Map provider attribution string.

3. Start the development server:
   ```bash
   npm run dev
   ```

---

## Launch Design & Beta Workarounds

### 1. Cloudinary Storage
All listing photos are uploaded directly to Cloudinary (capped at 6 photos max per listing, enforced both on client inputs and server routes). Local file disk multer has been removed to avoid PaaS file wipes.

### 2. Email OTP Workaround
To avoid phone OTP SMS provider charges for the beta stage:
- Email address is strictly required on registration.
- Account verification is done via an OTP code sent to the user's **email** (mock printed in backend terminal console).
- Once verified, the user is authorized. To preserve transparency, the user's phone number is labeled as **⚠️ Unverified Phone (Beta Mode)** across all dashboards and listing details.

### 3. PWA Standalone Install
The frontend is configured as an installable PWA. It registers a service worker (`sw.js`) and maps a standard `manifest.json` file. Installation prompts can be verified under Chrome DevTools -> Application -> Manifest.
