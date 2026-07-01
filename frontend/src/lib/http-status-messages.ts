/** User-facing fallback copy for well-known HTTP error statuses. */
export const STATUS_MESSAGES: Partial<Record<number, string>> = {
  409: 'One or more seats you selected have already been booked. Please go back and choose different seats.',
  410: 'Your reservation has expired. Please select seats again.',
};

export function messageForStatus(
  status: number | undefined,
  fallback = 'Something went wrong. Please try again.',
): string {
  return (status !== undefined ? STATUS_MESSAGES[status] : undefined) ?? fallback;
}
