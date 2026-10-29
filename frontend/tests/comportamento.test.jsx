import { render, screen, within } from '@testing-library/react';
import { ComportamentoAno, mesPorExtenso, periodoPorExtenso } from '../src/components/ComportamentoAno';
import { FatoresPreco } from '../src/components/FatoresPreco';
import { historicoMaisCurto } from '../src/utils/formatar';

const COMPORTAMENTO = {
  periodo: { inicio: '2025-10-29', fim: '2026-10-29', pontos: 249 },
  variacaoPercentual: 12.3,
  mesesEmAlta: 7,
  mesesNoPeriodo: 13,
  diasEmAltaPercentual: 51.2,
  oscilacaoDiariaPercentual: 1.9,
  volatilidadeAnualPercentual: 30.1,
  maiorQuedaPercentual: -18.4,
  melhorMes: { mes: '2026-03', variacaoPercentual: 9.8 },
  piorMes: { mes: '2026-07', variacaoPercentual: -9.4 },
  nivel: { codigo: 'alta', rotulo: 'Oscila bastante' },
};

describe('ComportamentoAno', () => {
  it('mostra o nível de oscilação, o resumo em frase e as estatísticas do último ano', () => {
    render(<ComportamentoAno comportamento={COMPORTAMENTO} />);
    expect(screen.getByRole('heading', { name: 'Como se comportou no último ano' })).toBeInTheDocument();
    expect(screen.getByText('Oscila bastante')).toBeInTheDocument();
    expect(screen.getByText(/Em 13 meses, fechou em alta em 7\. No pior mês, jul\/2026, chegou a cair 9,40%/)).toBeInTheDocument();

    const valor = (rotulo) => screen.getByText(rotulo).closest('div').querySelector('dd').textContent;
    expect(valor('Resultado no período')).toBe('+12,30%');
    expect(valor('Meses em alta')).toBe('7 de 13');
    expect(valor('Oscilação típica por dia')).toBe('± 1,90%');
    expect(valor('Maior queda')).toBe('-18,40%');
    expect(screen.getByText('30,10% ao ano')).toBeInTheDocument();
    expect(screen.getByText('mar/2026')).toBeInTheDocument();
  });

  it('deixa claro que descreve o passado e não é previsão (sem "chance de subir")', () => {
    render(<ComportamentoAno comportamento={COMPORTAMENTO} />);
    expect(screen.getByRole('note')).toHaveTextContent('Isso descreve o passado');
    expect(screen.getByRole('note')).toHaveTextContent('Não é previsão');
    expect(screen.queryByText(/chance|probabilidade/i)).not.toBeInTheDocument();
  });

  it('sem histórico suficiente, explica em vez de mostrar números', () => {
    render(<ComportamentoAno comportamento={null} />);
    expect(screen.getByText(/Ainda não há histórico suficiente/)).toBeInTheDocument();
  });

  it('formata o mês por extenso', () => {
    expect(mesPorExtenso('2026-01')).toBe('jan/2026');
    expect(mesPorExtenso('2025-12')).toBe('dez/2025');
  });

  it('com só 3 meses de histórico (limite do plano gratuito), diz o período real no título e explica', () => {
    const tresMeses = { ...COMPORTAMENTO, periodo: { inicio: '2026-07-31', fim: '2026-10-29', pontos: 63 }, mesesNoPeriodo: 4, mesesEmAlta: 2 };
    render(<ComportamentoAno comportamento={tresMeses} />);
    expect(screen.getByRole('heading', { name: 'Como se comportou nos últimos 3 meses' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('a fonte gratuita de dados libera só esse período');
  });

  it('escreve o período por extenso', () => {
    expect(periodoPorExtenso({ inicio: '2025-10-29', fim: '2026-10-29' })).toBe('no último ano');
    expect(periodoPorExtenso({ inicio: '2026-07-31', fim: '2026-10-29' })).toBe('nos últimos 3 meses');
    expect(periodoPorExtenso({ inicio: '2026-10-01', fim: '2026-10-29' })).toBe('no último mês');
  });
});

describe('Gráfico com histórico mais curto que o pedido', () => {
  const pontos = (inicio, fim) => [{ data: inicio, preco: 1 }, { data: fim, preco: 2 }];

  it('avisa quando pediu 1 ano e a fonte entregou ~3 meses', () => {
    expect(historicoMaisCurto(pontos('2026-07-31', '2026-10-29'), 365)).toBe(true);
    expect(historicoMaisCurto(pontos('2025-10-29', '2026-10-29'), 365)).toBe(false);
    expect(historicoMaisCurto(pontos('2026-07-31', '2026-10-29'), 90)).toBe(false); // pediu 3 meses: está completo
    expect(historicoMaisCurto([], 365)).toBe(false);
  });
});

describe('FatoresPreco', () => {
  const FATORES = { alta: ['Petróleo caro no mercado internacional', 'Dividendos altos'], baixa: ['Petróleo em queda'] };

  it('lista o que costuma fazer o preço subir e cair', () => {
    render(<FatoresPreco fatores={FATORES} />);
    expect(screen.getByRole('heading', { name: 'O que costuma fazer o preço subir ou cair' })).toBeInTheDocument();
    const sobe = screen.getByRole('region', { name: 'Costuma subir com' });
    const cai = screen.getByRole('region', { name: 'Costuma cair com' });
    expect(within(sobe).getAllByRole('listitem').map((li) => li.textContent)).toEqual(FATORES.alta);
    expect(within(cai).getByText('Petróleo em queda')).toBeInTheDocument();
    expect(screen.getByText(/não garantem o que vai acontecer/)).toBeInTheDocument();
  });

  it('na renda fixa, fala em render mais ou menos', () => {
    render(<FatoresPreco fatores={{ alta: ['Selic e CDI em alta: rende mais'], baixa: ['Selic e CDI em queda: rende menos'] }} rendaFixa />);
    expect(screen.getByRole('heading', { name: 'O que faz render mais ou menos' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rende mais quando' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rende menos ou tem risco quando' })).toBeInTheDocument();
  });

  it('sem fatores cadastrados, não mostra o card', () => {
    const { container } = render(<FatoresPreco fatores={{ alta: [], baixa: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
