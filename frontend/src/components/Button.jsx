import { Link } from 'react-router-dom';

const VARIANTES = {
  primario: 'bg-roxo-600 text-white hover:bg-roxo-700 active:bg-roxo-800 disabled:bg-roxo-300 dark:disabled:bg-roxo-900',
  secundario: 'bg-roxo-50 text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-500/15 dark:text-roxo-200 dark:hover:bg-roxo-500/25',
  fantasma: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10',
  perigo: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-300',
};
const TAMANHOS = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
};

/** Botão "pílula" no estilo Nubank. Vira <Link> quando recebe `para`. */
export function Button({ variante = 'primario', tamanho = 'md', carregando = false, para, className = '', children, disabled, type = 'button', ...resto }) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition
    disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`;

  if (para) {
    return (
      <Link to={para} className={classes} {...resto}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || carregando} aria-busy={carregando || undefined} {...resto}>
      {carregando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}
