# HomeXpert

A platform for home services and grocery shopping.

## Project Structure

- `client/` - Frontend React application
- `server/` - Backend Express API

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB

### Setup and Installation

1. Clone the repository
2. Install dependencies for both client and server:

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Running the Application

#### Start the Backend Server

```bash
# From the server directory
npm run dev
```

The server will start on http://localhost:3000

#### Start the Frontend Application

```bash
# From the client directory
npm run dev
```

The client will start on http://localhost:5173

### Online Payment Setup (Razorpay)

Online payment is implemented for both:

- Product checkout from Cart
- Service booking checkout

Add the following environment variables in the server environment:

```bash
DB_URL=<your_mongodb_connection_string>
RAZORPAY_KEY_ID=<your_razorpay_key_id>
RAZORPAY_KEY_SECRET=<your_razorpay_key_secret>
```

If Razorpay keys are not configured, the app will continue to work with Cash on Delivery.

### Using Mock Data

If the backend server is not available, the frontend is configured to use mock data. To toggle between real and mock data:

1. Open `client/src/services/api.js`
2. Set `USE_MOCK_DATA` to `true` to use mock data or `false` to use the real API

## Features

- Browse products by category
- Filter products
- View product details
- Add products to cart
- User authentication
- And more...

## Technologies Used

- **Frontend**: React, Tailwind CSS, React Router
- **Backend**: Node.js, Express, MongoDB
- **Authentication**: Clerk
