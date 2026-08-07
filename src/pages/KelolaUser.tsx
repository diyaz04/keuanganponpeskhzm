import { useState, useEffect } from 'react';
import { UserPlus, Users, Loader2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserRole {
  id: string;
  nama_lengkap: string;
  role: string;
  created_at: string;
}

const KelolaUser = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<'admin' | 'bendahara'>('bendahara');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [userList, setUserList] = useState<UserRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
    if (data) {
      setUserList(data as UserRole[]);
    }
    setLoadingUsers(false);
  };

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
      
      // Refresh list
      fetchUsers();
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Terjadi kesalahan saat membuat pengguna.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="h-6 w-6 mr-2 text-khzm-green" />
            Kelola Pengguna
          </h1>
          <p className="text-gray-500 mt-1">Tambahkan akun Admin atau Bendahara baru dan lihat daftar pengguna yang terdaftar.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Tambah Pengguna */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-8">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-bold text-gray-900 flex items-center">
                  <UserPlus className="h-5 w-5 mr-2 text-khzm-green" />
                  Tambah Akun Baru
                </h2>
              </div>

              <div className="p-6">
                {message.text && (
                  <div className={`p-4 rounded-lg mb-6 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    {message.text}
                  </div>
                )}

                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all text-sm"
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
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all text-sm"
                      placeholder="fulan@pesantren.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Sementara</label>
                    <input 
                      type="text" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all text-sm"
                      placeholder="Minimal 6 karakter"
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Hak Akses (Role)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${role === 'bendahara' ? 'bg-green-50 border-green-200 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <input 
                          type="radio" 
                          value="bendahara"
                          checked={role === 'bendahara'}
                          onChange={() => setRole('bendahara')}
                          className="hidden"
                        />
                        <span className="text-sm font-bold">Bendahara</span>
                      </label>
                      <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${role === 'admin' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <input 
                          type="radio" 
                          value="admin"
                          checked={role === 'admin'}
                          onChange={() => setRole('admin')}
                          className="hidden"
                        />
                        <span className="text-sm font-bold">Administrator</span>
                      </label>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center disabled:opacity-70 shadow-sm"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
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

          {/* Daftar Pengguna Terdaftar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="font-bold text-gray-900 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-gray-500" />
                  Daftar Akun Terdaftar
                </h2>
                <div className="text-xs font-medium text-gray-500 bg-gray-200/50 px-2.5 py-1 rounded-full">
                  {userList.length} Pengguna
                </div>
              </div>
              
              {loadingUsers ? (
                <div className="p-12 flex justify-center text-khzm-green">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : userList.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  Belum ada pengguna terdaftar (selain Anda).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white border-b border-gray-100">
                      <tr>
                        <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Nama Lengkap</th>
                        <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Hak Akses</th>
                        <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tanggal Terdaftar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {userList.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-gray-900">{u.nama_lengkap}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{u.id}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                              u.role === 'admin' 
                                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              {u.role === 'admin' ? 'Administrator' : 'Bendahara'}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-gray-600">
                            {new Date(u.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KelolaUser;
