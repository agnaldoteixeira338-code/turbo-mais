import { useContext } from 'react';
import { FavoritosContext } from '../context/FavoritosContext';

export function useFavoritos() {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error('useFavoritos deve ser usado dentro de <FavoritosProvider>');
  return ctx;
}
