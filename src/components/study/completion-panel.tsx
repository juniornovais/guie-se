"use client";

import { useTransition } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeTopic, markTopicReviewed, reopenTopic } from "@/lib/actions/progress";
import type { ActionResult } from "@/lib/actions/result";
import { relativeTime } from "@/lib/labels";

export type CompletionPanelProps = {
  topicId: string;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  reviewedAt: string | null;
  reviewCount: number;
};

/** Status do tópico e conclusão com um clique. */
export function CompletionPanel(p: CompletionPanelProps) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, success: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else toast.success(success);
    });

  const completed = p.status === "completed";
  // Tempos relativos ("agora", "há 2 min") podem mudar entre o render do servidor e a hidratação:
  // os elementos que os exibem usam suppressHydrationWarning e o valor do cliente prevalece.

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Status</p>
        <p className="mt-0.5 text-lg font-bold">
          {completed ? "Concluído" : p.status === "in_progress" ? "Em andamento" : "Não iniciado"}
        </p>
        {completed && p.completedAt && (
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            Concluído {relativeTime(p.completedAt)}
            {p.reviewCount > 0 && p.reviewedAt && `, revisado ${p.reviewCount}× (último ${relativeTime(p.reviewedAt)})`}
          </p>
        )}
      </div>

      {completed ? (
        <div className="flex flex-col gap-2">
          <Button variant="outline" disabled={pending} onClick={() => run(() => markTopicReviewed({ topicId: p.topicId }), "Revisão registrada")}>
            <RotateCcw className="size-4" aria-hidden />
            Marcar como revisado
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => reopenTopic({ topicId: p.topicId }), "Tópico reaberto")}>
            Reabrir tópico
          </Button>
        </div>
      ) : (
        <Button className="w-full" disabled={pending} onClick={() => run(() => completeTopic({ topicId: p.topicId }), "Tópico concluído")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Concluir tópico
        </Button>
      )}
    </div>
  );
}
