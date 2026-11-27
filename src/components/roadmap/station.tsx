import { cn } from "@/lib/utils";

export type StationState = "not_started" | "in_progress" | "completed" | "current";

export const STATUS_LABEL: Record<StationState, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
  current: "Você está aqui",
};

/**
 * Estação do mapa. O estado é comunicado pela FORMA (vazia, meia, cheia, anel
 * duplo), não só pela cor — legível para daltônicos e em escala de cinza.
 * A cor vem de `--line` (definida por data-line no ancestral).
 */
export function Station({
  state,
  size = 14,
  className,
  label,
}: {
  state: StationState;
  size?: number;
  className?: string;
  label?: string;
}) {
  const r = size / 2;
  const stroke = Math.max(2, size / 7);
  return (
    <svg
      width={size + (state === "current" ? 8 : 0)}
      height={size + (state === "current" ? 8 : 0)}
      viewBox={state === "current" ? `-4 -4 ${size + 8} ${size + 8}` : `0 0 ${size} ${size}`}
      className={cn("shrink-0 overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {state === "current" && (
        <circle cx={r} cy={r} r={r + 3} fill="none" stroke="var(--line)" strokeWidth={1.5} opacity={0.45} />
      )}
      <circle
        cx={r}
        cy={r}
        r={r - stroke / 2}
        fill={state === "completed" ? "var(--line)" : "var(--surface)"}
        stroke="var(--line)"
        strokeWidth={stroke}
      />
      {state === "in_progress" && (
        <path d={`M ${r} ${stroke} A ${r - stroke} ${r - stroke} 0 0 1 ${r} ${size - stroke} Z`} fill="var(--line)" />
      )}
      {state === "current" && <circle cx={r} cy={r} r={r / 2.4} fill="var(--line)" />}
    </svg>
  );
}

/** Barra de progresso fina na cor da linha. */
export function LineBar({ percent, className, label }: { percent: number; className?: string; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--line)_14%,transparent)]", className)}
    >
      <div className="h-full rounded-full bg-[var(--line)] transition-[width] duration-500" style={{ width: `${p}%` }} />
    </div>
  );
}

export function stateFor(status: string | undefined, isCurrent: boolean): StationState {
  if (isCurrent && status !== "completed") return "current";
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in_progress";
  return "not_started";
}
