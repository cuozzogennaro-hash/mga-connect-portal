import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/registrazione")({
  head: () => ({
    meta: [
      { title: "Registrazione B2B — MGA Connect" },
      { name: "description", content: "Registrati come cliente B2B di M.G.A. Alimentari Cuozzo S.r.l. per accedere al portale ordini." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegistrazionePage,
});

const schema = z.object({
  ragione_sociale: z.string().min(2, "Ragione sociale obbligatoria"),
  partita_iva: z.string().trim().regex(/^[A-Z0-9]{8,20}$/i, "P.IVA non valida"),
  referente: z.string().min(2, "Referente obbligatorio"),
  telefono: z.string().min(6, "Telefono obbligatorio"),
  email: z.string().email("Email non valida"),
  password: z.string().min(8, "Minimo 8 caratteri"),
  indirizzo_consegna: z.string().min(5, "Indirizzo obbligatorio"),
});

function RegistrazionePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    ragione_sociale: "",
    partita_iva: "",
    referente: "",
    telefono: "",
    email: "",
    password: "",
    indirizzo_consegna: "",
  });

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Compila tutti i campi");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        // NB: role is not passed → trigger defaults to cliente_b2b
        data: {
          nome: form.referente,
          ragione_sociale: form.ragione_sociale,
          partita_iva: form.partita_iva,
          referente: form.referente,
          telefono: form.telefono,
          indirizzo_consegna: form.indirizzo_consegna,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registrazione completata. Ora puoi accedere.");
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Torna alla home</Link>
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
          <h1 className="font-serif text-4xl font-semibold text-primary">Diventa cliente B2B</h1>
          <p className="mt-2 text-muted-foreground">
            La registrazione è riservata alle attività con Partita IVA. Inseriti i dati, potrai
            accedere subito a MGA Connect.
          </p>
          <form onSubmit={onSubmit} className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Ragione Sociale *</Label>
              <Input value={form.ragione_sociale} onChange={(e) => upd("ragione_sociale", e.target.value)} required />
            </div>
            <div>
              <Label>Partita IVA *</Label>
              <Input value={form.partita_iva} onChange={(e) => upd("partita_iva", e.target.value)} required />
            </div>
            <div>
              <Label>Referente *</Label>
              <Input value={form.referente} onChange={(e) => upd("referente", e.target.value)} required />
            </div>
            <div>
              <Label>Telefono *</Label>
              <Input value={form.telefono} onChange={(e) => upd("telefono", e.target.value)} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => upd("password", e.target.value)} required minLength={8} />
            </div>
            <div className="md:col-span-2">
              <Label>Indirizzo di consegna *</Label>
              <Textarea value={form.indirizzo_consegna} onChange={(e) => upd("indirizzo_consegna", e.target.value)} required rows={2} />
            </div>
            <div className="md:col-span-2 mt-2">
              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? "Registrazione in corso…" : "Registrati"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
