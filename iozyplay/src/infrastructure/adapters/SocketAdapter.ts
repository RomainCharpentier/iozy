/**
 * Infrastructure : SocketAdapter
 * Implémentation concrète du SocketPort utilisant Socket.io
 */
import { SocketPort } from '../../ports/output/SocketPort'
import { io, Socket } from 'socket.io-client'

export class SocketAdapter implements SocketPort {
  private socket: Socket | null = null
  private readonly url: string

  constructor(url: string = 'http://localhost:3001') {
    this.url = url
  }

  connect(): void {
    if (!this.socket) {
      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      })
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn(`[SocketAdapter] Tentative d'émettre ${event} mais socket non connecté`)
    }
  }

  on(event: string, callback: (data?: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event: string, callback?: (data?: any) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback)
      } else {
        this.socket.off(event)
      }
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * Obtient l'instance socket brute (pour compatibilité)
   */
  getSocket(): Socket | null {
    return this.socket
  }
}




