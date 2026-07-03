import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className={`min-h-screen flex flex-col ${isAdmin ? 'bg-slate-950' : ''}`}>
      <header className={`border-b sticky top-0 z-50 ${
        isAdmin
          ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md'
          : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isAdmin ? 'bg-gradient-to-br from-brand-500 to-brand-700' : 'bg-brand-600'
              }`}>
                <span className="text-white font-bold text-sm">SE</span>
              </div>
              <h1 className={`text-lg font-semibold ${isAdmin ? 'text-white' : 'text-gray-900'}`}>
                ShopEase AI Support
              </h1>
            </div>
            <nav className="flex gap-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? isAdmin
                        ? 'bg-brand-600 text-white'
                        : 'bg-brand-50 text-brand-700'
                      : isAdmin
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                Customer Chat
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? isAdmin
                        ? 'bg-brand-600 text-white'
                        : 'bg-brand-50 text-brand-700'
                      : isAdmin
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                Admin Dashboard
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  )
}
