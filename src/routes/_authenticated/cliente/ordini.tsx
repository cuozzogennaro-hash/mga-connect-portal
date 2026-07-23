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
import { Trash2 } from "lucide-react";

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
  ordini_righe: { descrizione: string; quantita: string | null }[];
};

const statoLabel: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  nuovo: { label: "Nuovo", variant: "default" },
  scontrinato: { label: "In preparazione", variant: "secondary" },
  evaso: { label: "Evaso", variant: "outline" },
  annullato: { label: "Annullato", variant: "outline" },
};

function OrdiniCliente() {
  const { role } = useRequireRole("cliente_b2b");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [dataRitiro, setDataRitiro] = useState("");
  const [note, setNote] = useState("");
  const [righe, setRighe] = useState<Riga[]>([{ descrizione: "", quantita: "", note: "" }]);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select("id, stato, created_at, data_ritiro, note, ordini_righe(descrizione, quantita, posizione)")
      .order("created_at", { ascending: false });
    setOrdini((data ?? []) as unknown as Ordine[]);
  }
  useEffect(() => {
    refresh();
  }, []);

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
    if (!uid) return;
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
    toast.success("Ordine inviato");
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
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 lg:col-span-3">
          <h2 className="font-serif text-2xl font-semibold">Nuovo ordine</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Inserisci una riga per ogni prodotto. La quantità è libera (es. "5 kg", "3 casse").
          </p>
          <div className="mt-6 space-y-3">
            {righe.map((r, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
                <Input
                  placeholder="Descrizione prodotto"
                  value={r.descrizione}
                  onChange={(e) => setRighe((s) => s.map((x, j) => (j === i ? { ...x, descrizione: e.target.value } : x)))}
                />
                <Input
                  placeholder="Q.tà"
                  value={r.quantita}
                  onChange={(e) => setRighe((s) => s.map((x, j) => (j === i ? { ...x, quantita: e.target.value } : x)))}
                />
                <Input
                  placeholder="Note (opzionali)"
                  value={r.note}
                  onChange={(e) => setRighe((s) => s.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRighe((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setRighe((s) => [...s, { descrizione: "", quantita: "", note: "" }])}
            >
              + Aggiungi riga
            </Button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <Label>Data ritiro (opzionale)</Label>
              <Input type="date" value={dataRitiro} onChange={(e) => setDataRitiro(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <Label>Note generali</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" className="mt-6 w-full" disabled={saving} size="lg">
            {saving ? "Invio in corso…" : "Invia ordine"}
          </Button>
        </form>
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-serif text-2xl font-semibold">Storico</h2>
          <div className="space-y-3">
            {ordini.length === 0 && <p className="text-sm text-muted-foreground">Nessun ordine.</p>}
            {ordini.map((o) => {
              const s = statoLabel[o.stato] ?? { label: o.stato, variant: "outline" as const };
              return (
                <div key={o.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("it-IT")}
                    </span>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                  <ul className="mt-2 text-sm">
                    {o.ordini_righe.map((r, i) => (
                      <li key={i}>
                        · {r.descrizione} {r.quantita ? `— ${r.quantita}` : ""}
                      </li>
                    ))}
                  </ul>
                  {o.data_ritiro && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ritiro: {new Date(o.data_ritiro).toLocaleDateString("it-IT")}
                    </p>
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
