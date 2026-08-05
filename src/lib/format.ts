export const formatRupiah = (angka: number | string): string => {
  const num = typeof angka === 'string' ? parseInt(angka.replace(/[^0-9]/g, ''), 10) : angka;
  if (isNaN(num)) return '0';
  return num.toLocaleString('id-ID');
};

export const parseRupiah = (text: string): number => {
  const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
};

export const formatBulan = (bulan: number): string => {
  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return namaBulan[bulan - 1] || '-';
};
