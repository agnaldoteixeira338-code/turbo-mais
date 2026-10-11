import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardCard } from '../components/DashboardCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Variacao } from '../components/Indicadores';
import { ativosService } from '../services/favoritos';
import { useFavoritos } from '../hooks/useFavoritos';
import { useNotificacoes } from '../hooks/useNotificacoes';
import { dataHora, moeda } from '../utils/formatar';

function LinhaCompacta({ ticker, nome, cotacao }) {
  return (
    <Link to={`/ativos/${encodeURIComponent(ticker)}`} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/5">
      <div className="min-w-0">
        <p className="font-semibold">{ticker}</p>
        <p className="truncate text-xs texto-suave">{nome}</p>
      </div>
      <div className="text-right text-sm">
        <p className="tabular-nums">{moeda(cotacao?.preco, cotacao?.moeda)}</p>
        <Variacao valor={cotacao?.variacaoPercentual} className="text-xs" />
      </div>
    </Link>
  );
}

/** Painel: maiores variações do dia, favoritos ao vivo e últimas notificações. */
export default function Dashboard() {
  const { itens: favoritos, cotacoesAoVivo, carregando: carregandoFav } = useFavoritos();
  const { notificacoes } = useNotificacoes();
  const [destaques, setDestaques] = useState(null);

  useEffect(() => {
    const controle = new AbortController();
    ativosService
      .buscar({ limit: 50 }, controle.signal)
      .then(({ data }) => {
        const comPreco = data.filter((a) => Number.isFinite(a.cotacao?.variacaoPercentual));
        comPreco.sort((a, b) => Math.abs(b.cotacao.variacaoPercentual) - Math.abs(a.cotacao.variacaoPercentual));
        setDestaques(comPreco.slice(0, 5));
      })
      .catch((e) => e.name !== 'AbortError' && setDestaques([]));
    return () => controle.abort();
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <DashboardCard titulo="Destaques do dia" icone="sinal" linkPara="/buscar">
        {destaques === null ? (
          <LoadingSkeleton linhas={4} />
        ) : destaques.length === 0 ? (
          <p className="texto-suave">Cotações indisponíveis no momento.</p>
        ) : (
          destaques.map((a) => <LinhaCompacta key={a.ticker} {...a} />)
        )}
      </DashboardCard>

      <DashboardCard titulo="Seus favoritos" icone="estrela" linkPara="/favoritos">
        {carregandoFav ? (
          <LoadingSkeleton linhas={3} />
        ) : favoritos.length === 0 ? (
          <EmptyState icone="estrela" titulo="Nenhum favorito" descricao="Toque na ⭐ de um ativo para acompanhá-lo aqui." />
        ) : (
          favoritos.slice(0, 5).map((f) => (
            <LinhaCompacta key={f.ticker} ticker={f.ticker} nome={f.ativo?.nome} cotacao={{ ...f.ativo?.cotacao, ...cotacoesAoVivo[f.ticker] }} />
          ))
        )}
      </DashboardCard>

      <DashboardCard titulo="Últimas notificações" icone="sino" linkPara="/notificacoes">
        {notificacoes.length === 0 ? (
          <EmptyState icone="sino" titulo="Tudo calmo" descricao="Crie alertas na página de um ativo para ser avisado." />
        ) : (
          <ul className="space-y-1">
            {notificacoes.slice(0, 5).map((n) => (
              <li key={n.id} className={`flex items-center justify-between rounded-2xl px-2 py-2.5 ${n.lida ? '' : 'bg-roxo-50/60 dark:bg-roxo-500/10'}`}>
                <span className="font-semibold">
                  {n.direcao === 'alta' ? '📈' : '📉'} {n.ticker}
                </span>
                <span className="text-right text-sm">
                  <Variacao valor={n.variacao} className="text-xs" />
                  <span className="block text-xs texto-suave">{dataHora(n.criadoEm)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}
