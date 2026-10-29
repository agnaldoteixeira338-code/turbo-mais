import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulador from '../src/pages/Simulador';
import { simuladorService } from '../src/services/simulador';
import { lerReais, prazoPorExtenso, reaisParaCampo } from '../src/utils/formatar';

jest.mock('../src/services/simulador', () => ({ simuladorService: { taxas: jest.fn(), simular: jest.fn() } }));
// O Recharts não desenha no jsdom (sem layout); o gráfico tem teste visual no print do PR
jest.mock('../src/components/SimuladorChart', () => ({
  __esModule: true,
  default: function GraficoFalso() {
    return require('react').createElement('div', { 'data-testid': 'grafico' });
  },
}));

// Esperas generosas: debounce de 400 ms + render em CI lento (padrão do Testing Library é 1 s)
const ESPERA = { timeout: 4000 };

const TAXAS = { selicMeta: 13.75, cdi: 13.65, trMensal: 0.1616, dataReferencia: '2026-10-23', origem: 'banco-central', referencia: false, desatualizado: false };

function modalidade(id, nome, valorLiquido, extra = {}) {
  return {
    id, nome, isentaIR: false, disponivel: true, motivoIndisponivel: null, carenciaMeses: 0,
    totalInvestido: 22000, valorBruto: valorLiquido + 500, irPago: 500, custodia: 0, valorLiquido, valorResgatavel: valorLiquido, valorEmCarencia: 0,
    rendimentoLiquido: valorLiquido - 22000, rendimentoLiquidoPercentual: Math.round(((valorLiquido - 22000) / 22000) * 10_000) / 100,
    serie: [{ mes: 0, investido: 10000, liquido: 10000 }], ...extra,
  };
}

function resultado({ taxas = TAXAS, prazoMeses = 24 } = {}) {
  return {
    parametros: { valorInicial: 10000, aporteMensal: 500, prazoMeses },
    totalInvestido: 22000,
    melhor: 'cdb-110',
    modalidades: [
      modalidade('poupanca', 'Poupança', 24800, { isentaIR: true, irPago: 0 }),
      modalidade('cdb-100', 'CDB 100% do CDI', 26100),
      modalidade('cdb-110', 'CDB 110% do CDI', 26600),
      modalidade('tesouro-selic', 'Tesouro Selic', 26150, { custodia: 12.34 }),
      modalidade('lci-lca', 'LCI/LCA 90% do CDI', 26400, { isentaIR: true, irPago: 0 }),
    ],
    taxas,
  };
}

beforeEach(() => {
  simuladorService.taxas.mockResolvedValue(TAXAS);
  simuladorService.simular.mockImplementation(async (params) => resultado({ prazoMeses: params.prazoMeses }));
});
afterEach(() => jest.clearAllMocks());

describe('Página Simulador', () => {
  it('calcula sozinho ao abrir, ordena os cards pelo líquido e destaca o que rendeu mais', async () => {
    render(<Simulador />);

    expect(await screen.findByRole('heading', { name: /R\$\s?22\.000,00 investidos em 2 anos/ }, ESPERA)).toBeInTheDocument();
    expect(simuladorService.simular).toHaveBeenCalledWith({ valorInicial: 10000, aporteMensal: 500, prazoMeses: 24 }, expect.objectContaining({ signal: expect.any(Object) }));

    const cards = screen.getAllByRole('article');
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'CDB 110% do CDI', 'LCI/LCA 90% do CDI', 'Tesouro Selic', 'CDB 100% do CDI', 'Poupança',
    ]);
    expect(cards[0]).toHaveAccessibleName('CDB 110% do CDI, a que mais rende');
    expect(within(cards[0]).getByText(/Rendeu mais/)).toBeInTheDocument();
    expect(within(cards[1]).getByText('Isento')).toBeInTheDocument();
    expect(within(cards[2]).getByText('Custódia B3')).toBeInTheDocument();
    // o gráfico é carregado sob demanda (lazy), depois dos cards
    expect(await screen.findByTestId('grafico', {}, ESPERA)).toBeInTheDocument();
  });

  it('mostra as taxas usadas com a fonte e a data, e o aviso educativo', async () => {
    render(<Simulador />);
    expect(await screen.findByText(/Banco Central do Brasil \(SGS\), dados de 23\/10\/2026/, {}, ESPERA)).toBeInTheDocument();
    expect(screen.getByText('13,75% a.a.')).toBeInTheDocument();
    expect(screen.getByText('0,1616% a.m.')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Simulação educativa, não é recomendação de investimento.');
  });

  it('com o Banco Central fora, deixa visível que são taxas de referência', async () => {
    const referencia = { ...TAXAS, origem: 'padrao', referencia: true, dataReferencia: null };
    simuladorService.taxas.mockResolvedValue(referencia);
    simuladorService.simular.mockResolvedValue(resultado({ taxas: referencia }));
    render(<Simulador />);
    expect(await screen.findByText(/Taxas de referência/, {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByText(/Banco Central do Brasil \(SGS\)/)).not.toBeInTheDocument();
  });

  it('atualiza enquanto a pessoa digita, com debounce (sem botão de calcular)', async () => {
    render(<Simulador />);
    await screen.findByRole('heading', { name: /investidos em 2 anos/ }, ESPERA);
    simuladorService.simular.mockClear();

    const campo = screen.getByLabelText('Valor inicial (R$)');
    await userEvent.clear(campo);
    await userEvent.type(campo, '25000');

    await waitFor(() => expect(simuladorService.simular).toHaveBeenCalledWith(expect.objectContaining({ valorInicial: 25000 }), expect.anything()), ESPERA);
    // digitou 5 caracteres, mas o debounce mandou só o valor final
    expect(simuladorService.simular.mock.calls.filter(([p]) => p.valorInicial !== 25000)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /calcular/i })).not.toBeInTheDocument();
  });

  it('atalhos de prazo marcam o botão escolhido e recalculam', async () => {
    render(<Simulador />);
    await screen.findByRole('heading', { name: /investidos em 2 anos/ }, ESPERA);

    const cincoAnos = screen.getByRole('button', { name: '5 anos' });
    expect(cincoAnos).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(cincoAnos);

    expect(cincoAnos).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Prazo (meses)')).toHaveValue(60);
    await waitFor(() => expect(simuladorService.simular).toHaveBeenCalledWith(expect.objectContaining({ prazoMeses: 60 }), expect.anything()), ESPERA);
  });

  it('valida na hora e não chama a API com dados inválidos', async () => {
    render(<Simulador />);
    await screen.findByRole('heading', { name: /investidos em 2 anos/ }, ESPERA);
    simuladorService.simular.mockClear();

    await userEvent.clear(screen.getByLabelText('Valor inicial (R$)'));
    await userEvent.clear(screen.getByLabelText('Aporte mensal (R$)'));
    expect(await screen.findByText('Informe um valor inicial ou um aporte mensal.', {}, ESPERA)).toBeInTheDocument();
    expect(screen.getByLabelText('Valor inicial (R$)')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.clear(screen.getByLabelText('Prazo (meses)'));
    await userEvent.type(screen.getByLabelText('Prazo (meses)'), '400');
    expect(screen.getByText('O prazo vai de 1 a 360 meses (30 anos).')).toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 500));
    expect(simuladorService.simular).not.toHaveBeenCalled();
  });

  it('formata o valor em reais ao sair do campo', async () => {
    render(<Simulador />);
    const campo = screen.getByLabelText('Aporte mensal (R$)');
    await userEvent.clear(campo);
    await userEvent.type(campo, '1500');
    await userEvent.tab();
    expect(campo).toHaveValue('1.500,00');
  });

  it('LCI/LCA com prazo menor que a carência: card "indisponível para este prazo" com o motivo, sem valores, no fim da lista', async () => {
    const motivo = 'LCI e LCA têm prazo mínimo de 6 meses (Resolução CMN 5.215/2025). Escolha um prazo de pelo menos 6 meses.';
    simuladorService.simular.mockImplementation(async () => {
      const r = resultado({ prazoMeses: 3 });
      r.modalidades = r.modalidades.map((m) =>
        m.id === 'lci-lca'
          ? { id: m.id, nome: m.nome, isentaIR: true, disponivel: false, motivoIndisponivel: motivo, carenciaMeses: 6, valorLiquido: null, valorBruto: null, irPago: null, custodia: null, totalInvestido: null, valorResgatavel: null, valorEmCarencia: null, rendimentoLiquido: null, rendimentoLiquidoPercentual: null, serie: [] }
          : m,
      );
      return r;
    });
    render(<Simulador />);

    const card = await screen.findByRole('article', { name: 'LCI/LCA 90% do CDI, indisponível para este prazo' }, ESPERA);
    expect(within(card).getByText('Indisponível para este prazo')).toBeInTheDocument();
    expect(within(card).getByText(motivo)).toBeInTheDocument();
    expect(within(card).queryByText(/R\$/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/Rendeu mais/)).not.toBeInTheDocument();
    // vai para o fim da lista, depois das disponíveis
    expect(screen.getAllByRole('article').at(-1)).toBe(card);
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('CDB 110% do CDI, a que mais rende');
  });

  it('LCI/LCA com aportes ainda em carência: mostra quanto pode resgatar e quanto está em carência', async () => {
    simuladorService.simular.mockImplementation(async () => {
      const r = resultado();
      r.modalidades = r.modalidades.map((m) => (m.id === 'lci-lca' ? { ...m, carenciaMeses: 6, valorResgatavel: 23400, valorEmCarencia: 3000 } : m));
      return r;
    });
    render(<Simulador />);

    const card = await screen.findByRole('article', { name: 'LCI/LCA 90% do CDI' }, ESPERA);
    expect(within(card).getByText('Pode resgatar').nextSibling).toHaveTextContent(/23\.400,00/);
    expect(within(card).getByText('Em carência').nextSibling).toHaveTextContent(/3\.000,00/);
    expect(within(card).getByText(/menos de 6 meses ainda não podem ser resgatados/)).toBeInTheDocument();
    // as outras modalidades não têm carência: sem essas linhas
    expect(within(screen.getByRole('article', { name: 'CDB 100% do CDI' })).queryByText('Em carência')).not.toBeInTheDocument();
  });

  it('o glossário explica o prazo mínimo (carência)', async () => {
    render(<Simulador />);
    const glossario = screen.getByRole('heading', { name: 'Entenda os termos' }).closest('section');
    expect(within(glossario).getByText('Prazo mínimo (carência)')).toBeInTheDocument();
    expect(within(glossario).getByText(/Na LCI e na LCA são 6 meses \(Resolução CMN 5\.215\/2025\)/)).toBeInTheDocument();
  });

  it('mostra o erro da API sem quebrar a tela', async () => {
    simuladorService.simular.mockRejectedValue(Object.assign(new Error('Sem conexão com o servidor.'), { code: 'SEM_CONEXAO' }));
    render(<Simulador />);
    expect(await screen.findByRole('alert', {}, ESPERA)).toHaveTextContent('Sem conexão com o servidor.');
  });
});

describe('Valores em reais', () => {
  it.each([
    ['1.234,56', 1234.56], ['1234,5', 1234.5], ['R$ 10.000', 10000], ['1500', 1500], ['1.5', 1.5], ['10.000.000', 10_000_000], ['', Number.NaN], ['abc', Number.NaN], ['-5', Number.NaN],
  ])('lerReais(%j) → %p', (texto, esperado) => {
    expect(lerReais(texto)).toBe(esperado);
  });

  it('formata de volta para o campo e escreve o prazo por extenso', () => {
    expect(reaisParaCampo(1500)).toBe('1.500,00');
    expect([1, 7, 12, 18, 24, 120].map(prazoPorExtenso)).toEqual(['1 mês', '7 meses', '1 ano', '1 ano e 6 meses', '2 anos', '10 anos']);
  });
});
