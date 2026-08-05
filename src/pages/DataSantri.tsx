import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, Eye, Edit2, UserMinus, Loader2, X } from 'lucide-react';

interface Santri {
  id: string;
  nama: string;
  kelas_id: string;
  kelas_pengajian?: { nama: string };
  kamar: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat: string;
  status: 'aktif' | 'keluar';
  tanggal_masuk: string;
  tanggal_keluar: string | null;
}

interface Kelas {
  id: string;
  nama: string;
}

const DataSantri = () => {
  const navigate = useNavigate();
  const [santri, setSantri] = useState<Santri[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | 'aktif' | 'keluar'>('aktif');
  const [kelasFilter, setKelasFilter] = useState<string>('semua');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isKeluarModalOpen, setIsKeluarModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    kelas_id: '',
    kamar: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat: '',
    tanggal_masuk: new Date().toISOString().split('T')[0]
  });
  const [tanggalKeluar, setTanggalKeluar] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKelas();
  }, []);

  useEffect(() => {
    fetchSantri();
  }, [statusFilter, kelasFilter]);

  const fetchKelas = async () => {
    try {
      const { data, error } = await supabase
        .from('kelas_pengajian')
        .select('id, nama')
        .eq('is_active', true);
      if (error) throw error;
      setKelas(data || []);
      if (data && data.length > 0 && !formData.kelas_id) {
        setFormData(prev => ({ ...prev, kelas_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching kelas:', error);
    }
  };

  const fetchSantri = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('santri')
        .select(`*, kelas_pengajian(nama)`)
        .order('nama', { ascending: true });

      if (statusFilter !== 'semua') {
        query = query.eq('status', statusFilter);
      }
      
      if (kelasFilter !== 'semua') {
        query = query.eq('kelas_id', kelasFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setSantri(data || []);
    } catch (error) {
      console.error('Error fetching santri:', error);
      alert('Gagal mengambil data santri.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (s?: Santri) => {
    if (s) {
      setEditingId(s.id);
      setFormData({
        nama: s.nama,
        kelas_id: s.kelas_id,
        kamar: s.kamar || '',
        tempat_lahir: s.tempat_lahir || '',
        tanggal_lahir: s.tanggal_lahir || '',
        alamat: s.alamat || '',
        tanggal_masuk: s.tanggal_masuk || new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingId(null);
      setFormData({
        nama: '',
        kelas_id: kelas.length > 0 ? kelas[0].id : '',
        kamar: '',
        tempat_lahir: '',
        tanggal_lahir: '',
        alamat: '',
        tanggal_masuk: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        nama: formData.nama,
        kelas_id: formData.kelas_id,
        kamar: formData.kamar,
        tempat_lahir: formData.tempat_lahir,
        tanggal_lahir: formData.tanggal_lahir || null,
        alamat: formData.alamat,
        tanggal_masuk: formData.tanggal_masuk
      };

      if (editingId) {
        const { error } = await supabase.from('santri').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('santri').insert([{ ...payload, status: 'aktif' }]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchSantri();
    } catch (error) {
      console.error('Error saving santri:', error);
      alert('Gagal menyimpan data santri.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenKeluarModal = (id: string) => {
    setEditingId(id);
    setTanggalKeluar(new Date().toISOString().split('T')[0]);
    setIsKeluarModalOpen(true);
  };

  const handleProsesKeluar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('santri')
        .update({ 
          status: 'keluar',
          tanggal_keluar: tanggalKeluar
        })
        .eq('id', editingId);
        
      if (error) throw error;
      
      setIsKeluarModalOpen(false);
      fetchSantri();
    } catch (error) {
      console.error('Error update status keluar:', error);
      alert('Gagal mengubah status santri.');
    } finally {
      setSaving(false);
    }
  };

  // Filter local for search bar
  const filteredSantri = santri.filter(s => 
    s.nama.toLowerCase().includes(search.toLowerCase()) || 
    (s.kamar && s.kamar.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end mb-6 gap-4">
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/santri/import')}
              className="flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Import Massal
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">Manajemen Data Santri</h1>
            
            {/* Toolbar: Search & Filter */}
            <div className="mt-6 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green focus:border-transparent" 
                  placeholder="Cari nama atau kamar santri..."
                />
              </div>
              
              <div className="flex gap-4">
                <div className="relative">
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-khzm-green focus:border-khzm-green appearance-none bg-white"
                  >
                    <option value="aktif">Status: Aktif</option>
                    <option value="keluar">Status: Keluar</option>
                    <option value="semua">Semua Status</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <Filter className="h-4 w-4" />
                  </div>
                </div>

                <div className="relative">
                  <select 
                    value={kelasFilter}
                    onChange={(e) => setKelasFilter(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-khzm-green focus:border-khzm-green appearance-none bg-white"
                  >
                    <option value="semua">Semua Kelas</option>
                    {kelas.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <Filter className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="h-8 w-8 text-khzm-green animate-spin" />
            </div>
          ) : filteredSantri.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Tidak ada data santri yang cocok dengan filter pencarian.
            </div>
          ) : (
            <>
              {/* Desktop View (Table) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-4 font-semibold text-gray-700">Nama Santri</th>
                      <th className="p-4 font-semibold text-gray-700">Kelas</th>
                      <th className="p-4 font-semibold text-gray-700">Kamar</th>
                      <th className="p-4 font-semibold text-gray-700">Status</th>
                      <th className="p-4 font-semibold text-gray-700 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSantri.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4 font-medium text-gray-900">{s.nama}</td>
                        <td className="p-4 text-gray-600">{s.kelas_pengajian?.nama}</td>
                        <td className="p-4 text-gray-600">{s.kamar || '-'}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            s.status === 'aktif' 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${s.status === 'aktif' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => navigate(`/santri/${s.id}`)}
                              className="p-2 text-gray-500 hover:text-khzm-green hover:bg-green-50 rounded-lg transition-colors"
                              title="Lihat Detail & Histori"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleOpenModal(s)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Data"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {s.status === 'aktif' && (
                              <button 
                                onClick={() => handleOpenKeluarModal(s.id)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Set Status Keluar"
                              >
                                <UserMinus className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (Cards) */}
              <div className="lg:hidden divide-y divide-gray-100 bg-gray-50/50">
                {filteredSantri.map((s) => (
                  <div key={s.id} className="p-5 bg-white mb-2 shadow-sm sm:rounded-lg sm:mx-4 sm:mt-2">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{s.nama}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{s.kelas_pengajian?.nama}</p>
                      </div>
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${
                        s.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {s.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-md">
                      <span className="font-medium mr-2">Kamar:</span> {s.kamar || '-'}
                    </div>
                    
                    <div className="flex grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-gray-100">
                      <button 
                        onClick={() => navigate(`/santri/${s.id}`)}
                        className="flex flex-col items-center justify-center py-2 px-1 text-xs font-medium text-khzm-green bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <Eye className="h-4 w-4 mb-1" />
                        Detail
                      </button>
                      <button 
                        onClick={() => handleOpenModal(s)}
                        className="flex flex-col items-center justify-center py-2 px-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 className="h-4 w-4 mb-1" />
                        Edit
                      </button>
                      {s.status === 'aktif' ? (
                        <button 
                          onClick={() => handleOpenKeluarModal(s.id)}
                          className="flex flex-col items-center justify-center py-2 px-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <UserMinus className="h-4 w-4 mb-1" />
                          Keluar
                        </button>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2 px-1 text-xs font-medium text-gray-400 bg-gray-50 rounded-lg">
                          <span className="block mt-4">Keluar pd {s.tanggal_keluar}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Form Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl z-10 relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Data Santri' : 'Tambah Santri Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="santriForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={formData.nama}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green outline-none transition-all"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kelas Pengajian</label>
                    <select 
                      value={formData.kelas_id}
                      onChange={(e) => setFormData({...formData, kelas_id: e.target.value})}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green outline-none transition-all bg-white"
                      required
                    >
                      <option value="" disabled>Pilih Kelas</option>
                      {kelas.map(k => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kamar</label>
                    <input 
                      type="text" 
                      value={formData.kamar}
                      onChange={(e) => setFormData({...formData, kamar: e.target.value})}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green outline-none transition-all"
                      placeholder="Misal: A-01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Lahir</label>
                    <input 
                      type="text" 
                      value={formData.tempat_lahir}
                      onChange={(e) => setFormData({...formData, tempat_lahir: e.target.value})}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                    <input 
                      type="date" 
                      value={formData.tanggal_lahir}
                      onChange={(e) => setFormData({...formData, tanggal_lahir: e.target.value})}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Asal</label>
                  <textarea 
                    value={formData.alamat}
                    onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green outline-none transition-all"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Masuk Pesantren</label>
                  <input 
                    type="date" 
                    value={formData.tanggal_masuk}
                    onChange={(e) => setFormData({...formData, tanggal_masuk: e.target.value})}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green outline-none transition-all"
                    required
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 shrink-0 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button 
                form="santriForm"
                type="submit"
                disabled={saving}
                className="bg-khzm-green hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center"
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Status Keluar */}
      {isKeluarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsKeluarModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl z-10 relative animate-in zoom-in-95 p-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <UserMinus className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Pindahkan Santri Keluar?</h3>
            <p className="text-sm text-center text-gray-500 mb-6">
              Status santri akan diubah menjadi "keluar". Riwayat transaksinya tidak akan terhapus dan tetap tersimpan sebagai arsip.
            </p>
            
            <form onSubmit={handleProsesKeluar}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Tanggal Keluar (Boyong)</label>
                <input 
                  type="date" 
                  value={tanggalKeluar}
                  onChange={(e) => setTanggalKeluar(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none transition-all text-center"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsKeluarModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center shadow-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Proses Keluar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSantri;
