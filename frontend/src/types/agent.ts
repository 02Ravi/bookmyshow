import type { SeatStatus } from './status';

export type MessageRole = 'user' | 'assistant';

export type ChoiceOption = {
  label: string;
  value: string;
  description?: string;
};

export type UiBlock =
  | { type: 'text'; content: string }
  | { type: 'markdown'; markdown: string }
  | {
      type: 'choice_group';
      message: string;
      mode: 'single' | 'multi';
      presentation: 'dropdown' | 'radio' | 'checkbox' | 'chips';
      choices: ChoiceOption[];
    }
  | {
      type: 'confirm';
      message: string;
      choices?: ChoiceOption[];
    }
  | {
      type: 'seat_picker';
      message: string;
      seats: Array<{
        showSeatId: string;
        row: string;
        number: number;
        type: string;
        status: SeatStatus;
        price: number;
      }>;
      maxSelections: number;
    }
  | {
      type: 'profile_form';
      message: string;
    };

export interface ChatMessage {
  id: string;
  role: MessageRole;
  blocks: UiBlock[];
  displayContent?: string;
}

export function isInteractiveBlock(block: UiBlock): boolean {
  return (
    block.type === 'choice_group' ||
    block.type === 'seat_picker' ||
    block.type === 'confirm' ||
    block.type === 'profile_form'
  );
}

export function isTextBlock(
  block: UiBlock,
): block is Extract<UiBlock, { type: 'text' }> {
  return block.type === 'text';
}
