import { Link } from 'react-router-dom';
import { ROTULOS_TIPO } from '../utils/formatar';
import { StarButton } from './StarButton';

/**
 * Card de sugestão: posição, ativo e "Por que combina com você".
 * Propositalmente SEM botão de compra — o Turbo Mais informa, não vende.
 */
export function SuggestionCard({ sugestao, ehFavorito, onAlternarFavorito }) {
  return (
    <article className="card flex animate-entrar flex-col gap-3">
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-roxo-600 font-bold text-white" aria-label={`Posição ${sugestao.posicao}`}>
          {sugestao.posicao}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">
            {sugestao.ticker} <span className="font-normal texto-suave">· {ROTULOS_TIPO[sugestao.tipo] ?? sugestao.tipo}</span>
          </h3>
          <p className="truncate text-sm texto-suave">{sugestao.nome}</p>
        </div>
        <StarButton ticker={sugestao.ticker} ativo={ehFavorito} onAlternar={onAlternarFavorito} />
      </header>
      <div className="rounded-2xl bg-roxo-50/70 p-4 text-sm leading-relaxed dark:bg-roxo-500/10">
        <p className="mb-1 font-semibold text-roxo-800 dark:text-roxo-200">Por que combina com você</p>
        <p className="text-zinc-700 dark:text-zinc-300">{sugestao.justificativa}</p>
      </div>
      <Link to={`/ativos/${encodeURIComponent(sugestao.ticker)}`} className="self-start text-sm font-semibold text-roxo-700 hover:underline dark:text-roxo-300">
        Entender este ativo →
      </Link>
    </article>
  );
}
