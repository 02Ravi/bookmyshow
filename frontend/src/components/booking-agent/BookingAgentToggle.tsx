'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useBookingAgent } from '@/hooks/useBookingAgent';
import { BookingAgentChatPanel } from './BookingAgentChatPanel';

export function BookingAgentToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const { inputLocked, loading, messages, sendMessage } = useBookingAgent();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bms-red)] text-white shadow-lg ring-4 ring-[var(--bms-red)]/20 transition hover:bg-[var(--bms-red-hover)]"
        aria-label="Toggle booking assistant"
      >
        <MessageCircle className="h-6 w-6" strokeWidth={2} />
      </button>

      <BookingAgentChatPanel
        inputLocked={inputLocked}
        isOpen={isOpen}
        loading={loading}
        messages={messages}
        onClose={() => setIsOpen(false)}
        onSend={sendMessage}
      />
    </>
  );
}
