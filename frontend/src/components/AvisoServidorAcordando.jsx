import { useEffect, useState } from 'react';
import { observarLentidao } from '../services/api';

/**
 * Aviso global enquanto alguma requisição demora: no plano gratuito da Render
 * a API "dorme" sem uso e a primeira chamada leva até ~1 min para responder.
 * Fica sempre montado (fora das rotas) para cobrir login, restauração de sessão
 * e qualquer tela.
 */
export function AvisoServidorAcordando() {
  const [lento, setLento] = useState(false);
  useEffect(() => observarLentidao(setLento), []);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      {lento && (
        <p className="flex items-center gap-3 rounded-full bg-roxo-700 px-5 py-3 text-sm font-semibold text-white shadow-lg dark:bg-roxo-600">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
          Acordando o servidor, isso leva alguns segundos.
        </p>
      )}
    </div>
  );
}
