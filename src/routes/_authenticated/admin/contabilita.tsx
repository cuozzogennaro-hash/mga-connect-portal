import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminSetPagamento, getSignedFileUrl } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const adminNav = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/utenti", label: "Utenti" },
  { to: "/admin/promozioni", label: "Promozioni" },
  { to: "/admin/ordini", label: "Ordini & OCR" },
  { to: "/admin/contabilita", label: "Contabilità" },
];

export const Route = createFileRoute("/_authenticated/admin/contabilita")({
  head: () => ({ meta: [{ title: "Contabilità — MGA Admin" }, { name: "robots", content: "noindex" }] }),
  component: ContabilitaAdmin,
});

type Bolla = {
  id: string;
  numero: number;
  anno: number;
  totale: number;
  iva: number;
  stato_pagamento: string;
  pdf_url: string | null;
  created_at: string;
  cliente_id: string;
  profiles: { ragione_sociale: string | null; partita_iva: string | null } | null;
};

function ContabilitaAdmin() {
  const { role } = useRequireRole("admin");
  const [bolle, setBolle] = useState<Bolla[]>([]);
  const setPag = useServerFn(adminSetPagamento);
  const signUrl = useServerFn(getSignedFileUrl);

  async function refresh() {
    const { data } = await supabase
      .from("bolle")
      .select(
        "id, numero, anno, totale, iva, stato_pagamento, pdf_url, created_at, cliente_id, profiles:cliente_id(ragione_sociale, partita_iva)",
      )
      .order("anno", { ascending: false })
      .order("numero", { ascending: false });
    setBolle((data ?? []) as unknown as Bolla[]);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function togglePag(b: Bolla) {
    try {
      await setPag({
        data: { bollaId: b.id, stato: b.stato_pagamento === "pagato" ? "in_attesa" : "pagato" },
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }
  async function scarica(b: Bolla) {
    if (!b.pdf_url) return;
    try {
      const r = await signUrl({ data: { path: b.pdf_url, bucket: "bolle" } });
      window.open(r.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  const raggr = new Map<string, Bolla[]>();
  for (const b of bolle) {
    const k = b.profiles?.partita_iva ?? b.cliente_id;
    if (!raggr.has(k)) raggr.set(k, []);
    raggr.get(k)!.push(b);
  }

  if (!role) return null;
  return (
    <AppShell title="Contabilità clienti" role="Admin" nav={adminNav}>
      <div className="space-y-6">
        {Array.from(raggr.entries()).map(([piva, list]) => {
          const dovuto = list
            .filter((b) => b.stato_pagamento !== "pagato")
            .reduce((s, b) => s + Number(b.totale), 0);
          const cliente = list[0].profiles?.ragione_sociale ?? "Cliente";
          return (
            <section key={piva} className="rounded-xl border border-border bg-card p-6">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl font-semibold">{cliente}</h2>
                  <p className="text-xs text-muted-foreground">P.IVA {piva}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Dovuto</p>
                  <p className="font-serif text-2xl font-semibold text-primary">€ {dovuto.toFixed(2)}</p>
                </div>
              </header>
              <div className="mt-4 divide-y divide-border">
                {list.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">
                        DDT n. {b.numero}/{b.anno}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString("it-IT")} · Totale € {Number(b.totale).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={b.stato_pagamento === "pagato" ? "default" : "secondary"}>
                        {b.stato_pagamento === "pagato" ? "Pagato" : "In attesa"}
                      </Badge>
                      {b.pdf_url && (
                        <Button variant="outline" size="sm" onClick={() => scarica(b)}>
                          PDF
                        </Button>
                      )}
                      <Button size="sm" onClick={() => togglePag(b)}>
                        {b.stato_pagamento === "pagato" ? "Segna non pagato" : "Segna pagato"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {bolle.length === 0 && <p className="text-sm text-muted-foreground">Nessuna bolla emessa.</p>}
      </div>
    </AppShell>
  );
}
