import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 1000;
const FMT_RUPIAH = '#,##0';

interface MutasiRow {
  santri_id: string;
  tipe: 'setor' | 'tarik';
  nominal: number;
  saldo_berjalan: number;
  tanggal_transaksi: string;
  created_at: string;
  user_roles: { nama_lengkap: string } | null;
}

export interface SantriInfo {
  id: string;
  nama: string;
  kamar?: string | null;
  kelas?: string | null;
}

// Supabase membatasi 1000 baris per request, jadi ambil bertahap sampai habis.
async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

const MUTASI_SELECT =
  'santri_id, tipe, nominal, saldo_berjalan, tanggal_transaksi, created_at, user_roles(nama_lengkap)';

const todayStr = () => new Date().toISOString().split('T')[0];

const safeFile = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(wch => ({ wch }));
}

// Beri format ribuan pada sel numerik di kolom tertentu (mulai baris ke-`fromRow`, 0-based).
function formatCols(ws: XLSX.WorkSheet, cols: number[], fromRow: number) {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let r = fromRow; r <= range.e.r; r++) {
    for (const c of cols) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = FMT_RUPIAH;
    }
  }
}

const sortChrono = (a: MutasiRow, b: MutasiRow) =>
  a.tanggal_transaksi.localeCompare(b.tanggal_transaksi) || a.created_at.localeCompare(b.created_at);

/** Export rincian buku tabungan satu santri (kronologis, lama -> baru). */
export async function exportTabunganSantri(santri: SantriInfo) {
  const rows = (
    await fetchAllPages<MutasiRow>((from, to) =>
      supabase
        .from('tabungan_mutasi')
        .select(MUTASI_SELECT)
        .eq('santri_id', santri.id)
        .order('tanggal_transaksi', { ascending: true })
        .order('created_at', { ascending: true })
        .range(from, to) as any
    )
  ).sort(sortChrono);

  let totalSetor = 0;
  let totalTarik = 0;
  rows.forEach(r => {
    if (r.tipe === 'setor') totalSetor += Number(r.nominal);
    else totalTarik += Number(r.nominal);
  });

  const header: (string | number)[][] = [
    ['RINCIAN TABUNGAN SANTRI - PESANTREN KHZM'],
    [],
    ['Nama', santri.nama],
    ['Kelas', santri.kelas || '-'],
    ['Kamar', santri.kamar || '-'],
    ['Tanggal Cetak', todayStr()],
    [],
    ['No', 'Tanggal', 'Tipe', 'Setoran (Rp)', 'Penarikan (Rp)', 'Saldo (Rp)', 'Petugas'],
  ];
  const headerRows = header.length;

  const body = rows.map((r, i) => [
    i + 1,
    r.tanggal_transaksi,
    r.tipe === 'setor' ? 'Setor' : 'Tarik',
    r.tipe === 'setor' ? Number(r.nominal) : '',
    r.tipe === 'tarik' ? Number(r.nominal) : '',
    Number(r.saldo_berjalan),
    r.user_roles?.nama_lengkap || '-',
  ]);

  const footer = [
    [],
    ['', '', 'TOTAL', totalSetor, totalTarik, totalSetor - totalTarik, ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...header, ...body, ...footer]);
  setColWidths(ws, [6, 14, 10, 16, 16, 16, 24]);
  formatCols(ws, [3, 4, 5], headerRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rincian Tabungan');
  XLSX.writeFile(wb, `Tabungan_${safeFile(santri.nama)}_${todayStr()}.xlsx`);
}

/** Export rekap tabungan seluruh santri (satu baris per santri + total keseluruhan). */
export async function exportTabunganSemua(options: { sertakanNonAktif?: boolean } = {}) {
  const santriRows = await fetchAllPages<any>((from, to) => {
    let q = supabase
      .from('santri')
      .select('id, nama, kamar, status, kelas_pengajian(nama)')
      .order('nama', { ascending: true })
      .range(from, to);
    if (!options.sertakanNonAktif) q = q.eq('status', 'aktif');
    return q as any;
  });

  const mutasi = (
    await fetchAllPages<MutasiRow>((from, to) =>
      supabase
        .from('tabungan_mutasi')
        .select(MUTASI_SELECT)
        .order('tanggal_transaksi', { ascending: true })
        .order('created_at', { ascending: true })
        .range(from, to) as any
    )
  ).sort(sortChrono);

  const agg = new Map<string, { setor: number; tarik: number; jumlah: number; terakhir: string }>();
  mutasi.forEach(m => {
    const a = agg.get(m.santri_id) || { setor: 0, tarik: 0, jumlah: 0, terakhir: '' };
    if (m.tipe === 'setor') a.setor += Number(m.nominal);
    else a.tarik += Number(m.nominal);
    a.jumlah += 1;
    if (m.tanggal_transaksi > a.terakhir) a.terakhir = m.tanggal_transaksi;
    agg.set(m.santri_id, a);
  });

  let sumSetor = 0;
  let sumTarik = 0;
  let sumJumlah = 0;
  const body = santriRows.map((s, i) => {
    const a = agg.get(s.id) || { setor: 0, tarik: 0, jumlah: 0, terakhir: '' };
    sumSetor += a.setor;
    sumTarik += a.tarik;
    sumJumlah += a.jumlah;
    return [
      i + 1,
      s.nama,
      s.kelas_pengajian?.nama || '-',
      s.kamar || '-',
      a.setor,
      a.tarik,
      a.setor - a.tarik,
      a.jumlah,
      a.terakhir || '-',
    ];
  });

  const header: (string | number)[][] = [
    ['REKAP TABUNGAN SELURUH SANTRI - PESANTREN KHZM'],
    ['Tanggal Cetak', todayStr()],
    [],
    ['No', 'Nama Santri', 'Kelas', 'Kamar', 'Total Setor (Rp)', 'Total Tarik (Rp)', 'Saldo (Rp)', 'Jumlah Transaksi', 'Transaksi Terakhir'],
  ];

  const footer = [
    [],
    ['', 'TOTAL SELURUH SANTRI', '', '', sumSetor, sumTarik, sumSetor - sumTarik, sumJumlah, ''],
  ];

  const wsRekap = XLSX.utils.aoa_to_sheet([...header, ...body, ...footer]);
  setColWidths(wsRekap, [6, 32, 18, 12, 18, 18, 18, 18, 18]);
  formatCols(wsRekap, [4, 5, 6], header.length);

  // Sheet 2: seluruh mutasi (detail), supaya rekap bisa diaudit
  const namaById = new Map<string, string>(santriRows.map(s => [s.id, s.nama]));
  const detail = mutasi
    .filter(m => namaById.has(m.santri_id))
    .map((m, i) => [
      i + 1,
      m.tanggal_transaksi,
      namaById.get(m.santri_id) || '-',
      m.tipe === 'setor' ? 'Setor' : 'Tarik',
      Number(m.nominal),
      Number(m.saldo_berjalan),
      m.user_roles?.nama_lengkap || '-',
    ]);
  const wsDetail = XLSX.utils.aoa_to_sheet([
    ['No', 'Tanggal', 'Nama Santri', 'Tipe', 'Nominal (Rp)', 'Saldo Setelahnya (Rp)', 'Petugas'],
    ...detail,
  ]);
  setColWidths(wsDetail, [6, 14, 32, 10, 16, 20, 24]);
  formatCols(wsDetail, [4, 5], 1);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Santri');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Semua Mutasi');
  XLSX.writeFile(wb, `Rekap_Tabungan_Semua_Santri_${todayStr()}.xlsx`);
}
