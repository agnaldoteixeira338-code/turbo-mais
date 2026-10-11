import { Logo } from './Logo';
import { BotaoTema } from './Header';

/** Moldura das telas públicas: painel roxo à esquerda (desktop) + formulário. */
export function AuthLayout({ titulo, subtitulo, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-roxo-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo tamanho="lg" className="[&_span]:text-white" />
        <div>
          <h2 className="text-4xl font-extrabold leading-tight">
            Acelere suas
            <br />
            decisões de investimento.
          </h2>
          <p className="mt-4 max-w-md text-lg text-roxo-100">
            Acompanhe cotações, monte sua watchlist, receba alertas e descubra ativos que combinam com você — tudo em um só lugar.
          </p>
        </div>
        <p className="text-sm text-roxo-200">O Turbo Mais não compra, não vende e não movimenta seu dinheiro.</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-roxo-400/30 blur-3xl" aria-hidden="true" />
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo tamanho="sm" className="lg:hidden" />
          <BotaoTema />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="titulo-pagina">{titulo}</h1>
          {subtitulo && <p className="mt-2 texto-suave">{subtitulo}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function MensagemErro({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
      {children}
    </p>
  );
}
