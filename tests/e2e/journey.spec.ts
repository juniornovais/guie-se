/**
 * Jornada completa: login → início → roadmap → módulo → estudo → concluir com um
 * clique → nova sessão (progresso persistido) → evolução. Gera screenshots em
 * tests/e2e/.screens para revisão visual.
 */
import { expect, test, type Page } from "@playwright/test";

const SHOTS = "tests/e2e/.screens";
const email = `e2e-${Date.now()}@guie-se.local`;
const password = "senha-e2e-123";

async function login(page: Page, who = email) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByText("Login de desenvolvimento").click();
  await page.getByLabel("E-mail").fill(who);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no ambiente local" }).click();
  await expect(page.getByRole("link", { name: /Começar a estudar|Continuar estudando/ })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

/** Apenas elementos visíveis: com Cache Components, rotas anteriores ficam ocultas no DOM (<Activity>). */
const vis = (l: ReturnType<Page["getByText"]>) => l.filter({ visible: true }).first();

test("página de login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Continue de onde parou" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeVisible();
  await page.waitForTimeout(2200); // animação das linhas
  await page.screenshot({ path: `${SHOTS}/01-login.png` });
});

test("jornada completa com persistência", async ({ page, browser }) => {
  await login(page);

  // Início (primeiro acesso)
  await expect(page.getByRole("heading", { level: 1, name: "CPU" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Desafios" })).toHaveCount(0); // área de desafios removida
  await page.screenshot({ path: `${SHOTS}/02-inicio-novo.png`, fullPage: true });

  // Roadmap
  await page.getByRole("link", { name: "Roadmap" }).first().click();
  await expect(page.getByRole("heading", { name: "Roadmap Java Backend" })).toBeVisible();
  await expect(vis(page.getByText(/^236 de 236$/))).toBeVisible();
  await page.getByRole("button", { name: /^4\.1\.8 Garbage Collection/ }).click();
  const panel = page.getByRole("complementary", { name: "Estação selecionada" });
  await expect(panel.getByRole("heading", { name: "Garbage Collection" })).toBeVisible();
  await expect(panel.getByText("4.1.6 Heap")).toBeVisible(); // pré-requisito
  await page.screenshot({ path: `${SHOTS}/03-roadmap.png` });
  await page.getByRole("textbox", { name: "Buscar tópico" }).fill("mvcc");
  await expect(vis(page.getByText(/^1 de 236$/))).toBeVisible();

  // Módulo
  await page.goto("/modulos/1-1-como-computadores-executam-programas");
  await expect(page.getByRole("heading", { level: 1, name: "Como computadores executam programas" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-modulo.png`, fullPage: true });

  // Estudo: tópico com texto opcional
  await page.goto("/estudo/1-1-7-stack");
  await expect(page.getByRole("heading", { level: 1, name: "Stack" })).toBeVisible();
  await expect(vis(page.getByText(/Texto de estudo para leitura opcional/))).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stack pointer e frames" })).toBeVisible();
  // Ideias de prática: lista recolhida, só títulos
  const pratica = page.locator("article summary", { hasText: "Ideias de prática" }).filter({ visible: true }).first();
  await expect(pratica).toBeVisible();
  await pratica.click();
  await expect(vis(page.getByText("Provocar um StackOverflowError controlado e ler o stack trace"))).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-estudo.png` });

  // Anotação + conclusão com um clique + revisão
  await page.getByRole("textbox", { name: "Nova anotação" }).fill("Stack: alocação = mover o rsp. Java não faz TCO.");
  await page.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(vis(page.getByText("Java não faz TCO."))).toBeVisible();
  await page.getByRole("button", { name: "Concluir tópico" }).click();
  await expect(page.getByRole("button", { name: "Marcar como revisado" })).toBeVisible();
  await page.getByRole("button", { name: "Marcar como revisado" }).click();
  await expect(vis(page.getByText(/revisado 1×/))).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/06-estudo-concluido.png` });

  // Tópico sem texto: só objetivos, ideias e conclusão
  await page.goto("/estudo/4-1-8-garbage-collection");
  await expect(page.getByRole("heading", { level: 1, name: "Garbage Collection" })).toBeVisible();
  await expect(page.getByText(/Texto de estudo para leitura opcional/).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Concluir tópico" })).toBeEnabled();

  // Nova sessão (outro "navegador"): o progresso vem do banco
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await login(page2);
  await expect(vis(page2.getByText(/último estudo/i))).toBeVisible();
  await expect(vis(page2.getByText("1 de 236 tópicos concluídos", { exact: false }))).toBeVisible();
  await page2.screenshot({ path: `${SHOTS}/08-inicio-retorno.png`, fullPage: true });
  await page2.goto("/estudo/1-1-7-stack");
  await expect(page2.getByText("Concluído", { exact: true }).first()).toBeVisible();
  await expect(vis(page2.getByText("Java não faz TCO."))).toBeVisible();

  // Evolução
  await page2.goto("/evolucao");
  await expect(page2.getByRole("heading", { name: "Evolução" })).toBeVisible();
  await expect(vis(page2.getByText("Primeira estação"))).toBeVisible();
  await page2.screenshot({ path: `${SHOTS}/09-evolucao.png`, fullPage: true });

  // Página removida responde 404
  const r = await page2.goto("/desafios");
  expect(r?.status()).toBe(404);
  await ctx2.close();
});

test("isolamento: outro usuário não vê o progresso", async ({ page }) => {
  await login(page, `e2e-outro-${Date.now()}@guie-se.local`);
  await expect(vis(page.getByText("0 de 236 tópicos concluídos", { exact: false }))).toBeVisible();
  await page.goto("/estudo/1-1-7-stack");
  await expect(page.getByText("Java não faz TCO.").filter({ visible: true })).toHaveCount(0);
});

test("mobile e tema escuro", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await login(page);

  // Nenhuma página pode ter rolagem horizontal no celular
  const pages = ["/", "/roadmap", "/estudo/1-1-7-stack", "/estudo/4-1-8-garbage-collection", "/evolucao", "/configuracoes", "/modulos/1-1-como-computadores-executam-programas"];
  for (const url of pages) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const { scrollW, vw } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
    expect(scrollW, `overflow horizontal em ${url}`).toBeLessThanOrEqual(vw);
  }

  await page.goto("/");
  await page.screenshot({ path: `${SHOTS}/12-mobile-inicio-dark.png`, fullPage: true });

  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("link", { name: "Evolução" })).toBeVisible();
  await page.waitForTimeout(600); // fim da animação de entrada
  await page.screenshot({ path: `${SHOTS}/13-mobile-menu.png` });
  await menu.getByRole("link", { name: "Roadmap" }).click();
  await expect(menu).toBeHidden(); // fecha ao navegar
  await expect(page.getByRole("heading", { name: "Roadmap Java Backend" })).toBeVisible();

  // Mapa: no celular o painel só aparece ao tocar uma estação
  await expect(page.getByRole("complementary", { name: "Estação selecionada" })).toBeHidden();
  await page.getByRole("button", { name: /^1\.1\.2 RAM/ }).click();
  await expect(page.getByRole("complementary", { name: "Estação selecionada" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/15-mobile-roadmap-estacao.png` });

  // Estudo: atalho para o botão de concluir
  await page.goto("/estudo/1-1-2-ram");
  await page.getByRole("link", { name: "Concluir tópico" }).click();
  await expect(page.getByRole("button", { name: "Concluir tópico" })).toBeInViewport();
  await page.screenshot({ path: `${SHOTS}/14-mobile-estudo.png` });
  await ctx.close();
});

test("Etapa 01: todos os tópicos têm o texto opcional renderizado", async ({ page }) => {
  await login(page, `e2e-conteudo-${Date.now()}@guie-se.local`);
  const slugs = new Set<string>();
  for (const mod of ["/modulos/1-1-como-computadores-executam-programas", "/modulos/1-2-sistema-operacional-processos-e-memoria"]) {
    await page.goto(mod);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // conteúdo chega por streaming
    await expect(page.locator('main ol a[href^="/estudo/"]').filter({ visible: true })).toHaveCount(9);
    for (const href of await page.locator('main ol a[href^="/estudo/"]').filter({ visible: true }).evaluateAll((els) => els.map((e) => e.getAttribute("href")!)))
      slugs.add(href);
  }
  expect(slugs.size).toBe(18);
  for (const href of slugs) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(vis(page.getByText(/Texto de estudo para leitura opcional/)), href).toBeVisible();
    expect(await page.locator("article h2").filter({ visible: true }).count(), `${href}: seções`).toBeGreaterThanOrEqual(8);
  }
});
