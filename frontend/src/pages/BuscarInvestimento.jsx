import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { AssetRow } from '../components/AssetRow';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Icone } from '../components/Icone';
import { ativosService } from '../services/favoritos';
import { useFavoritos } from '../hooks/useFavoritos';
import { useDebounce } from '../hooks/useDebounce';

export const ABAS = [
  { id: 'criptomoedas', rotulo: 'Cripto' },
  { id: 'cdbs', rotulo: 'CDBs' },
  { id: 'bancos', rotulo: 'Bancos' },
  { id: 'acoes-brasileiras', rotulo: 'Ações BR' },
  { id: 'acoes-globais', rotulo: 'Ações Globais' },
];

export default function BuscarInvestimento() {
  const [params, setParams] = useSearchParams();
  const aba = ABAS.some((a) => a.id === params.get('aba')) ? params.get('aba') : 'acoes-brasileiras';
  const [termo, setTermo] = useState('');
  const termoDebounced = useDebounce(termo, 350);
  const [estado, setEstado] = useState({ carregando: true, itens: [], erro: null });
  const { ehFavorito, alternar, cotacoesAoVivo } = useFavoritos();

  useEffect(() => {
    // AbortController: trocar de aba rápido cancela a requisição anterior
    // (evita a resposta antiga sobrescrever a nova — race condition clássica)
    const controle = new AbortController();
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    ativosService
      .listarPorCategoria(aba, { q: termoDebounced || undefined }, controle.signal)
      .then(({ data }) => setEstado({ carregando: false, itens: data, erro: null }))
      .catch((erro) => erro.name !== 'AbortError' && setEstado({ carregando: false, itens: [], erro }));
    return () => controle.abort();
  }, [aba, termoDebounced]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">Buscar investimento</h1>
        <p className="mt-1 texto-suave">Explore, entenda e favorite. A compra você faz na sua corretora.</p>
      </header>

      <div className="relative">
        <Icone nome="busca" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou código (ex.: PETR4, Apple)"
          aria-label="Buscar ativo"
          className="campo pl-12"
          maxLength={60}
        />
      </div>

      <div role="tablist" aria-label="Categorias" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={aba === a.id}
            onClick={() => setParams({ aba: a.id })}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              aba === a.id ? 'bg-roxo-600 text-white' : 'bg-white text-zinc-700 hover:bg-roxo-50 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <Card role="tabpanel" aria-busy={estado.carregando}>
        {aba === 'cdbs' && (
          <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            CDBs listados são exemplos didáticos de estruturas comuns, não ofertas reais. Compare taxas na sua corretora.
          </p>
        )}
        {estado.carregando ? (
          <LoadingSkeleton linhas={6} />
        ) : estado.erro ? (
          <EmptyState icone="alerta" titulo="Não foi possível carregar" descricao={estado.erro.message} />
        ) : estado.itens.length === 0 ? (
          <EmptyState icone="busca" titulo="Nada encontrado" descricao="Tente outro nome ou código." />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-white/5">
            {estado.itens.map((ativo) => (
              <AssetRow
                key={ativo.ticker}
                ativo={ativo}
                ehFavorito={ehFavorito(ativo.ticker)}
                onAlternarFavorito={(t) => alternar(t).catch(() => {})}
                cotacaoAoVivo={cotacoesAoVivo[ativo.ticker]}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
