import { Icone } from './Icone';

/** Estrela de favorito com estado anunciado a leitores de tela (aria-pressed). */
export function StarButton({ ticker, ativo, onAlternar, tamanho = 'md', disabled }) {
  const dim = tamanho === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onAlternar?.(ticker);
      }}
      disabled={disabled}
      aria-pressed={ativo}
      aria-label={ativo ? `Remover ${ticker} dos favoritos` : `Favoritar ${ticker}`}
      title={ativo ? 'Remover dos favoritos' : 'Favoritar'}
      className={`rounded-full p-2 transition hover:bg-roxo-50 dark:hover:bg-white/10 ${ativo ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-400'}`}
    >
      <Icone nome="estrela" className={dim} preenchido={ativo} />
    </button>
  );
}
