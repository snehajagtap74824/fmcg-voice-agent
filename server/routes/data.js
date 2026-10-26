import { Router } from 'express';

export function createDataRouter({ products, retailers }) {
  const router = Router();
  router.get('/products', (req, res) => res.json(products));
  router.get('/retailers', (req, res) => res.json(retailers));
  return router;
}
