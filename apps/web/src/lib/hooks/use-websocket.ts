import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketOptions {
  agentId?: string;
  userId?: string;
  onAssignmentNew?: (data: any) => void;
  onAssignmentStatusChanged?: (data: any) => void;
  onCallTransferred?: (data: any) => void;
  onEmergencyAlert?: (data: any) => void;
  onQueueUpdated?: (data: any) => void;
  onAgentStatusUpdated?: (data: any) => void;
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const socketRef = useRef<Socket>();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    socketRef.current = io(apiUrl, {
      auth: {
        agentId: options.agentId,
        userId: options.userId,
      },
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    // Assignment events
    if (options.onAssignmentNew) {
      socketRef.current.on('assignment:new', options.onAssignmentNew);
    }

    if (options.onAssignmentStatusChanged) {
      socketRef.current.on('assignment:status:changed', options.onAssignmentStatusChanged);
    }

    // Call transfer events
    if (options.onCallTransferred) {
      socketRef.current.on('call:transferred:in', options.onCallTransferred);
      socketRef.current.on('call:transferred:out', options.onCallTransferred);
    }

    // Emergency alerts
    if (options.onEmergencyAlert) {
      socketRef.current.on('emergency:alert', options.onEmergencyAlert);
    }

    // Queue updates
    if (options.onQueueUpdated) {
      socketRef.current.on('queue:updated', options.onQueueUpdated);
    }

    // Agent status updates
    if (options.onAgentStatusUpdated) {
      socketRef.current.on('agent:status:updated', options.onAgentStatusUpdated);
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, [options.agentId, options.userId]);

  const updateAgentStatus = (agentId: string, status: string) => {
    socketRef.current?.emit('agent:status', { agentId, status });
  };

  const acceptAssignment = (assignmentId: string, agentId: string) => {
    socketRef.current?.emit('assignment:accept', { assignmentId, agentId });
  };

  const rejectAssignment = (assignmentId: string, agentId: string, reason?: string) => {
    socketRef.current?.emit('assignment:reject', { assignmentId, agentId, reason });
  };

  const getOnlineAgents = async (hospitalId: string) => {
    return new Promise((resolve) => {
      socketRef.current?.emit('agents:online', { hospitalId }, (response: any) => {
        resolve(response);
      });
    });
  };

  return {
    socket: socketRef.current,
    isConnected,
    updateAgentStatus,
    acceptAssignment,
    rejectAssignment,
    getOnlineAgents,
  };
}
