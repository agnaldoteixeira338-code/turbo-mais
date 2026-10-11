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
