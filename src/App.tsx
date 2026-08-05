import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff, Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import KelolaUser from './pages/KelolaUser';
import MasterKategori from './pages/MasterKategori';
import DataSantri from './pages/DataSantri';
import DetailSantri from './pages/DetailSantri';
import ImportSantri from './pages/ImportSantri';
import TransaksiMasuk from './pages/TransaksiMasuk';
import TransaksiKeluar from './pages/TransaksiKeluar';
import MutasiTabungan from './pages/MutasiTabungan';
import AuditLog from './pages/AuditLog';
import Laporan from './pages/Laporan';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

function App() {
  const { user, isLoading } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-khzm-green animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Memuat KasPesantren...</p>
      </div>
    );
  }

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white py-2 px-4 flex items-center justify-center shadow-lg animate-in slide-in-from-top duration-300">
          <WifiOff className="h-4 w-4 mr-2" />
          <span className="text-xs font-bold uppercase tracking-wider">Anda sedang Offline. Pastikan koneksi stabil untuk menyimpan data.</span>
        </div>
      )}
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        
        {/* Rute yang membutuhkan login, dibungkus AppLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/transaksi" element={<AppLayout><TransaksiMasuk /></AppLayout>} />
          <Route path="/pengeluaran" element={<AppLayout><TransaksiKeluar /></AppLayout>} />
          <Route path="/tabungan" element={<AppLayout><MutasiTabungan /></AppLayout>} />
          <Route path="/audit-log" element={<AppLayout><AuditLog /></AppLayout>} />
          <Route path="/laporan" element={<AppLayout><Laporan /></AppLayout>} />
          <Route path="/santri" element={<AppLayout><DataSantri /></AppLayout>} />
          <Route path="/santri/import" element={<AppLayout><ImportSantri /></AppLayout>} />
          <Route path="/santri/:id" element={<AppLayout><DetailSantri /></AppLayout>} />
        </Route>

        {/* Rute khusus Admin, dibungkus AppLayout */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/users" element={<AppLayout><KelolaUser /></AppLayout>} />
          <Route path="/admin/kategori" element={<AppLayout><MasterKategori /></AppLayout>} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
