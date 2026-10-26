export const OUTCOMES = ['order_enquiry', 'info_only', 'follow_up_required', 'no_interest'];
export const SENTIMENTS = ['positive', 'neutral', 'negative'];

// The outcome is a rule in code. Gemini only judges between info_only and no_interest, and only when
// nothing was captured. Anything else from Gemini (or no answer at all) falls back to info_only.
export function decideOutcome({ itemCount, followUpCount, aiOutcome = null }) {
  if (itemCount > 0) return 'order_enquiry';
  if (followUpCount > 0) return 'follow_up_required';
  return aiOutcome === 'no_interest' ? 'no_interest' : 'info_only';
}
