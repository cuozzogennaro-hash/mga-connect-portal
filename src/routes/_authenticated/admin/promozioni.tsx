import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const adminNav = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/utenti", label: "Utenti" },
  { to: "/admin/promozioni", label: "Promozioni" },
  { to: "/admin/ordini", label: "Ordini & OCR" },
  { to: "/admin/contabilita", label: "Contabilità" },
];

export const Route = createFileRoute("/_authenticated/admin/promozioni")({
  head: () => ({ meta: [{ title: "Promozioni — MGA Admin" }, { name: "robots", content: "noindex" }] }),
  component: PromozioniAdmin,
});

type Promo = {
  id: string;
  titolo: string;
  descrizione: string | null;
  prezzo_promo: number | null;
  valida_da: string | null;
  valida_al: string | null;
  foto_url: string | null;
  attiva: boolean;
};

function PromozioniAdmin() {
  const { role } = useRequireRole("admin");
  const [items, setItems] = useState<Promo[]>([]);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [prezzo, setPrezzo] = useState("");
  const [validaDa, setValidaDa] = useState("");
  const [validaAl, setValidaAl] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const { data } = await supabase.from("promozioni").select("*").order("created_at", { ascending: false });
    const list = (data ?? []) as Promo[];
    setItems(list);
    const urls: Record<string, string> = {};
    await Promise.all(
      list
        .filter((p) => p.foto_url)
        .map(async (p) => {
          const { data: s } = await supabase.storage.from("promozioni").createSignedUrl(p.foto_url!, 600);
          if (s?.signedUrl) urls[p.id] = s.signedUrl;
        }),
    );
    setImgUrls(urls);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titolo.trim()) return;
    setSaving(true);
    let fotoPath: string | null = null;
    if (foto) {
      const path = `${Date.now()}-${foto.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("promozioni").upload(path, foto);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
      fotoPath = path;
    }
    const { error } = await supabase.from("promozioni").insert({
      titolo,
      descrizione: descrizione || null,
      prezzo_promo: prezzo ? Number(prezzo) : null,
      valida_da: validaDa || null,
      valida_al: validaAl || null,
      foto_url: fotoPath,
      attiva: true,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Promozione creata");
    setTitolo("");
    setDescrizione("");
    setPrezzo("");
    setValidaDa("");
    setValidaAl("");
    setFoto(null);
    refresh();
  }

  async function toggle(p: Promo) {
    await supabase.from("promozioni").update({ attiva: !p.attiva }).eq("id", p.id);
    refresh();
  }
  async function remove(p: Promo) {
    if (!confirm(`Eliminare "${p.titolo}"?`)) return;
    if (p.foto_url) await supabase.storage.from("promozioni").remove([p.foto_url]);
    await supabase.from("promozioni").delete().eq("id", p.id);
    refresh();
  }

  if (!role) return null;
  return (
    <AppShell title="Promozioni" role="Admin" nav={adminNav}>
      <div className="grid gap-8 lg:grid-cols-5">
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="font-serif text-xl font-semibold">Nuova promozione</h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Titolo *</Label>
              <Input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
            </div>
            <div>
              <Label>Prezzo promo (€)</Label>
              <Input type="number" step="0.01" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valida da</Label>
                <Input type="date" value={validaDa} onChange={(e) => setValidaDa(e.target.value)} />
              </div>
              <div>
                <Label>Valida al</Label>
                <Input type="date" value={validaAl} onChange={(e) => setValidaAl(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Foto</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Salvataggio…" : "Pubblica"}
            </Button>
          </div>
        </form>
        <div className="lg:col-span-3">
          <h2 className="mb-3 font-serif text-xl font-semibold">Promozioni pubblicate</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {imgUrls[p.id] && <img src={imgUrls[p.id]} alt={p.titolo} className="h-32 w-full object-cover" />}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-semibold">{p.titolo}</h3>
                    <Switch checked={p.attiva} onCheckedChange={() => toggle(p)} />
                  </div>
                  {p.prezzo_promo != null && (
                    <p className="mt-1 text-lg font-semibold">€ {Number(p.prezzo_promo).toFixed(2)}</p>
                  )}
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => remove(p)}>
                    <Trash2 className="mr-1 h-4 w-4" /> Elimina
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessuna promozione ancora pubblicata.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
