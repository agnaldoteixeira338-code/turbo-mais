/** Formatação pt-BR centralizada (Intl é caro de instanciar: reaproveitamos). */
const formatadoresMoeda = new Map();

export function moeda(valor, codigo = 'BRL') {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  if (!formatadoresMoeda.has(codigo)) {
    formatadoresMoeda.set(codigo, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: codigo, maximumFractionDigits: 2 }));
  }
  return formatadoresMoeda.get(codigo).format(Number(valor));
}

export function percentual(valor, { sinal = true } = {}) {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  const n = Number(valor);
  const texto = `${Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (!sinal) return texto;
  if (n > 0) return `+${texto}`;
  if (n < 0) return `-${texto}`;
  return texto;
}

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export function numeroCompacto(valor) {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  return compacto.format(Number(valor));
}

const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export function dataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dataHoraFmt.format(d);
}

export function dataCurta(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Lê um valor em reais digitado do jeito brasileiro: "1.234,56", "1234,5",
 * "R$ 10.000" ou "1500". Devolve NaN para texto vazio ou inválido.
 */
export function lerReais(texto) {
  let limpo = String(texto ?? '').replace(/R\$|\s/g, '');
  if (!limpo) return Number.NaN;
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  else if ((limpo.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(limpo)) limpo = limpo.replace(/\./g, '');
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : Number.NaN;
}

/** 1234.5 → "1.234,50" (para exibir de volta no campo, sem o "R$"). */
export function reaisParaCampo(valor) {
  return Number.isFinite(valor) ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}

/** "2026-10-23" → "23/10/2026" */
export function dataLonga(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

/** 24 → "2 anos"; 18 → "1 ano e 6 meses"; 7 → "7 meses" */
export function prazoPorExtenso(meses) {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const parteAnos = anos === 0 ? '' : `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  const parteMeses = resto === 0 ? '' : `${resto} ${resto === 1 ? 'mês' : 'meses'}`;
  return [parteAnos, parteMeses].filter(Boolean).join(' e ') || '0 meses';
}

export const ROTULOS_TIPO = Object.freeze({
  acao_br: 'Ações BR',
  acao_global: 'Ações Globais',
  cripto: 'Cripto',
  cdb: 'CDBs',
});

export const ROTULOS_RISCO = Object.freeze({
  conservador: 'Conservador',
  moderado: 'Moderado',
  arrojado: 'Arrojado',
});

export function tendencia(variacao) {
  if (!Number.isFinite(Number(variacao)) || Number(variacao) === 0) return 'neutra';
  return Number(variacao) > 0 ? 'alta' : 'baixa';
}
