import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from './Icone';
import { percentual } from '../utils/formatar';

const DURACAO_MS = 7000;

function Toast({ notificacao, onFechar }) {
  useEffect(() => {
    const id = setTimeout(() => onFechar(notificacao.id), DURACAO_MS);
    return () => clearTimeout(id);
  }, [notificacao.id, onFechar]);

  const alta = notificacao.direcao === 'alta';
  return (
    <div className="pointer-events-auto flex w-full max-w-sm animate-entrar items-start gap-3 rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
      <span className={`mt-0.5 rounded-2xl p-2 ${alta ? 'bg-emerald-50 text-alta dark:bg-emerald-500/15' : 'bg-red-50 text-baixa dark:bg-red-500/15'}`}>
        <Icone nome={alta ? 'alta' : 'baixa'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {alta ? '📈' : '📉'} {notificacao.ticker} {percentual(notificacao.variacao)}
        </p>
        <p className="text-sm texto-suave">Seu alerta foi disparado.</p>
        <Link to={`/ativos/${encodeURIComponent(notificacao.ticker)}`} className="mt-1 inline-block text-sm font-semibold text-roxo-700 dark:text-roxo-300">
          Ver ativo
        </Link>
      </div>
      <button type="button" onClick={() => onFechar(notificacao.id)} className="rounded-full p-1 texto-suave hover:bg-zinc-100 dark:hover:bg-white/10" aria-label="Fechar notificação">
        <Icone nome="fechar" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Pilha de toasts. role="status" + aria-live: leitores de tela anunciam sem roubar o foco. */
export function NotificationToast({ toasts, onFechar }) {
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6">
      {toasts.map((t) => (
        <Toast key={t.id} notificacao={t} onFechar={onFechar} />
      ))}
    </div>
  );
}
