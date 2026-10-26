import { randomUUID } from 'node:crypto';
import { Router } from 'express';

function buildGreeting(retailer) {
  const firstName = retailer.ownerName.split(' ')[0];
  return `Namaste ${firstName} ji, welcome. How can I help ${retailer.name} today?`;
}

export function createConversationsRouter({ retailers }) {
  const router = Router();

  // Nothing is saved here: the browser holds the conversation until it ends.
  router.post('/conversations/start', (req, res) => {
    const retailer = retailers.find((r) => r.id === req.body?.retailerId);
    if (!retailer) return res.status(404).json({ error: 'Unknown retailer' });
    res.json({
      conversationId: randomUUID(),
      startedAt: new Date().toISOString(),
      retailer,
      greeting: buildGreeting(retailer),
    });
  });

  // TODO(steps 6-7): POST /conversations/end, GET /conversations, GET /conversations/:id.

  return router;
}
