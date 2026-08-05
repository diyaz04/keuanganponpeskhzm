import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Wallet, Receipt, Users, Search, Filter, Loader2, CheckCircle2, Image as ImageIcon, Edit2, X, AlertTriangle, Printer, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupiah, parseRupiah, formatBulan } from '@/lib/format';
import { cetakKwitansi } from '@/lib/pdf';

interface Kategori {
  id: string;
  nama: string;
  nominal_default: number;
  tipe: 'rutin' | 'tabungan';
}

interface Santri {
  id: string;
  nama: string;
  kelas_id: string;
  kelas_pengajian?: { nama: string };
  kamar: string;
}

interface Kelas {
  id: string;
  nama: string;
}

interface CartItem {
  temp_id: string; // uuid v4 local
  kategori_id: string;
  nama_kategori: string;
  nominal: number;
  nominal_text: string;
  periode_bulan: string;
  periode_tahun: string;
  catatan: string;
}

interface TransaksiRiwayat {
  id: string;
  santri_id: string;
  kategori_id: string;
  santri: { nama: string; kelas_pengajian: { nama: string } };
  kategori_pembayaran: { nama: string };
  nominal: number;
  tanggal_transaksi: string;
  periode_bulan: number | null;
  periode_tahun: number | null;
  catatan: string | null;
  user_roles: { nama_lengkap: string };
}

const TransaksiMasuk = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'input' | 'riwayat'>('input');
  
  // Data Master
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [santriList, setSantriList] = useState<Santri[]>([]);
  
  // State for Target (Santri / Kelas)
  const [inputType, setInputType] = useState<'single' | 'bulk'>('single');
  const [searchSantri, setSearchSantri] = useState('');
  const [selectedSantriId, setSelectedSantriId] = useState<string>('');
  const [selectedKelasId, setSelectedKelasId] = useState<string>('');
  const [bulkSantriIds, setBulkSantriIds] = useState<string[]>([]);
  
  // State for Transaction Metadata
  const [tanggalTransaksi, setTanggalTransaksi] = useState(new Date().toISOString().split('T')[0]);

  // State for Form Item (Draft)
  const [formData, setFormData] = useState({
    kategori_id: '',
    nominal_text: '0',
    periode_bulan: (new Date().getMonth() + 1).toString(),
    periode_tahun: new Date().getFullYear().toString(),
    catatan: ''
  });

  // KERANJANG PEMBAYARAN (CART)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Mode Edit (Single Row Bypass)
  const [editingId, setEditingId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // State for Riwayat
  const [riwayatList, setRiwayatList] = useState<TransaksiRiwayat[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (activeTab === 'riwayat') {
      fetchRiwayat();
    }
  }, [activeTab]);

  const fetchMasterData = async () => {
    const { data: cat } = await supabase.from('kategori_pembayaran').select('*').eq('is_active', true).neq('tipe', 'tabungan');
    if (cat) {
      const virtualTabungan = {
        id: 'TABUNGAN_VIRTUAL',
        nama: 'Tabungan Santri (Titipan)',
        nominal_default: 30000,
        tipe: 'tabungan' as const
      };
      const extendedCat = [...cat, virtualTabungan];
      setKategoriList(extendedCat);
      if (extendedCat.length > 0) handleKategoriChange(extendedCat[0].id, extendedCat);
    }

    const { data: kel } = await supabase.from('kelas_pengajian').select('*').eq('is_active', true);
    if (kel) setKelasList(kel);

    const { data: sntr } = await supabase.from('santri').select('*, kelas_pengajian(nama)').eq('status', 'aktif');
    if (sntr) setSantriList(sntr);
  };

  const fetchRiwayat = async () => {
    setLoadingRiwayat(true);
    const { data, error } = await supabase
      .from('transaksi_masuk')
      .select(`
        id, santri_id, kategori_id, nominal, tanggal_transaksi, periode_bulan, periode_tahun, catatan,
        santri!inner(nama, kelas_pengajian(nama)),
        kategori_pembayaran!inner(nama),
        user_roles!inner(nama_lengkap)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (!error && data) {
      setRiwayatList(data as any);
    }
    setLoadingRiwayat(false);
  };

  const handleKategoriChange = (id: string, list: Kategori[] = kategoriList) => {
    const selected = list.find(k => k.id === id);
    setFormData(prev => ({
      ...prev,
      kategori_id: id,
      nominal_text: selected && !editingId ? formatRupiah(selected.nominal_default) : prev.nominal_text
    }));
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseRupiah(e.target.value);
    setFormData(prev => ({ ...prev, nominal_text: formatRupiah(val) }));
  };

  const filteredSantri = useMemo(() => {
    if (!searchSantri) return [];
    return santriList.filter(s => s.nama.toLowerCase().includes(searchSantri.toLowerCase())).slice(0, 5);
  }, [searchSantri, santriList]);

  const classSantriList = useMemo(() => {
    if (!selectedKelasId) return [];
    return santriList.filter(s => s.kelas_id === selectedKelasId);
  }, [selectedKelasId, santriList]);

  useEffect(() => {
    if (inputType === 'bulk' && selectedKelasId) {
      setBulkSantriIds(classSantriList.map(s => s.id));
    }
  }, [selectedKelasId, classSantriList, inputType]);

  const toggleBulkSantri = (id: string) => {
    setBulkSantriIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ================= CART LOGIC =================
  const handleAddToCart = () => {
    const nominalNum = parseRupiah(formData.nominal_text);
    if (nominalNum <= 0) return alert('Nominal harus lebih dari 0');
    if (!formData.kategori_id) return alert('Pilih kategori pembayaran');

    const kat = kategoriList.find(k => k.id === formData.kategori_id);
    if (!kat) return;

    // Cek keranjang apakah sudah ada tagihan yg sama (kategori & periode sama)
    const exists = cartItems.find(item => 
      item.kategori_id === formData.kategori_id && 
      item.periode_bulan === formData.periode_bulan && 
      item.periode_tahun === formData.periode_tahun
    );

    if (exists) {
      const confirm = window.confirm('Tagihan kategori dan periode ini sudah ada di keranjang. Apakah Anda yakin ingin menambahkannya lagi (Double)?');
      if (!confirm) return;
    }

    const newItem: CartItem = {
      temp_id: crypto.randomUUID(),
      kategori_id: formData.kategori_id,
      nama_kategori: kat.nama,
      nominal: nominalNum,
      nominal_text: formData.nominal_text,
      periode_bulan: formData.periode_bulan,
      periode_tahun: formData.periode_tahun,
      catatan: formData.catatan
    };

    setCartItems(prev => [...prev, newItem]);
    
    // Reset form draft but keep same category
    setFormData(prev => ({
      ...prev,
      catatan: ''
    }));
  };

  const handleAddSemuaRutin = () => {
    const rutinCategories = kategoriList.filter(k => k.tipe === 'rutin' || k.id === 'TABUNGAN_VIRTUAL');
    if (rutinCategories.length === 0) return alert('Tidak ada kategori tagihan yang aktif.');

    const newItems: CartItem[] = [];
    
    rutinCategories.forEach(kat => {
      // Cek apakah sudah ada di keranjang
      const exists = cartItems.find(item => 
        item.kategori_id === kat.id && 
        item.periode_bulan === formData.periode_bulan && 
        item.periode_tahun === formData.periode_tahun
      );

      if (!exists) {
        newItems.push({
          temp_id: crypto.randomUUID(),
          kategori_id: kat.id,
          nama_kategori: kat.nama,
          nominal: kat.nominal_default,
          nominal_text: formatRupiah(kat.nominal_default),
          periode_bulan: formData.periode_bulan,
          periode_tahun: formData.periode_tahun,
          catatan: formData.catatan
        });
      }
    });

    if (newItems.length > 0) {
      setCartItems(prev => [...prev, ...newItems]);
      // Reset form catatan
      setFormData(prev => ({ ...prev, catatan: '' }));
    } else {
      alert('Semua tagihan rutin untuk periode ini sudah ada di keranjang.');
    }
  };

  const handleRemoveFromCart = (temp_id: string) => {
    setCartItems(prev => prev.filter(item => item.temp_id !== temp_id));
  };

  const grandTotal = useMemo(() => {
    if (editingId) return parseRupiah(formData.nominal_text);
    return cartItems.reduce((acc, item) => acc + item.nominal, 0);
  }, [cartItems, editingId, formData.nominal_text]);

  // ================= SUBMIT LOGIC =================
  const handleSubmit = async () => {
    if (!user) return alert('Session expired');

    let targetIds: string[] = [];
    if (inputType === 'single') {
      if (!selectedSantriId) return alert('Pilih santri terlebih dahulu');
      targetIds = [selectedSantriId];
    } else {
      if (bulkSantriIds.length === 0) return alert('Pilih minimal 1 santri dari kelas');
      targetIds = bulkSantriIds;
    }

    if (editingId) {
      // EDIT MODE: Langsung proses formData tanpa keranjang
      const nominalNum = parseRupiah(formData.nominal_text);
      if (nominalNum <= 0) return alert('Nominal harus lebih dari 0');
      
      setSaving(true);
      try {
        const payload = {
          kategori_id: formData.kategori_id,
          nominal: nominalNum,
          tanggal_transaksi: tanggalTransaksi,
          periode_bulan: formData.periode_bulan ? parseInt(formData.periode_bulan) : null,
          periode_tahun: formData.periode_tahun ? parseInt(formData.periode_tahun) : null,
          catatan: formData.catatan || null
        };
        const { error } = await supabase.from('transaksi_masuk').update(payload).eq('id', editingId);
        if (error) throw error;
        
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        handleCancelEdit();
        setActiveTab('riwayat');
        fetchRiwayat();
      } catch (error: any) {
        console.error('Error saving:', error);
        alert('Gagal update: ' + error.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    // INSERT MODE: Proses seluruh keranjang
    if (cartItems.length === 0) return alert('Keranjang pembayaran kosong! Tambahkan minimal 1 tagihan.');

    setSaving(true);
    try {
      const payloads: any[] = [];
      const tabunganPayloads: any[] = [];
      
      // Susun Payload untuk bulk insert
      targetIds.forEach(santri_id => {
        cartItems.forEach(item => {
          if (item.kategori_id === 'TABUNGAN_VIRTUAL') {
            tabunganPayloads.push({
              santri_id,
              nominal: item.nominal,
              tanggal_transaksi: tanggalTransaksi,
              catatan: item.catatan || null
            });
          } else {
            payloads.push({
              santri_id,
              kategori_id: item.kategori_id,
              nominal: item.nominal,
              tanggal_transaksi: tanggalTransaksi,
              periode_bulan: item.periode_bulan ? parseInt(item.periode_bulan) : null,
              periode_tahun: item.periode_tahun ? parseInt(item.periode_tahun) : null,
              catatan: item.catatan || null,
              input_by: user.id
            });
          }
        });
      });

      // Insert ke database untuk transaksi masuk biasa
      if (payloads.length > 0) {
        const { error } = await supabase.from('transaksi_masuk').insert(payloads);
        if (error) throw error;
      }

      // Insert ke database untuk tabungan
      if (tabunganPayloads.length > 0) {
        for (const tb of tabunganPayloads) {
          const { data: tbHist } = await supabase.from('tabungan_mutasi')
            .select('saldo_berjalan')
            .eq('santri_id', tb.santri_id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const currentSaldo = tbHist && tbHist.length > 0 ? tbHist[0].saldo_berjalan : 0;
          
          const { error: insertError } = await supabase.from('tabungan_mutasi').insert([{
             santri_id: tb.santri_id,
             tipe: 'setor',
             nominal: tb.nominal,
             saldo_berjalan: currentSaldo + tb.nominal,
             tanggal_transaksi: tb.tanggal_transaksi,
             input_by: user.id
          }]);
          
          if (insertError) throw insertError;
        }
      }

      // Sukses
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Bersihkan state
      setCartItems([]);
      if (inputType === 'single') {
        setSelectedSantriId('');
        setSearchSantri('');
      } else {
        setSelectedKelasId('');
        setBulkSantriIds([]);
      }
      
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      alert('Terjadi kesalahan saat menyimpan transaksi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (trx: TransaksiRiwayat) => {
    setEditingId(trx.id);
    setSelectedSantriId(trx.santri_id);
    setSearchSantri(trx.santri.nama);
    setInputType('single');
    
    setFormData({
      kategori_id: trx.kategori_id,
      nominal_text: formatRupiah(trx.nominal),
      periode_bulan: trx.periode_bulan ? trx.periode_bulan.toString() : '',
      periode_tahun: trx.periode_tahun ? trx.periode_tahun.toString() : '',
      catatan: trx.catatan || ''
    });
    setTanggalTransaksi(trx.tanggal_transaksi);
    setActiveTab('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedSantriId('');
    setSearchSantri('');
    setFormData({
      kategori_id: kategoriList.length > 0 ? kategoriList[0].id : '',
      nominal_text: kategoriList.length > 0 ? formatRupiah(kategoriList[0].nominal_default) : '0',
      periode_bulan: (new Date().getMonth() + 1).toString(),
      periode_tahun: new Date().getFullYear().toString(),
      catatan: ''
    });
    setTanggalTransaksi(new Date().toISOString().split('T')[0]);
  };

  const handleCetakGabungan = async (trx: TransaksiRiwayat) => {
    // Cari semua transaksi untuk santri yang sama di tanggal transaksi yang sama
    const group = riwayatList.filter(
      r => r.santri_id === trx.santri_id && r.tanggal_transaksi === trx.tanggal_transaksi
    );

    // Fetch tabungan_mutasi juga agar masuk ke kwitansi
    const { data: tabunganData } = await supabase
      .from('tabungan_mutasi')
      .select('id, nominal, tanggal_transaksi')
      .eq('santri_id', trx.santri_id)
      .eq('tanggal_transaksi', trx.tanggal_transaksi)
      .eq('tipe', 'setor');

    const allTrx = [...group];
    
    if (tabunganData && tabunganData.length > 0) {
      tabunganData.forEach(tb => {
        allTrx.push({
          id: tb.id,
          santri_id: trx.santri_id,
          kategori_id: 'TABUNGAN_VIRTUAL',
          nominal: tb.nominal,
          tanggal_transaksi: tb.tanggal_transaksi,
          periode_bulan: trx.periode_bulan,
          periode_tahun: trx.periode_tahun,
          catatan: 'Setoran Tabungan',
          santri: trx.santri,
          kategori_pembayaran: { nama: 'Tabungan Santri (Titipan)' },
          user_roles: trx.user_roles
        } as any);
      });
    }

    // Jika ada lebih dari satu, cetak secara berkelompok
    cetakKwitansi(allTrx.length > 0 ? allTrx : trx);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus transaksi ini?')) return;
    try {
      const { error } = await supabase.from('transaksi_masuk').delete().eq('id', id);
      if (error) throw error;
      fetchRiwayat();
      fetchGlobalTotal();
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert('Gagal menghapus: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Uang Masuk</h1>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Pencatatan pembayaran & tagihan santri</p>
            </div>
          </div>
        </div>
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex space-x-6 mt-2">
          <button
            onClick={() => { setActiveTab('input'); if(editingId) handleCancelEdit(); }}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'input' ? 'border-khzm-green text-khzm-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <div className="flex items-center"><Wallet className="h-4 w-4 mr-2" /> Form Input {editingId && '(Mode Edit)'}</div>
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'riwayat' ? 'border-khzm-green text-khzm-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <div className="flex items-center"><Receipt className="h-4 w-4 mr-2" /> Riwayat Terakhir</div>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        {/* TAB 1: INPUT TRANSAKSI */}
        {activeTab === 'input' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {showSuccess && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 flex items-center shadow-sm">
                <CheckCircle2 className="h-5 w-5 mr-3 text-green-600" />
                <span className="font-medium">Transaksi berhasil {editingId ? 'diperbarui' : 'disimpan'}!</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Kolom Kiri: Pemilihan Target */}
              <div className="lg:col-span-1 space-y-6">
                <div className={`bg-white rounded-2xl p-6 shadow-sm border ${editingId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900">{editingId ? 'Edit Pembayaran' : 'Langkah 1: Pilih Santri'}</h3>
                    {editingId && (
                      <button onClick={handleCancelEdit} className="text-xs text-gray-500 hover:text-red-500 flex items-center">
                        <X className="h-3 w-3 mr-1" /> Batal Edit
                      </button>
                    )}
                  </div>
                  
                  {!editingId && (
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                      <button 
                        onClick={() => { setInputType('single'); setCartItems([]); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${inputType === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        Satu per Satu
                      </button>
                      <button 
                        onClick={() => { setInputType('bulk'); setCartItems([]); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${inputType === 'bulk' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        Masal (Per Kelas)
                      </button>
                    </div>
                  )}

                  {inputType === 'single' ? (
                    <div>
                      {!editingId && <label className="block text-sm font-medium text-gray-700 mb-2">Cari Nama Santri</label>}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input 
                          type="text" 
                          value={searchSantri}
                          onChange={(e) => setSearchSantri(e.target.value)}
                          placeholder="Ketik nama santri..."
                          disabled={!!editingId}
                          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-khzm-green focus:border-transparent transition-all outline-none disabled:opacity-70 font-medium"
                        />
                        
                        {searchSantri && !selectedSantriId && !editingId && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                            {filteredSantri.length > 0 ? (
                              filteredSantri.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    setSelectedSantriId(s.id);
                                    setSearchSantri(s.nama);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0"
                                >
                                  <div className="font-bold text-gray-900">{s.nama}</div>
                                  <div className="text-xs text-gray-500">{s.kelas_pengajian?.nama} • Kamar {s.kamar || '-'}</div>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center text-sm text-gray-500">Santri tidak ditemukan</div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {selectedSantriId && (
                        <div className={`mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between items-center ${editingId ? 'opacity-80' : ''}`}>
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-green-200 flex items-center justify-center mr-3">
                              <Users className="h-4 w-4 text-green-800" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-green-900">{santriList.find(s=>s.id===selectedSantriId)?.nama || searchSantri}</p>
                              <p className="text-xs text-green-700 font-medium">Santri Terpilih</p>
                            </div>
                          </div>
                          {!editingId && (
                            <button 
                              onClick={() => { setSelectedSantriId(''); setSearchSantri(''); setCartItems([]); }}
                              className="text-xs text-green-800 font-bold underline px-2 py-1 hover:bg-green-100 rounded"
                            >
                              Ganti
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas</label>
                      <select 
                        value={selectedKelasId}
                        onChange={(e) => setSelectedKelasId(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green focus:border-transparent transition-all outline-none mb-4"
                      >
                        <option value="" disabled>-- Pilih Kelas --</option>
                        {kelasList.map(k => (
                          <option key={k.id} value={k.id}>{k.nama}</option>
                        ))}
                      </select>

                      {selectedKelasId && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-500">PILIH SANTRI ({bulkSantriIds.length}/{classSantriList.length})</span>
                            <button 
                              onClick={() => setBulkSantriIds(bulkSantriIds.length === classSantriList.length ? [] : classSantriList.map(s=>s.id))}
                              className="text-xs text-khzm-green font-bold"
                            >
                              {bulkSantriIds.length === classSantriList.length ? 'Batal Semua' : 'Pilih Semua'}
                            </button>
                          </div>
                          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                            {classSantriList.map(s => (
                              <label key={s.id} className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={bulkSantriIds.includes(s.id)}
                                  onChange={() => toggleBulkSantri(s.id)}
                                  className="h-4 w-4 text-khzm-green focus:ring-khzm-green border-gray-300 rounded"
                                />
                                <div className="ml-3">
                                  <p className="text-sm font-bold text-gray-900">{s.nama}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TANGGAL TRANSAKSI GLOBAL */}
                  <div className="mt-6 border-t border-gray-100 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Transaksi (Kwitansi)</label>
                    <input 
                      type="date" 
                      value={tanggalTransaksi}
                      onChange={(e) => setTanggalTransaksi(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none font-medium text-gray-700"
                      required
                    />
                  </div>

                </div>
              </div>

              {/* Kolom Kanan: Rincian Tagihan & Keranjang */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* BLOK FORM TAMBAH ITEM */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
                    {editingId ? 'Edit Rincian Tagihan' : 'Langkah 2: Tambah Rincian Pembayaran'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Pembayaran</label>
                      <select 
                        value={formData.kategori_id}
                        onChange={(e) => handleKategoriChange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none font-medium text-gray-900"
                        required
                      >
                        <option value="" disabled>-- Pilih Kategori --</option>
                        {kategoriList.filter(k => !editingId || k.id !== 'TABUNGAN_VIRTUAL').map(k => (
                          <option key={k.id} value={k.id}>{k.nama}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nominal (Rp)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-bold">Rp</span>
                        </div>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          value={formData.nominal_text}
                          onChange={handleNominalChange}
                          className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-khzm-green outline-none font-bold text-gray-900 text-lg"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Untuk Periode (Bulan)</label>
                      <select 
                        value={formData.periode_bulan}
                        onChange={(e) => setFormData({...formData, periode_bulan: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none font-medium"
                      >
                        <option value="">- Tidak ada periode (Lainnya) -</option>
                        {Array.from({length: 12}, (_, i) => (
                          <option key={i+1} value={i+1}>{formatBulan(i+1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tahun</label>
                      <input 
                        type="number" 
                        value={formData.periode_tahun}
                        onChange={(e) => setFormData({...formData, periode_tahun: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Catatan Tambahan (Opsional)</label>
                    <textarea 
                      value={formData.catatan}
                      onChange={(e) => setFormData({...formData, catatan: e.target.value})}
                      placeholder="Misal: Bayar setengah dulu..."
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none"
                      rows={2}
                    />
                  </div>

                  {!editingId && (
                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <button 
                        type="button"
                        onClick={handleAddToCart}
                        className="w-full text-khzm-green bg-green-50 hover:bg-green-100 border border-green-200 py-3 rounded-xl font-bold transition-colors flex items-center justify-center"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Tambah ke Keranjang
                      </button>
                      <button 
                        type="button"
                        onClick={handleAddSemuaRutin}
                        className="w-full text-white bg-khzm-green hover:bg-emerald-700 border border-khzm-green py-3 rounded-xl font-bold transition-colors flex items-center justify-center"
                      >
                        <ShoppingBag className="h-5 w-5 mr-2" />
                        Pilih Semua Rutin
                      </button>
                    </div>
                  )}
                </div>

                {/* BLOK KERANJANG (Hanya tampil jika Mode Insert) */}
                {!editingId && (
                  <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4 flex items-center">
                      <ShoppingBag className="h-5 w-5 mr-2 text-khzm-green" /> 
                      Langkah 3: Keranjang Pembayaran
                    </h3>
                    
                    {cartItems.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium">Keranjang masih kosong.</p>
                        <p className="text-xs text-gray-400 mt-1">Tambahkan rincian tagihan di atas.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                            <tr>
                              <th className="p-4 font-bold">Kategori</th>
                              <th className="p-4 font-bold">Periode</th>
                              <th className="p-4 font-bold text-right">Nominal</th>
                              <th className="p-4 font-bold text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {cartItems.map((item) => (
                              <tr key={item.temp_id} className="hover:bg-gray-50">
                                <td className="p-4 text-sm font-bold text-gray-900">
                                  {item.nama_kategori}
                                  {item.catatan && <div className="text-xs font-normal text-gray-500 italic mt-0.5">{item.catatan}</div>}
                                </td>
                                <td className="p-4 text-sm text-gray-600">
                                  {item.periode_bulan ? `${formatBulan(Number(item.periode_bulan))} ${item.periode_tahun}` : '-'}
                                </td>
                                <td className="p-4 text-sm font-bold text-khzm-green text-right">Rp {item.nominal.toLocaleString('id-ID')}</td>
                                <td className="p-4 text-center">
                                  <button 
                                    onClick={() => handleRemoveFromCart(item.temp_id)}
                                    className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                                    title="Hapus dari keranjang"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200 mb-8">
                      <div className="mb-4 sm:mb-0 text-center sm:text-left">
                        <p className="text-sm font-bold text-gray-500 uppercase">Total Keseluruhan</p>
                        <p className="text-3xl font-black text-gray-900">Rp {grandTotal.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="text-sm text-gray-500 font-medium">
                        {cartItems.length} Tagihan
                      </div>
                    </div>

                    <button 
                      onClick={handleSubmit}
                      disabled={saving || cartItems.length === 0}
                      className="w-full text-white py-4 rounded-xl font-black transition-all shadow-md hover:shadow-lg flex items-center justify-center disabled:opacity-50 bg-gradient-to-r from-khzm-emerald to-khzm-green hover:from-emerald-600 hover:to-green-600 text-lg"
                    >
                      {saving ? <Loader2 className="h-6 w-6 mr-2 animate-spin" /> : <CheckCircle2 className="h-6 w-6 mr-2" />}
                      {inputType === 'bulk' && bulkSantriIds.length > 0 
                        ? `Simpan ${cartItems.length} Tagihan untuk ${bulkSantriIds.length} Santri` 
                        : `Simpan Semua Pembayaran`}
                    </button>
                  </div>
                )}

                {/* TOMBOL UPDATE (Hanya tampil jika Mode Edit) */}
                {editingId && (
                  <div className="bg-amber-50 rounded-2xl p-6 sm:p-8 shadow-sm border border-amber-200 text-center">
                    <p className="text-amber-800 font-medium mb-4 text-sm">Anda sedang dalam mode Edit. Perubahan ini akan langsung menimpa transaksi sebelumnya.</p>
                    <button 
                      onClick={handleSubmit}
                      disabled={saving}
                      className="w-full text-white py-4 rounded-xl font-black transition-all shadow-md hover:shadow-lg flex items-center justify-center disabled:opacity-50 bg-amber-500 hover:bg-amber-600 text-lg"
                    >
                      {saving ? <Loader2 className="h-6 w-6 mr-2 animate-spin" /> : <Edit2 className="h-6 w-6 mr-2" />}
                      Update Transaksi (Rp {grandTotal.toLocaleString('id-ID')})
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RIWAYAT TRANSAKSI */}
        {activeTab === 'riwayat' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Riwayat 50 Transaksi Terakhir</h3>
                <p className="text-sm text-gray-500">Data tersaji secara real-time dari database.</p>
              </div>
              <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">
                <Filter className="h-4 w-4 mr-2" />
                Filter Data
              </button>
            </div>

            {loadingRiwayat ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 text-khzm-green animate-spin" />
              </div>
            ) : riwayatList.length === 0 ? (
              <div className="p-12 text-center text-gray-500 font-medium">Belum ada transaksi tercatat.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-gray-100 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="p-4 font-bold">Waktu & Tgl</th>
                      <th className="p-4 font-bold">Santri</th>
                      <th className="p-4 font-bold">Kategori</th>
                      <th className="p-4 font-bold">Periode</th>
                      <th className="p-4 font-bold text-right">Nominal</th>
                      <th className="p-4 font-bold">Petugas</th>
                      <th className="p-4 font-bold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {riwayatList.map((trx) => (
                      <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm text-gray-600">
                          <div className="font-medium text-gray-900">{trx.tanggal_transaksi}</div>
                          <div className="text-xs">{new Date(trx.tanggal_transaksi).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</div>
                        </td>
                        <td className="p-4 text-sm">
                          <div className="font-bold text-gray-900">{trx.santri?.nama}</div>
                          <div className="text-xs text-gray-500">{trx.santri?.kelas_pengajian?.nama}</div>
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-700">
                          {trx.kategori_pembayaran?.nama}
                          {trx.catatan && <div className="text-xs text-gray-400 italic mt-0.5">{trx.catatan}</div>}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {trx.periode_bulan ? `${formatBulan(trx.periode_bulan)} ${trx.periode_tahun}` : '-'}
                        </td>
                        <td className="p-4 text-sm font-black text-khzm-green text-right">
                          Rp {trx.nominal.toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 text-xs font-medium text-gray-500">
                          {trx.user_roles?.nama_lengkap}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <button 
                              onClick={() => handleCetakGabungan(trx)}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Cetak Kwitansi Gabungan Harian (PDF)"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleEditClick(trx)}
                              className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                              title="Edit Transaksi"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </div>
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
  );
};

export default TransaksiMasuk;
