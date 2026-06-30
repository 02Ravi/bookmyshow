'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';

export function useShowSocket(showId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join-show', showId);

    const refetchSeats = () => {
      void queryClient.refetchQueries({ queryKey: ['show-seats', showId] });
    };

    socket.on('seat-held', refetchSeats);
    socket.on('seat-released', refetchSeats);
    socket.on('seat-booked', refetchSeats);

    return () => {
      socket.off('seat-held', refetchSeats);
      socket.off('seat-released', refetchSeats);
      socket.off('seat-booked', refetchSeats);
      socket.emit('leave-show', showId);
    };
  }, [showId, queryClient]);
}
