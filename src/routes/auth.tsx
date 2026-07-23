import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getMyRole, rolePath } from "@/lib/roles";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi — MGA Connect" },
      { name: "description", content: "Accesso riservato al portale ordini B2B di M.G.A. Alimentari Cuozzo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error("Credenziali non valide");
      return;
    }
    const role = await getMyRole();
    setLoading(false);
    if (!role) {
      toast.error("Nessun ruolo assegnato. Contatta l'amministratore.");
      await supabase.auth.signOut();
      return;
    }
    toast.success("Accesso riuscito");
    navigate({ to: rolePath[role] });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center px-6 md:grid-cols-2">
        <div className="hidden md:block">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Torna alla home</Link>
          <div className="mt-8 font-serif text-5xl font-semibold text-primary">MGA Connect</div>
          <p className="mt-4 max-w-md text-muted-foreground">
            Il portale ordini riservato ai clienti B2B di M.G.A. Alimentari Cuozzo S.r.l.
          </p>
        </div>
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
          <h1 className="font-serif text-3xl font-semibold">Accedi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inserisci le tue credenziali per continuare.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso…" : "Accedi"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Non hai un account?{" "}
            <Link to="/registrazione" className="font-medium text-primary hover:underline">
              Registrati come cliente B2B
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
