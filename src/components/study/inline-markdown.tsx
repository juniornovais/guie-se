import ReactMarkdown from "react-markdown";

/**
 * Markdown em linha para textos curtos do conteúdo (critérios, dicas, objetivos):
 * suporta `código`, **negrito** e _itálico_ sem gerar parágrafos/blocos.
 * Não executa HTML bruto. Funciona em Server e Client Components.
 */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      allowedElements={["p", "code", "strong", "em", "a"]}
      unwrapDisallowed
      components={{
        p: ({ children }) => <>{children}</>,
        code: ({ children }) => (
          <code className="rounded border bg-secondary px-1 py-px font-mono text-[0.88em] text-foreground">{children}</code>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
