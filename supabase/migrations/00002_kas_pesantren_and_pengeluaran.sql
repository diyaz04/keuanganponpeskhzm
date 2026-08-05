-- ==========================================
-- UPDATE SCHEMA: Fund Accounting & Kas Pesantren
-- ==========================================

-- 1. Modifikasi tabel transaksi_keluar
-- Menambahkan relasi sumber dana ke kategori_pembayaran
ALTER TABLE public.transaksi_keluar 
ADD COLUMN sumber_dana_id UUID REFERENCES public.kategori_pembayaran(id) ON DELETE RESTRICT;

-- Menambahkan kolom periode ke transaksi keluar agar pengeluaran terikat ke bulan anggaran tertentu
ALTER TABLE public.transaksi_keluar
ADD COLUMN periode_bulan INTEGER CHECK (periode_bulan BETWEEN 1 AND 12);

ALTER TABLE public.transaksi_keluar
ADD COLUMN periode_tahun INTEGER;

-- 2. Tabel Kas Pesantren
-- Menyimpan riwayat uang kas (termasuk hasil sweeping akhir bulan)
CREATE TABLE public.kas_pesantren_mutasi (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('masuk', 'keluar')),
    nominal NUMERIC NOT NULL,
    sumber_kategori_id UUID REFERENCES public.kategori_pembayaran(id) ON DELETE SET NULL, -- Null berarti mutasi kas umum non-sweeping
    periode_bulan INTEGER,
    periode_tahun INTEGER,
    keterangan TEXT,
    input_by UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Kas Pesantren
ALTER TABLE public.kas_pesantren_mutasi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kas Pesantren viewable by all staff"
ON public.kas_pesantren_mutasi FOR SELECT USING (is_admin() OR is_bendahara());

CREATE POLICY "Kas Pesantren insertable by staff"
ON public.kas_pesantren_mutasi FOR INSERT WITH CHECK (is_admin() OR is_bendahara());
