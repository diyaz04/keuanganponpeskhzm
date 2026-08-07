-- ==========================================
-- UPDATE SCHEMA: Vendor Split for Kategori Pembayaran
-- ==========================================

-- 1. Tambahkan kolom vendor_list pada kategori_pembayaran (Tipe Data JSONB)
-- Menyimpan list string nama vendor, misal: '["Vendor A", "Vendor B"]'
ALTER TABLE public.kategori_pembayaran 
ADD COLUMN vendor_list JSONB;

-- 2. Tambahkan kolom vendor_terpilih pada transaksi_masuk
ALTER TABLE public.transaksi_masuk
ADD COLUMN vendor_terpilih VARCHAR(100);

-- 3. Tambahkan kolom vendor_terpilih pada transaksi_keluar
ALTER TABLE public.transaksi_keluar
ADD COLUMN vendor_terpilih VARCHAR(100);
