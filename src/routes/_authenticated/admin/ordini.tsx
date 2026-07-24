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
import { Eye, Clock, PackageCheck, CheckCircle2, FileText, XCircle, ChevronDown, ChevronUp, MapPin, Phone, User, Calendar } from "lucide-react";

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
  data_ritiro: string | null;
  note: string | null;
  scontrino_url: string | null;
  ocr_totale: number | null;
  ocr_iva: number | null;
  ocr_data: unknown;
  ordini_righe: { descrizione: string; quantita: string | null; note?: string | null }[];
  profiles: {
    ragione_sociale: string | null;
    partita_iva: string | null;
    referente: string | null;
    telefono: string | null;
    indirizzo_consegna: string | null;
  } | null;
};

function OrdiniAdmin() {
  const { role } = useRequireRole("admin");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [now, setNow] = useState<number>(Date.now());
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const ocr = useServerFn(adminOcrScontrino);
  const gen = useServerFn(adminGeneraDDT);

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select(
        "id, stato, created_at, data_ritiro, note, scontrino_url, ocr_totale, ocr_iva, ocr_data, ordini_righe(descrizione, quantita, note, posizione), profiles:cliente_id(ragione_sociale, partita_iva, referente, telefono, indirizzo_consegna)",
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

    // Aggiorna la variabile temporale ogni secondo per sincronizzare i badge di stato
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const channel = supabase
      .channel("ordini-admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordini" }, () => refresh())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  function toggleExpand(id: string) {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
    <AppShell title="Ordini & OCR (Monitoraggio)" role="Admin" nav={adminNav}>
      <p className="mb-6 text-muted-foreground">
        Monitoraggio ordini in tempo reale: espandi qualsiasi ordine per consultare il dettaglio dei prodotti ed i dati di consegna.
      </p>

      <div className="space-y-4">
        {ordini.map((o) => {
          const createdAt = new Date(o.created_at).getTime();
          const elapsedSec = (now - createdAt) / 1000;
          const isExpanded = !!expandedOrders[o.id];

          // Stato visivo per l'Admin
          const isInSospesoCliente = o.stato === "nuovo" && elapsedSec < 120;
          const isInPreparazioneLab = o.stato === "nuovo" && elapsedSec >= 120;
          const isProntoScontrinato = o.stato === "scontrinato" || o.stato === "completo";
          const isDdtEvaso = o.stato === "evaso";
          const isAnnullato = o.stato === "annullato";

          const totalItems = o.ordini_righe?.length ?? 0;

          return (
            <div key={o.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-xl font-semibold">
                      {o.profiles?.ragione_sociale ?? "Cliente B2B"}
                    </h3>

                    {/* BADGES DI STATO PER L'ADMIN */}
                    {isInSospesoCliente && (
                      <Badge variant="secondary" className="flex items-center gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300">
                        <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600" />
                        In sospeso (Cliente)
                      </Badge>
                    )}

                    {isInPreparazioneLab && (
                      <Badge variant="default" className="flex items-center gap-1.5 bg-blue-600 text-white">
                        <PackageCheck className="h-3.5 w-3.5" />
                        In preparazione (Laboratorio)
                      </Badge>
                    )}

                    {isProntoScontrinato && (
                      <Badge variant="outline" className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Pronto / Scontrinato
                      </Badge>
                    )}

                    {isDdtEvaso && (
                      <Badge variant="outline" className="flex items-center gap-1.5 bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-400">
                        <FileText className="h-3.5 w-3.5 text-purple-600" />
                        DDT Generato (Evaso)
                      </Badge>
                    )}

                    {isAnnullato && (
                      <Badge variant="outline" className="flex items-center gap-1.5 text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />
                        Annullato
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    {o.profiles?.partita_iva && `P.IVA ${o.profiles.partita_iva} · `}
                    Inviato il {new Date(o.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleExpand(o.id)}
                      className="flex items-center gap-1 font-semibold"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" /> Chiudi Dettaglio
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" /> Dettaglio Ordine ({totalItems} {totalItems === 1 ? "prodotto" : "prodotti"})
                        </>
                      )}
                    </Button>

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
                      disabled={!o.ocr_data || busy === o.id || isDdtEvaso}
                      onClick={() => runDdt(o.id)}
                    >
                      {isDdtEvaso ? "DDT Emesso" : "Genera DDT"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* SEZIONE ESPANDIBILE DETTAGLIO ORDINE */}
              {isExpanded && (
                <div className="mt-4 border-t border-border/60 pt-4 space-y-4 animate-in fade-in duration-200">
                  {/* DATI DI CONTATTO E CONSEGNA CLIENTE */}
                  <div className="grid gap-3 sm:grid-cols-3 bg-muted/40 p-3.5 rounded-lg text-xs">
                    {o.profiles?.referente && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <div>
                          <span className="text-muted-foreground block">Referente</span>
                          <strong className="text-foreground">{o.profiles.referente}</strong>
                        </div>
                      </div>
                    )}
                    {o.profiles?.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <div>
                          <span className="text-muted-foreground block">Telefono</span>
                          <strong className="text-foreground">{o.profiles.telefono}</strong>
                        </div>
                      </div>
                    )}
                    {o.data_ritiro && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div>
                          <span className="text-muted-foreground block">Data Consegna Preferita</span>
                          <strong className="text-foreground">{new Date(o.data_ritiro).toLocaleDateString("it-IT")}</strong>
                        </div>
                      </div>
                    )}
                    {o.profiles?.indirizzo_consegna && (
                      <div className="flex items-center gap-2 sm:col-span-3">
                        <MapPin className="h-4 w-4 text-primary" />
                        <div>
                          <span className="text-muted-foreground block">Indirizzo Consegna</span>
                          <strong className="text-foreground">{o.profiles.indirizzo_consegna}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TABELLA PRODOTTI ORDINATI */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                      Prodotti Richiesti dal Cliente
                    </h4>
                    <div className="rounded-lg border border-border/80 overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 font-medium">#</th>
                            <th className="px-4 py-2 font-medium">Descrizione Prodotto</th>
                            <th className="px-4 py-2 font-medium text-right">Quantità</th>
                            <th className="px-4 py-2 font-medium">Note per Riga</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {o.ordini_righe && o.ordini_righe.length > 0 ? (
                            o.ordini_righe.map((r, i) => (
                              <tr key={i} className="hover:bg-muted/30">
                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{i + 1}</td>
                                <td className="px-4 py-2.5 font-medium text-foreground">{r.descrizione}</td>
                                <td className="px-4 py-2.5 font-bold text-right text-primary">{r.quantita ?? "1"}</td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground italic">{r.note ?? "—"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-3 text-center text-xs text-muted-foreground">
                                Nessun dettaglio riga presente per questo ordine.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* NOTE GENERALI ORDINE */}
                  {o.note && (
                    <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300">
                      <strong>📝 Note generali dell'ordine:</strong> {o.note}
                    </div>
                  )}
                </div>
              )}
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



