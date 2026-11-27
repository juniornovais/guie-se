import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/dal";
import { ThemeToggle } from "./theme-toggle";

/** Lê a sessão — deve ficar dentro de <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="space-y-3">
      <ThemeToggle />
      <div className="flex items-center gap-3">
        <Avatar className="size-8">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-8 rounded-md bg-accent" />
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-accent" />
        <div className="h-3 flex-1 rounded bg-accent" />
      </div>
    </div>
  );
}
