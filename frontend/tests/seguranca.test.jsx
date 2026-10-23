import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext';
import Configurar2FA from '../src/pages/Configurar2FA';
import { authService } from '../src/services/auth';

jest.mock('../src/services/auth', () => ({ authService: { ativar2FA: jest.fn() } }));
jest.mock('../src/hooks/useNotificacoes', () => ({ useNotificacoes: () => ({ permissao: 'default', pedirPermissao: jest.fn() }) }));

function renderizar(sair = jest.fn().mockResolvedValue()) {
  const valor = { usuario: { email: 'demo@turbomais.dev', twoFactorAtivo: false }, atualizarUsuario: jest.fn(), sair };
  render(
    <AuthContext.Provider value={valor}>
      <MemoryRouter initialEntries={['/seguranca']}>
        <Routes>
          <Route path="/seguranca" element={<Configurar2FA />} />
          <Route path="/cadastro" element={<p>Tela de cadastro</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { sair };
}

describe('Configurar2FA — conta demo', () => {
  beforeEach(() => authService.ativar2FA.mockReset());

  it('explica de forma amigável quando a conta demo não pode ativar o 2FA e leva ao cadastro', async () => {
    authService.ativar2FA.mockRejectedValue(Object.assign(new Error('bloqueado'), { code: 'CONTA_DEMO_PROTEGIDA' }));
    const { sair } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Ativar verificação em duas etapas' }));

    expect(await screen.findByText(/conta de demonstração/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sair e criar minha conta' }));
    expect(sair).toHaveBeenCalled();
    expect(await screen.findByText('Tela de cadastro')).toBeInTheDocument();
  });

  it('outros erros continuam aparecendo como mensagem de erro', async () => {
    authService.ativar2FA.mockRejectedValue(Object.assign(new Error('Sem conexão com o servidor.'), { code: 'SEM_CONEXAO' }));
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ativar verificação em duas etapas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
  });
});
