-- Migration: Izinkan Bendahara mengedit Transaksi Keluar

-- Tambahkan policy agar Staff (termasuk Bendahara) bisa melakukan UPDATE di transaksi_keluar
-- Karena sebelumnya Bendahara hanya punya akses SELECT dan INSERT.
CREATE POLICY "Staff can update transaksi_keluar" 
ON public.transaksi_keluar 
FOR UPDATE 
USING (public.is_staff()) 
WITH CHECK (public.is_staff());
