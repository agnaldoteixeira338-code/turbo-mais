/** Esqueleto de carregamento: evita "pulos" de layout enquanto os dados chegam. */
export function LoadingSkeleton({ linhas = 5, variante = 'lista' }) {
  if (variante === 'bloco') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    );
  }
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-2 py-3">
          <div className="skeleton h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-3 w-40" />
          </div>
          <div className="skeleton h-4 w-20" />
        </li>
      ))}
    </ul>
  );
}
