import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'bendahara')[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-khzm-green"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-2">Akses Ditolak</h1>
        <p className="text-gray-600 mb-6">Anda tidak memiliki izin untuk melihat halaman ini.</p>
        <button 
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
        >
          Kembali
        </button>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
