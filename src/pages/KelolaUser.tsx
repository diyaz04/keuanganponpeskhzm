import { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const KelolaUser = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<'admin' | 'bendahara'>('bendahara');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      // 1. Buat Supabase client sekunder untuk pendaftaran agar tidak menimpa sesi Admin yang sedang login
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const adminAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });

      // 2. Mendaftarkan User Baru (Email verification WAJIB dimatikan di Supabase Dashboard)
      const { data: authData, error: authError } = await adminAuthClient.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Gagal membuat user auth. Pastikan verifikasi email dinonaktifkan di Supabase Dashboard!');
      }

      // 3. Masukkan data profil (role & nama) ke tabel user_roles menggunakan client utama (karena butuh hak akses admin)
      const { error: dbError } = await supabase.from('user_roles').insert([
        { 
          id: authData.user.id,
          role: role,
          nama_lengkap: nama
        }
      ]);

      if (dbError) {
        // Jika gagal insert role, kita beritahu admin (Ideally we delete auth user, tapi client tidak bisa)
        throw new Error('Gagal menyimpan profil pengguna ke database: ' + dbError.message);
      }

      setMessage({ type: 'success', text: 'Berhasil membuat akun! Pengguna sekarang dapat login menggunakan email & password tersebut.' });
      
      // Reset form
      setEmail('');
      setPassword('');
      setNama('');
      setRole('bendahara');
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Terjadi kesalahan saat membuat pengguna.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Users className="h-6 w-6 mr-2 text-khzm-green" />
              Kelola Pengguna
            </h1>
            <p className="text-gray-500 mt-1">Tambahkan akun Admin atau Bendahara baru.</p>
          </div>

          <div className="p-6 sm:p-8">
            {message.text && (
              <div className={`p-4 rounded-lg mb-6 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-5 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all"
                  placeholder="Misal: Ustadz Fulan"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Login</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all"
                  placeholder="fulan@pesantren.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Sementara</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all"
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Hak Akses (Role)</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      value="bendahara"
                      checked={role === 'bendahara'}
                      onChange={() => setRole('bendahara')}
                      className="text-khzm-green focus:ring-khzm-green h-4 w-4"
                    />
                    <span className="ml-2 text-sm text-gray-700">Bendahara</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      className="text-khzm-green focus:ring-khzm-green h-4 w-4"
                    />
                    <span className="ml-2 text-sm text-gray-700">Administrator</span>
                  </label>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center disabled:opacity-70"
              >
                {loading ? 'Memproses...' : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Buat Akun Sekarang
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KelolaUser;
