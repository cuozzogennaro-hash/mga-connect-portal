import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getSignedFileUrl } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Download, CheckCircle2, Clock, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cliente/contabilita")({
  head: () => ({
    meta: [
      { title: "Contabilità — MGA Connect" },
      { name: "description", content: "Consulta le tue bolle di accompagnamento (DDT), gli importi in sospeso e lo stato dei pagamenti." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContabilitaCliente,
});

type Bolla = {
  id: string;
  numero: number;
  anno: number;
  totale: number;
  iva: number;
  imponibile: number;
  stato_pagamento: string;
  pdf_url: string | null;
  created_at: string;
};

const clientNav = [
  { to: "/cliente", label: "Promozioni" },
  { to: "/cliente/ordini", label: "I miei ordini" },
  { to: "/cliente/contabilita", label: "Contabilità" },
];

function ContabilitaCliente() {
  const { role } = useRequireRole("cliente_b2b");
  const [bolle, setBolle] = useState<Bolla[]>([]);
  const [loading, setLoading] = useState(true);
  const signUrl = useServerFn(getSignedFileUrl);

  async function refresh() {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;

    const { data } = await supabase
      .from("bolle")
      .select("id, numero, anno, totale, iva, imponibile, stato_pagamento, pdf_url, created_at")
      .eq("cliente_id", uid)
      .order("created_at", { ascending: false });

    setBolle((data ?? []) as unknown as Bolla[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();

    // Subscription Realtime: aggiorna istantaneamente quando l'Admin segna la bolla come pagata
    const channel = supabase
      .channel("bolle-cliente-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bolle" }, () => refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function scaricaPdf(b: Bolla) {
    if (!b.pdf_url) {
      toast.error("Documento PDF non ancora disponibile");
      return;
    }
    try {
      const r = await signUrl({ data: { path: b.pdf_url, bucket: "bolle" } });
      window.open(r.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile aprire il documento");
    }
  }

  // Calcolo saldo in sospeso ed importi saldati
  const bolleInSospeso = bolle.filter((b) => b.stato_pagamento !== "pagato");
  const bolleSaldate = bolle.filter((b) => b.stato_pagamento === "pagato");

  const totaleInSospeso = bolleInSospeso.reduce((sum, b) => sum + Number(b.totale), 0);
  const totaleSaldato = bolleSaldate.reduce((sum, b) => sum + Number(b.totale), 0);

  if (!role) return null;
  return (
    <AppShell title="Contabilità & Documenti" role="Cliente" nav={clientNav}>
      <p className="mb-6 text-muted-foreground">
        Estratto conto e riepilogo delle bolle di accompagnamento (DDT). Consulta l'importo totale in sospeso e scarica le copie PDF delle tue consegne.
      </p>

      {/* CARDS RIEPILOGO CONTABILE */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Totale In Sospeso (Da Saldare)
            </p>
            <h2 className={`font-serif text-4xl font-bold mt-2 ${totaleInSospeso > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              € {totaleInSospeso.toFixed(2)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {totaleInSospeso > 0
                ? `${bolleInSospeso.length} ${bolleInSospeso.length === 1 ? "documento in sospeso" : "documenti in sospeso"}`
                : "Tutte le bolle risultano saldate!"}
            </p>
          </div>
          <div className={`p-4 rounded-full ${totaleInSospeso > 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
            <Wallet className="h-8 w-8" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Totale Documenti Saldati
            </p>
            <h2 className="font-serif text-3xl font-semibold mt-2 text-foreground">
              € {totaleSaldato.toFixed(2)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {bolleSaldate.length} {bolleSaldate.length === 1 ? "documento regolato" : "documenti regolati"}
            </p>
          </div>
          <div className="p-4 rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* ELENCO DOCUMENTI / BOLLE */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="font-serif text-2xl font-semibold mb-4">Documenti di Trasporto (DDT)</h3>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Caricamento estratti conto…</p>
        ) : bolle.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            Nessun documento contabile o DDT emesso al momento.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {bolle.map((b) => {
              const isPagato = b.stato_pagamento === "pagato";
              return (
                <div key={b.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-muted text-foreground mt-0.5">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-base">
                        DDT n. {b.numero}/{b.anno}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Emesso il {new Date(b.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        {b.imponibile != null && ` · Imponibile € ${Number(b.imponibile).toFixed(2)} + IVA € ${Number(b.iva).toFixed(2)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="font-serif text-lg font-bold text-foreground block">
                        € {Number(b.totale).toFixed(2)}
                      </span>
                      {isPagato ? (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Saldata
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300">
                          <Clock className="h-3 w-3 mr-1 text-amber-600" /> In sospeso
                        </Badge>
                      )}
                    </div>

                    {b.pdf_url && (
                      <Button variant="outline" size="sm" onClick={() => scaricaPdf(b)} className="flex items-center gap-1.5">
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
