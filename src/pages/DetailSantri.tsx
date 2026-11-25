import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, MapPin, Calendar, BookOpen, Clock, Activity, Download, Wallet } from 'lucide-react';
import { exportTabunganSantri } from '@/lib/exportTabungan';

interface SantriDetail {
  id: string;
  nama: string;
  kelas_pengajian?: { nama: string };
  kamar: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat: string;
  status: 'aktif' | 'keluar';
  tanggal_masuk: string;
  tanggal_keluar: string | null;
}

interface TransaksiMasuk {
  id: string;
  kategori_pembayaran: { nama: string };
  nominal: number;
  tanggal_transaksi: string;
  periode_bulan: number | null;
  periode_tahun: number | null;
  catatan: string | null;
  user_roles: { nama_lengkap: string };
}

interface TabunganMutasi {
  id: string;
  tipe: 'setor' | 'tarik';
  nominal: number;
  saldo_berjalan: number;
  tanggal_transaksi: string;
  user_roles: { nama_lengkap: string };
}

const DetailSantri = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'biodata' | 'transaksi' | 'tabungan'>('biodata');
  
  const [santri, setSantri] = useState<SantriDetail | null>(null);
  const [transaksi, setTransaksi] = useState<TransaksiMasuk[]>([]);
  const [tabungan, setTabungan] = useState<TabunganMutasi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Biodata
      const { data: dataSantri, error: errSantri } = await supabase
        .from('santri')
        .select('*, kelas_pengajian(nama)')
        .eq('id', id)
        .single();
        
      if (errSantri) throw errSantri;
      setSantri(dataSantri);

      // 2. Fetch Transaksi Masuk
      const { data: dataTrx, error: errTrx } = await supabase
        .from('transaksi_masuk')
        .select(`
          id, nominal, tanggal_transaksi, periode_bulan, periode_tahun, catatan,
          kategori_pembayaran(nama),
          user_roles!transaksi_masuk_input_by_fkey(nama_lengkap)
        `)
        .eq('santri_id', id)
        .order('tanggal_transaksi', { ascending: false });
        
      if (!errTrx) setTransaksi(dataTrx as any);

      // 3. Fetch Tabungan
      const { data: dataTabungan, error: errTabungan } = await supabase
        .from('tabungan_mutasi')
        .select(`
          id, tipe, nominal, saldo_berjalan, tanggal_transaksi,
          user_roles!tabungan_mutasi_input_by_fkey(nama_lengkap)
        `)
        .eq('santri_id', id)
        .order('tanggal_transaksi', { ascending: false });
        
      if (!errTabungan) setTabungan(dataTabungan as any);

    } catch (error) {
      console.error('Error fetching detail santri:', error);
      alert('Gagal mengambil data detail santri.');
      navigate('/santri');
    } finally {
      setLoading(false);
    }
  };

  const getBulanNama = (bulan: number) => {
    const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return namaBulan[bulan - 1] || '-';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-khzm-green"></div>
      </div>
    );
  }

  if (!santri) return null;

  const saldoTerakhir = tabungan.length > 0 ? tabungan[0].saldo_berjalan : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/santri')}
              className="mr-4 p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{santri.nama}</h1>
              <div className="flex items-center text-sm text-gray-500 mt-1 space-x-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${santri.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {santri.status.toUpperCase()}
                </span>
                <span>•</span>
                <span>{santri.kamar || 'Belum ada kamar'}</span>
              </div>
            </div>
          </div>
          <button className="hidden sm:flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4 mr-2" />
            Export Laporan
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Custom Tabs */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 inline-flex mb-8 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('biodata')}
            className={`flex items-center px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'biodata' ? 'bg-slate-900 text-white shadow' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <User className="h-4 w-4 mr-2" /> Biodata Lengkap
          </button>
          <button
            onClick={() => setActiveTab('transaksi')}
            className={`flex items-center px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'transaksi' ? 'bg-slate-900 text-white shadow' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <Activity className="h-4 w-4 mr-2" /> Histori Transaksi
          </button>
          <button
            onClick={() => setActiveTab('tabungan')}
            className={`flex items-center px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'tabungan' ? 'bg-slate-900 text-white shadow' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <Wallet className="h-4 w-4 mr-2" /> Tabungan
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'tabungan' ? 'bg-white/20' : 'bg-green-100 text-green-700'}`}>
              Rp {saldoTerakhir.toLocaleString('id-ID')}
            </span>
          </button>
        </div>

        {/* TAB 1: BIODATA */}
        {activeTab === 'biodata' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">Informasi Pribadi</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <User className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nama Lengkap</p>
                    <p className="text-gray-900 font-medium">{santri.nama}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tempat, Tanggal Lahir</p>
                    <p className="text-gray-900">{santri.tempat_lahir || '-'}, {santri.tanggal_lahir || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Alamat Asal</p>
                    <p className="text-gray-900">{santri.alamat || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">Informasi Akademik & Status</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <BookOpen className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Kelas Pengajian</p>
                    <p className="text-gray-900 font-medium">{santri.kelas_pengajian?.nama || 'Belum diatur'}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tanggal Masuk (Registrasi)</p>
                    <p className="text-gray-900">{santri.tanggal_masuk}</p>
                  </div>
                </div>
                {santri.status === 'keluar' && (
                  <div className="flex items-start">
                    <ArrowLeft className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-red-500">Tanggal Keluar (Boyong)</p>
                      <p className="text-red-700 font-bold">{santri.tanggal_keluar}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRANSAKSI MASUK */}
        {activeTab === 'transaksi' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
            {transaksi.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Belum ada transaksi</h3>
                <p className="text-gray-500 mt-1">Santri ini belum memiliki riwayat pembayaran apapun.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-4 font-semibold text-gray-700">Tanggal</th>
                      <th className="p-4 font-semibold text-gray-700">Jenis Pembayaran</th>
                      <th className="p-4 font-semibold text-gray-700">Periode (Bln/Thn)</th>
                      <th className="p-4 font-semibold text-gray-700">Nominal</th>
                      <th className="p-4 font-semibold text-gray-700">Penerima</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transaksi.map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-gray-600 whitespace-nowrap">{trx.tanggal_transaksi}</td>
                        <td className="p-4">
                          <p className="font-medium text-gray-900">{trx.kategori_pembayaran?.nama}</p>
                          {trx.catatan && <p className="text-xs text-gray-500 mt-0.5">{trx.catatan}</p>}
                        </td>
                        <td className="p-4 text-gray-600">
                          {trx.periode_bulan ? `${getBulanNama(trx.periode_bulan)} ${trx.periode_tahun || ''}` : '-'}
                        </td>
                        <td className="p-4 font-bold text-khzm-green whitespace-nowrap">
                          Rp {trx.nominal.toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 text-gray-500 text-sm">{trx.user_roles?.nama_lengkap || 'Sistem'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TABUNGAN */}
        {activeTab === 'tabungan' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Saldo Card */}
            <div className="bg-gradient-to-r from-khzm-emerald to-khzm-green rounded-2xl p-6 text-white shadow-lg shadow-green-100/50">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-green-50 font-medium mb-1">Total Saldo Tabungan Aktif</p>
                  <h2 className="text-4xl font-bold">Rp {saldoTerakhir.toLocaleString('id-ID')}</h2>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await exportTabunganSantri({ id: santri.id, nama: santri.nama, kamar: santri.kamar, kelas: santri.kelas_pengajian?.nama });
                    } catch (e: any) {
                      alert('Gagal export: ' + (e?.message || 'terjadi kesalahan'));
                    }
                  }}
                  disabled={tabungan.length === 0}
                  className="flex items-center justify-center px-4 py-2.5 bg-white text-khzm-green rounded-lg font-bold text-sm shadow hover:bg-green-50 transition-colors disabled:opacity-60"
                >
                  <Download className="h-4 w-4 mr-2" /> Export Excel
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {tabungan.length === 0 ? (
                <div className="p-12 text-center">
                  <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">Belum ada mutasi</h3>
                  <p className="text-gray-500 mt-1">Santri ini belum memiliki riwayat setor/tarik tabungan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-4 font-semibold text-gray-700">Tanggal</th>
                        <th className="p-4 font-semibold text-gray-700">Tipe Mutasi</th>
                        <th className="p-4 font-semibold text-gray-700">Nominal</th>
                        <th className="p-4 font-semibold text-gray-700">Saldo Berjalan</th>
                        <th className="p-4 font-semibold text-gray-700">Teller/Petugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tabungan.map((mutasi) => (
                        <tr key={mutasi.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-gray-600 whitespace-nowrap">{mutasi.tanggal_transaksi}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              mutasi.tipe === 'setor' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {mutasi.tipe === 'setor' ? '+ SETOR' : '- TARIK'}
                            </span>
                          </td>
                          <td className={`p-4 font-bold whitespace-nowrap ${mutasi.tipe === 'setor' ? 'text-blue-600' : 'text-orange-600'}`}>
                            Rp {mutasi.nominal.toLocaleString('id-ID')}
                          </td>
                          <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                            Rp {mutasi.saldo_berjalan.toLocaleString('id-ID')}
                          </td>
                          <td className="p-4 text-gray-500 text-sm">{mutasi.user_roles?.nama_lengkap || 'Sistem'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailSantri;
