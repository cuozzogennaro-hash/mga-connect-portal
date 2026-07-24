import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Edit2, Clock, CheckCircle2, PackageCheck, AlertCircle, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cliente/ordini")({
  head: () => ({
    meta: [
      { title: "I miei ordini — MGA Connect" },
      { name: "description", content: "Inserisci un nuovo ordine e consulta lo storico degli ordini B2B con M.G.A. Alimentari Cuozzo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdiniCliente,
});

type Riga = { descrizione: string; quantita: string; note: string };
type Ordine = {
  id: string;
  stato: string;
  created_at: string;
  data_ritiro: string | null;
  note: string | null;
  ordini_righe: { descrizione: string; quantita: string | null; note?: string | null }[];
};

function formatSeconds(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function OrdiniCliente() {
  const { role } = useRequireRole("cliente_b2b");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [dataRitiro, setDataRitiro] = useState("");
  const [note, setNote] = useState("");
  const [righe, setRighe] = useState<Riga[]>([{ descrizione: "", quantita: "", note: "" }]);
  const [saving, setSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select("id, stato, created_at, data_ritiro, note, ordini_righe(descrizione, quantita, note, posizione)")
      .order("created_at", { ascending: false });
    setOrdini((data ?? []) as unknown as Ordine[]);
  }

  useEffect(() => {
    refresh();

    // Timer per aggiornare il conto alla rovescia ogni secondo
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    // Subscription Realtime per aggiornare lo stato appena l'operatore lavora l'ordine
    const channel = supabase
      .channel("ordini-cliente-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordini" }, () => refresh())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  function startEditing(o: Ordine) {
    setEditingOrderId(o.id);
    setDataRitiro(o.data_ritiro ?? "");
    setNote(o.note ?? "");
    if (o.ordini_righe && o.ordini_righe.length > 0) {
      setRighe(
        o.ordini_righe.map((r) => ({
          descrizione: r.descrizione ?? "",
          quantita: r.quantita ?? "",
          note: r.note ?? "",
        })),
      );
    } else {
      setRighe([{ descrizione: "", quantita: "", note: "" }]);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingOrderId(null);
    setRighe([{ descrizione: "", quantita: "", note: "" }]);
    setDataRitiro("");
    setNote("");
  }

  async function deleteOrder(id: string) {
    if (!window.confirm("Sei sicuro di voler eliminare questo ordine?")) return;
    
    // Elimina prima le righe e poi l'ordine
    await supabase.from("ordini_righe").delete().eq("ordine_id", id);
    const { error } = await supabase.from("ordini").delete().eq("id", id);
    if (error) {
      toast.error("Impossibile eliminare l'ordine: " + error.message);
      return;
    }
    toast.success("Ordine eliminato");
    if (editingOrderId === id) {
      cancelEditing();
    }
    refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const valide = righe.filter((r) => r.descrizione.trim().length > 0);
    if (valide.length === 0) {
      toast.error("Aggiungi almeno una riga con la descrizione");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      setSaving(false);
      return;
    }

    if (editingOrderId) {
      // Aggiornamento ordine esistente
      const { error: updateErr } = await supabase
        .from("ordini")
        .update({
          data_ritiro: dataRitiro || null,
          note: note || null,
        })
        .eq("id", editingOrderId);

      if (updateErr) {
        setSaving(false);
        toast.error("Errore aggiornamento ordine: " + updateErr.message);
        return;
      }

      // Sostituisci le righe dell'ordine
      await supabase.from("ordini_righe").delete().eq("ordine_id", editingOrderId);
      const { error: rErr } = await supabase.from("ordini_righe").insert(
        valide.map((r, i) => ({
          ordine_id: editingOrderId,
          posizione: i,
          descrizione: r.descrizione,
          quantita: r.quantita || null,
          note: r.note || null,
        })),
      );

      setSaving(false);
      if (rErr) {
        toast.error(rErr.message);
        return;
      }

      toast.success("Ordine modificato con successo");
      cancelEditing();
      refresh();
      return;
    }

    // Inserimento nuovo ordine
    const { data: ord, error } = await supabase
      .from("ordini")
      .insert({
        cliente_id: uid,
        data_ritiro: dataRitiro || null,
        note: note || null,
        stato: "nuovo",
      })
      .select("id")
      .single();

    if (error || !ord) {
      setSaving(false);
      toast.error(error?.message ?? "Errore invio ordine");
      return;
    }

    const { error: rErr } = await supabase.from("ordini_righe").insert(
      valide.map((r, i) => ({
        ordine_id: ord.id,
        posizione: i,
        descrizione: r.descrizione,
        quantita: r.quantita || null,
        note: r.note || null,
      })),
    );

    setSaving(false);
    if (rErr) {
      toast.error(rErr.message);
      return;
    }

    toast.success("Ordine inviato! Hai 2 minuti per eventuali modifiche.");
    setRighe([{ descrizione: "", quantita: "", note: "" }]);
    setDataRitiro("");
    setNote("");
    refresh();
  }

  if (!role) return null;
  return (
    <AppShell
      title="I miei ordini"
      role="Cliente"
      nav={[
        { to: "/cliente", label: "Promozioni" },
        { to: "/cliente/ordini", label: "I miei ordini" },
      ]}
    >
      <div className="grid gap-8 lg:grid-cols-5">
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 lg:col-span-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold">
              {editingOrderId ? "Modifica ordine" : "Nuovo ordine"}
            </h2>
            {editingOrderId && (
              <Button type="button" variant="ghost" size="sm" onClick={cancelEditing}>
                Annulla modifica
              </Button>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Inserisci i prodotti che desideri ordinare. Hai 2 minuti di tempo dall'invio per modificare o cancellare l'ordine prima che passi in magazzino.
          </p>

          <div className="mt-6 space-y-3">
            {righe.map((r, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
                <Input
                  placeholder="Descrizione prodotto (es. Mozzarella Bufala)"
                  value={r.descrizione}
                  onChange={(e) => setRighe((s) => s.map((x, j) => (j === i ? { ...x, descrizione: e.target.value } : x)))}
                />
                <Input
                  placeholder="Q.tà (es. 5 kg)"
                  value={r.quantita}
                  onChange={(e) => setRighe((s) => s.map((x, j) => (j === i ? { ...x, quantita: e.target.value } : x)))}
                />
                <Input
                  placeholder="Note (es. ben stagionato)"
                  value={r.note}
                  onChange={(e) => setRighe((s) => s.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRighe((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRighe((s) => [...s, { descrizione: "", quantita: "", note: "" }])}
            >
              + Aggiungi riga
            </Button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Data consegna/ritiro preferita</Label>
              <Input type="date" className="mt-1" value={dataRitiro} onChange={(e) => setDataRitiro(e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Note generali per il magazzino</Label>
            <Textarea rows={2} className="mt-1" placeholder="Note sulla consegna, orari preferiti..." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="mt-6 flex gap-3">
            <Button type="submit" className="w-full" disabled={saving} size="lg">
              {saving ? "Salvataggio…" : editingOrderId ? "Salva modifiche ordine" : "Conferma e Invia ordine"}
            </Button>
          </div>
        </form>

        {/* STORICO ORDINI */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-serif text-2xl font-semibold">I tuoi ordini</h2>
          <div className="space-y-4">
            {ordini.length === 0 && <p className="text-sm text-muted-foreground">Nessun ordine inoltrato.</p>}
            {ordini.map((o) => {
              const createdAt = new Date(o.created_at).getTime();
              const elapsedSec = (now - createdAt) / 1000;
              const secondsLeft = Math.max(0, 120 - elapsedSec);
              const isEditable = o.stato === "nuovo" && secondsLeft > 0;
              const isPresaInCarico = o.stato === "nuovo" && secondsLeft <= 0;
              const isCompleto = o.stato === "scontrinato" || o.stato === "completo" || o.stato === "evaso";
              const isAnnullato = o.stato === "annullato";

              return (
                <div key={o.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-3">
                    <div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(o.created_at).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* BADGES DI STATO DINAMICI */}
                    {isEditable && (
                      <Badge variant="secondary" className="flex items-center gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300">
                        <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600" />
                        In sospeso ({formatSeconds(secondsLeft)})
                      </Badge>
                    )}

                    {isPresaInCarico && (
                      <Badge variant="default" className="flex items-center gap-1.5 bg-blue-600 text-white">
                        <PackageCheck className="h-3.5 w-3.5" />
                        Presa in carico
                      </Badge>
                    )}

                    {isCompleto && (
                      <Badge variant="outline" className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Completo
                      </Badge>
                    )}

                    {isAnnullato && (
                      <Badge variant="outline" className="flex items-center gap-1.5 text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />
                        Annullato
                      </Badge>
                    )}
                  </div>

                  {/* AVVISO TIMER PER IL CLIENTE */}
                  {isEditable && (
                    <div className="mt-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span>Hai ancora <strong>{formatSeconds(secondsLeft)}</strong> per modificare o annullare.</span>
                    </div>
                  )}

                  {/* RIGHE PRODOTTI */}
                  <ul className="mt-3 space-y-1 text-sm">
                    {o.ordini_righe.map((r, i) => (
                      <li key={i} className="flex justify-between py-0.5">
                        <span className="font-medium text-foreground">· {r.descrizione}</span>
                        <span className="text-muted-foreground">{r.quantita ? `(${r.quantita})` : ""}</span>
                      </li>
                    ))}
                  </ul>

                  {o.data_ritiro && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      📅 Data preferita: <strong>{new Date(o.data_ritiro).toLocaleDateString("it-IT")}</strong>
                    </p>
                  )}
                  {o.note && (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      📝 Nota: {o.note}
                    </p>
                  )}

                  {/* AZIONI MODIFICA ED ELIMINA SE IN FINESTRA DI 2 MINUTI */}
                  {isEditable && (
                    <div className="mt-4 flex gap-2 border-t border-border/50 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full flex items-center gap-1.5"
                        onClick={() => startEditing(o)}
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Modifica
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full flex items-center gap-1.5"
                        onClick={() => deleteOrder(o.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Elimina
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

