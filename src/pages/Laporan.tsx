import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, FileText, Download, Loader2, Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupiah, formatBulan } from '@/lib/format';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TransaksiMasuk {
  id: string;
  nominal: number;
  tanggal_transaksi: string;
  santri: { nama: string; kelas_pengajian?: { nama: string } };
  kategori_pembayaran: { nama: string };
  catatan: string | null;
  user_roles: { nama_lengkap: string };
}

interface TransaksiKeluar {
  id: string;
  nominal: number;
  tanggal_transaksi: string;
  kategori_pengeluaran: { nama: string };
  sumber_dana: { nama: string };
  keterangan: string | null;
  user_roles: { nama_lengkap: string };
}

interface KasPesantrenMutasi {
  id: string;
  nominal: number;
  created_at: string;
  sumber_kategori: { nama: string } | null;
  keterangan: string | null;
  user_roles: { nama_lengkap: string };
}

const Laporan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  
  const [loading, setLoading] = useState(false);
  const [dataMasuk, setDataMasuk] = useState<TransaksiMasuk[]>([]);
  const [dataKeluar, setDataKeluar] = useState<TransaksiKeluar[]>([]);
  const [dataKasPesantren, setDataKasPesantren] = useState<KasPesantrenMutasi[]>([]);
  const [dataPenggunaanKas, setDataPenggunaanKas] = useState<KasPesantrenMutasi[]>([]);
  
  const [totalMasuk, setTotalMasuk] = useState(0);
  const [totalKeluar, setTotalKeluar] = useState(0);

  useEffect(() => {
    fetchLaporan();
  }, [selectedBulan, selectedTahun]);

  const fetchLaporan = async () => {
    setLoading(true);
    
    // Construct date range for the selected month
    const startDate = new Date(selectedTahun, selectedBulan - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(selectedTahun, selectedBulan, 0).toISOString().split('T')[0];

    try {
      // Fetch Transaksi Masuk
      const { data: masuk } = await supabase
        .from('transaksi_masuk')
        .select(`
          id, nominal, tanggal_transaksi, catatan,
          santri(nama, kelas_pengajian(nama)),
          kategori_pembayaran(nama),
          user_roles(nama_lengkap)
        `)
        .gte('tanggal_transaksi', startDate)
        .lte('tanggal_transaksi', endDate)
        .order('tanggal_transaksi', { ascending: true });

      // Fetch Transaksi Keluar
      const { data: keluar } = await supabase
        .from('transaksi_keluar')
        .select(`
          id, nominal, tanggal_transaksi, keterangan,
          kategori_pengeluaran(nama),
          sumber_dana:kategori_pembayaran(nama),
          user_roles(nama_lengkap)
        `)
        .gte('tanggal_transaksi', startDate)
        .lte('tanggal_transaksi', endDate)
        .order('tanggal_transaksi', { ascending: true });

      // Cari titik wipe terakhir (checkpoint)
      const { data: wipeCheckpoint } = await supabase
        .from('kas_pesantren_mutasi')
        .select('created_at')
        .ilike('keterangan', 'WIPE DATA SYSTEM RESET%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch Kas Pesantren (Tutup Buku) - Tipe Masuk
      let kasQuery = supabase
        .from('kas_pesantren_mutasi')
        .select(`
          id, nominal, created_at, keterangan,
          sumber_kategori:kategori_pembayaran(nama),
          user_roles(nama_lengkap)
        `)
        .eq('tipe', 'masuk')
        .ilike('keterangan', 'Tutup Buku otomatis sisa dana%')
        .gte('created_at', startDate + 'T00:00:00.000Z')
        .lte('created_at', endDate + 'T23:59:59.999Z')
        .order('created_at', { ascending: true });

      // Fetch Penggunaan Kas Pesantren - Tipe Keluar
      let kasPenggunaanQuery = supabase
        .from('kas_pesantren_mutasi')
        .select(`
          id, nominal, created_at, keterangan,
          user_roles(nama_lengkap)
        `)
        .eq('tipe', 'keluar')
        .gte('created_at', startDate + 'T00:00:00.000Z')
        .lte('created_at', endDate + 'T23:59:59.999Z')
        .order('created_at', { ascending: true });

      if (wipeCheckpoint) {
        kasQuery = kasQuery.gt('created_at', wipeCheckpoint.created_at);
        kasPenggunaanQuery = kasPenggunaanQuery.gt('created_at', wipeCheckpoint.created_at);
      }

      const [{ data: kasP }, { data: kasPK }] = await Promise.all([
        kasQuery,
        kasPenggunaanQuery
      ]);

      const masukList = (masuk as any) || [];
      const keluarList = (keluar as any) || [];
      const kasList = (kasP as any) || [];
      const kasPList = (kasPK as any) || [];

      setDataMasuk(masukList);
      setDataKeluar(keluarList);
      setDataKasPesantren(kasList);
      setDataPenggunaanKas(kasPList);
      
      setTotalMasuk(masukList.reduce((acc: number, curr: any) => acc + curr.nominal, 0));
      setTotalKeluar(keluarList.reduce((acc: number, curr: any) => acc + curr.nominal, 0));

    } catch (error) {
      console.error('Failed to fetch laporan', error);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // 1. Data Pemasukan
    const wsMasukData = dataMasuk.map((t, idx) => ({
      'No': idx + 1,
      'Tanggal': t.tanggal_transaksi,
      'Nama Santri': t.santri?.nama || '-',
      'Kelas': t.santri?.kelas_pengajian?.nama || '-',
      'Kategori': t.kategori_pembayaran?.nama || '-',
      'Nominal': t.nominal,
      'Keterangan': t.catatan || '-',
      'Petugas': t.user_roles?.nama_lengkap || '-'
    }));
    const wsMasuk = XLSX.utils.json_to_sheet(wsMasukData);
    XLSX.utils.book_append_sheet(wb, wsMasuk, "Pemasukan");

    // 2. Data Pengeluaran
    const wsKeluarData = dataKeluar.map((t, idx) => ({
      'No': idx + 1,
      'Tanggal': t.tanggal_transaksi,
      'Kategori Pengeluaran': t.kategori_pengeluaran?.nama || '-',
      'Sumber Dana': t.sumber_dana?.nama || '-',
      'Nominal': t.nominal,
      'Keterangan': t.keterangan || '-',
      'Petugas': t.user_roles?.nama_lengkap || '-'
    }));
    const wsKeluar = XLSX.utils.json_to_sheet(wsKeluarData);
    XLSX.utils.book_append_sheet(wb, wsKeluar, "Pengeluaran");

    // 3. Data Kas Pesantren (Tutup Buku)
    const wsKasData = dataKasPesantren.map((t, idx) => ({
      'No': idx + 1,
      'Tanggal': t.created_at.split('T')[0],
      'Sumber Dana (Kategori)': t.sumber_kategori?.nama || '-',
      'Nominal': t.nominal,
      'Keterangan': t.keterangan || '-',
      'Petugas': t.user_roles?.nama_lengkap || '-'
    }));
    const wsKas = XLSX.utils.json_to_sheet(wsKasData);
    XLSX.utils.book_append_sheet(wb, wsKas, "Mutasi Kas Pesantren");

    // 4. Data Penggunaan Kas Pesantren
    const wsPenggunaanData = dataPenggunaanKas.map((t, idx) => ({
      'No': idx + 1,
      'Tanggal': t.created_at.split('T')[0],
      'Nominal': t.nominal,
      'Keterangan': t.keterangan || '-',
      'Petugas': t.user_roles?.nama_lengkap || '-'
    }));
    const wsPenggunaan = XLSX.utils.json_to_sheet(wsPenggunaanData);
    XLSX.utils.book_append_sheet(wb, wsPenggunaan, "Penggunaan Kas");

    // 5. Ringkasan
    const wsSummaryData = [
      { 'Item': 'Total Pemasukan', 'Nominal': totalMasuk },
      { 'Item': 'Total Pengeluaran (Biasa)', 'Nominal': totalKeluar },
      { 'Item': 'Total Penggunaan Kas Pesantren', 'Nominal': dataPenggunaanKas.reduce((acc, curr) => acc + curr.nominal, 0) },
      { 'Item': 'Saldo Kas Bersih', 'Nominal': totalMasuk - totalKeluar }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(wsSummaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

    XLSX.writeFile(wb, `Laporan_Keuangan_KHZM_${formatBulan(selectedBulan)}_${selectedTahun}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text('LAPORAN KEUANGAN PESANTREN KHZM', pageWidth / 2, 40, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Periode: ${formatBulan(selectedBulan)} ${selectedTahun}`, pageWidth / 2, 60, { align: 'center' });
    
    let currentY = 90;

    // Summary Box
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Pemasukan: Rp ${totalMasuk.toLocaleString('id-ID')}`, 40, currentY);
    currentY += 15;
    doc.text(`Total Pengeluaran: Rp ${totalKeluar.toLocaleString('id-ID')}`, 40, currentY);
    currentY += 15;
    doc.text(`Saldo Kas Bersih: Rp ${(totalMasuk - totalKeluar).toLocaleString('id-ID')}`, 40, currentY);
    
    currentY += 30;

    // Table Pemasukan
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Rincian Pemasukan', 40, currentY);
    
    autoTable(doc, {
      startY: currentY + 10,
      head: [['Tanggal', 'Nama Santri', 'Kategori', 'Nominal (Rp)', 'Petugas']],
      body: dataMasuk.map(t => [
        t.tanggal_transaksi,
        t.santri?.nama || '-',
        t.kategori_pembayaran?.nama || '-',
        t.nominal.toLocaleString('id-ID'),
        t.user_roles?.nama_lengkap || '-'
      ]),
      foot: [['TOTAL', '', '', totalMasuk.toLocaleString('id-ID'), '']],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // Green for income
      footStyles: { fillColor: [240, 253, 244], textColor: [20, 20, 20], fontStyle: 'bold' },
      styles: { fontSize: 8 }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 30;

    // Table Pengeluaran
    // Add page if needed
    if (currentY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      currentY = 40;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Rincian Pengeluaran', 40, currentY);

    autoTable(doc, {
      startY: currentY + 10,
      head: [['Tanggal', 'Kategori', 'Sumber Dana', 'Nominal (Rp)', 'Petugas']],
      body: dataKeluar.map(t => [
        t.tanggal_transaksi,
        t.kategori_pengeluaran?.nama || '-',
        t.sumber_dana?.nama || '-',
        t.nominal.toLocaleString('id-ID'),
        t.user_roles?.nama_lengkap || '-'
      ]),
      foot: [['TOTAL', '', '', totalKeluar.toLocaleString('id-ID'), '']],
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] }, // Red for expenses
      footStyles: { fillColor: [254, 242, 242], textColor: [20, 20, 20], fontStyle: 'bold' },
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 30;

    // Table Kas Pesantren (Tutup Buku)
    if (currentY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      currentY = 40;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Rincian Pemasukan Kas Pesantren (Hasil Tutup Buku)', 40, currentY);

    autoTable(doc, {
      startY: currentY + 10,
      head: [['Tanggal', 'Sumber Dana', 'Nominal (Rp)', 'Keterangan', 'Petugas']],
      body: dataKasPesantren.map(t => [
        t.created_at.split('T')[0],
        t.sumber_kategori?.nama || '-',
        t.nominal.toLocaleString('id-ID'),
        t.keterangan || '-',
        t.user_roles?.nama_lengkap || '-'
      ]),
      foot: [['TOTAL', '', dataKasPesantren.reduce((acc, curr) => acc + curr.nominal, 0).toLocaleString('id-ID'), '', '']],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Blue
      footStyles: { fillColor: [239, 246, 255], textColor: [20, 20, 20], fontStyle: 'bold' },
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 30;

    // Table Penggunaan Kas Pesantren
    if (currentY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      currentY = 40;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Rincian Penggunaan Kas Pesantren', 40, currentY);

    autoTable(doc, {
      startY: currentY + 10,
      head: [['Tanggal', 'Nominal (Rp)', 'Keterangan', 'Petugas']],
      body: dataPenggunaanKas.map(t => [
        t.created_at.split('T')[0],
        t.nominal.toLocaleString('id-ID'),
        t.keterangan || '-',
        t.user_roles?.nama_lengkap || '-'
      ]),
      foot: [['TOTAL', dataPenggunaanKas.reduce((acc, curr) => acc + curr.nominal, 0).toLocaleString('id-ID'), '', '']],
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9] }, // Amber
      footStyles: { fillColor: [254, 243, 199], textColor: [20, 20, 20], fontStyle: 'bold' },
      styles: { fontSize: 8 }
    });

    // Tanda Tangan / Titimangsa
    currentY = (doc as any).lastAutoTable.finalY + 40;
    if (currentY > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      currentY = 60;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const formatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' });
    const tglStr = formatter.format(new Date());
    
    // Penandatangan Kiri (Pimpinan)
    doc.text('Mengetahui,', 80, currentY, { align: 'center' });
    doc.text('Pimpinan Pesantren', 80, currentY + 15, { align: 'center' });
    
    // Penandatangan Kanan (Bendahara)
    doc.text(`Sukamenak, ${tglStr}`, pageWidth - 80, currentY, { align: 'center' });
    doc.text('Bendahara', pageWidth - 80, currentY + 15, { align: 'center' });
    
    // Garis Nama Kiri
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.line(40, currentY + 70, 120, currentY + 70);
    doc.text('( ......................................... )', 80, currentY + 75, { align: 'center' });

    // Garis Nama Kanan
    doc.line(pageWidth - 120, currentY + 70, pageWidth - 40, currentY + 70);
    doc.setFont('helvetica', 'bold');
    doc.text(`( ${user?.user_metadata?.nama_lengkap || user?.email || '.........................................'} )`, pageWidth - 80, currentY + 75, { align: 'center' });

    // Save
    doc.save(`Laporan_Keuangan_KHZM_${formatBulan(selectedBulan)}_${selectedTahun}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center">
              <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">Laporan Bulanan</h1>
                <p className="text-sm text-gray-500">Rincian keuangan dan export arsip</p>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-3 w-full sm:w-auto">
            <button 
              onClick={exportExcel}
              disabled={loading || (dataMasuk.length === 0 && dataKeluar.length === 0)}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </button>
            <button 
              onClick={exportPDF}
              disabled={loading || (dataMasuk.length === 0 && dataKeluar.length === 0)}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label>
              <select 
                value={selectedBulan} 
                onChange={(e) => setSelectedBulan(Number(e.target.value))}
                className="w-40 px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-khzm-green"
              >
                {Array.from({length: 12}, (_, i) => (
                  <option key={i+1} value={i+1}>{formatBulan(i+1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
              <input 
                type="number" 
                value={selectedTahun}
                onChange={(e) => setSelectedTahun(Number(e.target.value))}
                className="w-32 px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-khzm-green"
              />
            </div>
            {loading && <Loader2 className="h-5 w-5 text-khzm-green animate-spin mb-2" />}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center text-green-600 mb-2">
              <TrendingUp className="h-5 w-5 mr-2" />
              <h3 className="font-semibold">Total Pemasukan</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">Rp {totalMasuk.toLocaleString('id-ID')}</p>
            <p className="text-xs text-gray-500 mt-1">Dari {dataMasuk.length} transaksi</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center text-red-600 mb-2">
              <TrendingDown className="h-5 w-5 mr-2" />
              <h3 className="font-semibold">Total Pengeluaran</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">Rp {totalKeluar.toLocaleString('id-ID')}</p>
            <p className="text-xs text-gray-500 mt-1">Dari {dataKeluar.length} transaksi</p>
          </div>
          <div className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden`}>
            <div className={`absolute right-0 top-0 w-2 h-full ${totalMasuk - totalKeluar >= 0 ? 'bg-khzm-green' : 'bg-red-500'}`}></div>
            <div className="flex items-center text-gray-700 mb-2">
              <DollarSign className="h-5 w-5 mr-2" />
              <h3 className="font-semibold">Saldo Kas Bersih Bulan Ini</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">Rp {(totalMasuk - totalKeluar).toLocaleString('id-ID')}</p>
            <p className="text-xs text-gray-500 mt-1">Uang yang seharusnya tersisa</p>
          </div>
        </div>

        {/* Rincian Tables Preview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-900">
            Preview Data Pemasukan (5 Terbaru)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-gray-100 text-xs text-gray-500">
                <tr>
                  <th className="p-4 font-semibold uppercase">Tgl</th>
                  <th className="p-4 font-semibold uppercase">Santri</th>
                  <th className="p-4 font-semibold uppercase">Kategori</th>
                  <th className="p-4 font-semibold uppercase text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dataMasuk.slice(0, 5).map(trx => (
                  <tr key={trx.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-600">{trx.tanggal_transaksi}</td>
                    <td className="p-4 text-sm font-medium text-gray-900">{trx.santri?.nama}</td>
                    <td className="p-4 text-sm text-gray-600">{trx.kategori_pembayaran?.nama}</td>
                    <td className="p-4 text-sm font-bold text-khzm-green text-right">Rp {trx.nominal.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                {dataMasuk.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada data pemasukan</td></tr>}
              </tbody>
              <tfoot className="bg-green-50/50 border-t-2 border-green-100">
                <tr>
                  <td colSpan={3} className="p-4 text-sm font-bold text-gray-900 text-right">TOTAL</td>
                  <td className="p-4 text-sm font-bold text-khzm-green text-right">Rp {totalMasuk.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Preview Kas Pesantren */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8 mb-8">
          <div className="p-4 border-b border-gray-100 bg-blue-50 font-bold text-blue-900">
            Preview Mutasi Kas Pesantren (Hasil Tutup Buku)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-gray-100 text-xs text-gray-500">
                <tr>
                  <th className="p-4 font-semibold uppercase">Tgl</th>
                  <th className="p-4 font-semibold uppercase">Sumber Dana</th>
                  <th className="p-4 font-semibold uppercase">Keterangan</th>
                  <th className="p-4 font-semibold uppercase text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dataKasPesantren.slice(0, 5).map(trx => (
                  <tr key={trx.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-600">{trx.created_at.split('T')[0]}</td>
                    <td className="p-4 text-sm font-medium text-gray-900">{trx.sumber_kategori?.nama || '-'}</td>
                    <td className="p-4 text-sm text-gray-600">{trx.keterangan}</td>
                    <td className="p-4 text-sm font-bold text-blue-600 text-right">Rp {trx.nominal.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                {dataKasPesantren.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada riwayat tutup buku di bulan ini</td></tr>}
              </tbody>
              <tfoot className="bg-blue-50 border-t-2 border-blue-100">
                <tr>
                  <td colSpan={3} className="p-4 text-sm font-bold text-gray-900 text-right">TOTAL</td>
                  <td className="p-4 text-sm font-bold text-blue-700 text-right">Rp {dataKasPesantren.reduce((acc, curr) => acc + curr.nominal, 0).toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Laporan;
