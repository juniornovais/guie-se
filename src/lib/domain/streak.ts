/**
 * Sequência de dias estudados (pura). Um dia conta quando há qualquer atividade
 * de estudo registrada (sessão, progresso, tentativa, anotação) no fuso do usuário.
 */
export function toLocalDay(iso: string | Date, timeZone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

export function computeStreak(timestamps: (string | Date)[], timeZone: string, now: Date = new Date()) {
  const days = new Set(timestamps.map((t) => toLocalDay(t, timeZone)));
  const today = toLocalDay(now, timeZone);

  // A sequência atual continua viva se houve estudo hoje ou ontem.
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  let longest = 0;
  for (const day of days) {
    if (days.has(shiftDay(day, -1))) continue; // não é início de sequência
    let len = 0;
    let c = day;
    while (days.has(c)) {
      len++;
      c = shiftDay(c, 1);
    }
    longest = Math.max(longest, len);
  }

  return { current, longest, studiedToday: days.has(today), activeDays: days.size };
}
