import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Tooltip, GLOSSARIO } from '../components/Tooltip';
import { Icone } from '../components/Icone';
import { simuladorService } from '../services/simulador';
import { useDebounce } from '../hooks/useDebounce';
import { dataLonga, lerReais, moeda, percentual, prazoPorExtenso, reaisParaCampo } from '../utils/formatar';
import { ESTILO_MODALIDADE } from '../utils/modalidades';

// Recharts é pesado: o gráfico vem em um chunk separado
const SimuladorChart = lazy(() => import('../components/SimuladorChart'));

export const ATALHOS_PRAZO = [
  { meses: 6, rotulo: '6 meses' },
  { meses: 12, rotulo: '1 ano' },
  { meses: 24, rotulo: '2 anos' },
  { meses: 60, rotulo: '5 anos' },
  { meses: 120, rotulo: '10 anos' },
];
const LIMITES = { valorInicial: 10_000_000, aporteMensal: 1_000_000, prazoMeses: 360 };
const TERMOS_GLOSSARIO = ['Selic', 'CDI', 'IR regressivo', 'CDB', 'LCI/LCA', 'Tesouro Selic', 'Poupança'];

const taxa = (v, casas = 2) => `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

/** Mesmas regras do backend, para avisar na hora (o backend valida de novo). */
function validar({ valorInicial, aporteMensal, prazoMeses }) {
  const erros = {};
  if (!Number.isFinite(valorInicial) || valorInicial < 0 || valorInicial > LIMITES.valorInicial) {
    erros.valorInicial = 'Use um valor entre R$ 0 e R$ 10.000.000, como 10.000,00.';
  }
  if (!Number.isFinite(aporteMensal) || aporteMensal < 0 || aporteMensal > LIMITES.aporteMensal) {
    erros.aporteMensal = 'Use um valor entre R$ 0 e R$ 1.000.000, como 500,00.';
  }
  if (!Number.isInteger(prazoMeses) || prazoMeses < 1 || prazoMeses > LIMITES.prazoMeses) {
    erros.prazoMeses = 'O prazo vai de 1 a 360 meses (30 anos).';
  }
  if (!erros.valorInicial && !erros.aporteMensal && valorInicial === 0 && aporteMensal === 0) {
    erros.valorInicial = 'Informe um valor inicial ou um aporte mensal.';
  }
  return erros;
}

const lerCampo = (texto) => (String(texto).trim() === '' ? 0 : lerReais(texto));

/** Simulador: atualiza sozinho enquanto a pessoa digita (debounce), sem botão "calcular". */
export default function Simulador() {
  const [campos, setCampos] = useState({ valorInicial: '10.000,00', aporteMensal: '500,00', prazoMeses: '24' });
  const [resultado, setResultado] = useState(null);
  const [taxas, setTaxas] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erroApi, setErroApi] = useState('');

  const valores = useMemo(
    () => ({ valorInicial: lerCampo(campos.valorInicial), aporteMensal: lerCampo(campos.aporteMensal), prazoMeses: Number(campos.prazoMeses) }),
    [campos],
  );
  const erros = validar(valores);
  // String estável: o debounce só dispara quando os VALORES mudam (não a cada objeto novo)
  const pedido = Object.keys(erros).length === 0 ? JSON.stringify(valores) : null;
  const pedidoAtrasado = useDebounce(pedido, 400);

  useEffect(() => {
    simuladorService.taxas().then(setTaxas).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pedidoAtrasado) return undefined;
    const controle = new AbortController();
    setCarregando(true);
    setErroApi('');
    simuladorService
      .simular(JSON.parse(pedidoAtrasado), { signal: controle.signal })
      .then((r) => {
        setResultado(r);
        setTaxas(r.taxas);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setErroApi(e.message);
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false);
      });
    // digitou de novo antes da resposta: cancela o pedido antigo
    return () => controle.abort();
  }, [pedidoAtrasado]);

  const alterar = (campo) => (e) => setCampos((c) => ({ ...c, [campo]: e.target.value }));
  const formatarAoSair = (campo) => () => {
    const n = lerReais(campos[campo]);
    if (Number.isFinite(n)) setCampos((c) => ({ ...c, [campo]: reaisParaCampo(n) }));
  };

  const ordenadas = resultado ? [...resultado.modalidades].sort((a, b) => b.valorLiquido - a.valorLiquido) : [];
  const vencedora = ordenadas[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">🧮 Simulador</h1>
        <p className="mt-1 texto-suave">Quanto o seu dinheiro renderia em cada aplicação, já descontado o imposto de renda.</p>
      </header>

      <Card as="form" onSubmit={(e) => e.preventDefault()} aria-label="Dados da simulação">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            rotulo="Valor inicial (R$)"
            inputMode="decimal"
            autoComplete="off"
            value={campos.valorInicial}
            onChange={alterar('valorInicial')}
            onBlur={formatarAoSair('valorInicial')}
            erro={erros.valorInicial}
          />
          <Input
            rotulo="Aporte mensal (R$)"
            inputMode="decimal"
            autoComplete="off"
            value={campos.aporteMensal}
            onChange={alterar('aporteMensal')}
            onBlur={formatarAoSair('aporteMensal')}
            erro={erros.aporteMensal}
            dica={erros.aporteMensal ? undefined : 'Pode ser 0'}
          />
          <Input
            rotulo="Prazo (meses)"
            type="number"
            inputMode="numeric"
            min={1}
            max={360}
            value={campos.prazoMeses}
            onChange={alterar('prazoMeses')}
            erro={erros.prazoMeses}
            dica={erros.prazoMeses ? undefined : prazoPorExtenso(valores.prazoMeses || 0)}
          />
        </div>
        <div role="group" aria-label="Atalhos de prazo" className="mt-4 flex flex-wrap gap-2">
          {ATALHOS_PRAZO.map((a) => {
            const ativo = valores.prazoMeses === a.meses;
            return (
              <button
                key={a.meses}
                type="button"
                aria-pressed={ativo}
                onClick={() => setCampos((c) => ({ ...c, prazoMeses: String(a.meses) }))}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  ativo ? 'bg-roxo-600 text-white' : 'bg-roxo-50 text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-500/15 dark:text-roxo-200 dark:hover:bg-roxo-500/25'
                }`}
              >
                {a.rotulo}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Anúncio para leitor de tela: só o resumo, não cada tecla */}
      <p className="sr-only" aria-live="polite">
        {vencedora && !carregando
          ? `Em ${prazoPorExtenso(resultado.parametros.prazoMeses)}, quem mais rende é ${vencedora.nome}: ${moeda(vencedora.valorLiquido)} líquidos para ${moeda(resultado.totalInvestido)} investidos.`
          : ''}
      </p>

      {erroApi && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {erroApi}
        </p>
      )}

      {!resultado && carregando && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-44" />
          ))}
        </div>
      )}

      {resultado && (
        <section aria-labelledby="titulo-resultado" aria-busy={carregando} className={`space-y-4 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <h2 id="titulo-resultado" className="text-xl font-bold">
            {moeda(resultado.totalInvestido)} investidos em {prazoPorExtenso(resultado.parametros.prazoMeses)}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ordenadas.map((m) => (
              <li key={m.id}>
                <CardModalidade modalidade={m} melhor={m.id === resultado.melhor} />
              </li>
            ))}
          </ul>

          <Card titulo="Evolução do valor líquido">
            <Suspense fallback={<div className="skeleton h-72" />}>
              <SimuladorChart modalidades={resultado.modalidades} melhor={resultado.melhor} />
            </Suspense>
            <p className="mt-2 text-xs texto-suave">Cada ponto mostra quanto você teria se resgatasse naquele mês, já descontados o IR e a custódia.</p>
          </Card>
        </section>
      )}

      <PainelTaxas taxas={taxas} />

      <Card titulo="Entenda os termos">
        <dl className="grid gap-4 sm:grid-cols-2">
          {TERMOS_GLOSSARIO.map((termo) => (
            <div key={termo}>
              <dt className="font-semibold">{termo}</dt>
              <dd className="mt-1 text-sm texto-suave">{GLOSSARIO[termo]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <p role="note" className="flex gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        <Icone nome="alerta" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Simulação educativa, não é recomendação de investimento.</strong> Considera as taxas de hoje constantes durante todo o prazo, IR regressivo
          calculado por aporte e a custódia do Tesouro Selic. Não inclui IOF (só vale para resgates com menos de 30 dias).
        </span>
      </p>
    </div>
  );
}

function CardModalidade({ modalidade: m, melhor }) {
  const estilo = ESTILO_MODALIDADE[m.id];
  return (
    <article
      aria-label={`${m.nome}${melhor ? ', a que mais rende' : ''}`}
      className={`card h-full space-y-3 ${melhor ? 'ring-2 ring-roxo-500 dark:ring-roxo-400' : ''}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: estilo?.cor }} aria-hidden="true" />
        <h3 className="font-bold">{m.nome}</h3>
        {estilo && <Tooltip termo={estilo.termo}>{GLOSSARIO[estilo.termo]}</Tooltip>}
        {melhor && <span className="ml-auto rounded-full bg-roxo-600 px-3 py-1 text-xs font-bold text-white">🏆 Rendeu mais</span>}
      </header>
      <div>
        <p className="text-2xl font-extrabold tracking-tight">{moeda(m.valorLiquido)}</p>
        <p className="text-sm font-semibold text-alta">
          +{moeda(m.rendimentoLiquido)} ({percentual(m.rendimentoLiquidoPercentual, { sinal: false })}) de rendimento líquido
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="texto-suave">Investido</dt>
        <dd className="text-right">{moeda(m.totalInvestido)}</dd>
        <dt className="texto-suave">Valor bruto</dt>
        <dd className="text-right">{moeda(m.valorBruto)}</dd>
        <dt className="texto-suave">Imposto de renda</dt>
        <dd className="text-right">{m.isentaIR ? <span className="font-semibold text-alta">Isento</span> : `− ${moeda(m.irPago)}`}</dd>
        {m.custodia > 0 && (
          <>
            <dt className="texto-suave">Custódia B3</dt>
            <dd className="text-right">− {moeda(m.custodia)}</dd>
          </>
        )}
      </dl>
    </article>
  );
}

function PainelTaxas({ taxas }) {
  if (!taxas) return null;
  return (
    <Card titulo="Taxas usadas">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li>
          Selic <strong>{taxa(taxas.selicMeta)} a.a.</strong>
          <Tooltip termo="Selic">{GLOSSARIO.Selic}</Tooltip>
        </li>
        <li>
          CDI <strong>{taxa(taxas.cdi)} a.a.</strong>
          <Tooltip termo="CDI">{GLOSSARIO.CDI}</Tooltip>
        </li>
        <li>
          TR <strong>{taxa(taxas.trMensal, 4)} a.m.</strong>
          <Tooltip termo="TR">{GLOSSARIO.TR}</Tooltip>
        </li>
      </ul>
      {taxas.referencia ? (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <Icone nome="alerta" className="h-4 w-4 shrink-0" />
          Taxas de referência: o Banco Central não respondeu agora, então usamos valores aproximados.
        </p>
      ) : (
        <p className="mt-3 text-sm texto-suave">
          Fonte: Banco Central do Brasil (SGS){taxas.dataReferencia ? `, dados de ${dataLonga(taxas.dataReferencia)}` : ''}
          {taxas.desatualizado ? ' · último valor conhecido (o Banco Central não respondeu agora)' : ''}.
        </p>
      )}
    </Card>
  );
}
