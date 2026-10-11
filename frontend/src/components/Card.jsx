export function Card({ titulo, acao, className = '', children, as: Tag = 'section', ...resto }) {
  return (
    <Tag className={`card animate-entrar ${className}`} {...resto}>
      {(titulo || acao) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>}
          {acao}
        </header>
      )}
      {children}
    </Tag>
  );
}
