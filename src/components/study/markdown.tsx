import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { cn } from "@/lib/utils";

/**
 * Renderiza Markdown do banco com segurança: react-markdown não executa HTML
 * bruto (sem rehype-raw), então o conteúdo não pode injetar scripts.
 */
export function Markdown({ children, className, compact }: { children: string; className?: string; compact?: boolean }) {
  return (
    <div className={cn("prose-study", compact && "prose-compact", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          // Links externos abrem em nova aba
          a: ({ href, children, ...rest }) => {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...rest} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          pre: ({ children, ...rest }) => (
            <pre tabIndex={0} {...rest}>
              {children}
            </pre>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
