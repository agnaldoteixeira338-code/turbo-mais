import { Card } from './Card';
import { Tooltip, GLOSSARIO } from './Tooltip';
import { Icone } from './Icone';
import { percentual } from '../utils/formatar';

const ESTILO_NIVEL = {
  baixa: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  moderada: 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  alta: 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  'muito-alta': 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200',
};

/** "2026-03" → "mar/2026" */
export function mesPorExtenso(aaaaMm) {
  const [ano, mes] = aaaaMm.split('-').map(Number);
  const nome = new Date(Date.UTC(ano, mes - 1, 15)).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${nome}/${ano}`;
}

function Estatistica({ rotulo, valor, detalhe, termo }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-white/5">
      <dt className="flex items-center text-sm texto-suave">
        {rotulo}
        {termo && <Tooltip termo={termo}>{GLOSSARIO[termo]}</Tooltip>}
      </dt>
      <dd className="mt-1 text-lg font-bold tabular-nums">{valor}</dd>
      {detalhe && <dd className="text-xs texto-suave">{detalhe}</dd>}
    </div>
  );
}

/**
 * "no último ano" ou "nos últimos 3 meses": o plano gratuito da fonte de dados
 * só libera 1 ano para alguns ativos (ADR-015), então o título diz o período real.
 */
export function periodoPorExtenso({ inicio, fim }) {
  const dias = (Date.parse(fim) - Date.parse(inicio)) / (24 * 3600 * 1000);
  if (dias >= 330) return 'no último ano';
  const meses = Math.max(1, Math.round(dias / 30.44));
  return meses === 1 ? 'no último mês' : `nos últimos ${meses} meses`;
}

/**
 * Como o preço se comportou no período disponível (ADR-015). Descreve o PASSADO
 * com dados reais; de propósito, não existe "chance de subir": ninguém sabe prever.
 */
export function ComportamentoAno({ comportamento: c }) {
  if (!c) {
    return (
      <Card titulo="Como se comportou recentemente">
        <p className="texto-suave">Ainda não há histórico suficiente para calcular o comportamento deste ativo.</p>
      </Card>
    );
  }

  const periodo = periodoPorExtenso(c.periodo);
  return (
    <Card titulo={`Como se comportou ${periodo}`}>
      <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${ESTILO_NIVEL[c.nivel.codigo] ?? ''}`}>
        <Icone nome="sinal" className="h-4 w-4" /> {c.nivel.rotulo}
      </p>
      <p className="mt-3 texto-suave">
        Em {c.mesesNoPeriodo} meses, fechou em alta em {c.mesesEmAlta}. No pior mês, {mesPorExtenso(c.piorMes.mes)}, chegou a{' '}
        {c.piorMes.variacaoPercentual < 0 ? `cair ${percentual(c.piorMes.variacaoPercentual, { sinal: false })}` : 'subir pouco'}.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Estatistica rotulo="Resultado no período" valor={percentual(c.variacaoPercentual)} />
        <Estatistica rotulo="Meses em alta" valor={`${c.mesesEmAlta} de ${c.mesesNoPeriodo}`} />
        <Estatistica rotulo="Oscilação típica por dia" valor={`± ${percentual(c.oscilacaoDiariaPercentual, { sinal: false })}`} termo="Oscilação" detalhe={`${percentual(c.volatilidadeAnualPercentual, { sinal: false })} ao ano`} />
        <Estatistica rotulo="Maior queda" valor={percentual(c.maiorQuedaPercentual)} termo="Maior queda" />
        <Estatistica rotulo="Melhor mês" valor={percentual(c.melhorMes.variacaoPercentual)} detalhe={mesPorExtenso(c.melhorMes.mes)} />
        <Estatistica rotulo="Pior mês" valor={percentual(c.piorMes.variacaoPercentual)} detalhe={mesPorExtenso(c.piorMes.mes)} />
      </dl>

      <p role="note" className="mt-4 flex gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        <Icone nome="alerta" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Isso descreve o <strong>passado</strong>, calculado com os preços reais de {c.periodo.pontos} dias de negociação{' '}
          {periodo === 'no último ano' ? '' : '(a fonte gratuita de dados libera só esse período para este ativo)'}. Não é previsão: ninguém sabe se o preço vai
          subir ou cair daqui para frente.
        </span>
      </p>
    </Card>
  );
}
