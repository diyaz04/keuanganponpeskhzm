import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatRupiah, formatBulan } from './format';
import logoUrl from '../assets/logo.png';

interface TransaksiRiwayat {
  id: string;
  santri: { nama: string; kelas_pengajian: { nama: string } };
  kategori_pembayaran: { nama: string };
  nominal: number;
  tanggal_transaksi: string;
  periode_bulan: number | null;
  periode_tahun: number | null;
  catatan: string | null;
  user_roles: { nama_lengkap: string };
}

export const cetakKwitansi = async (trxData: TransaksiRiwayat | TransaksiRiwayat[]) => {
  const trxList = Array.isArray(trxData) ? trxData : [trxData];
  if (trxList.length === 0) return;
  
  const trx = trxList[0]; // Ambil data referensi dari item pertama
  const totalNominal = trxList.reduce((sum, item) => sum + item.nominal, 0);

  // A5 Landscape format (panjang 210mm x tinggi 148mm)
  // Cocok untuk ukuran kwitansi
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  // const pageHeight = doc.internal.pageSize.getHeight();

  // Helper untuk memuat logo image sebagai DataURL (Base64)
  const getLogoBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return null;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  // 1. Header Kiri (Logo & Nama Pesantren)
  const logoDataUrl = await getLogoBase64(logoUrl); // Sesuai info user: logo dari assets
  
  if (logoDataUrl) {
    // Add Logo (x: 15, y: 15, width: 20, height: 20)
    doc.addImage(logoDataUrl, 'PNG', 15, 12, 20, 20);
    
    // Nama Pesantren text disamping logo
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // khzm-green (tailwind emerald-600 approx)
    doc.text('PESANTREN KHZM', 40, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Sistem Informasi Keuangan Santri', 40, 25);
    doc.text('Kwitansi Resmi Pembayaran', 40, 30);
  } else {
    // Fallback jika logo tidak ada
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text('PESANTREN KHZM', 15, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Kwitansi Resmi Pembayaran', 15, 25);
  }

  // 2. Header Kanan (KWITANSI & Nomor)
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('KWITANSI', pageWidth - 15, 22, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  // Ambil ID dari item pertama untuk hash
  const noKwitansi = `NO: KW-${trx.tanggal_transaksi.replace(/-/g, '')}-${trx.id.substring(0,4).toUpperCase()}`;
  doc.text(noKwitansi, pageWidth - 15, 28, { align: 'right' });
  
  // Garis Bawah Header
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1);
  doc.line(15, 38, pageWidth - 15, 38);

  // 3. Badan Kwitansi (Detail Informasi)
  const startY = 50;
  const lineSpacing = 10;
  
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  
  // Telah Diterima Dari
  doc.setFont('helvetica', 'normal');
  doc.text('Telah Diterima Dari', 15, startY);
  doc.text(':', 60, startY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${trx.santri?.nama || 'Tanpa Nama'} (Kelas: ${trx.santri?.kelas_pengajian?.nama || '-'})`, 65, startY);
  
  // Uang Sebesar
  doc.setFont('helvetica', 'normal');
  doc.text('Uang Sebesar', 15, startY + lineSpacing);
  doc.text(':', 60, startY + lineSpacing);
  
  // Highlight box untuk nominal
  doc.setFillColor(240, 253, 244); // bg-green-50
  doc.roundedRect(63, startY + lineSpacing - 6, 80, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`Rp ${totalNominal.toLocaleString('id-ID')}`, 65, startY + lineSpacing + 0.5);
  
  // Untuk Pembayaran
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.text('Untuk Pembayaran', 15, startY + lineSpacing * 2);
  doc.text(':', 60, startY + lineSpacing * 2);
  
  doc.setFont('helvetica', 'bold');
  let currentY = startY + lineSpacing * 2;
  
  if (trxList.length === 1) {
    let peruntukan = trx.kategori_pembayaran?.nama || 'Lainnya';
    if (trx.periode_bulan) {
      peruntukan += ` (Periode: ${formatBulan(trx.periode_bulan)} ${trx.periode_tahun})`;
    }
    doc.text(peruntukan, 65, currentY);
    
    if (trx.catatan) {
      doc.setFont('helvetica', 'normal');
      doc.text('Catatan', 15, currentY + lineSpacing);
      doc.text(':', 60, currentY + lineSpacing);
      doc.setFont('helvetica', 'italic');
      doc.text(trx.catatan, 65, currentY + lineSpacing);
    }
  } else {
    // Array of items
    trxList.forEach((item, idx) => {
      if (currentY > 95) return; // Stop if too long
      
      let peruntukan = `${idx + 1}. ${item.kategori_pembayaran?.nama || 'Lainnya'}`;
      if (item.periode_bulan) {
        peruntukan += ` (${formatBulan(item.periode_bulan)} ${item.periode_tahun})`;
      }
      peruntukan += ` - Rp ${item.nominal.toLocaleString('id-ID')}`;
      
      doc.setFontSize(10);
      doc.text(peruntukan, 65, currentY);
      currentY += 6;
    });
  }

  // 4. Footer (Tanda Tangan)
  const footerY = 100;
  
  // Tanggal cetak di atas ttd bendahara
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const formatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' });
  const tglStr = formatter.format(new Date(trx.tanggal_transaksi));
  
  doc.text(`Sukamenak, ${tglStr}`, pageWidth - 55, footerY - 5, { align: 'center' });
  
  doc.text('Penyetor / Santri', 55, footerY, { align: 'center' });
  doc.text('Penerima / Bendahara', pageWidth - 55, footerY, { align: 'center' });

  // Garis nama
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  
  doc.line(30, footerY + 25, 80, footerY + 25);
  doc.text(`( ${trx.santri?.nama || '...'} )`, 55, footerY + 30, { align: 'center' });
  
  doc.line(pageWidth - 80, footerY + 25, pageWidth - 30, footerY + 25);
  doc.setFont('helvetica', 'bold');
  doc.text(`${trx.user_roles?.nama_lengkap || 'Bendahara'}`, pageWidth - 55, footerY + 30, { align: 'center' });

  // Small note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Kwitansi ini adalah bukti pembayaran yang sah. Harap disimpan dengan baik.', pageWidth / 2, 140, { align: 'center' });

  // Save / Trigger Download
  doc.save(`Kwitansi_${trx.santri?.nama || 'Santri'}_${trx.tanggal_transaksi}.pdf`);
};
