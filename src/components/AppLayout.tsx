import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, 
  TrendingUp, 
  ShoppingCart, 
  Wallet, 
  Users, 
  FileText, 
  Settings, 
  ShieldAlert,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import logoUrl from '../assets/logo.png';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Uang Masuk', path: '/transaksi', icon: TrendingUp },
    { name: 'Pengeluaran', path: '/pengeluaran', icon: ShoppingCart },
    { name: 'Tabungan', path: '/tabungan', icon: Wallet },
    { name: 'Data Santri', path: '/santri', icon: Users },
  ];

  const adminItems = [
    { name: 'Laporan', path: '/laporan', icon: FileText },
    { name: 'Kategori & Nominal', path: '/admin/kategori', icon: Settings },
    { name: 'Kelola Hak Akses', path: '/admin/users', icon: ShieldAlert },
    { name: 'Audit Trail', path: '/audit-log', icon: ShieldAlert }, // reusing icon
  ];

  // ================= SIDEBAR (DESKTOP) =================
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Logo Pesantren" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-2xl font-black text-khzm-green tracking-tight">KAS<span className="text-gray-800">PESANTREN</span></h1>
            <p className="text-xs text-gray-500 font-medium">Command Center</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Menu Utama</p>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    isActive 
                      ? 'bg-green-50 text-khzm-green' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </div>
        </div>

        {role === 'admin' && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Master & Laporan</p>
            <div className="space-y-1">
              {adminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => 
                    `flex items-center px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                      isActive 
                        ? 'bg-green-50 text-khzm-green' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-gray-900 truncate">{profile?.nama_lengkap}</p>
            <p className="text-xs text-khzm-green uppercase font-bold tracking-wider">{role}</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center px-4 py-2 bg-white border border-gray-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-100 transition-colors"
        >
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:block w-64 flex-shrink-0 h-full z-20">
        <SidebarContent />
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto pb-16 md:pb-0 relative">
        
        {/* MOBILE HEADER (Only on mobile) */}
        <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Logo Pesantren" className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-black text-khzm-green tracking-tight">KAS<span className="text-gray-800">PESANTREN</span></h1>
          </div>
          {/* We'll use a hamburger menu for the "Lainnya" items in mobile, since bottom nav is limited */}
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -mr-2 text-gray-600 hover:text-gray-900">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* PAGE CONTENT */}
        <div className="h-full">
          {children}
        </div>

      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {/* We take the first 4 nav items for the bottom bar */}
        {navItems.slice(0, 4).map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full py-3 transition-colors ${
                isActive ? 'text-khzm-green' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <item.icon className={`h-6 w-6 mb-1 ${isActive ? 'fill-green-50' : ''}`} />
              <span className={`text-[10px] font-bold ${isActive ? 'text-khzm-green' : 'text-gray-500'}`}>
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* MOBILE DRAWER (For Menu Lainnya) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-4/5 max-w-sm bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 ml-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <p className="text-sm font-bold text-gray-900">{profile?.nama_lengkap}</p>
                <p className="text-xs text-khzm-green uppercase font-bold tracking-wider">{role}</p>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 bg-white rounded-full shadow-sm">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Menu Lainnya</p>
                <div className="space-y-1">
                  {/* Data Santri is the 5th item not in bottom nav */}
                  <NavLink
                    to={navItems[4].path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => `flex items-center px-3 py-3 rounded-lg text-sm font-bold ${isActive ? 'bg-green-50 text-khzm-green' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Users className="h-5 w-5 mr-3" />
                    {navItems[4].name}
                  </NavLink>
                </div>
              </div>

              {role === 'admin' && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Master & Laporan</p>
                  <div className="space-y-1">
                    {adminItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) => `flex items-center px-3 py-3 rounded-lg text-sm font-bold ${isActive ? 'bg-green-50 text-khzm-green' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold active:bg-red-100"
              >
                <LogOut className="h-5 w-5 mr-2" /> Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
