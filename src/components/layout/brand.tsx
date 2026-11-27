import Link from "next/link";

/** Marca: seis linhas paralelas (as seis etapas) convergindo num ponto. */
export function BrandMark({ size = 22 }: { size?: number }) {
  const colors = ["--line-01", "--line-02", "--line-03", "--line-04", "--line-05", "--line-06"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {colors.map((c, i) => (
        <path
          key={c}
          d={`M 3 ${3 + i * 3.6} C 10 ${3 + i * 3.6}, 12 12, 19 12`}
          fill="none"
          stroke={`var(${c})`}
          strokeWidth={1.9}
          strokeLinecap="round"
        />
      ))}
      <circle cx="19.5" cy="12" r="3" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.8" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md text-lg font-bold tracking-tight text-foreground">
      <BrandMark />
      Guie-se
    </Link>
  );
}
