-- Script untuk menjadikan email adminkeuangankhzm@gmail.com sebagai Admin Utama (Superadmin)
-- Jalankan ini di SQL Editor Supabase!

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Cari ID user berdasarkan email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'adminkeuangankhzm@gmail.com';

    -- 2. Jika user ditemukan, jadikan Admin
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (id, role, nama_lengkap)
        VALUES (target_user_id, 'admin', 'Superadmin KHZM')
        ON CONFLICT (id) 
        DO UPDATE SET role = 'admin', nama_lengkap = 'Superadmin KHZM';
        
        RAISE NOTICE 'Sukses! Email adminkeuangankhzm@gmail.com sekarang adalah Admin.';
    ELSE
        -- 3. Jika belum mendaftar, beri peringatan
        RAISE EXCEPTION 'Gagal: Email adminkeuangankhzm@gmail.com belum terdaftar. Silakan Sign Up di aplikasi terlebih dahulu, baru jalankan script ini.';
    END IF;
END $$;
