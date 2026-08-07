-- Menambahkan trigger audit log ke semua tabel utama yang belum ter-cover

CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_kelas_pengajian
AFTER INSERT OR UPDATE OR DELETE ON public.kelas_pengajian
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_kategori_pembayaran
AFTER INSERT OR UPDATE OR DELETE ON public.kategori_pembayaran
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_kategori_pengeluaran
AFTER INSERT OR UPDATE OR DELETE ON public.kategori_pengeluaran
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_santri
AFTER INSERT OR UPDATE OR DELETE ON public.santri
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_kas_pesantren_mutasi
AFTER INSERT OR UPDATE OR DELETE ON public.kas_pesantren_mutasi
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();
