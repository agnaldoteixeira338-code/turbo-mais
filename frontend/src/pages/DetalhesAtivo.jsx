import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { EducationalCard } from '../components/EducationalCard';
import { StarButton } from '../components/StarButton';
import { Tooltip, GLOSSARIO } from '../components/Tooltip';
import { Variacao, SeloDado } from '../components/Indicadores';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { AlertaForm } from '../components/AlertaForm';
import { Button } from '../components/Button';
import { Icone } from '../components/Icone';
import { ComportamentoAno } from '../components/ComportamentoAno';
import { FatoresPreco } from '../components/FatoresPreco';
import { ativosService } from '../services/favoritos';
import { useFavoritos } from '../hooks/useFavoritos';
import { moeda, numeroCompacto, percentual, ROTULOS_RISCO, ROTULOS_TIPO, dataHora, historicoMaisCurto } from '../utils/formatar';

// Recharts só é baixado quando alguém abre um detalhe (code splitting)
const PriceChart = lazy(() => import('../components/PriceChart'));

const PERIODOS = [7, 30, 90, 365];

function Indicador({ rotulo, valor, termo }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-white/5">
      <dt className="flex items-center text-sm texto-suave">
        {rotulo}
        {termo && <Tooltip termo={termo}>{GLOSSARIO[termo]}</Tooltip>}
      </dt>
      <dd className="mt-1 text-lg font-bold tabular-nums">{valor}</dd>
    </div>
  );
}

export default function DetalhesAtivo() {
  const { ticker } = useParams();
  const navegar = useNavigate();
  const [dias, setDias] = useState(30);
  const [estado, setEstado] = useState({ carregando: true, ativo: null, erro: null });
  const { ehFavorito, alternar, cotacoesAoVivo } = useFavoritos();

  useEffect(() => {
    let ativo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    ativosService
      .detalhar(ticker, dias)
      .then((dados) => ativo && setEstado({ carregando: false, ativo: dados, erro: null }))
      .catch((erro) => ativo && setEstado({ carregando: false, ativo: null, erro }));
    return () => {
      ativo = false;
    };
  }, [ticker, dias]);

  if (estado.carregando && !estado.ativo) return <LoadingSkeleton variante="bloco" />;
  if (estado.erro) {
    return (
      <Card>
        <EmptyState
          icone="alerta"
          titulo={estado.erro.status === 404 ? 'Ativo não encontrado' : 'Não foi possível carregar'}
          descricao={estado.erro.message}
          acao={<Button para="/buscar">Voltar para a busca</Button>}
        />
      </Card>
    );
  }

  const a = estado.ativo;
  const cotacao = { ...a.cotacao, ...cotacoesAoVivo[a.ticker] };
  const rendaFixa = a.tipo === 'cdb';

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navegar(-1)} className="inline-flex items-center gap-1 text-sm font-semibold texto-suave hover:text-roxo-700">
        <Icone nome="voltar" className="h-4 w-4" /> Voltar
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-roxo-700 dark:text-roxo-300">
              {ROTULOS_TIPO[a.tipo]} · {a.setor}
            </p>
            <h1 className="titulo-pagina mt-1">{a.ticker}</h1>
            <p className="texto-suave">{a.nome}</p>
          </div>
          <StarButton ticker={a.ticker} ativo={ehFavorito(a.ticker)} onAlternar={(t) => alternar(t).catch(() => {})} tamanho="lg" />
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
          {rendaFixa ? (
            <p className="text-3xl font-extrabold">{a.rendimentoMedio}</p>
          ) : (
            <>
              <p className="text-4xl font-extrabold tabular-nums">{moeda(cotacao.preco, cotacao.moeda)}</p>
              <Variacao valor={cotacao.variacaoPercentual} className="text-lg" />
            </>
          )}
          <SeloDado cotacao={cotacao} />
        </div>
        {!rendaFixa && (
          <p className="mt-2 text-xs texto-suave">
            Fonte: {cotacao.fonte} · atualizado em {dataHora(cotacao.atualizadoEm)}
          </p>
        )}

        {!rendaFixa && (
          <div className="mt-6">
            <div className="mb-3 flex gap-2" role="group" aria-label="Período do gráfico">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDias(p)}
                  aria-pressed={dias === p}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${dias === p ? 'bg-roxo-600 text-white' : 'texto-suave hover:bg-zinc-100 dark:hover:bg-white/10'}`}
                >
                  {p === 365 ? '1A' : `${p}D`}
                </button>
              ))}
            </div>
            {a.historico?.pontos?.length ? (
              <Suspense fallback={<div className="skeleton h-64" />}>
                <PriceChart pontos={a.historico.pontos} moedaCodigo={cotacao.moeda} />
                {a.historico.desatualizado && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Histórico desatualizado: exibindo a última versão disponível.</p>}
                {historicoMaisCurto(a.historico.pontos, dias) && (
                  <p className="mt-2 text-xs texto-suave">A fonte gratuita de dados libera só os últimos 3 meses deste ativo; o gráfico mostra o período disponível.</p>
                )}
              </Suspense>
            ) : (
              <p className="rounded-2xl bg-zinc-50 p-6 text-center texto-suave dark:bg-white/5">Histórico indisponível no momento.</p>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <EducationalCard titulo={rendaFixa ? 'Como funciona' : 'O que essa empresa faz'} icone="info">
          {a.oQueFaz}
        </EducationalCard>
        <EducationalCard titulo="Papel na sociedade" icone="globo">
          {a.papelSociedade}
        </EducationalCard>
      </div>

      {!rendaFixa && <ComportamentoAno comportamento={a.comportamento} />}
      <FatoresPreco fatores={a.fatores} rendaFixa={rendaFixa} />

      <Card titulo="Raio-X">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Indicador rotulo="Setor" valor={a.setor} />
          <Indicador rotulo="País" valor={a.pais} />
          <Indicador rotulo="Fundação" valor={a.fundacao ?? '—'} />
          <Indicador rotulo="Perfil de risco" valor={ROTULOS_RISCO[a.perfilRisco]} termo="Perfil de risco" />
          {!rendaFixa && (
            <>
              <Indicador rotulo="P/L" valor={a.indicadores?.pl?.toLocaleString('pt-BR') ?? '—'} termo="P/L" />
              <Indicador rotulo="Dividend Yield" valor={a.indicadores?.dividendYield != null ? percentual(a.indicadores.dividendYield, { sinal: false }) : '—'} termo="Dividend Yield" />
              <Indicador rotulo="Market Cap" valor={numeroCompacto(a.indicadores?.marketCap)} termo="Market Cap" />
            </>
          )}
          {rendaFixa && <Indicador rotulo="Rendimento" valor={a.rendimentoMedio} termo="CDI" />}
        </dl>
        <p className="mt-4 text-xs texto-suave">
          Conteúdo educativo. Não é recomendação de investimento. Rentabilidade passada não garante rentabilidade futura.
        </p>
      </Card>

      {!rendaFixa && (
        <Card titulo="🔔 Configurar alerta">
          <AlertaForm ticker={a.ticker} />
        </Card>
      )}
    </div>
  );
}
