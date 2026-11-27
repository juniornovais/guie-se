"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { heartbeatStudySession, recordTopicVisit, startStudySession } from "@/lib/actions/progress";

const HEARTBEAT_MS = 30_000;
const IDLE_LIMIT_MS = 5 * 60_000; // sem interação por 5 min: pausa a contagem

/**
 * Registra a visita (último tópico + "em andamento") e mede o tempo ATIVO de
 * estudo: só conta enquanto a aba está visível e houve interação recente.
 * Roda no cliente para que prefetch/renderização não gerem registros falsos.
 */
export function StudyTracker({ topicId, firstVisit }: { topicId: string; firstVisit: boolean }) {
  const router = useRouter();
  const sessionId = useRef<string | null>(null);
  const activeMs = useRef(0);
  const lastTick = useRef(0);
  const lastInput = useRef(0);
  // Valor da primeira renderização: o refresh muda a prop, mas não deve reiniciar a sessão.
  const firstVisitRef = useRef(firstVisit);

  useEffect(() => {
    let cancelled = false;
    const now = () => performance.now();
    lastTick.current = now();
    lastInput.current = now();
    activeMs.current = 0;

    recordTopicVisit({ topicId }).then((r) => {
      // Primeira visita: o tópico passou a "em andamento" no banco; atualiza a página.
      if (!cancelled && r.ok && firstVisitRef.current) {
        firstVisitRef.current = false;
        router.refresh();
      }
    });
    startStudySession({ topicId }).then((r) => {
      if (!cancelled && r.ok) sessionId.current = r.data;
    });

    const accumulate = () => {
      const t = now();
      const visible = document.visibilityState === "visible";
      const recentlyActive = t - lastInput.current < IDLE_LIMIT_MS;
      if (visible && recentlyActive) activeMs.current += t - lastTick.current;
      lastTick.current = t;
    };
    const flush = () => {
      accumulate();
      if (sessionId.current && activeMs.current > 0) {
        heartbeatStudySession({ sessionId: sessionId.current, durationSeconds: Math.min(86_400, Math.round(activeMs.current / 1000)) });
      }
    };
    const onInput = () => {
      accumulate();
      lastInput.current = now();
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? flush() : (lastTick.current = now()));

    const interval = window.setInterval(flush, HEARTBEAT_MS);
    const events = ["scroll", "keydown", "pointerdown", "pointermove"] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      flush();
      window.clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [topicId, router]);

  return null;
}
