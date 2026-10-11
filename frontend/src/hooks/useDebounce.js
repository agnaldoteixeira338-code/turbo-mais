import { useEffect, useState } from 'react';

/** Atrasa a propagação de um valor (ex.: busca só dispara quando o usuário para de digitar). */
export function useDebounce(valor, atrasoMs = 350) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(id);
  }, [valor, atrasoMs]);
  return atrasado;
}
