import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Button } from '../src/components/Button';
import { StarButton } from '../src/components/StarButton';
import { AssetRow } from '../src/components/AssetRow';
import { Variacao, SeloDado } from '../src/components/Indicadores';
import { EmptyState } from '../src/components/EmptyState';
import { Tooltip } from '../src/components/Tooltip';
import { Input } from '../src/components/Input';
import { SuggestionCard } from '../src/components/SuggestionCard';
import { NotificationToast } from '../src/components/NotificationToast';

const comRouter = (ui) => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>);

const PETR4 = {
  ticker: 'PETR4',
  nome: 'Petrobras PN',
  tipo: 'acao_br',
  cotacao: { preco: 37.95, variacaoPercentual: -1.23, moeda: 'BRL', desatualizado: false, indisponivel: false, simulado: false },
};

describe('Button', () => {
  it('fica desabilitado e anuncia carregamento', () => {
    render(<Button carregando>Salvar</Button>);
    const botao = screen.getByRole('button', { name: /salvar/i });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute('aria-busy', 'true');
  });

  it('vira link quando recebe "para"', () => {
    comRouter(<Button para="/buscar">Buscar</Button>);
    expect(screen.getByRole('link', { name: 'Buscar' })).toHaveAttribute('href', '/buscar');
  });
});

describe('StarButton', () => {
  it('expõe o estado com aria-pressed e chama onAlternar com o ticker', async () => {
    const onAlternar = jest.fn();
    render(<StarButton ticker="VALE3" ativo={false} onAlternar={onAlternar} />);
    const botao = screen.getByRole('button', { name: 'Favoritar VALE3' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(botao);
    expect(onAlternar).toHaveBeenCalledWith('VALE3');
  });

  it('rótulo muda quando já é favorito', () => {
    render(<StarButton ticker="VALE3" ativo />);
    expect(screen.getByRole('button', { name: 'Remover VALE3 dos favoritos' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('AssetRow', () => {
  it('mostra ticker, nome, preço em BRL, variação e link de detalhes', () => {
    comRouter(<ul><AssetRow ativo={PETR4} ehFavorito={false} onAlternarFavorito={() => {}} /></ul>);
    expect(screen.getByText('PETR4')).toBeInTheDocument();
    expect(screen.getByText('Petrobras PN')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?37,95/)).toBeInTheDocument();
    expect(screen.getByText('-1,23%')).toBeInTheDocument();
    expect(screen.getByText('em queda')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes de PETR4' })).toHaveAttribute('href', '/ativos/PETR4');
  });

  it('cotação ao vivo (socket) tem prioridade sobre a da listagem', () => {
    comRouter(<ul><AssetRow ativo={PETR4} cotacaoAoVivo={{ preco: 40, variacaoPercentual: 2.5 }} /></ul>);
    expect(screen.getByText(/R\$\s?40,00/)).toBeInTheDocument();
    expect(screen.getByText('+2,50%')).toBeInTheDocument();
  });

  it('CDB mostra rendimento em vez de preço', () => {
    const cdb = { ticker: 'CDB-LIQ-100', nome: 'CDB Liquidez', tipo: 'cdb', rendimentoMedio: '100% do CDI', cotacao: { rendimento: '100% do CDI' } };
    comRouter(<ul><AssetRow ativo={cdb} /></ul>);
    expect(screen.getByText('100% do CDI')).toBeInTheDocument();
  });

  it('sinaliza dado desatualizado/indisponível/simulado', () => {
    const { rerender } = render(<SeloDado cotacao={{ desatualizado: true }} />);
    expect(screen.getByText('Desatualizado')).toBeInTheDocument();
    rerender(<SeloDado cotacao={{ indisponivel: true }} />);
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
    rerender(<SeloDado cotacao={{ simulado: true }} />);
    expect(screen.getByText('Simulado')).toBeInTheDocument();
    rerender(<SeloDado cotacao={{}} />);
    expect(screen.queryByText(/Simulado|Desatualizado|Indisponível/)).not.toBeInTheDocument();
  });
});

describe('Variacao', () => {
  it.each([[3.456, '+3,46%', 'em alta'], [-0.5, '-0,50%', 'em queda']])('%p → %p', (valor, texto, sr) => {
    render(<Variacao valor={valor} />);
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(screen.getByText(sr)).toBeInTheDocument();
  });

  it('valor ausente vira traço', () => {
    render(<Variacao valor={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('abre no foco (teclado) e fecha com Esc', () => {
    render(<Tooltip termo="P/L">Preço sobre lucro</Tooltip>);
    const gatilho = screen.getByRole('button', { name: 'O que é P/L?' });
    fireEvent.focus(gatilho);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Preço sobre lucro');
    fireEvent.keyDown(gatilho, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('Input', () => {
  it('associa label e anuncia erro', () => {
    render(<Input rotulo="E-mail" erro="E-mail inválido" />);
    const campo = screen.getByLabelText('E-mail');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('E-mail inválido');
  });
});

describe('RodapeFontes', () => {
  it('credita as fontes de dados (exigência da CoinGecko) com links seguros', () => {
    const { RodapeFontes } = require('../src/components/Layout');
    render(<RodapeFontes />);
    const coingecko = screen.getByRole('link', { name: 'CoinGecko' });
    expect(coingecko).toHaveAttribute('href', 'https://www.coingecko.com');
    expect(coingecko).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'brapi' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha Vantage' })).toBeInTheDocument();
    expect(screen.getByText(/não é recomendação de investimento/)).toBeInTheDocument();
  });
});

describe('EmptyState, SuggestionCard e NotificationToast', () => {
  it('EmptyState renderiza título, descrição e ação', () => {
    render(<EmptyState titulo="Vazio" descricao="Nada aqui" acao={<button type="button">Agir</button>} />);
    expect(screen.getByRole('heading', { name: 'Vazio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agir' })).toBeInTheDocument();
  });

  it('SuggestionCard mostra a justificativa e NÃO tem botão de compra', () => {
    comRouter(
      <SuggestionCard sugestao={{ posicao: 1, ticker: 'ITUB4', nome: 'Itaú', tipo: 'acao_br', justificativa: 'Combina com você porque dividendos.' }} ehFavorito={false} />,
    );
    expect(screen.getByText('Por que combina com você')).toBeInTheDocument();
    expect(screen.getByText(/porque dividendos/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comprar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/comprar/i)).not.toBeInTheDocument();
  });

  it('NotificationToast anuncia (aria-live) e fecha', async () => {
    const onFechar = jest.fn();
    comRouter(<NotificationToast toasts={[{ id: 'n1', ticker: 'BTC', variacao: 4.2, direcao: 'alta' }]} onFechar={onFechar} />);
    expect(screen.getByRole('status')).toHaveTextContent('BTC +4,20%');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }));
    expect(onFechar).toHaveBeenCalledWith('n1');
  });
});
