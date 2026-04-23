## HomeXpert

HomeXpert is a full-stack role-based platform that combines two customer needs in one app:

1. Grocery shopping with cart, checkout, addresses, favorites, and order tracking.
2. Home services booking (cleaning, appliance, plumbing, electrical) with assigned workers and live tracking.

The project also includes operational dashboards for workforce roles and an admin console for partner management.

## 1) Problem Statement

Typical local service and grocery apps solve only one side well: either product delivery or home services. HomeXpert aims to provide a single unified experience where:

- Customers can buy products and book home services from one account.
- Workforce partners can manage assignments in role-specific dashboards.
- Live tracking remains consistent for both grocery delivery and service bookings.
- Profile and operational data for all roles stay editable and up to date.

## 2) Solution Overview

HomeXpert is implemented as a monorepo with:

- `client/`: React + Vite frontend
- `server/`: Express + MongoDB backend

Core implementation ideas:

- Shared `order` domain model for both product orders and service bookings.
- Role-based flows for `user`, `shopkeeper`, `delivery`, `worker`, `vendor`, and admin.
- OTP-based user auth and password/JWT-based workforce auth.
- Live map and route parity using OpenStreetMap APIs (Nominatim + OSRM) and Leaflet.
- Optional Razorpay for online payments with COD fallback.

## 3) Key Features

### Consumer features

- Browse products across shop items and shop goods.
- Add/remove/update cart quantities with persistent local storage.
- Save and manage multiple delivery addresses with map-assisted address picking.
- Manage wishlist/favorites.
- Place grocery orders and service bookings.
- Track status progression (`PLACED` -> `CONFIRMED` -> `PREPARING` -> `OUT_FOR_DELIVERY` -> `DELIVERED`).
- See live tracking map for active orders.
- Cancel eligible orders and submit feedback.

### Workforce features

- Role-specific login and session storage.
- Shopkeeper dashboard to maintain inventory stock from shared catalog.
- Delivery dashboard with assignment acceptance, live navigation, and GPS sync.
- Worker dashboard for service leads, schedule management, and map navigation.
- Editable profile pages for delivery, worker, shopkeeper, and vendor roles.

### Admin features

- Workforce admin dashboard for listing, filtering, exporting, and deleting partner profiles.
- Admin product creation into the shared global catalog.

### Payments

- COD available by default.
- Online payment via Razorpay (`ONLINE` and `UPI`) when keys are configured.

## 4) End-to-End Flows

### A) Grocery order flow

1. Customer browses catalog and adds items to cart.
2. Customer selects saved address and payment mode.
3. If online payment is selected, frontend creates and verifies Razorpay payment.
4. Frontend creates `order` with grocery `orderItems`.
5. Delivery dashboard picks active order, accepts assignment, and updates status/location.
6. Customer sees status and map updates in account order pages.

### B) Service booking flow

1. Customer chooses service type and package on service booking page.
2. Customer selects address, date/time, notes, and payment mode.
3. Booking is created as `order` with `bookingType: service` and `serviceBooking` payload.
4. Backend matches an available worker and assigns `assignedWorkerId`.
5. Worker dashboard receives the booking and can progress status.
6. Worker live GPS sync updates the same `order.liveTracking` object used by customer tracking map.

### C) Live tracking consistency strategy

- User tracking and workforce tracking both rely on the same backend endpoint:
	- `PATCH /order-api/order/:orderId/location`
- Destination and live coordinates are written into `order.liveTracking`.
- Customer map renders route and ETA from this shared tracking source.

## 5) Architecture

### Frontend

- React 19 + Vite
- React Router for route orchestration
- Context API for auth and cart state
- React Leaflet + Leaflet for maps
- React Toastify for notifications

### Backend

- Express 4 with modular route files under `server/APIs`
- Mongoose models under `server/models`
- Role APIs for each workforce domain
- Order API for payment, status transitions, assignment, and live location

### External services

- MongoDB (primary data store)
- Razorpay (optional online payment)
- Nominatim (address geocoding)
- OSRM (route generation)

## 6) Repository Structure

```text
homeexpert/
	client/                  # React frontend
		src/
			components/          # Consumer + workforce + admin UIs
			context/             # AuthContext, CartContext
			services/            # api.js, paymentGateway.js
			utils/               # workforceAuth session helpers
	server/                  # Express backend
		APIs/                  # Route modules
		models/                # Mongoose schemas
		config/                # OTP/environment config
		utils/                 # SMS/OTP helper
```

## 7) Frontend Route Map

Important frontend routes:

- `/` Home
- `/products` Product browsing
- `/cart` Cart + grocery checkout
- `/services` Services hub
- `/services/book/:serviceSlug` Service booking
- `/account` User dashboard (tabs)
- `/account/order/:orderId` Order details and tracking
- `/work/login` Workforce login/register
- `/work/shopkeeper-dashboard` Shopkeeper operations
- `/work/delivery-dashboard` Delivery operations
- `/work/worker-dashboard` Worker operations
- `/work/vendor-dashboard` Vendor dashboard
- `/work/shopkeeper-profile` Editable shopkeeper profile
- `/work/delivery-profile` Editable delivery profile
- `/work/worker-profile` Editable worker profile
- `/work/vendor-profile` Editable vendor profile
- `/private/workforce-admin-dashboard` Admin console

## 8) Authentication and Session Model

### Consumer users

- Registration and OTP verification via `user-api`.
- Session persisted in `localStorage` (`currentUser`) through `AuthContext`.

### Workforce users

- Login/register via role auth APIs:
	- `shopkeeper-api/auth/*`
	- `delivery-api/auth/*`
	- `worker-api/auth/*`
	- `vendor-api/auth/*`
- JWT token returned by backend.
- Frontend stores role-scoped auth in `sessionStorage` via `workforceAuth:<role>` keys.

## 9) Backend API Modules

Mounted in `server/server.js`:

- `/user-api` user registration, OTP, review operations
- `/shopkeeper-api` shopkeeper auth, profile, and product inventory
- `/worker-api` worker auth and profile updates
- `/delivery-api` delivery partner auth and profile updates
- `/vendor-api` vendor auth and profile updates
- `/shopitems-api` global shop items catalog
- `/shopgoods-api` shop goods catalog
- `/works-api` services catalog
- `/order-api` orders, payment, assignment, status, live tracking
- `/address-api` user addresses CRUD + default switching
- `/favorite-api` wishlist/favorites

### High-value order endpoints

- `GET /order-api/payment/config`
- `POST /order-api/payment/create-order`
- `POST /order-api/payment/verify`
- `POST /order-api/order`
- `GET /order-api/orders/:userId`
- `GET /order-api/worker/bookings/:workerId`
- `PATCH /order-api/order/:orderId/status`
- `PATCH /order-api/order/:orderId/location`
- `GET /order-api/delivery/orders`
- `PATCH /order-api/delivery/order/:orderId/assign`
- `PATCH /order-api/worker/order/:orderId/status`
- `PATCH /order-api/order/:orderId/cancel`

## 10) Data Model Snapshot

### Order (`orderModel`)

- Supports both product and service flows using `bookingType`.
- Product order payload uses `orderItems` + `deliveryAddress`.
- Service booking payload uses `serviceBooking` + `assignedWorkerId`.
- Stores payment metadata (`paymentMethod`, `paymentStatus`, gateway IDs).
- Stores live tracking under `liveTracking` with synced location timestamps.

### User (`userModel`)

- Phone number as unique identity.
- OTP generation/verification methods for login flow.
- Optional address and profile fields.

### Workforce models

- `shopKeeperModel`, `workerModel`, `deliveryPersonModel`, `vendorModel`
- Password hashes stored as `passwordHash`.
- Editable profile fields exposed via PATCH routes.

### Supporting models

- `addressModel` for saved addresses
- `favoriteModel` for wishlist
- `shopItemsModel`, `shopGoodsModel`, `worksModel` for catalogs

## 11) Local Setup

### Prerequisites

- Node.js 18+
- npm
- MongoDB instance (local or cloud)

### Install dependencies

```bash
cd client
npm install

cd ../server
npm install
```

### Run backend

```bash
cd server
npm run dev
```

Backend default URL: `http://localhost:3000`

### Run frontend

```bash
cd client
npm run dev
```

Frontend default URL: `http://localhost:5173`

### Production build (frontend)

```bash
cd client
npm run build
```

## 12) Environment Variables

Create `server/.env`:

```bash
DB_URL=mongodb://localhost:27017/homeexpert
JWT_SECRET=replace_with_secure_random_secret
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxxxxx
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/homeexpert
```

Notes:

- `DB_URL` is required by `server/server.js` for MongoDB connection.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are required only for online payment.
- If Razorpay keys are missing, COD still works.
- `JWT_SECRET` has a dev fallback in code, but must be set for real deployments.

## 13) Implementation Notes (Important)

### Map and tracking behavior

- Geocoding uses Nominatim; route lines use OSRM.
- If geocoding fails, deterministic fallback coordinates are generated from address fields.
- Delivery and worker dashboards push GPS updates to order live tracking.
- User order tracking consumes the same live tracking source for consistency.

### Performance-focused updates already applied

- Context value memoization in auth/cart providers.
- Cart totals/count derived via memoized computations.
- Worker route syncing throttled to reduce excess network traffic.
- Worker profile render-loop issue removed by avoiding redundant state sync effect.

### Profile edit parity

Editable profile pages exist for:

- worker
- delivery
- shopkeeper
- vendor

## 14) Troubleshooting

### Backend fails to connect to database

- Check `DB_URL` in `server/.env`.
- Ensure MongoDB is reachable.

### Online payment option not available

- Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set.
- Check `GET /order-api/payment/config` response.

### No live location movement on map

- Allow browser GPS permission for workforce dashboard.
- Ensure order status is active (`OUT_FOR_DELIVERY` for delivery, active worker statuses for worker).

### Address map search not returning results

- Nominatim may rate-limit rapid requests.
- Retry with more specific landmark/city text.

## 15) Known Gaps / Risks

- API auth middleware is not uniformly enforced across all routes.
- No automated test suite is committed yet.
- Some imports use case-sensitive path variants (works on Windows, may fail on Linux).
- Backend currently listens on hardcoded port `3000` in `server/server.js`.
- Vendor auth API exists, but workforce login UI currently emphasizes shopkeeper/delivery/worker flows.

## 16) Suggested Next Improvements

1. Add JWT auth middleware and route-level authorization.
2. Add unit/integration tests for order and auth flows.
3. Standardize import casing for cross-platform compatibility.
4. Add frontend code splitting to address large bundle chunks.
5. Add CI pipeline for lint/build/test checks.
6. Introduce API documentation (OpenAPI/Swagger).

## 17) Useful Commands

```bash
# Frontend
cd client
npm run dev
npm run build
npm run lint

# Backend
cd server
npm run dev
npm start
```

Also present in repo root:

- `clean-node-modules.bat`
- `reinstall-modules.bat`

These helper scripts can be used for dependency cleanup and reinstall on Windows.

## 18) Summary

HomeXpert is implemented as a practical multi-role commerce + services platform with:

- unified order domain,
- live map tracking,
- role-specific operational dashboards,
- optional online payments,
- and editable profile management across workforce roles.

This README is intended to help you understand the project end-to-end, from problem statement to implementation details and operational behavior.
