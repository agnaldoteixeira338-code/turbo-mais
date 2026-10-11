import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { MODOS } from '../services/socket';

const SEM_SOCKET = { socket: null, modo: MODOS.CONECTANDO, tempoReal: false };

/** Fora do provider (ex.: telas públicas) devolve um estado "sem socket". */
export function useSocket() {
  return useContext(SocketContext) ?? SEM_SOCKET;
}
