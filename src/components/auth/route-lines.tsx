/**
 * As seis linhas do roadmap, desenhadas uma vez ao carregar a página de login.
 * Único movimento automático da interface (respeita prefers-reduced-motion).
 */
const STAGES = [
  { key: "01", title: "Fundamentos" },
  { key: "02", title: "LeetCode" },
  { key: "03", title: "Backend" },
  { key: "04", title: "Java Backend" },
  { key: "05", title: "Sistemas Distribuídos" },
  { key: "06", title: "System Design" },
];

export function RouteLines() {
  return (
    <svg viewBox="0 0 520 380" className="h-auto w-full max-w-[520px]" role="img" aria-label="As seis etapas do roadmap como linhas de um mapa">
      <style>{`
        .rl-path { stroke-dasharray: 900; stroke-dashoffset: 900; animation: rl-draw 1.6s cubic-bezier(.6,.1,.2,1) forwards; }
        .rl-stop { opacity: 0; animation: rl-fade .4s ease-out forwards; }
        @keyframes rl-draw { to { stroke-dashoffset: 0; } }
        @keyframes rl-fade { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .rl-path, .rl-stop { animation: none; stroke-dashoffset: 0; opacity: 1; } }
      `}</style>
      {STAGES.map((s, i) => {
        const y = 40 + i * 56;
        const d = `M 20 ${y} H ${140 + i * 18} C ${210 + i * 18} ${y}, ${230 + i * 10} 190, 300 190 H 470`;
        return (
          <g key={s.key} data-line={s.key}>
            <path className="rl-path" d={d} fill="none" stroke="var(--line)" strokeWidth={6} strokeLinecap="round" style={{ animationDelay: `${i * 110}ms` }} />
            <circle className="rl-stop" cx={20} cy={y} r={7} fill="var(--surface)" stroke="var(--line)" strokeWidth={3} style={{ animationDelay: `${i * 110}ms` }} />
            <text className="rl-stop" x={36} y={y - 12} fontSize={13} fontWeight={600} fill="var(--muted)" style={{ animationDelay: `${300 + i * 110}ms` }}>
              {s.key} {s.title}
            </text>
          </g>
        );
      })}
      <circle className="rl-stop" cx={480} cy={190} r={13} fill="var(--surface)" stroke="var(--ink)" strokeWidth={4} style={{ animationDelay: "1.5s" }} />
      <text className="rl-stop" x={480} y={226} fontSize={13} fontWeight={700} fill="var(--ink)" textAnchor="middle" style={{ animationDelay: "1.6s" }}>
        Backend Java
      </text>
    </svg>
  );
}
