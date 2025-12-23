import { useEffect, useRef } from 'react';
import { connectSocket, getSocket, disconnectSocket } from '../utils/socket';

export function useSocket() {
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

  useEffect(() => {
    socketRef.current = connectSocket();
    return () => {
      if (socketRef.current) {
        disconnectSocket();
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    getSocket: () => getSocket(),
  };
}







