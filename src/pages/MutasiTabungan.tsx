import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Wallet, Search, ArrowDownCircle, ArrowUpCircle, Loader2, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import { formatRupiah, parseRupiah } from '@/lib/format';
import { exportTabunganSantri, exportTabunganSemua } from '@/lib/exportTabungan';

interface Santri {
  id: string;
  nama: string;
  kamar: string;
}

interface MutasiHistory {
  id: string;
  tipe: 'setor' | 'tarik';
  nominal: number;
  saldo_berjalan: number;
  tanggal_transaksi: string;
  user_roles: { nama_lengkap: string };
}

const MutasiTabungan = () => {
  const { user } = useAuth();
  const [exporting, setExporting] = useState<'santri' | 'semua' | null>(null);
  
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [searchSantri, setSearchSantri] = useState('');
  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null);
  
  const [globalTotal, setGlobalTotal] = useState<number>(0);
  const [lastBalance, setLastBalance] = useState<number>(0);
  const [historyList, setHistoryList] = useState<MutasiHistory[]>([]);
  
  const [formData, setFormData] = useState({
    tipe: 'setor' as 'setor' | 'tarik',
    nominal_text: '0',
    tanggal_transaksi: new Date().toISOString().split('T')[0]
  });
  
  const [loadingSantri, setLoadingSantri] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchMasterData();
    fetchGlobalTotal();
  }, []);

  const fetchMasterData = async () => {
    const { data } = await supabase.from('santri').select('id, nama, kamar').eq('status', 'aktif').order('nama');
    if (data) setSantriList(data);
  };

  const fetchGlobalTotal = async () => {
    // Because we don't have a specific SQL view yet, we sum all setor and tarik globally
    const { data, error } = await supabase
      .from('tabungan_mutasi')
      .select('tipe, nominal');
      
    if (!error && data) {
      const totalSetor = data.filter(d => d.tipe === 'setor').reduce((sum, item) => sum + Number(item.nominal), 0);
      const totalTarik = data.filter(d => d.tipe === 'tarik').reduce((sum, item) => sum + Number(item.nominal), 0);
      setGlobalTotal(totalSetor - totalTarik);
    }
  };

  const fetchSantriData = async (santriId: string) => {
    setLoadingSantri(true);
    
    // 1. Fetch History
    const { data: hist } = await supabase
      .from('tabungan_mutasi')
      .select(`
        id, tipe, nominal, saldo_berjalan, tanggal_transaksi,
        user_roles!inner(nama_lengkap)
      `)
      .eq('santri_id', santriId)
      .order('created_at', { ascending: false });
      
    if (hist) {
      setHistoryList(hist as any);
      // Saldo terakhir ada di index 0 (karena DESC)
      setLastBalance(hist.length > 0 ? Number(hist[0].saldo_berjalan) : 0);
    } else {
      setHistoryList([]);
      setLastBalance(0);
    }
    
    setLoadingSantri(false);
  };

  const handleSelectSantri = (s: Santri) => {
    setSelectedSantri(s);
    setSearchSantri('');
    fetchSantriData(s.id);
  };

  const clearSantri = () => {
    setSelectedSantri(null);
    setHistoryList([]);
    setLastBalance(0);
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseRupiah(e.target.value);
    setFormData(prev => ({ ...prev, nominal_text: formatRupiah(val) }));
  };

  // Filter santri for searchable combobox
  const filteredSantri = useMemo(() => {
    if (!searchSantri) return [];
    return santriList.filter(s => s.nama.toLowerCase().includes(searchSantri.toLowerCase())).slice(0, 5);
  }, [searchSantri, santriList]);

  const handleExportSantri = async () => {
    if (!selectedSantri) return;
    setExporting('santri');
    try {
      await exportTabunganSantri({ id: selectedSantri.id, nama: selectedSantri.nama, kamar: selectedSantri.kamar });
    } catch (error: any) {
      console.error('Error export tabungan santri:', error);
      alert('Gagal export: ' + (error?.message || 'terjadi kesalahan'));
    } finally {
      setExporting(null);
    }
  };

  const handleExportSemua = async () => {
    setExporting('semua');
    try {
      await exportTabunganSemua();
    } catch (error: any) {
      console.error('Error export rekap tabungan:', error);
      alert('Gagal export: ' + (error?.message || 'terjadi kesalahan'));
    } finally {
      setExporting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSantri) return;

    const nominalNum = parseRupiah(formData.nominal_text);
    if (nominalNum <= 0) return alert('Nominal harus lebih dari 0');

    // Validasi Tarik
    if (formData.tipe === 'tarik' && nominalNum > lastBalance) {
      return alert(`Gagal: Saldo tidak mencukupi! Maksimal penarikan adalah Rp ${formatRupiah(lastBalance)}`);
    }

    setSaving(true);
    try {
      // Kalkulasi saldo berjalan baru
      const newSaldo = formData.tipe === 'setor' 
        ? lastBalance + nominalNum 
        : lastBalance - nominalNum;

      const { error } = await supabase.from('tabungan_mutasi').insert([{
        santri_id: selectedSantri.id,
        tipe: formData.tipe,
        nominal: nominalNum,
        saldo_berjalan: newSaldo,
        tanggal_transaksi: formData.tanggal_transaksi,
        input_by: user.id
      }]);

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Reset form & Refresh Data
      setFormData(prev => ({ ...prev, nominal_text: '0' }));
      fetchSantriData(selectedSantri.id);
      fetchGlobalTotal(); // update global dashboard
      
    } catch (error: any) {
      console.error('Error saving mutasi:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Global Overview Card */}
        <div className="bg-gradient-to-r from-khzm-emerald to-khzm-green rounded-2xl p-6 text-white shadow-lg mb-8 relative overflow-hidden">
          <Wallet className="absolute right-[-20px] bottom-[-20px] h-48 w-48 text-white opacity-10" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-green-50 font-medium mb-1">Total Titipan Tabungan Seluruh Santri</p>
              <h2 className="text-4xl font-bold">Rp {globalTotal.toLocaleString('id-ID')}</h2>
            </div>
            <button
              onClick={handleExportSemua}
              disabled={exporting !== null}
              className="flex items-center justify-center px-4 py-2.5 bg-white text-khzm-green rounded-lg font-bold text-sm shadow hover:bg-green-50 transition-colors disabled:opacity-60"
            >
              {exporting === 'semua' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Export Rekap Semua Santri (Excel)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Kolom Kiri: Pilih Santri & Saldo */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">Pilih Santri</h3>
              
              {!selectedSantri ? (
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={searchSantri}
                    onChange={(e) => setSearchSantri(e.target.value)}
                    placeholder="Ketik nama santri..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-khzm-green outline-none"
                  />
                  
                  {searchSantri && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {filteredSantri.length > 0 ? (
                        filteredSantri.map(s => (
                          <button
                            key={s.id}
                            onClick={() => handleSelectSantri(s)}
                            className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-50"
                          >
                            <div className="font-medium text-gray-900">{s.nama}</div>
                            <div className="text-xs text-gray-500">Kamar {s.kamar || '-'}</div>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-gray-500">Santri tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-green-900">{selectedSantri.nama}</h4>
                      <p className="text-xs text-green-700">Kamar: {selectedSantri.kamar || '-'}</p>
                    </div>
                    <button 
                      onClick={clearSantri}
                      className="text-xs text-green-800 underline hover:text-green-900"
                    >
                      Ganti Santri
                    </button>
                  </div>
                  
                  <div className="pt-3 border-t border-green-200/60">
                    <p className="text-xs text-green-800 mb-1">Saldo Tersedia:</p>
                    {loadingSantri ? (
                      <div className="h-8 bg-green-200/50 animate-pulse rounded w-3/4"></div>
                    ) : (
                      <p className="text-2xl font-bold text-khzm-green">Rp {lastBalance.toLocaleString('id-ID')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kolom Kanan: Form Transaksi & Riwayat */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Form Box */}
            <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-opacity ${!selectedSantri ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Input Mutasi Tabungan</h3>
              
              {showSuccess && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 flex items-center shadow-sm">
                  <CheckCircle2 className="h-5 w-5 mr-3 text-green-600" />
                  <span className="font-medium">Mutasi berhasil dicatat!</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Transaksi</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, tipe: 'setor'}))}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center ${
                          formData.tipe === 'setor' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <ArrowDownCircle className="h-4 w-4 mr-1.5" />
                        Setor Tunai
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, tipe: 'tarik'}))}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center ${
                          formData.tipe === 'tarik' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <ArrowUpCircle className="h-4 w-4 mr-1.5" />
                        Tarik Tunai
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Mutasi</label>
                    <input 
                      type="date" 
                      value={formData.tanggal_transaksi}
                      onChange={(e) => setFormData({...formData, tanggal_transaksi: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-khzm-green outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nominal (Rp)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">Rp</span>
                    </div>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={formData.nominal_text}
                      onChange={(e) => {
                        const val = parseRupiah(e.target.value);
                        setFormData({...formData, nominal_text: formatRupiah(val)});
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-khzm-green outline-none font-bold text-gray-900 text-xl"
                      required
                    />
                  </div>
                  {formData.tipe === 'tarik' && parseRupiah(formData.nominal_text) > lastBalance && (
                    <p className="text-red-500 text-sm mt-2 font-medium">
                      Peringatan: Nominal penarikan melebihi saldo tersedia!
                    </p>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={saving || (formData.tipe === 'tarik' && parseRupiah(formData.nominal_text) > lastBalance)}
                  className={`w-full text-white py-3.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                    formData.tipe === 'setor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      {formData.tipe === 'setor' ? 'Simpan Setoran Tabungan' : 'Proses Penarikan Tabungan'}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Riwayat Buku Tabungan */}
            {selectedSantri && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4 gap-3">
                  <h3 className="font-bold text-gray-900">Buku Tabungan {selectedSantri.nama}</h3>
                  <button
                    onClick={handleExportSantri}
                    disabled={exporting !== null || historyList.length === 0}
                    className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {exporting === 'santri' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Export Excel
                  </button>
                </div>
                
                {loadingSantri ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 text-khzm-green animate-spin" /></div>
                ) : historyList.length === 0 ? (
                  <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    Belum ada riwayat mutasi untuk santri ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="p-3 font-semibold text-gray-700 text-sm">Tanggal</th>
                          <th className="p-3 font-semibold text-gray-700 text-sm">Sandi</th>
                          <th className="p-3 font-semibold text-gray-700 text-sm text-right">Mutasi</th>
                          <th className="p-3 font-semibold text-gray-700 text-sm text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {historyList.map((hist) => (
                          <tr key={hist.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-gray-600 text-sm whitespace-nowrap">{hist.tanggal_transaksi}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                hist.tipe === 'setor' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {hist.tipe === 'setor' ? 'SETOR' : 'TARIK'}
                              </span>
                            </td>
                            <td className={`p-3 font-bold text-sm text-right whitespace-nowrap ${
                              hist.tipe === 'setor' ? 'text-blue-600' : 'text-orange-600'
                            }`}>
                              {hist.tipe === 'setor' ? '+' : '-'} {hist.nominal.toLocaleString('id-ID')}
                            </td>
                            <td className="p-3 font-bold text-gray-900 text-sm text-right whitespace-nowrap">
                              Rp {hist.saldo_berjalan.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default MutasiTabungan;
