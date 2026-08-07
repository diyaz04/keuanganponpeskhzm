import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert, History, Filter, Search, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  changed_by: string | null;
  changed_at: string;
  // resolved di frontend
  resolved_nama?: string;
  resolved_role?: string;
}

interface UserProfile {
  id: string;
  nama_lengkap: string;
  role: string;
}

const AuditLog = () => {
  const { profile } = useAuth();
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Proteksi Khusus Admin
  if (profile?.role === 'bendahara') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  // Ekstrak user ID dari audit log entry — coba changed_by dulu, lalu input_by dari JSON data
  const extractUserId = (log: AuditLogEntry): string | null => {
    // 1. Jika changed_by sudah terisi (ideal)
    if (log.changed_by) return log.changed_by;

    // 2. Coba ambil dari new_data.input_by (INSERT / UPDATE)
    if (log.new_data?.input_by) return log.new_data.input_by;

    // 3. Coba ambil dari old_data.input_by (DELETE)
    if (log.old_data?.input_by) return log.old_data.input_by;

    return null;
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      setErrorMsg(null);
      
      // 1. Fetch audit logs
      const { data: auditData, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error("Supabase Error:", error);
        setErrorMsg(error.message || 'Unknown error');
        throw error;
      }

      if (!auditData || auditData.length === 0) {
        setLogs([]);
        return;
      }

      // 2. Kumpulkan semua unique user IDs dari audit log
      const userIdSet = new Set<string>();
      for (const log of auditData) {
        const uid = extractUserId(log);
        if (uid) userIdSet.add(uid);
      }

      // 3. Fetch semua user profiles sekaligus (batch, bukan per-row)
      let userMap: Record<string, UserProfile> = {};
      if (userIdSet.size > 0) {
        const { data: users } = await supabase
          .from('user_roles')
          .select('id, nama_lengkap, role')
          .in('id', Array.from(userIdSet));

        if (users) {
          for (const u of users) {
            userMap[u.id] = u;
          }
        }
      }

      // 4. Resolve nama user ke setiap log entry
      const resolvedLogs: AuditLogEntry[] = auditData.map(log => {
        const uid = extractUserId(log);
        const userProfile = uid ? userMap[uid] : null;
        return {
          ...log,
          resolved_nama: userProfile?.nama_lengkap || null,
          resolved_role: userProfile?.role || null,
        } as AuditLogEntry;
      });

      setLogs(resolvedLogs);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchAction = filterAction === 'ALL' || log.action === filterAction;
      const userName = log.resolved_nama || 'Sistem';
      const matchSearch = userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.table_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchAction && matchSearch;
    });
  }, [logs, filterAction, searchTerm]);

  const getActionColor = (action: string) => {
    switch(action) {
      case 'INSERT': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'UPDATE': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTableLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      'transaksi_masuk': 'Uang Masuk',
      'transaksi_keluar': 'Pengeluaran',
      'tabungan_mutasi': 'Tabungan',
      'santri': 'Data Santri',
      'kategori_pembayaran': 'Kategori Pembayaran',
      'kategori_pengeluaran': 'Kategori Pengeluaran',
      'kelas_pengajian': 'Kelas Pengajian',
      'user_roles': 'Akun Pengguna',
      'kas_pesantren_mutasi': 'Kas Pesantren',
    };
    return labels[tableName] || tableName;
  };

  const getActionLabel = (action: string) => {
    switch(action) {
      case 'INSERT': return 'Menambahkan';
      case 'UPDATE': return 'Mengubah';
      case 'DELETE': return 'Menghapus';
      default: return action;
    }
  };

  const formatJSON = (jsonObj: any) => {
    if (!jsonObj) return 'Tidak ada data';
    return JSON.stringify(jsonObj, null, 2);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center">
            <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center mr-4 shadow-sm">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Log Aktivitas (Audit Trail)</h1>
              <p className="text-sm text-gray-500">Merekam semua perubahan data sensitif secara otomatis (Admin Only).</p>
            </div>
          </div>
          <button 
            onClick={fetchLogs}
            className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <History className="h-4 w-4 mr-2" />
            Refresh Data
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Filter Bar */}
          <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari berdasarkan nama user atau tabel..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select 
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-800 outline-none"
              >
                <option value="ALL">Semua Aksi</option>
                <option value="INSERT">Data Baru (INSERT)</option>
                <option value="UPDATE">Ubah Data (UPDATE)</option>
                <option value="DELETE">Hapus Data (DELETE)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {errorMsg ? (
            <div className="p-20 flex flex-col items-center justify-center text-red-500">
              <ShieldAlert className="h-10 w-10 mb-4" />
              <p className="font-bold">Gagal mengambil data Audit Log</p>
              <p className="text-sm mt-2">{errorMsg}</p>
            </div>
          ) : loading ? (
            <div className="p-20 flex flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 text-slate-800 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Membaca log dari database...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-20 text-center text-gray-500">
              Tidak ada riwayat aktivitas yang sesuai.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white border-b border-gray-100">
                    <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Waktu Kejadian</th>
                    <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Pelaku (User)</th>
                    <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Aktivitas</th>
                    <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Aksi</th>
                    <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider text-right">Detail Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="text-sm font-bold text-gray-900">
                            {new Date(log.changed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(log.changed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-bold text-slate-800">{log.resolved_nama || 'Sistem'}</div>
                          {log.resolved_role && (
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${log.resolved_role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {log.resolved_role === 'admin' ? 'Administrator' : 'Bendahara'}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-gray-800">
                            <span className="font-medium">{getActionLabel(log.action)}</span>
                            {' '}data di{' '}
                            <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                              {getTableLabel(log.table_name)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                            className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors"
                          >
                            {expandedRow === log.id ? 'Tutup Detail' : 'Lihat Data JSON'}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded JSON Detail Row */}
                      {expandedRow === log.id && (
                        <tr className="bg-slate-800 text-emerald-400">
                          <td colSpan={5} className="p-0 border-b border-slate-700">
                            <div className="p-6 overflow-x-auto text-xs font-mono grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {log.old_data && (
                                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50 shadow-inner">
                                  <div className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-[10px] border-b border-slate-700/50 pb-2">
                                    🔴 Data Sebelumnya (Sebelum Dihapus/Diubah)
                                  </div>
                                  <pre className="whitespace-pre-wrap break-all">{formatJSON(log.old_data)}</pre>
                                </div>
                              )}
                              
                              {log.new_data && (
                                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50 shadow-inner">
                                  <div className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-[10px] border-b border-slate-700/50 pb-2">
                                    🟢 Data Baru (Setelah Dibuat/Diubah)
                                  </div>
                                  <pre className="whitespace-pre-wrap break-all">{formatJSON(log.new_data)}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default AuditLog;
