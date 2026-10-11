/**
 * Único ponto do front que lê import.meta.env (o Jest troca este módulo por
 * um stub). Vazio = MESMA ORIGEM (proxy do Vite em dev, Nginx/rewrite em prod).
 */
export const API_URL = import.meta.env.VITE_API_URL ?? '';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';
export const AMBIENTE = import.meta.env.MODE;
