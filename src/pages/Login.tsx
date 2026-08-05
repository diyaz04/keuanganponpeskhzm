import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, Loader2, ArrowLeft } from 'lucide-react';
import logoUrl from '../assets/logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      // Navigate to dashboard on success
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Gagal login. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center sm:py-12 relative">
      
      {/* Tombol Kembali ke Landing Page */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-khzm-green transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Halaman Utama
        </button>
      </div>

      <div className="xs:p-0 mx-auto md:w-full md:max-w-md w-full mt-10 sm:mt-0">
        <div className="bg-white shadow-xl w-full rounded-2xl divide-y divide-gray-200 overflow-hidden border border-gray-100">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-khzm-emerald to-khzm-green p-8 text-center text-white flex flex-col items-center justify-center">
            <div className="bg-white p-3 rounded-full mb-4 shadow-md inline-block">
               <img src={logoUrl} alt="Logo KHZM" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="font-bold text-3xl mb-1">KAS PESANTREN KHZM</h1>
            <p className="text-emerald-100 text-sm">Sistem Keuangan Pesantren</p>
          </div>

          {/* Form Content */}
          <div className="px-5 py-7 sm:p-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Masuk ke Akun Anda</h2>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="font-semibold text-sm text-gray-700 pb-1 block">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 w-full pl-10 focus:outline-none focus:ring-2 focus:ring-khzm-green focus:border-transparent transition-all" 
                    placeholder="admin@khzm.com"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="font-semibold text-sm text-gray-700 pb-1 block">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 w-full pl-10 focus:outline-none focus:ring-2 focus:ring-khzm-green focus:border-transparent transition-all" 
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="transition duration-200 bg-gradient-to-r from-khzm-emerald to-khzm-green hover:from-emerald-600 hover:to-green-600 focus:bg-green-600 focus:shadow-sm focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 text-white w-full py-3 rounded-lg text-sm shadow-md hover:shadow-lg font-semibold text-center inline-flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Memproses...
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </form>
          </div>
          
          <div className="py-4 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              Lupa password? Hubungi Superadmin (Pimpinan Pesantren).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
