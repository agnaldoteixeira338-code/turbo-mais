import { useContext } from 'react';
import { NotificacoesContext } from '../context/NotificacoesContext';

export function useNotificacoes() {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) throw new Error('useNotificacoes deve ser usado dentro de <NotificacoesProvider>');
  return ctx;
}
