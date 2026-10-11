export const SLOGAN = 'Acelere suas decisões de investimento';

/** Marca do Turbo Mais: seta de tendência + "+" em um quadrado roxo. */
export function Logo({ tamanho = 'md', comSlogan = false, className = '' }) {
  const dimensoes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }[tamanho];
  const texto = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' }[tamanho];
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 64 64" className={`${dimensoes} shrink-0`} aria-hidden="true">
        <rect width="64" height="64" rx="18" fill="#820ad1" />
        <path d="M16 41 L29 28 L36 35 L48 22" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 22 H48 V30" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M44 42 v10 M39 47 h10" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <span className={`${texto} font-extrabold tracking-tight`}>
          Turbo <span className="text-roxo-600 dark:text-roxo-400">Mais</span>
        </span>
        {comSlogan && <p className="text-sm texto-suave">{SLOGAN}</p>}
      </div>
    </div>
  );
}
