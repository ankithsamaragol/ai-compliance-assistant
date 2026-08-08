const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
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

// Same inline data: URI pattern as companies.logo_data_url — see the comment there for why.
const AVATAR_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, AVATAR_MIME_TYPES.has(file.mimetype));
  },
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
    const { email, password, inviteCode, name, orgInviteToken } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Email and a password of at least 8 characters are required' });
    }
    // The global INVITE_CODE gate (who can sign up to the app at all) and an
    // orgInviteToken (which team a signup joins) are separate, orthogonal
    // checks — both a global code and joining a specific team can apply.
    if (!isValidInviteCode(inviteCode)) {
      return res.status(403).json({ error: 'Invalid or missing invite code' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    let account;
    let orgId;
    let role;
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'INSERT INTO accounts (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, avatar_data_url',
        [email.toLowerCase().trim(), passwordHash, (name || '').trim() || null],
      );
      account = rows[0];

      if (orgInviteToken) {
        const { rows: inviteRows } = await client.query(
          `SELECT * FROM org_invites WHERE token = $1 AND expires_at > now() AND used_at IS NULL`,
          [orgInviteToken],
        );
        const invite = inviteRows[0];
        if (!invite) {
          throw Object.assign(new Error('That team invite link is invalid, expired, or already used'), { status: 400 });
        }
        orgId = invite.org_id;
        role = 'member';
        await client.query('INSERT INTO org_members (org_id, account_id, role) VALUES ($1, $2, $3)', [orgId, account.id, role]);
        await client.query('UPDATE org_invites SET used_at = now() WHERE id = $1', [invite.id]);
      } else {
        const { rows: orgRows } = await client.query(
          'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
          [`${(name || email).trim()}'s Workspace`],
        );
        orgId = orgRows[0].id;
        role = 'owner';
        await client.query('INSERT INTO org_members (org_id, account_id, role) VALUES ($1, $2, $3)', [orgId, account.id, role]);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    const token = jwt.sign({ id: account.id, email: account.email, orgId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, account });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' });
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT id, email, name, avatar_data_url, password_hash FROM accounts WHERE email = $1', [
      (email || '').toLowerCase().trim(),
    ]);
    const account = rows[0];
    if (!account || !(await bcrypt.compare(password || '', account.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { rows: memberRows } = await pool.query('SELECT org_id, role FROM org_members WHERE account_id = $1', [account.id]);
    const membership = memberRows[0];
    const token = jwt.sign(
      { id: account.id, email: account.email, orgId: membership?.org_id, role: membership?.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );
    res.json({ token, account: { id: account.id, email: account.email, name: account.name, avatar_data_url: account.avatar_data_url } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.email, a.name, a.avatar_data_url, om.org_id AS "orgId", om.role, o.name AS "orgName"
       FROM accounts a
       JOIN org_members om ON om.account_id = a.id
       JOIN organizations o ON o.id = om.org_id
       WHERE a.id = $1`,
      [req.account.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    const { rows } = await pool.query(
      'UPDATE accounts SET name = $1 WHERE id = $2 RETURNING id, email, name, avatar_data_url',
      [(name || '').trim() || null, req.account.id],
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded, or file type not allowed (PNG/JPG/WEBP, 500KB max)' });

    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const { rows } = await pool.query(
      `UPDATE accounts SET avatar_data_url = $1 WHERE id = $2 RETURNING id, email, name, avatar_data_url`,
      [dataUrl, req.account.id],
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE accounts SET avatar_data_url = NULL WHERE id = $1 RETURNING id, email, name, avatar_data_url`,
      [req.account.id],
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
