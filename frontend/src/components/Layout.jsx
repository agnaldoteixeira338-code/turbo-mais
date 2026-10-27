import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationToast } from './NotificationToast';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useNotificacoes } from '../hooks/useNotificacoes';

/** Casca das telas autenticadas: header + navegação + toasts. */
export function Layout() {
  const { toasts, dispensarToast } = useNotificacoes();
  return (
    <div className="min-h-screen">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-roxo-600 focus:px-4 focus:py-2 focus:text-white">
        Pular para o conteúdo
      </a>
      <Header />
      <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
        <Sidebar />
        <main id="conteudo" className="min-w-0 flex-1">
          <Outlet />
          <RodapeFontes />
        </main>
      </div>
      <NotificationToast toasts={toasts} onFechar={dispensarToast} />
    </div>
  );
}

const FONTES = [
  { nome: 'brapi', url: 'https://brapi.dev' },
  { nome: 'CoinGecko', url: 'https://www.coingecko.com' },
  { nome: 'Alpha Vantage', url: 'https://www.alphavantage.co' },
];

/** Crédito das fontes de dados (exigido pelo plano gratuito da CoinGecko) + aviso educativo. */
export function RodapeFontes() {
  return (
    <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs texto-suave dark:border-white/10">
      <p>
        Cotações fornecidas por{' '}
        {FONTES.map((f, i) => (
          <span key={f.nome}>
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:text-roxo-700 hover:underline dark:hover:text-roxo-300">
              {f.nome}
            </a>
            {i < FONTES.length - 1 ? ', ' : '.'}
          </span>
        ))}{' '}
        Taxas de juros do simulador:{' '}
        <a href="https://dadosabertos.bcb.gov.br" target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:text-roxo-700 hover:underline dark:hover:text-roxo-300">
          Banco Central do Brasil
        </a>
        . Os dados podem ter atraso.
      </p>
      <p className="mt-1">O Turbo Mais não compra, não vende e não movimenta dinheiro. Conteúdo educativo, não é recomendação de investimento.</p>
    </footer>
  );
}

/** Protege rotas: sem sessão → /login (guardando de onde o usuário veio). */
export function RotaProtegida({ children }) {
  const { autenticado, carregando } = useAuth();
  const local = useLocation();
  if (carregando) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LoadingSkeleton variante="bloco" />
      </div>
    );
  }
  if (!autenticado) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  return children;
}

/** Telas públicas (login/cadastro): quem já está logado vai para o início. */
export function RotaPublica({ children }) {
  const { autenticado, carregando } = useAuth();
  if (carregando) return null;
  if (autenticado) return <Navigate to="/" replace />;
  return children;
}
