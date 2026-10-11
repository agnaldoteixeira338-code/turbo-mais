import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { AssetRow } from '../components/AssetRow';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';
import { useFavoritos } from '../hooks/useFavoritos';
import { ROTULOS_TIPO } from '../utils/formatar';

const FILTROS = [{ id: 'todos', rotulo: 'Todos' }, ...Object.entries(ROTULOS_TIPO).map(([id, rotulo]) => ({ id, rotulo }))];

export default function Favoritos() {
  const { itens, carregando, erro, alternar, cotacoesAoVivo } = useFavoritos();
  const [filtro, setFiltro] = useState('todos');
  const visiveis = useMemo(() => (filtro === 'todos' ? itens : itens.filter((f) => f.tipo === filtro)), [itens, filtro]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">⭐ Favoritos</h1>
        <p className="mt-1 texto-suave">Sua watchlist, com cotações atualizadas em tempo real.</p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filtro === f.id ? 'bg-roxo-600 text-white' : 'bg-white text-zinc-700 dark:bg-white/5 dark:text-zinc-300'}`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <Card>
        {erro && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{erro.message}</p>}
        {carregando && itens.length === 0 ? (
          <LoadingSkeleton linhas={4} />
        ) : visiveis.length === 0 ? (
          <EmptyState
            icone="estrela"
            titulo={itens.length === 0 ? 'Sua watchlist está vazia' : 'Nenhum favorito neste filtro'}
            descricao="Encontre ativos na busca e toque na estrela para acompanhá-los."
            acao={<Button para="/buscar">Buscar investimentos</Button>}
          />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-white/5">
            {visiveis
              .filter((f) => f.ativo)
              .map((f) => (
                <AssetRow key={f.ticker} ativo={f.ativo} ehFavorito onAlternarFavorito={(t) => alternar(t).catch(() => {})} cotacaoAoVivo={cotacoesAoVivo[f.ticker]} />
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
