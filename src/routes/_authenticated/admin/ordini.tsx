import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminOcrScontrino, adminGeneraDDT } from "@/lib/admin.functions";
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

export const Route = createFileRoute("/_authenticated/admin/ordini")({
  head: () => ({ meta: [{ title: "Ordini & OCR — MGA Admin" }, { name: "robots", content: "noindex" }] }),
  component: OrdiniAdmin,
});

type Ordine = {
  id: string;
  stato: string;
  created_at: string;
  scontrino_url: string | null;
  ocr_totale: number | null;
  ocr_iva: number | null;
  ocr_data: unknown;
  profiles: { ragione_sociale: string | null; partita_iva: string | null } | null;
};

function OrdiniAdmin() {
  const { role } = useRequireRole("admin");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const ocr = useServerFn(adminOcrScontrino);
  const gen = useServerFn(adminGeneraDDT);

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select(
        "id, stato, created_at, scontrino_url, ocr_totale, ocr_iva, ocr_data, profiles:cliente_id(ragione_sociale, partita_iva)",
      )
      .order("created_at", { ascending: false });
    setOrdini((data ?? []) as unknown as Ordine[]);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function runOcr(id: string) {
    setBusy(id);
    try {
      await ocr({ data: { ordineId: id } });
      toast.success("OCR completato");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore OCR");
    } finally {
      setBusy(null);
    }
  }
  async function runDdt(id: string) {
    setBusy(id);
    try {
      const r = await gen({ data: { ordineId: id } });
      toast.success(`DDT n. ${r.numero}/${r.anno} generato`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore DDT");
    } finally {
      setBusy(null);
    }
  }

  if (!role) return null;
  return (
    <AppShell title="Ordini & OCR" role="Admin" nav={adminNav}>
      <div className="space-y-3">
        {ordini.map((o) => (
          <div key={o.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg font-semibold">
                  {o.profiles?.ragione_sociale ?? "Cliente"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {o.profiles?.partita_iva && `P.IVA ${o.profiles.partita_iva} · `}
                  {new Date(o.created_at).toLocaleString("it-IT")}
                </p>
                {o.ocr_totale != null && (
                  <p className="mt-1 text-sm">
                    Totale OCR: <strong>€ {Number(o.ocr_totale).toFixed(2)}</strong>
                    {o.ocr_iva != null && ` · IVA € ${Number(o.ocr_iva).toFixed(2)}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge>{o.stato}</Badge>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!o.scontrino_url || busy === o.id}
                    onClick={() => runOcr(o.id)}
                  >
                    {busy === o.id ? "…" : "Analizza scontrino"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!o.ocr_data || busy === o.id}
                    onClick={() => runDdt(o.id)}
                  >
                    Genera DDT
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {ordini.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun ordine presente.</p>
        )}
      </div>
    </AppShell>
  );
}
