import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Users, Wallet, LogOut, TrendingUp, Archive, FileText, ShoppingCart, Loader2, AlertCircle, Settings, ShieldAlert, Trash2, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatBulan } from '@/lib/format';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const APP_VERSION = 'v1.0.1';

interface KasBulanan {
  kategori_nama: string;
  total_masuk: number;
  total_keluar: number;
  sisa_saldo: number;
  vendors?: {
    nama: string;
    total_masuk: number;
    total_keluar: number;
    sisa_saldo: number;
  }[];
}

interface ChartData {
  name: string;
  Pemasukan: number;
  Pengeluaran: number;
}

interface TunggakanSantri {
  santri_id: string;
  nama_santri: string;
  kategori_nama: string;
  bulan_nunggak: number; // 1 atau 2+
}

const Dashboard = () => {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();

  // Metrics
  const [totalSantri, setTotalSantri] = useState(0);
  const [saldoKasPesantren, setSaldoKasPesantren] = useState(0);
  const [totalTabungan, setTotalTabungan] = useState(0);
  const [totalMasukBulanIni, setTotalMasukBulanIni] = useState(0);
  const [totalKeluarBulanIni, setTotalKeluarBulanIni] = useState(0);
  
  // Date utils
  const currentDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());
  
  // States
  const [rincianBulanIni, setRincianBulanIni] = useState<KasBulanan[]>([]);
  const [riwayatKas, setRiwayatKas] = useState<any[]>([]);
  const [isSweeping, setIsSweeping] = useState(false);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [daftarTunggakan, setDaftarTunggakan] = useState<TunggakanSantri[]>([]);
  const [loadingTunggakan, setLoadingTunggakan] = useState(false);
  const [devWipeDone, setDevWipeDone] = useState(localStorage.getItem('dev_wipe_done_v3') === 'true');
  const [isWiping, setIsWiping] = useState(false);
  const [isProduction, setIsProduction] = useState(localStorage.getItem('productionModeVersion') === APP_VERSION);

  const checkActiveMonth = async (fallbackMonth: number, fallbackYear: number) => {
    // Cari titik wipe terakhir (checkpoint)
    const { data: wipeCheckpoint } = await supabase
      .from('kas_pesantren_mutasi')
      .select('created_at')
      .ilike('keterangan', 'WIPE DATA SYSTEM RESET%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let query = supabase
      .from('kas_pesantren_mutasi')
      .select('id')
      .ilike('keterangan', 'Tutup Buku otomatis sisa dana%')
      .eq('periode_bulan', fallbackMonth)
      .eq('periode_tahun', fallbackYear)
      .limit(1);

    if (wipeCheckpoint) {
      query = query.gt('created_at', wipeCheckpoint.created_at);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      let nextM = fallbackMonth + 1;
      let nextY = fallbackYear;
      if (nextM > 12) {
        nextM = 1;
        nextY++;
      }
      setCurrentMonth(nextM);
      setCurrentYear(nextY);
      return { m: nextM, y: nextY };
    } else {
      setCurrentMonth(fallbackMonth);
      setCurrentYear(fallbackYear);
      return { m: fallbackMonth, y: fallbackYear };
    }
  };

  useEffect(() => {
    const init = async () => {
      const d = new Date();
      await checkActiveMonth(d.getMonth() + 1, d.getFullYear());
    };
    init();
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchRincianBulanIni();
    fetchRiwayatKas();
    fetchChartData();
    fetchTunggakan();
  }, [currentMonth, currentYear]);

  const fetchDashboardStats = async () => {
    // Total Santri Aktif
    const { count } = await supabase.from('santri').select('*', { count: 'exact', head: true }).eq('status', 'aktif');
    if (count !== null) setTotalSantri(count);

    // Kas Pesantren
    const { data: kasData } = await supabase.from('kas_pesantren_mutasi').select('tipe, nominal');
    if (kasData) {
      const masuk = kasData.filter(d => d.tipe === 'masuk').reduce((sum, item) => sum + Number(item.nominal), 0);
      const keluar = kasData.filter(d => d.tipe === 'keluar').reduce((sum, item) => sum + Number(item.nominal), 0);
      setSaldoKasPesantren(masuk - keluar);
    }

    // Total Tabungan (Khusus Santri Aktif)
    const { data: tabData } = await supabase.from('tabungan_mutasi').select('tipe, nominal, santri!inner(status)').eq('santri.status', 'aktif');
    if (tabData) {
      const tabMasuk = tabData.filter(d => d.tipe === 'setor').reduce((sum, item) => sum + Number(item.nominal), 0);
      const tabKeluar = tabData.filter(d => d.tipe === 'tarik').reduce((sum, item) => sum + Number(item.nominal), 0);
      setTotalTabungan(tabMasuk - tabKeluar);
    }

    // Total Masuk & Keluar Bulan Ini (berdasarkan tanggal transaksi / cash-basis)
    const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    const { data: mData } = await supabase.from('transaksi_masuk').select('nominal').gte('tanggal_transaksi', startDate).lte('tanggal_transaksi', endDate);
    const { data: kData } = await supabase.from('transaksi_keluar').select('nominal').gte('tanggal_transaksi', startDate).lte('tanggal_transaksi', endDate);
    
    setTotalMasukBulanIni(mData?.reduce((sum, i) => sum + Number(i.nominal), 0) || 0);
    setTotalKeluarBulanIni(kData?.reduce((sum, i) => sum + Number(i.nominal), 0) || 0);
  };

  const fetchChartData = async () => {
    // Generate last 6 months
    const data: ChartData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      
      const { data: mData } = await supabase.from('transaksi_masuk').select('nominal').eq('periode_bulan', m).eq('periode_tahun', y);
      const { data: kData } = await supabase.from('transaksi_keluar').select('nominal').eq('periode_bulan', m).eq('periode_tahun', y);
      
      data.push({
        name: formatBulan(m).substring(0,3) + ' ' + y.toString().substring(2,4),
        Pemasukan: mData?.reduce((sum, i) => sum + Number(i.nominal), 0) || 0,
        Pengeluaran: kData?.reduce((sum, i) => sum + Number(i.nominal), 0) || 0
      });
    }
    setChartData(data);
  };

  const fetchTunggakan = async () => {
    setLoadingTunggakan(true);
    try {
      // Logic Tunggakan:
      // Ambil santri aktif & kategori rutin
      const { data: santriList } = await supabase.from('santri').select('id, nama').eq('status', 'aktif');
      const { data: kategoriList } = await supabase.from('kategori_pembayaran').select('id, nama').eq('is_active', true).eq('tipe', 'rutin');
      
      if (!santriList || !kategoriList) return;

      // Previous month logic
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      // Fetch all transactions for current and previous month to process locally (faster than querying in loop)
      const { data: trxList } = await supabase
        .from('transaksi_masuk')
        .select('santri_id, kategori_id, periode_bulan')
        .in('periode_bulan', [currentMonth, prevMonth])
        .in('periode_tahun', [currentYear, prevYear]);

      const tunggakan: TunggakanSantri[] = [];

      for (const santri of santriList) {
        for (const kat of kategoriList) {
          const bayarBulanIni = trxList?.some(t => t.santri_id === santri.id && t.kategori_id === kat.id && t.periode_bulan === currentMonth);
          const bayarBulanLalu = trxList?.some(t => t.santri_id === santri.id && t.kategori_id === kat.id && t.periode_bulan === prevMonth);
          
          let bulanNunggak = 0;
          if (!bayarBulanIni) bulanNunggak += 1;
          if (!bayarBulanLalu) bulanNunggak += 1;

          if (bulanNunggak > 0) {
            tunggakan.push({
              santri_id: santri.id,
              nama_santri: santri.nama,
              kategori_nama: kat.nama,
              bulan_nunggak: bulanNunggak
            });
          }
        }
      }

      setDaftarTunggakan(tunggakan);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingTunggakan(false);
    }
  };

  const fetchRincianBulanIni = async () => {
    const { data: kategori } = await supabase.from('kategori_pembayaran').select('id, nama, vendor_list').eq('is_active', true).neq('tipe', 'tabungan');
    if (!kategori) return;

    // Hitung seluruh uang masuk dan keluar sepanjang masa untuk sisa anggaran sejati
    const { data: masukData } = await supabase.from('transaksi_masuk').select('kategori_id, nominal, vendor_terpilih');
    const { data: keluarData } = await supabase.from('transaksi_keluar').select('sumber_dana_id, nominal, vendor_terpilih');

    const rincian: KasBulanan[] = kategori.map(kat => {
      const tMasuk = masukData?.filter(m => m.kategori_id === kat.id).reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
      const tKeluar = keluarData?.filter(k => k.sumber_dana_id === kat.id).reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
      
      let vendors = undefined;
      if (kat.vendor_list && Array.isArray(kat.vendor_list)) {
        vendors = kat.vendor_list.map((vName: string) => {
          const vMasuk = masukData?.filter(m => m.kategori_id === kat.id && m.vendor_terpilih === vName).reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
          const vKeluar = keluarData?.filter(k => k.sumber_dana_id === kat.id && k.vendor_terpilih === vName).reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
          return {
            nama: vName,
            total_masuk: vMasuk,
            total_keluar: vKeluar,
            sisa_saldo: vMasuk - vKeluar
          };
        });
      }

      return {
        kategori_nama: kat.nama,
        total_masuk: tMasuk,
        total_keluar: tKeluar,
        sisa_saldo: tMasuk - tKeluar,
        vendors
      };
    });

    setRincianBulanIni(rincian);
  };

  const fetchRiwayatKas = async () => {
    // Cari titik wipe terakhir (checkpoint)
    const { data: wipeCheckpoint } = await supabase
      .from('kas_pesantren_mutasi')
      .select('created_at')
      .ilike('keterangan', 'WIPE DATA SYSTEM RESET%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let query = supabase
      .from('kas_pesantren_mutasi')
      .select(`id, tipe, nominal, keterangan, periode_bulan, periode_tahun, created_at, sumber_kategori:kategori_pembayaran(nama), user_roles(nama_lengkap)`);

    // Hanya tampilkan riwayat SETELAH titik wipe (jika ada)
    if (wipeCheckpoint) {
      query = query.gt('created_at', wipeCheckpoint.created_at);
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(20);
    if (data) setRiwayatKas(data);
  };

  const handleTutupBuku = async () => {
    if (!window.confirm(`Yakin ingin melakukan Tutup Buku untuk bulan ${formatBulan(currentMonth)} ${currentYear}?\nSemua sisa saldo akan dipindahkan ke Kas Pesantren utama.`)) return;
    
    setIsSweeping(true);
    try {
      // 1. Get or create sweep category for expenses
      const sweepKategoriName = 'Tutup Buku (Sweep ke Kas Pesantren)';
      let sweepKategoriId = '';
      const { data: existKat } = await supabase.from('kategori_pengeluaran').select('id').eq('nama', sweepKategoriName).limit(1);
      
      if (existKat && existKat.length > 0) {
        sweepKategoriId = existKat[0].id;
      } else {
        const { data: newKat } = await supabase.from('kategori_pengeluaran').insert([{ nama: sweepKategoriName }]).select('id').single();
        if (newKat) sweepKategoriId = newKat.id;
      }

      if (!sweepKategoriId) throw new Error('Gagal membuat/mencari kategori pengeluaran sistem.');

      const { data: kategori } = await supabase.from('kategori_pembayaran').select('id, nama').eq('is_active', true).neq('tipe', 'tabungan');
      let sweptCount = 0;
      
      if (kategori) {
        for (const kat of kategori) {
          // Ambil keseluruhan transaksi tanpa batas waktu
          const tMasuk = await supabase.from('transaksi_masuk').select('nominal').eq('kategori_id', kat.id);
          const tKeluar = await supabase.from('transaksi_keluar').select('nominal').eq('sumber_dana_id', kat.id);
          
          const masukSum = tMasuk.data?.reduce((sum, i) => sum + Number(i.nominal), 0) || 0;
          const keluarSum = tKeluar.data?.reduce((sum, i) => sum + Number(i.nominal), 0) || 0;
          
          const sisa = masukSum - keluarSum;
          
          if (sisa > 0) {
            // Catat pengeluaran di transaksi_keluar
            await supabase.from('transaksi_keluar').insert([{
              kategori_pengeluaran_id: sweepKategoriId,
              sumber_dana_id: kat.id,
              nominal: sisa,
              tanggal_transaksi: new Date().toISOString().split('T')[0],
              periode_bulan: currentMonth,
              periode_tahun: currentYear,
              keterangan: `Tutup Buku otomatis sisa dana: ${kat.nama}`,
              input_by: user!.id
            }]);

            // Tambahkan ke kas_pesantren_mutasi
            await supabase.from('kas_pesantren_mutasi').insert([{
              tipe: 'masuk', 
              nominal: sisa, 
              sumber_kategori_id: kat.id,
              periode_bulan: currentMonth, 
              periode_tahun: currentYear,
              keterangan: `Tutup Buku otomatis sisa dana: ${kat.nama}`, 
              input_by: user!.id
            }]);
            
            sweptCount++;
          }
        }
      }
      
      alert(sweptCount > 0 ? `Tutup buku berhasil! ${sweptCount} pos anggaran telah disapu ke Kas Pesantren.` : 'Tidak ada sisa saldo yang perlu disapu (sudah Rp 0).');
      
      // Auto-advance month by re-checking
      const d = new Date();
      await checkActiveMonth(d.getMonth() + 1, d.getFullYear());
      // The useEffect listening to currentMonth and currentYear will automatically re-fetch everything

    } catch (error: any) {
      alert('Gagal tutup buku: ' + error.message);
    } finally {
      setIsSweeping(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleWipeData = async () => {
    const confirmText = window.prompt('PERINGATAN KERAS: Aksi ini akan menghapus semua data Santri, Transaksi Masuk, Transaksi Keluar, dan Tabungan secara permanen.\n\nKetik persis teks berikut untuk melanjutkan:\nhapus semua data sekarang');
    
    if (confirmText !== 'hapus semua data sekarang') {
      alert('Teks tidak cocok atau dibatalkan. Penghapusan dibatalkan.');
      return;
    }

    setIsWiping(true);
    try {
      // Supabase tidak bisa "DELETE tanpa filter", kita gunakan parameter yang selalu match, misal not null
      // 1. Hapus transaksi masuk
      const { error: e1 } = await supabase.from('transaksi_masuk').delete().not('id', 'is', null);
      if (e1) throw e1;
      
      // 2. Hapus tabungan_mutasi
      const { error: e2 } = await supabase.from('tabungan_mutasi').delete().not('id', 'is', null);
      if (e2) throw e2;
      
      // 3. Hapus transaksi keluar
      const { error: e3 } = await supabase.from('transaksi_keluar').delete().not('id', 'is', null);
      if (e3) throw e3;

      // 4. Hapus data santri
      const { error: e4 } = await supabase.from('santri').delete().not('id', 'is', null);
      if (e4) throw e4;

      // 5. Kosongkan Kas Pesantren via Koreksi (Offsetting) karena RLS mungkin memblokir DELETE
      const { data: kasToWipe } = await supabase.from('kas_pesantren_mutasi').select('tipe, nominal');
      if (kasToWipe) {
        const wipeMasuk = kasToWipe.filter(d => d.tipe === 'masuk').reduce((sum, item) => sum + Number(item.nominal), 0);
        const wipeKeluar = kasToWipe.filter(d => d.tipe === 'keluar').reduce((sum, item) => sum + Number(item.nominal), 0);
        const wipeSaldo = wipeMasuk - wipeKeluar;
        
        if (wipeSaldo > 0) {
          await supabase.from('kas_pesantren_mutasi').insert([{
            tipe: 'keluar',
            nominal: wipeSaldo,
            keterangan: 'WIPE DATA SYSTEM RESET (Koreksi Saldo ke Rp 0)',
            periode_bulan: currentMonth,
            periode_tahun: currentYear,
            input_by: user!.id
          }]);
        }
      }
      
      localStorage.setItem('dev_wipe_done_v4', 'true');
      setDevWipeDone(true);
      alert('Seluruh data riwayat dan santri berhasil dihapus bersih!');
      
      // Auto-reload data dan reset bulan aktif ke bulan ini
      const d = new Date();
      await checkActiveMonth(d.getMonth() + 1, d.getFullYear());
      fetchDashboardStats();
      fetchRincianBulanIni();
      fetchRiwayatKas();
      fetchChartData();
    } catch (error: any) {
      console.error('Error wiping data:', error);
      alert('Terjadi kesalahan saat menghapus data: ' + error.message);
    } finally {
      setIsWiping(false);
    }
  };

  const handleProductionNow = () => {
    if (window.confirm('Yakin ingin menyembunyikan tombol Developer? Tombol akan otomatis muncul kembali jika ada pembaruan sistem/kode.')) {
      localStorage.setItem('productionModeVersion', APP_VERSION);
      setIsProduction(true);
    }
  };


  return (
    <div className="bg-slate-50 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 min-h-screen">
      
      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group hover:border-khzm-green transition-colors">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Pemasukan</p>
          <p className="text-lg sm:text-xl font-black text-green-600">Rp {totalMasukBulanIni.toLocaleString('id-ID')}</p>
          <p className="text-xs text-gray-400 mt-1">Bulan Ini</p>
          <TrendingUp className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-green-50 opacity-50 group-hover:scale-110 transition-transform" />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group hover:border-red-400 transition-colors">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Pengeluaran</p>
          <p className="text-lg sm:text-xl font-black text-red-500">Rp {totalKeluarBulanIni.toLocaleString('id-ID')}</p>
          <p className="text-xs text-gray-400 mt-1">Bulan Ini</p>
          <ShoppingCart className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-red-50 opacity-50 group-hover:scale-110 transition-transform" />
        </div>
        <div className="bg-gradient-to-br from-khzm-emerald to-khzm-green rounded-2xl p-5 shadow-md relative overflow-hidden text-white">
          <p className="text-xs font-bold text-green-100 uppercase tracking-wider mb-1">Saldo Kas Pesantren</p>
          <p className="text-xl sm:text-2xl font-black">Rp {saldoKasPesantren.toLocaleString('id-ID')}</p>
          <div className="absolute right-3 top-3">
            <button onClick={handleTutupBuku} disabled={isSweeping} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
              {isSweeping ? 'Menyapu...' : 'Tutup Buku'}
            </button>
          </div>
          <Archive className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-white opacity-10" />
        </div>
        <div className="bg-blue-600 rounded-2xl p-5 shadow-md relative overflow-hidden text-white">
          <p className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-1">Titipan Tabungan</p>
          <p className="text-xl sm:text-2xl font-black">Rp {totalTabungan.toLocaleString('id-ID')}</p>
          <p className="text-xs text-blue-100 mt-1">Total Santri Aktif ({totalSantri})</p>
          <Wallet className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-white opacity-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          
          {/* KOLOM KIRI: GRAFIK & RINCIAN */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            
            {/* Grafik Arus Kas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
              <h3 className="font-bold text-gray-900 mb-6">Tren Arus Kas (6 Bulan Terakhir)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMasuk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorKeluar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} tickFormatter={(val) => `Rp${val/1000000}M`} />
                    <Tooltip 
                      formatter={(value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Area type="monotone" dataKey="Pemasukan" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMasuk)" />
                    <Area type="monotone" dataKey="Pengeluaran" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorKeluar)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Laporan Rincian Bulan Ini */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-khzm-green" />
                    Rincian Sisa Anggaran: {formatBulan(currentMonth)} {currentYear}
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      <th className="p-4 font-semibold text-gray-500 text-xs uppercase">Sumber Dana</th>
                      <th className="p-4 font-semibold text-gray-500 text-xs uppercase text-right">Masuk</th>
                      <th className="p-4 font-semibold text-gray-500 text-xs uppercase text-right">Keluar</th>
                      <th className="p-4 font-semibold text-gray-500 text-xs uppercase text-right">Limit Sisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rincianBulanIni.map((rin, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-gray-50/50">
                          <td className="p-4 font-medium text-gray-900 text-sm">{rin.kategori_nama}</td>
                          <td className="p-4 text-right text-green-600 text-sm">Rp {rin.total_masuk.toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right text-red-500 text-sm">Rp {rin.total_keluar.toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${rin.sisa_saldo > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              Rp {rin.sisa_saldo.toLocaleString('id-ID')}
                            </span>
                          </td>
                        </tr>
                        {/* Sub-row for vendors if they exist */}
                        {rin.vendors && rin.vendors.length > 0 && (
                          <tr className="bg-blue-50/30">
                            <td colSpan={4} className="p-0">
                              <div className="pl-8 pr-4 py-3 bg-slate-50 border-l-4 border-blue-400">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Distribusi Dana Vendor:</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {rin.vendors.map((v, vIdx) => (
                                    <div key={vIdx} className="bg-white p-3 rounded border border-gray-100 shadow-sm">
                                      <div className="font-bold text-sm text-gray-800">{v.nama}</div>
                                      <div className="flex justify-between text-xs mt-1">
                                        <span className="text-gray-500">Masuk:</span>
                                        <span className="text-green-600 font-medium">Rp {v.total_masuk.toLocaleString('id-ID')}</span>
                                      </div>
                                      <div className="flex justify-between text-xs mt-0.5 border-b border-gray-100 pb-1">
                                        <span className="text-gray-500">Keluar:</span>
                                        <span className="text-red-500 font-medium">Rp {v.total_keluar.toLocaleString('id-ID')}</span>
                                      </div>
                                      <div className="flex justify-between text-xs mt-1">
                                        <span className="text-gray-700 font-bold">Saldo:</span>
                                        <span className={`font-bold ${v.sisa_saldo > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                          Rp {v.sisa_saldo.toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {rincianBulanIni.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-sm text-gray-500">Memuat data...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* KOLOM KANAN: TUNGGAKAN & RIWAYAT SWEEP */}
          <div className="lg:col-span-1 space-y-6 sm:space-y-8">
            
            {/* Daftar Piutang / Tunggakan */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
              <div className="p-5 border-b border-gray-100 bg-red-50/50 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                  Deteksi Tunggakan Santri
                </h3>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                {loadingTunggakan ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 text-red-500 animate-spin" /></div>
                ) : daftarTunggakan.length === 0 ? (
                  <div className="text-center p-8 text-sm text-gray-500">Alhamdulillah, tidak ada tunggakan.</div>
                ) : (
                  <div className="space-y-3">
                    {daftarTunggakan.sort((a,b) => b.bulan_nunggak - a.bulan_nunggak).map((tunggak, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border ${tunggak.bulan_nunggak >= 2 ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{tunggak.nama_santri}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{tunggak.kategori_nama}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tunggak.bulan_nunggak >= 2 ? 'bg-red-600 text-white shadow-sm animate-pulse' : 'bg-amber-500 text-white shadow-sm'}`}>
                            Nunggak {tunggak.bulan_nunggak} Bulan
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Riwayat Sweeping Kas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 flex items-center text-sm">
                  <Archive className="h-4 w-4 mr-2 text-gray-500" />
                  Riwayat Tambah Kas
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="divide-y divide-gray-50">
                  {riwayatKas.map((riw) => (
                    <div key={riw.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-khzm-green">+ Rp {riw.nominal.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] text-gray-400">{new Date(riw.created_at).toLocaleDateString('id-ID', {month:'short', year:'numeric'})}</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{riw.keterangan}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

        </div>
      </div>

      {/* DEVELOPER ZONE */}
      {!isProduction && (
        <div className="mt-12 bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-red-800 font-bold flex items-center mb-1">
                <ShieldAlert className="h-5 w-5 mr-2" />
                Developer Zone
              </h3>
              <p className="text-sm text-red-600">Fitur khusus: Menghapus seluruh riwayat dan data agar siap digunakan ulang dari awal.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleProductionNow}
                disabled={isWiping}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-50"
              >
                <Rocket className="h-5 w-5 mr-2" />
                Production Now
              </button>
              <button 
                onClick={handleWipeData}
                disabled={isWiping}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-50"
              >
                <Trash2 className="h-5 w-5 mr-2" />
                {isWiping ? 'Menghapus...' : 'Hapus Semua Data!'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
