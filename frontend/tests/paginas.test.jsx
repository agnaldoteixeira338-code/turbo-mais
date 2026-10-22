import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthContext } from '../src/context/AuthContext';
import { useTheme } from '../src/hooks/useTheme';
import { IdeaInput } from '../src/components/IdeaInput';
import Login from '../src/pages/Login';
import NotFound from '../src/pages/NotFound';
import { mascararCelular, REGRAS_SENHA } from '../src/pages/Cadastro';
import { detectarInteresses } from '../src/utils/palavrasChave';
import { moeda, percentual, numeroCompacto, dataHora, tendencia } from '../src/utils/formatar';

describe('ThemeContext (dark mode)', () => {
  function Alternador() {
    const { tema, alternar } = useTheme();
    return <button type="button" onClick={alternar}>{tema}</button>;
  }

  it('alterna a classe "dark" no <html> e persiste em localStorage', async () => {
    render(<ThemeProvider><Alternador /></ThemeProvider>);
    const botao = screen.getByRole('button');
    expect(botao).toHaveTextContent('claro');
    await userEvent.click(botao);
    expect(botao).toHaveTextContent('escuro');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('turbo-mais:tema')).toBe('escuro');
  });

  it('restaura o tema salvo', () => {
    localStorage.setItem('turbo-mais:tema', 'escuro');
    render(<ThemeProvider><Alternador /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('escuro');
  });
});

describe('IdeaInput', () => {
  it('mostra interesses detectados e envia o texto', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onEnviar = jest.fn();
    render(<ThemeProvider><IdeaInput onEnviar={onEnviar} /></ThemeProvider>);

    const botao = screen.getByRole('button', { name: 'Enviar' });
    expect(botao).toBeDisabled();
    await user.type(screen.getByRole('textbox'), 'Quero dividendos com segurança');
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByText('Renda passiva')).toBeInTheDocument();
    expect(screen.getByText('Baixo risco')).toBeInTheDocument();
    await user.click(botao);
    expect(onEnviar).toHaveBeenCalledWith('Quero dividendos com segurança');
    jest.useRealTimers();
  });
});

describe('Login', () => {
  function renderizar(entrar, entrarComoVisitante = jest.fn()) {
    const valor = { entrar, entrarComoVisitante, validar2FA: jest.fn(), usuario: null, autenticado: false, carregando: false };
    return render(
      <ThemeProvider>
        <AuthContext.Provider value={valor}>
          <MemoryRouter>
            <Login />
          </MemoryRouter>
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  }

  it('tem link "Esqueceu a senha?" e passa para a etapa 2FA quando exigido', async () => {
    const entrar = jest.fn().mockResolvedValue({ requer2FA: true, desafioToken: 'desafio' });
    renderizar(entrar);
    expect(screen.getByRole('link', { name: 'Esqueceu a senha?' })).toHaveAttribute('href', '/esqueci-senha');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@teste.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'Senha@123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(entrar).toHaveBeenCalledWith({ email: 'ana@teste.com', senha: 'Senha@123' });
    expect(await screen.findByText('Verificação em duas etapas')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de verificação')).toBeInTheDocument();
  });

  it('exibe a mensagem de erro da API', async () => {
    const entrar = jest.fn().mockRejectedValue(Object.assign(new Error('E-mail ou senha incorretos'), { code: 'CREDENCIAIS_INVALIDAS' }));
    renderizar(entrar);
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@teste.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos');
  });

  it('"Entrar como visitante" entra sem preencher e-mail e senha', async () => {
    const entrar = jest.fn();
    const visitante = jest.fn().mockResolvedValue({ usuario: { email: 'demo@turbomais.dev' } });
    renderizar(entrar, visitante);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar como visitante' }));
    expect(visitante).toHaveBeenCalledTimes(1);
    expect(entrar).not.toHaveBeenCalled();
  });

  it('mostra o erro se o acesso de visitante estiver indisponível', async () => {
    const visitante = jest.fn().mockRejectedValue(new Error('O acesso de visitante não está disponível no momento'));
    renderizar(jest.fn(), visitante);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar como visitante' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('visitante não está disponível');
  });
});

describe('AvisoServidorAcordando', () => {
  it('aparece quando uma requisição passa do limite e some quando ela termina', async () => {
    jest.useFakeTimers();
    const { api } = require('../src/services/api');
    const { AvisoServidorAcordando } = require('../src/components/AvisoServidorAcordando');
    let responder;
    global.fetch = jest.fn(() => new Promise((r) => { responder = r; }));
    render(<AvisoServidorAcordando />);

    const pedido = api('/ativos');
    expect(screen.queryByText(/Acordando o servidor/)).not.toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(4000); });
    expect(screen.getByRole('status')).toHaveTextContent('Acordando o servidor, isso leva alguns segundos.');

    await act(async () => {
      responder({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data: [], meta: null }) });
      await pedido;
    });
    expect(screen.queryByText(/Acordando o servidor/)).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});

describe('NotFound', () => {
  it('é temática e oferece caminho de volta', () => {
    render(<ThemeProvider><MemoryRouter><NotFound /></MemoryRouter></ThemeProvider>);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/');
  });
});

describe('utilitários', () => {
  it('máscara de celular e regras de senha', () => {
    expect(mascararCelular('11987654321')).toBe('(11) 98765-4321');
    expect(mascararCelular('119')).toBe('(11) 9');
    expect(REGRAS_SENHA.every((r) => r.teste('Senha@Forte1'))).toBe(true);
    expect(REGRAS_SENHA.every((r) => r.teste('fraca'))).toBe(false);
  });

  it('detecção de interesses casa palavras inteiras sem acento', () => {
    expect(detectarInteresses('Quero investir em INOVAÇÃO e energia solar')).toEqual(expect.arrayContaining(['Tecnologia', 'Energia', 'Sustentabilidade']));
    expect(detectarInteresses('minha família')).not.toContain('Tecnologia');
  });

  it('formatação pt-BR', () => {
    expect(moeda(1234.5)).toMatch(/R\$\s?1\.234,50/);
    expect(moeda(10, 'USD')).toMatch(/US\$\s?10,00/);
    expect(moeda(null)).toBe('—');
    expect(percentual(1.5)).toBe('+1,50%');
    expect(percentual(-2)).toBe('-2,00%');
    expect(percentual(0)).toBe('0,00%');
    expect(numeroCompacto(1_500_000)).toMatch(/1,5\s?mi/);
    expect(dataHora(null)).toBe('—');
    expect(tendencia(0)).toBe('neutra');
  });
});
