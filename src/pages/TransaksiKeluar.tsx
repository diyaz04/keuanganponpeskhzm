import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, ShoppingCart, Filter, Loader2, CheckCircle2, Plus, Edit2, AlertTriangle, X, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupiah, parseRupiah, formatBulan } from '@/lib/format';

interface KategoriPengeluaran {
  id: string;
  nama: string;
}

interface SumberDana {
  id: string;
  nama: string;
  vendor_list?: string[] | null;
}

interface TransaksiKeluar {
  id: string;
  kategori_pengeluaran_id: string;
  sumber_dana_id: string;
  kategori_pengeluaran: { nama: string };
  sumber_dana: { nama: string };
  nominal: number;
  tanggal_transaksi: string;
  periode_bulan: number | null;
  periode_tahun: number | null;
  periode_tahun: number | null;
  keterangan: string | null;
  vendor_terpilih: string | null;
  user_roles: { nama_lengkap: string };
}

const TransaksiKeluar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [kategoriList, setKategoriList] = useState<KategoriPengeluaran[]>([]);
  const [sumberDanaList, setSumberDanaList] = useState<SumberDana[]>([]);
  
  const [formData, setFormData] = useState({
    kategori_id: '',
    sumber_dana_id: '',
    nominal_text: '0',
    tanggal_transaksi: new Date().toISOString().split('T')[0],
    periode_bulan: (new Date().getMonth() + 1).toString(),
    periode_tahun: new Date().getFullYear().toString(),
    keterangan: '',
    vendor_terpilih: ''
  });

  const [sisaAnggaran, setSisaAnggaran] = useState<number | null>(null);
  const [loadingAnggaran, setLoadingAnggaran] = useState(false);
  
  const [riwayatList, setRiwayatList] = useState<TransaksiKeluar[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMasterData();
    fetchRiwayat();
  }, []);

  // Memantau perubahan sumber dana atau periode untuk menghitung sisa anggaran
  useEffect(() => {
    if (formData.sumber_dana_id && formData.periode_bulan && formData.periode_tahun) {
      hitungSisaAnggaran();
    } else {
      setSisaAnggaran(null);
    }
  }, [formData.sumber_dana_id, formData.periode_bulan, formData.periode_tahun]);

  const fetchMasterData = async () => {
    const { data: katKeluar } = await supabase.from('kategori_pengeluaran').select('*').order('nama');
    if (katKeluar) setKategoriList(katKeluar);

    const { data: sumDana } = await supabase.from('kategori_pembayaran').select('id, nama, vendor_list').eq('is_active', true).neq('tipe', 'tabungan').order('nama');
    if (sumDana) {
      setSumberDanaList([
        ...sumDana,
        { id: 'KAS-PESANTREN', nama: 'Kas Pesantren (Saldo Utama)' }
      ]);
    }
  };

  const fetchRiwayat = async () => {
    setLoadingRiwayat(true);
    
    // 1. Fetch Transaksi Keluar Biasa
    const { data: biasaData, error: biasaError } = await supabase
      .from('transaksi_keluar')
      .select(`
        id, kategori_pengeluaran_id, sumber_dana_id, nominal, tanggal_transaksi, periode_bulan, periode_tahun, keterangan, created_at, vendor_terpilih,
        kategori_pengeluaran(nama),
        sumber_dana:kategori_pembayaran(nama),
        user_roles!inner(nama_lengkap)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
      
    // Cari titik wipe terakhir (checkpoint)
    const { data: wipeCheckpoint } = await supabase
      .from('kas_pesantren_mutasi')
      .select('created_at')
      .ilike('keterangan', 'WIPE DATA SYSTEM RESET%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Fetch Pengeluaran Kas Pesantren
    let kasQuery = supabase
      .from('kas_pesantren_mutasi')
      .select(`
        id, nominal, created_at, keterangan, periode_bulan, periode_tahun,
        user_roles!inner(nama_lengkap)
      `)
      .eq('tipe', 'keluar')
      .not('keterangan', 'ilike', 'WIPE DATA SYSTEM RESET%')
      .order('created_at', { ascending: false })
      .limit(50);

    if (wipeCheckpoint) {
      kasQuery = kasQuery.gt('created_at', wipeCheckpoint.created_at);
    }

    const { data: kasData, error: kasError } = await kasQuery;

    if (!biasaError && !kasError) {
      const merged = [
        ...(biasaData || []),
        ...(kasData || []).map(k => ({
          ...k,
          tanggal_transaksi: k.created_at.split('T')[0],
          isKasMutasi: true,
          kategori_pengeluaran: { nama: 'Kas Pesantren' },
          sumber_dana: { nama: 'Kas Pesantren (Saldo Utama)' }
        }))
      ];
      
      // Sort descending by created_at
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setRiwayatList(merged.slice(0, 50) as any);
    }
    
    setLoadingRiwayat(false);
  };

  const hitungSisaAnggaran = async () => {
    setLoadingAnggaran(true);
    try {
      const pBulan = parseInt(formData.periode_bulan);
      const pTahun = parseInt(formData.periode_tahun);
      const sumberId = formData.sumber_dana_id;

      // Cari titik wipe terakhir (checkpoint)
      const { data: wipeCheckpoint } = await supabase
        .from('kas_pesantren_mutasi')
        .select('created_at')
        .ilike('keterangan', 'WIPE DATA SYSTEM RESET%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sumberId === 'KAS-PESANTREN') {
        // Hitung Saldo Global Kas Pesantren
        let saldoQuery = supabase.from('kas_pesantren_mutasi').select('tipe, nominal');
        if (wipeCheckpoint) {
          saldoQuery = saldoQuery.gt('created_at', wipeCheckpoint.created_at);
        }
        const { data: kasMutasi } = await saldoQuery;
        
        let globalSaldo = 0;
        if (kasMutasi) {
          globalSaldo = kasMutasi.reduce((acc, curr) => {
            return curr.tipe === 'masuk' ? acc + Number(curr.nominal) : acc - Number(curr.nominal);
          }, 0);
        }

        // Jika sedang edit, kembalikan saldo dari transaksi yang diedit
        if (editingId) {
          const { data: editTrx } = await supabase.from('kas_pesantren_mutasi').select('nominal').eq('id', editingId).single();
          if (editTrx) {
            globalSaldo += Number(editTrx.nominal); // Kembalikan karena ini pengeluaran yang sedang diedit
          }
        }

        setSisaAnggaran(globalSaldo);
      } else {
        const { data: masukData } = await supabase.from('transaksi_masuk').select('nominal').eq('kategori_id', sumberId).eq('periode_bulan', pBulan).eq('periode_tahun', pTahun);
        const totalMasuk = masukData ? masukData.reduce((sum, item) => sum + Number(item.nominal), 0) : 0;

        const { data: keluarData } = await supabase.from('transaksi_keluar').select('nominal, id').eq('sumber_dana_id', sumberId).eq('periode_bulan', pBulan).eq('periode_tahun', pTahun);
        
        let totalKeluar = 0;
        if (keluarData) {
          totalKeluar = keluarData.reduce((sum, item) => {
            if (editingId && item.id === editingId) return sum;
            return sum + Number(item.nominal);
          }, 0);
        }

        // Tidak perlu mengurangi totalSweep lagi karena Tutup Buku sudah tercatat di transaksi_keluar
        const sisa = totalMasuk - totalKeluar;
        setSisaAnggaran(sisa);
      }

    } catch (error) {
      console.error('Gagal hitung sisa:', error);
    } finally {
      setLoadingAnggaran(false);
    }
  };

  const handleAddKategori = async () => {
    const namaKategori = window.prompt("Masukkan nama kategori pengeluaran baru (Contoh: Beli Listrik):");
    if (!namaKategori || namaKategori.trim() === '') return;
    
    setSaving(true);
    const { data, error } = await supabase
      .from('kategori_pengeluaran')
      .insert([{ nama: namaKategori }])
      .select()
      .single();
      
    if (!error && data) {
      setKategoriList(prev => [...prev, data].sort((a, b) => a.nama.localeCompare(b.nama)));
      setFormData(prev => ({ ...prev, kategori_id: data.id }));
    } else {
      alert("Gagal menambahkan kategori.");
    }
    setSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const nominalNum = parseRupiah(formData.nominal_text);
    if (nominalNum <= 0) return alert('Nominal harus lebih dari 0');
    if (!formData.kategori_id) return alert('Pilih jenis pengeluaran');
    if (!formData.sumber_dana_id) return alert('Pilih sumber anggaran');
    
    const sumber = sumberDanaList.find(s => s.id === formData.sumber_dana_id);
    if (sumber && sumber.vendor_list && sumber.vendor_list.length > 0 && !formData.vendor_terpilih) {
      return alert('Pilih vendor penyedia untuk pengeluaran ini.');
    }
    
    if (sisaAnggaran !== null && nominalNum > sisaAnggaran) {
      return alert(`Pengeluaran gagal! Sisa anggaran ${sumberDanaList.find(s=>s.id === formData.sumber_dana_id)?.nama} di bulan ini hanya Rp ${sisaAnggaran.toLocaleString('id-ID')}.`);
    }

    setSaving(true);
    try {
      // Cek Duplikasi Jika Mode INSERT
      if (!editingId) {
        const { data: duplicates } = await supabase
          .from('transaksi_keluar')
          .select('id')
          .eq('tanggal_transaksi', formData.tanggal_transaksi)
          .eq('sumber_dana_id', formData.sumber_dana_id)
          .eq('kategori_pengeluaran_id', formData.kategori_id)
          .eq('nominal', nominalNum)
          .limit(1);

        if (duplicates && duplicates.length > 0) {
          const isConfirmed = window.confirm(
            "⚠️ PERINGATAN DUPLIKASI!\n\n" +
            "Sistem mendeteksi ada pengeluaran dengan nominal, sumber dana, kategori, dan tanggal yang PERSIS SAMA yang sudah Anda input.\n\n" +
            "Apakah Anda yakin ini adalah transaksi yang berbeda dan ingin tetap menyimpannya?"
          );
          if (!isConfirmed) {
            setSaving(false);
            return;
          }
        }
      }

      let queryError;
      
      if (formData.sumber_dana_id === 'KAS-PESANTREN') {
        // Simpan ke kas_pesantren_mutasi (tipe: keluar)
        const katName = kategoriList.find(k => k.id === formData.kategori_id)?.nama || 'Pengeluaran';
        const kasPayload = {
          tipe: 'keluar',
          nominal: nominalNum,
          periode_bulan: parseInt(formData.periode_bulan),
          periode_tahun: parseInt(formData.periode_tahun),
          keterangan: `[${katName}] ${formData.keterangan || 'Pengeluaran Kas'}`,
          input_by: user.id
        };

        if (editingId) {
          const { error } = await supabase.from('kas_pesantren_mutasi').update(kasPayload).eq('id', editingId);
          queryError = error;
        } else {
          const { error } = await supabase.from('kas_pesantren_mutasi').insert([kasPayload]);
          queryError = error;
        }
      } else {
        // Simpan ke transaksi_keluar biasa
        const payload = {
          kategori_pengeluaran_id: formData.kategori_id,
          sumber_dana_id: formData.sumber_dana_id,
          nominal: nominalNum,
          tanggal_transaksi: formData.tanggal_transaksi,
          periode_bulan: parseInt(formData.periode_bulan),
          periode_tahun: parseInt(formData.periode_tahun),
          keterangan: formData.keterangan || null,
          vendor_terpilih: formData.vendor_terpilih || null,
          input_by: user.id
        };

        if (editingId) {
          const { error } = await supabase.from('transaksi_keluar').update(payload).eq('id', editingId);
          queryError = error;
        } else {
          const { error } = await supabase.from('transaksi_keluar').insert([payload]);
          queryError = error;
        }
      }

      if (queryError) throw queryError;

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      handleCancelEdit();
      fetchRiwayat();
    } catch (error: any) {
      console.error(error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (trx: any) => {
    setEditingId(trx.id);
    
    // Deteksi apakah ini dari kas_pesantren_mutasi (trx.isKasMutasi) atau transaksi_keluar
    if (trx.isKasMutasi) {
      // Ekstrak kategori dari keterangan "[Kategori] Deskripsi"
      let katId = '';
      let extractedKeterangan = trx.keterangan || '';
      
      const match = extractedKeterangan.match(/^\[(.*?)\]\s(.*)/);
      if (match) {
        const katName = match[1];
        extractedKeterangan = match[2];
        const found = kategoriList.find(k => k.nama === katName);
        if (found) katId = found.id;
      }

      setFormData({
        kategori_id: katId,
        sumber_dana_id: 'KAS-PESANTREN',
        nominal_text: trx.nominal.toString(),
        tanggal_transaksi: trx.tanggal_transaksi,
        periode_bulan: (trx.periode_bulan || 1).toString(),
        periode_tahun: (trx.periode_tahun || new Date().getFullYear()).toString(),
        keterangan: extractedKeterangan
      });
    } else {
      setFormData({
        kategori_id: trx.kategori_pengeluaran_id,
        sumber_dana_id: trx.sumber_dana_id,
        nominal_text: trx.nominal.toString(),
        tanggal_transaksi: trx.tanggal_transaksi,
        periode_bulan: (trx.periode_bulan || 1).toString(),
        periode_tahun: (trx.periode_tahun || new Date().getFullYear()).toString(),
        keterangan: trx.keterangan || '',
        vendor_terpilih: trx.vendor_terpilih || ''
      });
    }
    // Scroll to top gently
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(prev => ({ 
      ...prev, 
      nominal_text: '0', 
      keterangan: '',
      vendor_terpilih: '' 
    }));
    hitungSisaAnggaran();
  };

  const handleDelete = async (id: string, isKasMutasi: boolean) => {
    if (!window.confirm('Yakin ingin menghapus transaksi pengeluaran ini? Saldo akan dikembalikan.')) return;
    try {
      if (isKasMutasi) {
        const { error } = await supabase.from('kas_pesantren_mutasi').delete().eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transaksi_keluar').delete().eq('id', id);
        if (error) throw error;
      }
      fetchRiwayat();
      hitungSisaAnggaran();
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert('Gagal menghapus: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-6">
          <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center mr-4">
            <ShoppingCart className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Pengeluaran Pesantren</h1>
            <p className="text-sm text-gray-500">Catat pemakaian dana operasional berdasarkan sumber anggaran.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Kolom Form Input */}
          <div className="lg:col-span-1 space-y-6">
            <div className={`bg-white rounded-2xl p-6 shadow-sm border ${editingId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-100'}`}>
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="font-bold text-gray-900 flex items-center">
                  {editingId ? <><Edit2 className="h-4 w-4 mr-2 text-amber-500" /> Edit Pengeluaran</> : 'Form Pengeluaran'}
                </h3>
                {editingId && (
                  <button onClick={handleCancelEdit} className="text-xs text-gray-500 hover:text-red-500 flex items-center">
                    <X className="h-3 w-3 mr-1" /> Batal Edit
                  </button>
                )}
              </div>
              
              {showSuccess && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 flex items-center shadow-sm">
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600 shrink-0" />
                  <span className="text-sm font-medium">Berhasil disimpan!</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* 1. Sumber Dana */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <label className="block text-xs font-bold text-amber-800 mb-1">1. Ambil Dana Dari (Sumber Anggaran)</label>
                  <select 
                    value={formData.sumber_dana_id}
                    onChange={(e) => setFormData({...formData, sumber_dana_id: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-md focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                    required
                  >
                    <option value="" disabled>-- Pilih Sumber Pemasukan --</option>
                    {sumberDanaList.map(s => (
                      <option key={s.id} value={s.id}>{s.nama}</option>
                    ))}
                  </select>
                  
                  {/* Status Sisa Anggaran */}
                  {formData.sumber_dana_id && (
                    <div className="mt-2 pt-2 border-t border-amber-200/50 flex justify-between items-center">
                      <span className="text-xs text-amber-700">Limit Tersedia (Bulan Ini):</span>
                      {loadingAnggaran ? (
                        <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                      ) : (
                        <span className={`font-bold text-sm ${sisaAnggaran && sisaAnggaran <= 0 ? 'text-red-600' : 'text-amber-800'}`}>
                          Rp {sisaAnggaran?.toLocaleString('id-ID') || 0}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 1.5 Vendor (If Any) */}
                {(() => {
                  const sumber = sumberDanaList.find(s => s.id === formData.sumber_dana_id);
                  if (sumber && sumber.vendor_list && sumber.vendor_list.length > 0) {
                    return (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <label className="block text-xs font-bold text-blue-900 mb-1">Tujuan Pengeluaran Ke Vendor (Wajib)</label>
                        <select 
                          value={formData.vendor_terpilih || ''}
                          onChange={(e) => setFormData({...formData, vendor_terpilih: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          required
                        >
                          <option value="" disabled>-- Pilih Vendor --</option>
                          {sumber.vendor_list.map((v, i) => (
                            <option key={i} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* 2. Jenis Pengeluaran */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">2. Untuk Keperluan (Jenis)</label>
                    <button type="button" onClick={handleAddKategori} className="text-xs text-khzm-green font-medium flex items-center hover:underline">
                      <Plus className="h-3 w-3 mr-1" /> Tambah Baru
                    </button>
                  </div>
                  <select 
                    value={formData.kategori_id}
                    onChange={(e) => setFormData({...formData, kategori_id: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none"
                    required
                  >
                    <option value="" disabled>-- Pilih Jenis Pengeluaran --</option>
                    {kategoriList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">3. Nominal (Rp)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">Rp</span>
                    </div>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={formData.nominal_text}
                      onChange={(e) => setFormData(prev => ({ ...prev, nominal_text: formatRupiah(parseRupiah(e.target.value)) }))}
                      className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-khzm-green outline-none font-bold text-gray-900 text-lg"
                      required
                    />
                  </div>
                  {sisaAnggaran !== null && parseRupiah(formData.nominal_text) > sisaAnggaran && (
                    <p className="text-red-500 text-xs mt-1 font-medium flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Nominal melebihi limit anggaran sumber dana!
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                    <input 
                      type="date" 
                      value={formData.tanggal_transaksi}
                      onChange={(e) => setFormData({...formData, tanggal_transaksi: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
                    <select 
                      value={formData.periode_bulan}
                      onChange={(e) => setFormData({...formData, periode_bulan: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none text-sm"
                    >
                      {Array.from({length: 12}, (_, i) => (
                        <option key={i+1} value={i+1}>{formatBulan(i+1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan / Rincian Tambahan</label>
                  <textarea 
                    value={formData.keterangan}
                    onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                    placeholder="Misal: Beli gas 3kg 4 tabung"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-khzm-green outline-none text-sm"
                    rows={2}
                    required
                  />
                </div>

                <button 
                  type="submit"
                  disabled={saving || (sisaAnggaran !== null && parseRupiah(formData.nominal_text) > sisaAnggaran)}
                  className={`w-full mt-4 text-white py-3 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center disabled:opacity-50 ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? 'Update Pengeluaran' : 'Simpan Pengeluaran')}
                </button>
              </form>
            </div>
          </div>

          {/* Kolom Riwayat */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Riwayat Pengeluaran (50 Terakhir)</h3>
                <button className="flex items-center text-xs font-medium text-gray-600 hover:text-gray-900">
                  <Filter className="h-4 w-4 mr-1" /> Filter
                </button>
              </div>

              {loadingRiwayat ? (
                <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 text-khzm-green animate-spin" /></div>
              ) : riwayatList.length === 0 ? (
                <div className="p-12 text-center text-gray-500">Belum ada catatan pengeluaran.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-gray-100">
                        <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tgl / Keterangan</th>
                        <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Jenis & Sumber Anggaran</th>
                        <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider text-right">Nominal Keluar</th>
                        <th className="p-4 font-semibold text-gray-500 text-xs uppercase tracking-wider text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {riwayatList.map((trx) => (
                        <tr key={trx.id} className={`transition-colors ${editingId === trx.id ? 'bg-amber-50/50' : 'hover:bg-red-50/30'}`}>
                          <td className="p-4">
                            <div className="text-sm font-medium text-gray-900">{trx.tanggal_transaksi}</div>
                            <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate" title={trx.keterangan || ''}>
                              {trx.keterangan || '-'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                                {trx.kategori_pengeluaran?.nama}
                              </span>
                              <span className="text-[10px] font-medium text-amber-600 flex flex-col items-start gap-0.5">
                                <span>Dari: {trx.sumber_dana?.nama} ({formatBulan(trx.periode_bulan || 1)} {trx.periode_tahun})</span>
                                {trx.vendor_terpilih && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-sm">Vendor: {trx.vendor_terpilih}</span>}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="font-bold text-red-600 text-sm">
                              - Rp {trx.nominal.toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">oleh {trx.user_roles?.nama_lengkap}</div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center space-x-2">
                              <button 
                                onClick={() => handleEditClick(trx)}
                                className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                                title="Edit Pengeluaran"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(trx.id, !!(trx as any).isKasMutasi)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Hapus Pengeluaran"
                              >
                                <Trash2 className="h-4 w-4" />
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
          </div>

        </div>
      </div>
    </div>
  );
};

export default TransaksiKeluar;
