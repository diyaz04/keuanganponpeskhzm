-- Migration: Izinkan Bendahara mengedit Transaksi Masuk

CREATE POLICY "Staff can update transaksi_masuk" 
ON public.transaksi_masuk 
FOR UPDATE 
USING (public.is_staff()) 
WITH CHECK (public.is_staff());
