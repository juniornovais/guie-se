import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-8">
      <h1 className="text-2xl font-bold">Esta estação não existe</h1>
      <p className="mt-2 text-muted-foreground">O endereço pode ter mudado. Encontre o tópico pelo mapa do roadmap.</p>
      <Button asChild className="mt-6">
        <Link href="/roadmap">Abrir o roadmap</Link>
      </Button>
    </div>
  );
}
