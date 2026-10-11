import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Variacao, SeloDado } from '../components/Indicadores';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ativosService } from '../services/favoritos';
import { useFavoritos } from '../hooks/useFavoritos';
import { moeda } from '../utils/formatar';

const CATEGORIAS = [
  { id: 'criptomoedas', titulo: 'Cripto', emoji: '🪙' },
  { id: 'cdbs', titulo: 'CDBs', emoji: '🏦' },
  { id: 'acoes-brasileiras', titulo: 'Ações BR', emoji: '🇧🇷' },
  { id: 'acoes-globais', titulo: 'Ações Globais', emoji: '🌎' },
];

function media(lista) {
  const valores = lista.map((a) => a.cotacao?.variacaoPercentual).filter(Number.isFinite);
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null;
}

function MiniLista({ itens, aoVivo = {} }) {
  return (
    <ul className="space-y-1">
      {itens.map((a) => {
        const c = { ...a.cotacao, ...aoVivo[a.ticker] };
        return (
          <li key={a.ticker}>
            <Link to={`/ativos/${encodeURIComponent(a.ticker)}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-white/5">
              <span className="flex items-center gap-2 font-semibold">
                {a.ticker} <SeloDado cotacao={c} />
              </span>
              {a.tipo === 'cdb' ? (
                <span className="text-sm">{c.rendimento ?? a.rendimentoMedio}</span>
              ) : (
                <span className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums texto-suave">{moeda(c.preco, c.moeda)}</span>
                  <Variacao valor={c.variacaoPercentual} />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Painel de ACOMPANHAMENTO por categoria. Por decisão de produto, sem
 * quantidade, preço de compra, lucro ou prejuízo: o Turbo Mais não sabe
 * (e não quer saber) quanto dinheiro você tem — ele mostra o mercado.
 */
export default function MinhaCarteira() {
  const { itens: favoritos, cotacoesAoVivo } = useFavoritos();
  const [mercado, setMercado] = useState(null);

  useEffect(() => {
    const controle = new AbortController();
    Promise.all(CATEGORIAS.map((c) => ativosService.listarPorCategoria(c.id, { limit: 20 }, controle.signal).then((r) => [c.id, r.data])))
      .then((pares) => setMercado(Object.fromEntries(pares)))
      .catch((e) => e.name !== 'AbortError' && setMercado({}));
    return () => controle.abort();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">💼 Minha Carteira</h1>
        <p className="mt-1 texto-suave">Visão geral do mercado e dos seus favoritos — sem valores investidos, só acompanhamento.</p>
      </header>

      <Card titulo="⭐ Favoritos">
        {favoritos.length === 0 ? (
          <p className="texto-suave">Você ainda não favoritou nenhum ativo.</p>
        ) : (
          <MiniLista itens={favoritos.filter((f) => f.ativo).map((f) => f.ativo)} aoVivo={cotacoesAoVivo} />
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORIAS.map((c) => {
          const itens = mercado?.[c.id] ?? [];
          const m = media(itens);
          return (
            <Card
              key={c.id}
              titulo={`${c.emoji} ${c.titulo}`}
              acao={c.id !== 'cdbs' && m != null ? <span className="text-sm texto-suave">média do dia <Variacao valor={m} /></span> : null}
            >
              {mercado === null ? <LoadingSkeleton linhas={3} /> : itens.length === 0 ? <p className="texto-suave">Indisponível no momento.</p> : <MiniLista itens={itens} aoVivo={cotacoesAoVivo} />}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
