import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Volume2, VolumeX, Printer, BellRing, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operatore/")({
  head: () => ({
    meta: [
      { title: "Preparazione ordini — MGA Connect" },
      { name: "description", content: "Dashboard operatore: gestisci ordini in preparazione in tempo reale." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OperatoreHome,
});

type Ordine = {
  id: string;
  stato: string;
  created_at: string;
  data_ritiro: string | null;
  note: string | null;
  scontrino_url: string | null;
  cliente_id: string;
  ordini_righe: { descrizione: string; quantita: string | null }[];
  profiles: { ragione_sociale: string | null; referente: string | null; telefono: string | null } | null;
};

// Funzione sintetizzatore Web Audio API per produrre un segnale acustico chiaro su Android/Browser
function playBeepSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playNote(880, now, 0.15); // Nota A5
    playNote(1174.66, now + 0.18, 0.25); // Nota D6
  } catch (e) {
    console.warn("Audio non consentito o non supportato", e);
  }
}

function OperatoreHome() {
  const { role } = useRequireRole("operatore_preparazione");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [printingOrdine, setPrintingOrdine] = useState<Ordine | null>(null);

  // Traccia gli ID degli ordini già processati/notificati in questa sessione
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select(
        "id, stato, created_at, data_ritiro, note, scontrino_url, cliente_id, ordini_righe(descrizione, quantita, posizione), profiles:cliente_id(ragione_sociale, referente, telefono)",
      )
      .in("stato", ["nuovo", "scontrinato", "evaso"])
      .order("created_at", { ascending: true });

    setOrdini((data ?? []) as unknown as Ordine[]);
  }

  useEffect(() => {
    refresh();

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const ch = supabase
      .channel("ordini-operatore")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordini" }, () => refresh())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  // Gli ordini compaiono all'operatore SOLO dopo che sono trascorsi 2 minuti (120000 ms) dalla creazione
  const ordiniReady = ordini.filter((o) => {
    if (o.stato === "scontrinato" || o.stato === "completo" || o.stato === "evaso") return true;
    const createdAt = new Date(o.created_at).getTime();
    return now - createdAt >= 120000;
  });

  // Controlla il rilevamento di nuovi ordini pronti per il laboratorio
  useEffect(() => {
    if (isFirstLoadRef.current) {
      // Alla prima carica popola i seenOrderIds per non far suonare gli ordini vecchi
      ordiniReady.forEach((o) => seenOrderIdsRef.current.add(o.id));
      if (ordiniReady.length > 0) isFirstLoadRef.current = false;
      return;
    }

    let hasNewOrder = false;
    let newlyArrived: Ordine | null = null;

    for (const o of ordiniReady) {
      if (!seenOrderIdsRef.current.has(o.id) && o.stato === "nuovo") {
        seenOrderIdsRef.current.add(o.id);
        hasNewOrder = true;
        newlyArrived = o;
      }
    }

    if (hasNewOrder && newlyArrived) {
      if (soundEnabled) {
        playBeepSound();
      }
      toast.info(`🔔 NUOVO ORDINO IN LABORATORIO!\n${newlyArrived.profiles?.ragione_sociale ?? "Cliente B2B"}`);

      if (autoPrintEnabled) {
        handlePrint(newlyArrived);
      }
    }
  }, [ordiniReady, soundEnabled, autoPrintEnabled]);

  async function uploadScontrino(ordineId: string, file: File) {
    setUploading(ordineId);
    const path = `${ordineId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("scontrini").upload(path, file, { upsert: false });
    if (error) {
      setUploading(null);
      toast.error(error.message);
      return;
    }
    const { error: uErr } = await supabase
      .from("ordini")
      .update({ scontrino_url: path, stato: "scontrinato" })
      .eq("id", ordineId);

    setUploading(null);
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success("Foto scontrino caricata! Ordine marcato come COMPLETO.");
    refresh();
  }

  function handlePrint(o: Ordine) {
    setPrintingOrdine(o);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  if (!role) return null;
  return (
    <AppShell title="Preparazione ordini (Laboratorio)" role="Operatore">
      {/* BARRA CONTROLLI TABLET LABORATORIO */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-sm font-medium">Tablet Laboratorio Attivo</p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            <Label htmlFor="sound-toggle" className="text-xs font-semibold cursor-pointer">
              Segnale Acustico
            </Label>
            <Switch id="sound-toggle" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>

          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-blue-600" />
            <Label htmlFor="autoprint-toggle" className="text-xs font-semibold cursor-pointer">
              Stampa Automatica
            </Label>
            <Switch id="autoprint-toggle" checked={autoPrintEnabled} onCheckedChange={setAutoPrintEnabled} />
          </div>

          <Button variant="outline" size="sm" onClick={() => playBeepSound()}>
            Test Suono
          </Button>
        </div>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Gli ordini compaiono qui in tempo reale <strong>2 minuti dopo l'invio del cliente</strong>. Quando prepari i prodotti, batti lo scontrino di cassa e caricalo qui.
      </p>

      {/* LISTA ORDINI */}
      <div className="grid gap-4 md:grid-cols-2">
        {ordiniReady.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground md:col-span-2">
            Nessun ordine in arrivo per la preparazione in magazzino.
          </div>
        )}
        {ordiniReady.map((o) => (
          <OrdineCard
            key={o.id}
            ordine={o}
            onUpload={uploadScontrino}
            onPrint={() => handlePrint(o)}
            uploading={uploading === o.id}
          />
        ))}
      </div>

      {/* TEMPLATE STAMPA RICEVUTA/TAGLIANDO LABORATORIO */}
      {printingOrdine && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-4 text-xs font-mono print-ticket">
          <div className="text-center border-b border-black pb-2 mb-2">
            <h1 className="text-lg font-bold">M.G.A. ALIMENTARI CUOZZO</h1>
            <p className="text-xs">TAGLIANDO PREPARAZIONE LABORATORIO</p>
            <p className="text-xs">Data: {new Date().toLocaleString("it-IT")}</p>
          </div>

          <div className="mb-3">
            <p className="font-bold text-sm">CLIENTE: {printingOrdine.profiles?.ragione_sociale ?? "Cliente"}</p>
            {printingOrdine.profiles?.referente && <p>Referente: {printingOrdine.profiles.referente}</p>}
            {printingOrdine.profiles?.telefono && <p>Tel: {printingOrdine.profiles.telefono}</p>}
            {printingOrdine.data_ritiro && <p className="font-bold">DATA CONSEGNA: {new Date(printingOrdine.data_ritiro).toLocaleDateString("it-IT")}</p>}
          </div>

          <table className="w-full border-collapse border-t border-b border-black mb-3">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1">PRODOTTO</th>
                <th className="py-1 text-right">Q.TÀ</th>
              </tr>
            </thead>
            <tbody>
              {printingOrdine.ordini_righe.map((r, i) => (
                <tr key={i} className="border-b border-gray-300">
                  <td className="py-1.5 font-bold text-sm">{r.descrizione}</td>
                  <td className="py-1.5 text-right font-bold text-sm">{r.quantita ?? "1"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {printingOrdine.note && (
            <div className="border border-black p-2 mt-2">
              <p className="font-bold">NOTE MAGAZZINO:</p>
              <p>{printingOrdine.note}</p>
            </div>
          )}

          <div className="mt-4 pt-2 border-t border-black text-center text-[10px]">
            ID Ordine: {printingOrdine.id}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function OrdineCard({
  ordine,
  onUpload,
  onPrint,
  uploading,
}: {
  ordine: Ordine;
  onUpload: (id: string, f: File) => void;
  onPrint: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompleto = ordine.stato === "scontrinato" || ordine.stato === "completo" || ordine.stato === "evaso";

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-xl font-semibold">
            {ordine.profiles?.ragione_sociale ?? "Cliente"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {ordine.profiles?.referente ?? ""} · {ordine.profiles?.telefono ?? ""}
          </p>
        </div>
        <Badge variant={isCompleto ? "outline" : "default"} className={isCompleto ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400" : "bg-blue-600 text-white"}>
          {isCompleto ? "Completo / Pronto" : "Presa in carico"}
        </Badge>
      </header>

      <p className="mt-2 text-xs text-muted-foreground">
        Ricevuto {new Date(ordine.created_at).toLocaleString("it-IT")}
        {ordine.data_ritiro && ` · Ritiro preferito ${new Date(ordine.data_ritiro).toLocaleDateString("it-IT")}`}
      </p>

      <ul className="mt-3 space-y-1 text-base">
        {ordine.ordini_righe.map((r, i) => (
          <li key={i} className="flex justify-between border-b border-dashed border-border/50 py-1">
            <span className="font-medium">{r.descrizione}</span>
            <span className="text-muted-foreground font-semibold">{r.quantita ?? ""}</span>
          </li>
        ))}
      </ul>

      {ordine.note && <p className="mt-2 text-sm italic text-muted-foreground">Nota: {ordine.note}</p>}

      <div className="mt-4 flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-1.5" />
          {uploading ? "Caricamento…" : ordine.scontrino_url ? "Ricarica scontrino" : "Foto Scontrino"}
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={onPrint}
        >
          <Printer className="h-4 w-4 mr-1.5" /> Stampa Tagliando
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(ordine.id, f);
          e.target.value = "";
        }}
      />
    </article>
  );
}

