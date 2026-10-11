import { Link } from 'react-router-dom';
import { StarButton } from './StarButton';
import { Variacao, SeloDado } from './Indicadores';
import { Icone } from './Icone';
import { moeda } from '../utils/formatar';

/**
 * Linha de ativo: ticker, nome, preço, variação, ⭐ e "Ver detalhes".
 * `cotacaoAoVivo` (do socket) tem prioridade sobre a cotação da listagem.
 */
export function AssetRow({ ativo, ehFavorito, onAlternarFavorito, cotacaoAoVivo }) {
  const cotacao = cotacaoAoVivo ? { ...ativo.cotacao, ...cotacaoAoVivo } : ativo.cotacao;
  const ehRendaFixa = ativo.tipo === 'cdb';

  return (
    <li className="flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-zinc-50 sm:gap-4 sm:px-3 dark:hover:bg-white/5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-roxo-50 text-xs font-bold text-roxo-700 dark:bg-roxo-500/15 dark:text-roxo-200"
        aria-hidden="true"
      >
        {ativo.ticker.slice(0, 4)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{ativo.ticker}</span>
          <SeloDado cotacao={cotacao} />
        </div>
        <p className="truncate text-sm texto-suave">{ativo.nome}</p>
      </div>

      <div className="text-right">
        {ehRendaFixa ? (
          <span className="font-semibold">{cotacao?.rendimento ?? ativo.rendimentoMedio}</span>
        ) : (
          <>
            <span className="block font-semibold tabular-nums">{moeda(cotacao?.preco, cotacao?.moeda)}</span>
            <Variacao valor={cotacao?.variacaoPercentual} className="text-sm" />
          </>
        )}
      </div>

      <StarButton ticker={ativo.ticker} ativo={ehFavorito} onAlternar={onAlternarFavorito} />
      {/* Um único link: texto no desktop, seta no celular — mesmo nome acessível */}
      <Link
        to={`/ativos/${encodeURIComponent(ativo.ticker)}`}
        className="inline-flex items-center rounded-full p-2 text-sm font-semibold text-roxo-700 hover:bg-roxo-50 sm:px-3 dark:text-roxo-300 dark:hover:bg-white/10"
        aria-label={`Ver detalhes de ${ativo.ticker}`}
      >
        <span className="hidden sm:inline">Ver detalhes</span>
        <Icone nome="seta" className="h-5 w-5 sm:hidden" />
      </Link>
    </li>
  );
}
