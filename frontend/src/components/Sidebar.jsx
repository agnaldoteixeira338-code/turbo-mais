import { NavLink } from 'react-router-dom';
import { Icone } from './Icone';

// `celular`: os 5 itens da barra inferior no celular (o resto fica na Home e no desktop)
export const ITENS_NAVEGACAO = [
  { para: '/', rotulo: 'Início', icone: 'casa', fim: true, celular: true },
  { para: '/buscar', rotulo: 'Buscar', icone: 'busca', celular: true },
  { para: '/ideia', rotulo: 'Ideia', icone: 'ideia', celular: true },
  { para: '/simulador', rotulo: 'Simulador', icone: 'calculadora', celular: true },
  { para: '/carteira', rotulo: 'Minha Carteira', icone: 'carteira' },
  { para: '/favoritos', rotulo: 'Favoritos', icone: 'estrela', celular: true },
  { para: '/notificacoes', rotulo: 'Notificações', icone: 'sino' },
  { para: '/seguranca', rotulo: 'Segurança', icone: 'escudo' },
];

const classeItem = ({ isActive }) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
    isActive
      ? 'bg-roxo-600 text-white shadow-lg shadow-roxo-600/20'
      : 'text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100'
  }`;

/** Lateral no desktop; barra inferior fixa no celular (polegar alcança). */
export function Sidebar() {
  return (
    <>
      <nav aria-label="Navegação principal" className="sticky top-20 hidden h-fit w-56 shrink-0 space-y-1 lg:block">
        {ITENS_NAVEGACAO.map((item) => (
          <NavLink key={item.para} to={item.para} end={item.fim} className={classeItem}>
            <Icone nome={item.icone} />
            {item.rotulo}
          </NavLink>
        ))}
      </nav>

      <nav aria-label="Navegação principal (celular)" className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden dark:border-white/10 dark:bg-zinc-950/95">
        <ul className="mx-auto flex max-w-lg justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {ITENS_NAVEGACAO.filter((item) => item.celular).map((item) => (
            <li key={item.para}>
              <NavLink
                to={item.para}
                end={item.fim}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium ${isActive ? 'text-roxo-600 dark:text-roxo-300' : 'texto-suave'}`}
              >
                <Icone nome={item.icone} />
                {item.rotulo.replace('Minha ', '')}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
