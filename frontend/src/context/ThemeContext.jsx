import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export const ThemeContext = createContext(null);
const CHAVE = 'turbo-mais:tema';

function temaInicial() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
    /* storage bloqueado (modo privado): cai no padrão do sistema */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

/** Tema claro/escuro persistido em localStorage (preferência por dispositivo). */
export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      /* sem persistência, mas o tema da sessão funciona */
    }
  }, [tema]);

  const alternar = useCallback(() => setTema((t) => (t === 'escuro' ? 'claro' : 'escuro')), []);
  const valor = useMemo(() => ({ tema, alternar, escuro: tema === 'escuro' }), [tema, alternar]);
  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}
