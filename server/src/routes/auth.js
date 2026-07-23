const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

function isValidInviteCode(submitted) {
  const expected = process.env.INVITE_CODE;
  if (!expected) return true; // no code configured = signup open
  const a = Buffer.from(String(submitted || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const { email, password, inviteCode, name } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Email and a password of at least 8 characters are required' });
    }
    if (!isValidInviteCode(inviteCode)) {
      return res.status(403).json({ error: 'Invalid or missing invite code' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO accounts (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email.toLowerCase().trim(), passwordHash, (name || '').trim() || null],
    );
    const account = rows[0];
    const token = jwt.sign({ id: account.id, email: account.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, account });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' });
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT id, email, name, password_hash FROM accounts WHERE email = $1', [
      (email || '').toLowerCase().trim(),
    ]);
    const account = rows[0];
    if (!account || !(await bcrypt.compare(password || '', account.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: account.id, email: account.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, account: { id: account.id, email: account.email, name: account.name } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name FROM accounts WHERE id = $1', [req.account.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    const { rows } = await pool.query(
      'UPDATE accounts SET name = $1 WHERE id = $2 RETURNING id, email, name',
      [(name || '').trim() || null, req.account.id],
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
