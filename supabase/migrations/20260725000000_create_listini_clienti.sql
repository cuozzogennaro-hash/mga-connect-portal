-- Migration: Creazione tabella listini_clienti per i prezzi riservati B2B
CREATE TABLE IF NOT EXISTS public.listini_clienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descrizione_prodotto TEXT NOT NULL,
  prezzo NUMERIC(10,2) NOT NULL,
  unita_misura TEXT DEFAULT 'kg',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indici per performance su cliente_id
CREATE INDEX IF NOT EXISTS idx_listini_clienti_cliente ON public.listini_clienti(cliente_id);

-- Abilitazione Row Level Security (RLS)
ALTER TABLE public.listini_clienti ENABLE ROW LEVEL SECURITY;

-- Policy di lettura: Operatori, Admin e il Cliente titolare possono leggere il listino
CREATE POLICY "Lettura listini clienti per utenti autenticati"
  ON public.listini_clienti FOR SELECT
  TO authenticated
  USING (true);

-- Policy di scrittura: Solo gli amministratori possono inserire/modificare/eliminare voci di listino
CREATE POLICY "Gestione listini per admin"
  ON public.listini_clienti FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
