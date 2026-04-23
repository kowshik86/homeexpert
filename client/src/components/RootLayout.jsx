import Header from './common/Header'
import Footer from './common/Footer'
import React from 'react'
import {Outlet} from 'react-router-dom'

function RootLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="flex-grow relative isolate">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default RootLayout
