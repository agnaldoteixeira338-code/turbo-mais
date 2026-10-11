import { Icone } from './Icone';
import { percentual, tendencia } from '../utils/formatar';

/** Variação % colorida (verde/vermelho) com seta — a cor nunca é o ÚNICO sinal. */
export function Variacao({ valor, className = '' }) {
  const t = tendencia(valor);
  const cores = { alta: 'text-alta', baixa: 'text-baixa', neutra: 'texto-suave' }[t];
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${cores} ${className}`}>
      {t !== 'neutra' && <Icone nome={t} className="h-4 w-4" />}
      <span>{percentual(valor)}</span>
      <span className="sr-only">{t === 'alta' ? 'em alta' : t === 'baixa' ? 'em queda' : ''}</span>
    </span>
  );
}

/**
 * Selo de QUALIDADE DO DADO. Mostrar ao usuário que um preço é antigo ou
 * simulado é parte do contrato de resiliência (ADR-007): degradar, sim;
 * enganar, nunca.
 */
export function SeloDado({ cotacao }) {
  if (!cotacao) return null;
  if (cotacao.indisponivel) {
    return <Selo cor="zinc" texto="Indisponível" titulo="Não foi possível obter a cotação agora" />;
  }
  if (cotacao.simulado) {
    return <Selo cor="amber" texto="Simulado" titulo="Dado simulado (modo demonstração) — não é cotação real" />;
  }
  if (cotacao.desatualizado) {
    return <Selo cor="amber" texto="Desatualizado" titulo="A fonte de dados falhou; exibindo o último valor conhecido" />;
  }
  return null;
}

function Selo({ cor, texto, titulo }) {
  const cores = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300',
  }[cor];
  return (
    <span title={titulo} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cores}`}>
      <Icone nome="alerta" className="h-3 w-3" />
      {texto}
    </span>
  );
}
