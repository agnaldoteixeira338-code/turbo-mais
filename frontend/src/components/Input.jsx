import { forwardRef, useId } from 'react';

/** Campo acessível: label associado, erro anunciado (aria-invalid + aria-describedby). */
export const Input = forwardRef(function Input({ rotulo, erro, dica, id, className = '', ...resto }, ref) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  const idAjuda = `${idCampo}-ajuda`;
  return (
    <div className={className}>
      {rotulo && (
        <label htmlFor={idCampo} className="rotulo">
          {rotulo}
        </label>
      )}
      <input
        ref={ref}
        id={idCampo}
        className={`campo ${erro ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : ''}`}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={erro || dica ? idAjuda : undefined}
        {...resto}
      />
      {(erro || dica) && (
        <p id={idAjuda} className={`mt-1.5 text-sm ${erro ? 'text-red-600 dark:text-red-400' : 'texto-suave'}`}>
          {erro || dica}
        </p>
      )}
    </div>
  );
});
