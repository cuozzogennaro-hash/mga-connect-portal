import { ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MGA } from "@/lib/mga";

export function AppShell({
  title,
  role,
  nav,
  children,
}: {
  title: string;
  role: string;
  nav?: { to: string; label: string }[];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-serif text-2xl font-semibold text-primary">MGA</span>
            <span className="hidden text-xs uppercase tracking-widest text-muted-foreground md:inline">
              Connect · {role}
            </span>
          </Link>
          {nav && nav.length > 0 && (
            <nav className="hidden gap-1 md:flex">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
                  activeProps={{ className: "active" }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            Esci
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-6 font-serif text-3xl font-semibold">{title}</h1>
        {children}
      </main>
      <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground">
        {MGA.ragioneSociale} — P.IVA {MGA.piva}
      </footer>
    </div>
  );
}
