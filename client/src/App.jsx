import React from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import RootLayout from './components/RootLayout'
import Home from './components/Home'
import Cart from './components/Cart'
import Products from './components/Products'
import UserDashboard from './components/user/UserDashboard'
import AuthModal from './components/auth/AuthModal'
import WorkLogin from './components/work/WorkLogin'
import ShopkeeperDashboard from './components/work/ShopkeeperDashboard'
import ShopkeeperProfile from './components/work/ShopkeeperProfile'
import DeliveryDashboard from './components/work/DeliveryDashboard'
import DeliveryProfile from './components/work/DeliveryProfile'
import WorkerDashboard from './components/work/WorkerDashboard'
import WorkforceAdminDashboard from './components/admin/WorkforceAdminDashboard'
import './App.css';
import { useAuth } from './context/AuthContext'

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  const browserRouterObj = createBrowserRouter([
    {
      path: "/",
      element: <RootLayout />,
      children: [
        {
          path: "",
          element: <Home />
        },
        {
          path: "cart",
          element: <Cart />
        },
        {
          path: "products",
          element: <Products />
        },
        {
          path: "account",
          element: <ProtectedRoute><UserDashboard /></ProtectedRoute>
        },
        {
          path: "work/login",
          element: <WorkLogin />
        },
        {
          path: "work/shopkeeper-dashboard",
          element: <ShopkeeperDashboard />
        },
        {
          path: "work/shopkeeper-profile",
          element: <ShopkeeperProfile />
        },
        {
          path: "work/delivery-dashboard",
          element: <DeliveryDashboard />
        },
        {
          path: "work/delivery-profile",
          element: <DeliveryProfile />
        },
        {
          path: "work/worker-dashboard",
          element: <WorkerDashboard />
        }
      ]
    },
    {
      path: "/private/workforce-admin-dashboard",
      element: <WorkforceAdminDashboard />
    }
  ])
  return (
    <div className="relative">
      <RouterProvider router={browserRouterObj} />
      <AuthModal />
    </div>
  )
}

export default App




