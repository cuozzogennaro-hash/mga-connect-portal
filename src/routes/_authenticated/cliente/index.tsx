import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/cliente/")({
  head: () => ({
    meta: [
      { title: "Promozioni B2B — MGA Connect" },
      { name: "description", content: "Sfoglia le promozioni settimanali riservate ai clienti B2B di M.G.A. Alimentari Cuozzo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClienteHome,
});

type Promo = {
  id: string;
  titolo: string;
  descrizione: string | null;
  prezzo_promo: number | null;
  valida_da: string | null;
  valida_al: string | null;
  foto_url: string | null;
};

function ClienteHome() {
  const { role } = useRequireRole("cliente_b2b");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("promozioni")
        .select("id, titolo, descrizione, prezzo_promo, valida_da, valida_al, foto_url")
        .eq("attiva", true)
        .or(`valida_al.is.null,valida_al.gte.${today}`)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      const list = (data ?? []) as Promo[];
      setPromos(list);
      setLoading(false);
      const urls: Record<string, string> = {};
      await Promise.all(
        list
          .filter((p) => p.foto_url)
          .map(async (p) => {
            const { data: s } = await supabase.storage.from("promozioni").createSignedUrl(p.foto_url!, 600);
            if (s?.signedUrl) urls[p.id] = s.signedUrl;
          }),
      );
      if (mounted) setImgUrls(urls);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!role) return null;
  return (
    <AppShell
      title="Promozioni della settimana"
      role="Cliente"
      nav={[
        { to: "/cliente", label: "Promozioni" },
        { to: "/cliente/ordini", label: "I miei ordini" },
        { to: "/cliente/contabilita", label: "Contabilità" },
      ]}
    >
      <div className="mb-6 flex items-center justify-between">
        <p className="text-muted-foreground">Offerte riservate agli operatori commerciali B2B.</p>
        <Button asChild>
          <Link to="/cliente/ordini">Nuovo ordine</Link>
        </Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Caricamento…</p>
      ) : promos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          Nessuna promozione attiva al momento. Torna a trovarci a breve.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {imgUrls[p.id] ? (
                <img src={imgUrls[p.id]} alt={p.titolo} className="h-44 w-full object-cover" />
              ) : (
                <div className="h-44 w-full bg-muted" />
              )}
              <div className="p-5">
                <h3 className="font-serif text-xl font-semibold text-primary">{p.titolo}</h3>
                {p.descrizione && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.descrizione}</p>}
                <div className="mt-3 flex items-center justify-between">
                  {p.prezzo_promo != null && (
                    <span className="text-lg font-semibold">€ {Number(p.prezzo_promo).toFixed(2)}</span>
                  )}
                  {p.valida_al && (
                    <Badge variant="secondary">fino al {new Date(p.valida_al).toLocaleDateString("it-IT")}</Badge>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
