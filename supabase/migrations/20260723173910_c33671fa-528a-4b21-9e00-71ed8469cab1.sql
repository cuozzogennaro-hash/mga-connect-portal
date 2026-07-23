
-- Promozioni: authenticated read, admin write
CREATE POLICY "promozioni_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'promozioni');
CREATE POLICY "promozioni_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'promozioni' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "promozioni_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'promozioni' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "promozioni_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'promozioni' AND public.has_role(auth.uid(), 'admin'));

-- Scontrini: operatore/admin insert, cliente vede propri (via cartella con user_id del cliente), admin/operatore vedono tutto
CREATE POLICY "scontrini_operator_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scontrini'
    AND (public.has_role(auth.uid(), 'operatore_preparazione') OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "scontrini_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'scontrini'
    AND (
      public.has_role(auth.uid(), 'operatore_preparazione')
      OR public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Bolle: cliente vede la propria cartella (userId/...), admin tutto e write
CREATE POLICY "bolle_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bolle'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
CREATE POLICY "bolle_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bolle' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bolle_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bolle' AND public.has_role(auth.uid(), 'admin'));
