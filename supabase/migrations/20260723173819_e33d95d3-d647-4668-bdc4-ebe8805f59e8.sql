
-- Enums
CREATE TYPE public.app_role AS ENUM ('cliente_b2b', 'operatore_preparazione', 'admin');
CREATE TYPE public.ordine_stato AS ENUM ('nuovo', 'scontrinato', 'evaso', 'annullato');
CREATE TYPE public.pagamento_stato AS ENUM ('in_attesa', 'pagato');

-- Utility function updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nome TEXT,
  ragione_sociale TEXT,
  partita_iva TEXT,
  referente TEXT,
  telefono TEXT,
  indirizzo_consegna TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Users can see own role rows
CREATE POLICY "user_roles_self_select" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- profiles policies
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operatore_preparazione'));
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- handle_new_user: create profile + assign role from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, nome, ragione_sociale, partita_iva, referente, telefono, indirizzo_consegna)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'nome',
    NEW.raw_user_meta_data ->> 'ragione_sociale',
    NEW.raw_user_meta_data ->> 'partita_iva',
    NEW.raw_user_meta_data ->> 'referente',
    NEW.raw_user_meta_data ->> 'telefono',
    NEW.raw_user_meta_data ->> 'indirizzo_consegna'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Default role from metadata, fallback cliente_b2b
  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'cliente_b2b');
  EXCEPTION WHEN others THEN
    _role := 'cliente_b2b';
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- promozioni
CREATE TABLE public.promozioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  prezzo_promo NUMERIC(10,2),
  foto_url TEXT,
  valida_da DATE,
  valida_al DATE,
  attiva BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promozioni TO authenticated;
GRANT ALL ON public.promozioni TO service_role;
ALTER TABLE public.promozioni ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_promozioni_updated BEFORE UPDATE ON public.promozioni
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "promozioni_authenticated_read" ON public.promozioni
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "promozioni_admin_all" ON public.promozioni
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ordini
CREATE TABLE public.ordini (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stato public.ordine_stato NOT NULL DEFAULT 'nuovo',
  data_ritiro TIMESTAMPTZ,
  note TEXT,
  scontrino_url TEXT,
  ocr_data JSONB,
  ocr_totale NUMERIC(10,2),
  ocr_iva NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordini TO authenticated;
GRANT ALL ON public.ordini TO service_role;
ALTER TABLE public.ordini ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ordini_updated BEFORE UPDATE ON public.ordini
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "ordini_cliente_select_own" ON public.ordini
  FOR SELECT TO authenticated USING (
    cliente_id = auth.uid()
    OR public.has_role(auth.uid(), 'operatore_preparazione')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "ordini_cliente_insert_own" ON public.ordini
  FOR INSERT TO authenticated WITH CHECK (cliente_id = auth.uid() AND public.has_role(auth.uid(), 'cliente_b2b'));
CREATE POLICY "ordini_operator_admin_update" ON public.ordini
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'operatore_preparazione') OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "ordini_admin_delete" ON public.ordini
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ordini_righe
CREATE TABLE public.ordini_righe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordine_id UUID NOT NULL REFERENCES public.ordini(id) ON DELETE CASCADE,
  posizione INT NOT NULL DEFAULT 0,
  quantita TEXT,
  descrizione TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordini_righe TO authenticated;
GRANT ALL ON public.ordini_righe TO service_role;
ALTER TABLE public.ordini_righe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordini_righe_select" ON public.ordini_righe
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ordini o WHERE o.id = ordine_id AND (
      o.cliente_id = auth.uid()
      OR public.has_role(auth.uid(), 'operatore_preparazione')
      OR public.has_role(auth.uid(), 'admin')
    ))
  );
CREATE POLICY "ordini_righe_insert" ON public.ordini_righe
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.ordini o WHERE o.id = ordine_id AND o.cliente_id = auth.uid())
  );
CREATE POLICY "ordini_righe_admin_all" ON public.ordini_righe
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- bolle (DDT)
CREATE TABLE public.bolle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL,
  anno INT NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INT,
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ordine_id UUID REFERENCES public.ordini(id) ON DELETE SET NULL,
  totale NUMERIC(10,2) NOT NULL DEFAULT 0,
  iva NUMERIC(10,2) NOT NULL DEFAULT 0,
  imponibile NUMERIC(10,2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  stato_pagamento public.pagamento_stato NOT NULL DEFAULT 'in_attesa',
  pagato_il TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(numero, anno)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolle TO authenticated;
GRANT ALL ON public.bolle TO service_role;
ALTER TABLE public.bolle ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_bolle_updated BEFORE UPDATE ON public.bolle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "bolle_cliente_select" ON public.bolle
  FOR SELECT TO authenticated USING (
    cliente_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "bolle_admin_all" ON public.bolle
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- bolle_righe
CREATE TABLE public.bolle_righe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bolla_id UUID NOT NULL REFERENCES public.bolle(id) ON DELETE CASCADE,
  posizione INT NOT NULL DEFAULT 0,
  descrizione TEXT NOT NULL,
  quantita NUMERIC(10,3),
  prezzo NUMERIC(10,2),
  iva_perc NUMERIC(5,2) DEFAULT 22,
  totale_riga NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolle_righe TO authenticated;
GRANT ALL ON public.bolle_righe TO service_role;
ALTER TABLE public.bolle_righe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bolle_righe_select" ON public.bolle_righe
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bolle b WHERE b.id = bolla_id AND (
      b.cliente_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    ))
  );
CREATE POLICY "bolle_righe_admin_all" ON public.bolle_righe
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sequence helper for progressive numero
CREATE OR REPLACE FUNCTION public.next_bolla_numero(_anno INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _n INT;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO _n FROM public.bolle WHERE anno = _anno;
  RETURN _n;
END;
$$;

-- Realtime for ordini
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordini;
