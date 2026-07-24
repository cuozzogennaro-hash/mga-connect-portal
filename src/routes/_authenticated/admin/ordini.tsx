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
import { Eye, FileText, Image as ImageIcon } from "lucide-react";

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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const ocr = useServerFn(adminOcrScontrino);
  const gen = useServerFn(adminGeneraDDT);

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select(
        "id, stato, created_at, scontrino_url, ocr_totale, ocr_iva, ocr_data, profiles:cliente_id(ragione_sociale, partita_iva)",
      )
      .order("created_at", { ascending: false });
    const list = (data ?? []) as unknown as Ordine[];
    setOrdini(list);

    // Carica gli URL firmati riservati per l'Admin
    const urls: Record<string, string> = {};
    await Promise.all(
      list
        .filter((o) => o.scontrino_url)
        .map(async (o) => {
          const { data: s } = await supabase.storage.from("scontrini").createSignedUrl(o.scontrino_url!, 3600);
          if (s?.signedUrl) urls[o.id] = s.signedUrl;
        }),
    );
    setSignedUrls(urls);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function runOcr(id: string) {
    setBusy(id);
    try {
      await ocr({ data: { ordineId: id } });
      toast.success("OCR completato con successo");
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
      <p className="mb-6 text-muted-foreground">
        Visualizza le foto degli scontrini caricate dagli operatori (riservate esclusivamente all'amministrazione), esegui l'OCR ed emetti il DDT.
      </p>
      <div className="space-y-4">
        {ordini.map((o) => {
          const isCompleto = o.stato === "scontrinato" || o.stato === "completo";
          return (
            <div key={o.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-semibold">
                      {o.profiles?.ragione_sociale ?? "Cliente"}
                    </h3>
                    <Badge variant={isCompleto ? "outline" : "default"} className={isCompleto ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400" : "bg-blue-600 text-white"}>
                      {isCompleto ? "Completo" : "Presa in carico"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {o.profiles?.partita_iva && `P.IVA ${o.profiles.partita_iva} · `}
                    Inviato il {new Date(o.created_at).toLocaleString("it-IT")}
                  </p>
                  {o.ocr_totale != null && (
                    <p className="mt-2 text-sm bg-muted/50 p-2 rounded-md inline-block">
                      Totale Scontrino OCR: <strong className="text-foreground">€ {Number(o.ocr_totale).toFixed(2)}</strong>
                      {o.ocr_iva != null && ` · IVA € ${Number(o.ocr_iva).toFixed(2)}`}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap gap-2">
                    {signedUrls[o.id] && (
                      <Button
                        size="sm"
                        variant="secondary"
                        asChild
                      >
                        <a href={signedUrls[o.id]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                          <Eye className="h-4 w-4" /> Vedi Foto Scontrino
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!o.scontrino_url || busy === o.id}
                      onClick={() => runOcr(o.id)}
                    >
                      {busy === o.id ? "Analisi…" : "Analizza Scontrino (OCR)"}
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
          );
        })}
        {ordini.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun ordine presente.</p>
        )}
      </div>
    </AppShell>
  );
}

