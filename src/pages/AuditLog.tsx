import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, ShieldAlert, History, Filter, Search, Loader2 } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  changed_at: string;
  user_roles: { nama_lengkap: string; role: string } | null;
}

const AuditLog = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Proteksi Khusus Admin (Meski RLS database sudah melindungi datanya, kita cegah halamannya diload)
  if (profile?.role === 'bendahara') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          *,
          user_roles:changed_by (nama_lengkap, role)
        `)
        .order('changed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) setLogs(data as any);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchAction = filterAction === 'ALL' || log.action === filterAction;
    const matchSearch = (log.user_roles?.nama_lengkap || 'Sistem').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        log.table_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchAction && matchSearch;
  });

  const getActionColor = (action: string) => {
    switch(action) {
      case 'INSERT': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'UPDATE': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
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
          {loading ? (
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
                    <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tabel</th>
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
                          <div className="text-sm font-bold text-slate-800">{log.user_roles?.nama_lengkap || 'Sistem Database'}</div>
                          {log.user_roles?.role && (
                            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{log.user_roles.role}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {log.table_name}
                          </span>
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
