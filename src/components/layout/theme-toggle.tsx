"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme: current, setTheme } = useTheme();
  // O servidor não conhece o tema do usuário: evita divergência de hidratação.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const theme = mounted ? current : undefined;
  return (
    <div role="radiogroup" aria-label="Tema" className="flex rounded-md border bg-background p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex flex-1 items-center justify-center rounded-[5px] py-1 text-muted-foreground hover:text-foreground",
            theme === value && "bg-accent text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
