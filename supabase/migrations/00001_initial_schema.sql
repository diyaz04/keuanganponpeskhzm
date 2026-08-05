-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. USER MANAGEMENT (Role Based Access)
-- ==========================================
-- Kita asumsikan auth.users bawaan Supabase digunakan, dan kita membuat tabel profil/role.
CREATE TABLE public.user_roles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'bendahara')),
    nama_lengkap VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. TABEL MASTER
-- ==========================================
CREATE TABLE public.kelas_pengajian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.kategori_pembayaran (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    nominal_default NUMERIC NOT NULL DEFAULT 0,
    tipe VARCHAR(20) NOT NULL CHECK (tipe IN ('rutin', 'tabungan')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.kategori_pengeluaran (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. ENTITAS UTAMA (SANTRI)
-- ==========================================
CREATE TABLE public.santri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    kelas_id UUID REFERENCES public.kelas_pengajian(id) ON DELETE RESTRICT,
    kamar VARCHAR(50),
    tempat_lahir VARCHAR(100),
    tanggal_lahir DATE,
    alamat TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'keluar')),
    tanggal_masuk DATE NOT NULL DEFAULT CURRENT_DATE,
    tanggal_keluar DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- KEPUTUSAN DESAIN: Partial index khusus santri aktif untuk query rekap yang sangat efisien
-- Semua query agregat yang men-filter "status = 'aktif'" akan menggunakan index ringan ini.
CREATE INDEX idx_santri_aktif ON public.santri(id) WHERE status = 'aktif';

-- ==========================================
-- 4. TRANSAKSI KEUANGAN
-- ==========================================
CREATE TABLE public.transaksi_masuk (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE RESTRICT,
    kategori_id UUID NOT NULL REFERENCES public.kategori_pembayaran(id) ON DELETE RESTRICT,
    nominal NUMERIC NOT NULL,
    tanggal_transaksi DATE NOT NULL DEFAULT CURRENT_DATE,
    periode_bulan INTEGER CHECK (periode_bulan BETWEEN 1 AND 12),
    periode_tahun INTEGER,
    catatan TEXT,
    input_by UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.tabungan_mutasi (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE RESTRICT,
    tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('setor', 'tarik')),
    nominal NUMERIC NOT NULL,
    saldo_berjalan NUMERIC NOT NULL,
    tanggal_transaksi DATE NOT NULL DEFAULT CURRENT_DATE,
    input_by UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.transaksi_keluar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kategori_pengeluaran_id UUID NOT NULL REFERENCES public.kategori_pengeluaran(id) ON DELETE RESTRICT,
    nominal NUMERIC NOT NULL,
    tanggal_transaksi DATE NOT NULL DEFAULT CURRENT_DATE,
    keterangan TEXT,
    input_by UUID NOT NULL REFERENCES public.user_roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. AUDIT LOG (Mencatat semua perubahan data)
-- ==========================================
CREATE TABLE public.audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id), -- User yang melakukan (berdasarkan JWT Token)
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fungsi trigger generik untuk mencatat log
CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Mengambil ID user dari konteks JWT Supabase (jika request dari API)
    -- Jika dari backend server / service role, bisa jadi null
    BEGIN
        v_user_id := (current_setting('request.jwt.claim.sub', true))::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb, v_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW)::jsonb, v_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Memasang trigger pada tabel-tabel krusial
CREATE TRIGGER audit_transaksi_masuk
AFTER INSERT OR UPDATE OR DELETE ON public.transaksi_masuk
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_tabungan_mutasi
AFTER INSERT OR UPDATE OR DELETE ON public.tabungan_mutasi
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_transaksi_keluar
AFTER INSERT OR UPDATE OR DELETE ON public.transaksi_keluar
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();


-- ==========================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas_pengajian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategori_pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategori_pengeluaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.santri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_masuk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabungan_mutasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_keluar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function untuk mengecek role admin (berbasis tabel user_roles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE id = (auth.uid()) AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function untuk mengecek role bendahara
CREATE OR REPLACE FUNCTION public.is_bendahara()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE id = (auth.uid()) AND role = 'bendahara'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function untuk mengecek apakah user adalah admin ATAU bendahara
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_admin() OR public.is_bendahara();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6.1 RLS untuk Tabel Master & Santri (Bendahara = Read, Admin = All)
CREATE POLICY "Staff can view master data and santri" ON public.kelas_pengajian FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can all on master data and santri" ON public.kelas_pengajian FOR ALL USING (public.is_admin());

CREATE POLICY "Staff can view master data and santri" ON public.kategori_pembayaran FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can all on master data and santri" ON public.kategori_pembayaran FOR ALL USING (public.is_admin());

CREATE POLICY "Staff can view master data and santri" ON public.kategori_pengeluaran FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can all on master data and santri" ON public.kategori_pengeluaran FOR ALL USING (public.is_admin());

CREATE POLICY "Staff can view master data and santri" ON public.santri FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can all on master data and santri" ON public.santri FOR ALL USING (public.is_admin());


-- 6.2 RLS untuk Transaksi (Bendahara = Insert/Select, Admin = All)
-- Transaksi Masuk
CREATE POLICY "Staff can insert and select transaksi_masuk" ON public.transaksi_masuk FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert transaksi_masuk" ON public.transaksi_masuk FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Admin can update and delete transaksi_masuk" ON public.transaksi_masuk FOR ALL USING (public.is_admin());

-- Tabungan Mutasi
CREATE POLICY "Staff can insert and select tabungan_mutasi" ON public.tabungan_mutasi FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert tabungan_mutasi" ON public.tabungan_mutasi FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Admin can update and delete tabungan_mutasi" ON public.tabungan_mutasi FOR ALL USING (public.is_admin());

-- Transaksi Keluar
CREATE POLICY "Staff can insert and select transaksi_keluar" ON public.transaksi_keluar FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert transaksi_keluar" ON public.transaksi_keluar FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Admin can update and delete transaksi_keluar" ON public.transaksi_keluar FOR ALL USING (public.is_admin());


-- 6.3 RLS untuk Audit Log (Hanya Admin yang bisa baca, tidak ada yang bisa ubah)
CREATE POLICY "Admin can view audit log" ON public.audit_log FOR SELECT USING (public.is_admin());
-- INSERT diizinkan karena dilakukan oleh Security Definer Function di atas.

-- 6.4 RLS untuk user_roles (Staff bisa lihat dirinya dan orang lain, Admin bisa edit)
CREATE POLICY "Staff can read all roles" ON public.user_roles FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can edit roles" ON public.user_roles FOR ALL USING (public.is_admin());
