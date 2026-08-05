import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Edit2, Power, PowerOff, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Kategori {
  id: string;
  nama: string;
  nominal_default: number;
  tipe: 'rutin' | 'tabungan';
  is_active: boolean;
}

const MasterKategori = () => {
  const navigate = useNavigate();
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    nominal_default: 0,
    tipe: 'rutin' as 'rutin' | 'tabungan'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKategori();
  }, []);

  const fetchKategori = async () => {
    try {
      const { data, error } = await supabase
        .from('kategori_pembayaran')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setKategori(data || []);
    } catch (error) {
      console.error('Error fetching kategori:', error);
      alert('Gagal mengambil data kategori.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (k?: Kategori) => {
    if (k) {
      setEditingId(k.id);
      setFormData({
        nama: k.nama,
        nominal_default: k.nominal_default,
        tipe: k.tipe
      });
    } else {
      setEditingId(null);
      setFormData({
        nama: '',
        nominal_default: 0,
        tipe: 'rutin'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('kategori_pembayaran')
          .update({
            nama: formData.nama,
            nominal_default: formData.nominal_default,
            tipe: formData.tipe
          })
          .eq('id', editingId);
          
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('kategori_pembayaran')
          .insert([{
            nama: formData.nama,
            nominal_default: formData.nominal_default,
            tipe: formData.tipe,
            is_active: true
          }]);
          
        if (error) throw error;
      }
      
      handleCloseModal();
      fetchKategori();
    } catch (error) {
      console.error('Error saving kategori:', error);
      alert('Gagal menyimpan kategori.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!window.confirm(`Apakah Anda yakin ingin ${currentStatus ? 'menonaktifkan' : 'mengaktifkan'} kategori ini?`)) return;
    
    try {
      const { error } = await supabase
        .from('kategori_pembayaran')
        .update({ is_active: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      fetchKategori();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Gagal mengubah status kategori.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-end mb-6">
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Kategori Baru
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">Master Kategori Pembayaran</h1>
            <p className="text-gray-500 mt-1 text-sm">Kelola jenis-jenis tagihan atau tabungan santri.</p>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="h-8 w-8 text-khzm-green animate-spin" />
            </div>
          ) : kategori.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Belum ada kategori pembayaran. Silakan tambah baru.
            </div>
          ) : (
            <>
              {/* Desktop View (Table) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-4 font-semibold text-gray-700">Nama Kategori</th>
                      <th className="p-4 font-semibold text-gray-700">Nominal Default</th>
                      <th className="p-4 font-semibold text-gray-700">Tipe</th>
                      <th className="p-4 font-semibold text-gray-700">Status</th>
                      <th className="p-4 font-semibold text-gray-700 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {kategori.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-gray-900">{k.nama}</td>
                        <td className="p-4 text-gray-600">Rp {k.nominal_default.toLocaleString('id-ID')}</td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                            k.tipe === 'rutin' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {k.tipe.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                            k.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {k.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleOpenModal(k)}
                            className="inline-flex p-2 text-gray-500 hover:text-blue-600 transition-colors mr-2 rounded-md hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleActive(k.id, k.is_active)}
                            className={`inline-flex p-2 rounded-md transition-colors ${
                              k.is_active 
                                ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' 
                                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={k.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            {k.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (Cards) */}
              <div className="md:hidden divide-y divide-gray-100">
                {kategori.map((k) => (
                  <div key={k.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">{k.nama}</h3>
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${
                        k.tipe === 'rutin' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {k.tipe.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-gray-600 font-mono text-sm mb-3">
                      Rp {k.nominal_default.toLocaleString('id-ID')}
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <span className={`inline-flex items-center text-xs font-medium ${
                        k.is_active ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <div className={`h-2 w-2 rounded-full mr-1.5 ${k.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        {k.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleOpenModal(k)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleToggleActive(k.id, k.is_active)}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            k.is_active 
                              ? 'text-red-700 bg-red-50 hover:bg-red-100' 
                              : 'text-green-700 bg-green-50 hover:bg-green-100'
                          }`}
                        >
                          {k.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal / Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={handleCloseModal}></div>
          
          <div className="bg-white w-full sm:w-[450px] rounded-t-2xl sm:rounded-2xl shadow-xl z-10 relative animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Kategori' : 'Tambah Kategori'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kategori</label>
                  <input 
                    type="text" 
                    value={formData.nama}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all"
                    placeholder="Contoh: Uang Makan Bulanan"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nominal Default (Rp)</label>
                  <input 
                    type="number" 
                    value={formData.nominal_default}
                    onChange={(e) => setFormData({...formData, nominal_default: Number(e.target.value)})}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-khzm-green focus:border-transparent outline-none transition-all"
                    placeholder="0"
                    min="0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Isi 0 jika nominal bersifat bebas/variabel (misal: tabungan).</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Pembayaran</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="radio" 
                        value="rutin"
                        checked={formData.tipe === 'rutin'}
                        onChange={() => setFormData({...formData, tipe: 'rutin'})}
                        className="text-khzm-green focus:ring-khzm-green h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700">Rutin (SPP, Makan)</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="radio" 
                        value="tabungan"
                        checked={formData.tipe === 'tabungan'}
                        onChange={() => setFormData({...formData, tipe: 'tabungan'})}
                        className="text-khzm-green focus:ring-khzm-green h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700">Tabungan</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-khzm-emerald to-khzm-green hover:from-emerald-600 hover:to-green-600 text-white rounded-lg transition-colors shadow-sm font-medium flex justify-center items-center"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterKategori;
