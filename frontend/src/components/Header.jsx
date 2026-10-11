import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { Icone } from './Icone';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useNotificacoes } from '../hooks/useNotificacoes';
import { useSocket } from '../hooks/useSocket';
import { MODOS } from '../services/socket';

const ROTULO_MODO = {
  [MODOS.WEBSOCKET]: { texto: 'Tempo real', cor: 'bg-emerald-500' },
  [MODOS.LONG_POLLING]: { texto: 'Tempo real (modo compatível)', cor: 'bg-emerald-400' },
  [MODOS.REST_POLLING]: { texto: 'Atualização a cada 30s', cor: 'bg-amber-400' },
  [MODOS.CONECTANDO]: { texto: 'Conectando…', cor: 'bg-zinc-400' },
};

export function BotaoTema() {
  const { escuro, alternar } = useTheme();
  return (
    <button
      type="button"
      onClick={alternar}
      className="rounded-full p-2.5 texto-suave hover:bg-zinc-100 dark:hover:bg-white/10"
      aria-label={escuro ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      <Icone nome={escuro ? 'sol' : 'lua'} />
    </button>
  );
}

export function Header() {
  const { sair } = useAuth();
  const { naoLidas } = useNotificacoes();
  const { modo } = useSocket();
  const navegar = useNavigate();
  const status = ROTULO_MODO[modo] ?? ROTULO_MODO[MODOS.CONECTANDO];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-superficie/85 backdrop-blur dark:border-white/5 dark:bg-superficie-escura/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="Turbo Mais — início">
          <Logo tamanho="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden items-center gap-2 text-xs texto-suave md:flex" title="Status da conexão em tempo real">
            <span className={`h-2 w-2 rounded-full ${status.cor}`} aria-hidden="true" />
            {status.texto}
          </span>
          <Link to="/notificacoes" className="relative rounded-full p-2.5 texto-suave hover:bg-zinc-100 dark:hover:bg-white/10" aria-label={`Notificações${naoLidas ? `: ${naoLidas} não lidas` : ''}`}>
            <Icone nome="sino" />
            {naoLidas > 0 && (
              <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-roxo-600 px-1 text-[11px] font-bold text-white">
                {naoLidas > 99 ? '99+' : naoLidas}
              </span>
            )}
          </Link>
          <BotaoTema />
          <button
            type="button"
            onClick={async () => {
              await sair();
              navegar('/login');
            }}
            className="rounded-full p-2.5 texto-suave hover:bg-zinc-100 dark:hover:bg-white/10"
            aria-label="Sair"
            title="Sair"
          >
            <Icone nome="sair" />
          </button>
        </div>
      </div>
    </header>
  );
}
