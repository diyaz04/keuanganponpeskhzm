-- ==========================================
-- SEED DATA DUMMY (SISTEM KEUANGAN PESANTREN)
-- ==========================================

-- Pastikan extension uuid tersedia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
    -- Variabel penyimpan ID untuk dipakai berulang
    admin_id UUID := '00000000-0000-0000-0000-000000000001';
    bendahara_id UUID := '00000000-0000-0000-0000-000000000002';
    
    kelas_ula UUID := uuid_generate_v4();
    kelas_wustho UUID := uuid_generate_v4();
    kelas_ulya UUID := uuid_generate_v4();

    kat_spp UUID := uuid_generate_v4();
    kat_makan UUID := uuid_generate_v4();
    kat_listrik UUID := uuid_generate_v4();
    kat_kegiatan UUID := uuid_generate_v4();
    kat_tabungan UUID := uuid_generate_v4();

    kat_pengeluaran_listrik UUID := uuid_generate_v4();
    kat_pengeluaran_makan UUID := uuid_generate_v4();
    kat_pengeluaran_honor UUID := uuid_generate_v4();

    s_id_1 UUID := uuid_generate_v4();
    s_id_2 UUID := uuid_generate_v4();
    s_id_3 UUID := uuid_generate_v4();
    s_id_4 UUID := uuid_generate_v4();
    s_id_5 UUID := uuid_generate_v4();
    s_id_6 UUID := uuid_generate_v4();
    s_id_7 UUID := uuid_generate_v4();
    s_id_8 UUID := uuid_generate_v4();
    s_id_9 UUID := uuid_generate_v4();
    s_id_10 UUID := uuid_generate_v4();
    s_id_11 UUID := uuid_generate_v4();
    s_id_12 UUID := uuid_generate_v4();
    s_id_13 UUID := uuid_generate_v4();
    s_id_14 UUID := uuid_generate_v4();
    s_id_15 UUID := uuid_generate_v4();

BEGIN

-- 1. SEED USER ROLES
-- Catatan: Di Supabase sungguhan, tabel auth.users harus ada terlebih dahulu. 
-- Karena seed ini berjalan lokal, kita abaikan constraint auth.users atau pastikan Anda membuat auth users lewat UI.
-- Jika error constraint foreign key terjadi pada lokal, hapus baris ini, dan buat user via Auth UI, lalu insert manual ke user_roles.
-- INSERT INTO public.user_roles (id, role, nama_lengkap) VALUES 
--     (admin_id, 'admin', 'Administrator KHZM'),
--     (bendahara_id, 'bendahara', 'Ustadz Bendahara');

-- 2. SEED KELAS PENGAJIAN
INSERT INTO public.kelas_pengajian (id, nama, is_active) VALUES
    (kelas_ula, 'Kelas Ula (Dasar)', true),
    (kelas_wustho, 'Kelas Wustho (Menengah)', true),
    (kelas_ulya, 'Kelas Ulya (Atas)', true);

-- 3. SEED KATEGORI PEMBAYARAN (5 Kategori)
INSERT INTO public.kategori_pembayaran (id, nama, nominal_default, tipe, is_active) VALUES
    (kat_spp, 'SPP / Syahriyah', 100000, 'rutin', true),
    (kat_makan, 'Uang Makan (Katering)', 350000, 'rutin', true),
    (kat_listrik, 'Iuran Listrik & Fasilitas', 50000, 'rutin', true),
    (kat_kegiatan, 'Dana Ekstrakurikuler', 25000, 'rutin', true),
    (kat_tabungan, 'Tabungan Santri', 0, 'tabungan', true);

-- 4. SEED KATEGORI PENGELUARAN (3 Kategori)
INSERT INTO public.kategori_pengeluaran (id, nama, is_active) VALUES
    (kat_pengeluaran_listrik, 'Bayar Listrik PLN & Air', true),
    (kat_pengeluaran_makan, 'Belanja Dapur / Katering', true),
    (kat_pengeluaran_honor, 'Bisyaroh / Honor Asatidz', true);

-- 5. SEED 15 SANTRI (Beberapa aktif, beberapa keluar)
INSERT INTO public.santri (id, nama, kelas_id, kamar, tempat_lahir, tanggal_lahir, alamat, status, tanggal_masuk, tanggal_keluar) VALUES
    (s_id_1, 'Ahmad Fathan', kelas_ula, 'Kamar A-01', 'Bandung', '2005-04-12', 'Jl. Merdeka 1, Bandung', 'aktif', '2022-07-15', NULL),
    (s_id_2, 'Budi Santoso', kelas_wustho, 'Kamar A-02', 'Jakarta', '2004-08-20', 'Jl. Sudirman, Jakarta', 'aktif', '2021-07-10', NULL),
    (s_id_3, 'Chairil Anwar', kelas_ulya, 'Kamar B-01', 'Surabaya', '2003-02-15', 'Jl. Pahlawan, Surabaya', 'aktif', '2020-07-20', NULL),
    (s_id_4, 'Dani Ramadhan', kelas_ula, 'Kamar A-03', 'Semarang', '2006-01-10', 'Jl. Ahmad Yani, Semarang', 'aktif', '2023-07-15', NULL),
    (s_id_5, 'Eko Prasetyo', kelas_wustho, 'Kamar B-02', 'Yogyakarta', '2004-11-05', 'Jl. Malioboro, Jogja', 'aktif', '2021-07-10', NULL),
    (s_id_6, 'Fauzan Hidayat', kelas_ulya, 'Kamar C-01', 'Malang', '2003-09-30', 'Jl. Ijen, Malang', 'keluar', '2020-07-20', '2023-12-01'),
    (s_id_7, 'Gatot Kaca', kelas_ula, 'Kamar A-01', 'Solo', '2005-06-18', 'Jl. Slamet Riyadi, Solo', 'aktif', '2022-07-15', NULL),
    (s_id_8, 'Hasan Basri', kelas_wustho, 'Kamar B-03', 'Medan', '2004-03-25', 'Jl. Gatot Subroto, Medan', 'aktif', '2021-07-10', NULL),
    (s_id_9, 'Iqbal Ramadhan', kelas_ulya, 'Kamar C-02', 'Makassar', '2003-07-12', 'Jl. Pettarani, Makassar', 'aktif', '2020-07-20', NULL),
    (s_id_10, 'Joko Widodo', kelas_ula, 'Kamar A-02', 'Solo', '2006-05-01', 'Jl. Sudirman, Solo', 'keluar', '2023-07-15', '2024-01-15'),
    (s_id_11, 'Kurniawan Dwi', kelas_wustho, 'Kamar B-01', 'Malang', '2004-12-20', 'Jl. Sukarno Hatta, Malang', 'aktif', '2021-07-10', NULL),
    (s_id_12, 'Lukman Hakim', kelas_ulya, 'Kamar C-01', 'Surabaya', '2003-04-08', 'Jl. Diponegoro, Surabaya', 'aktif', '2020-07-20', NULL),
    (s_id_13, 'Muhammad Al Fatih', kelas_ula, 'Kamar A-03', 'Jakarta', '2005-10-10', 'Jl. Thamrin, Jakarta', 'aktif', '2022-07-15', NULL),
    (s_id_14, 'Naufal Zaki', kelas_wustho, 'Kamar B-02', 'Bandung', '2004-01-15', 'Jl. Braga, Bandung', 'keluar', '2021-07-10', '2023-06-30'),
    (s_id_15, 'Oemar Said', kelas_ulya, 'Kamar C-02', 'Yogyakarta', '2003-08-22', 'Jl. Kaliurang, Jogja', 'aktif', '2020-07-20', NULL);

-- NOTA: Karena tabel transaksi dan mutasi tabungan butuh input_by yang berelasi ke user_roles,
-- dan seed ini mungkin dijalankan SEBELUM user dibuat di sistem auth Supabase asli, 
-- kita tidak insert transaksi dummy di sini untuk menghindari error "foreign key constraint fails".
-- Jika ingin insert transaksi dummy, pastikan data user_roles (input_by) tersedia lebih dulu.

END $$;
