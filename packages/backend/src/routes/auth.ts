import { Router } from 'express';

const router = Router();

// TODO: Implement authentication
// - POST /api/auth/login
// - POST /api/auth/logout
// - GET /api/auth/me
// - POST /api/auth/refresh

router.post('/login', (req, res) => {
  res.status(501).json({ error: 'not-implemented' });
});

router.post('/logout', (req, res) => {
  res.status(501).json({ error: 'not-implemented' });
});

router.get('/me', (req, res) => {
  res.status(501).json({ error: 'not-implemented' });
});

export default router;
