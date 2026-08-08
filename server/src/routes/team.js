const crypto = require('crypto');
const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function requireOwner(req, res, next) {
  if (req.account.role !== 'owner') return res.status(403).json({ error: 'Only the team owner can do this' });
  next();
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.email, om.role, om.created_at AS "joinedAt"
       FROM org_members om JOIN accounts a ON a.id = om.account_id
       WHERE om.org_id = $1
       ORDER BY (om.role = 'owner') DESC, om.created_at`,
      [req.account.orgId],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/invite', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await pool.query(
      'INSERT INTO org_invites (org_id, token, created_by, expires_at) VALUES ($1, $2, $3, $4)',
      [req.account.orgId, token, req.account.id, expiresAt],
    );
    res.status(201).json({ token, expiresAt });
  } catch (err) { next(err); }
});

// Public — hit from the signup screen before the invitee has an account, purely to show
// "you're joining {org}'s team" instead of a bare token. Returns only the org name, nothing
// that would leak membership details to an unauthenticated caller.
router.get('/invite/:token', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.name AS "orgName" FROM org_invites i
       JOIN organizations o ON o.id = i.org_id
       WHERE i.token = $1 AND i.expires_at > now() AND i.used_at IS NULL`,
      [req.params.token],
    );
    if (!rows[0]) return res.status(404).json({ error: 'This invite link is invalid, expired, or already used' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:accountId', requireAuth, requireOwner, async (req, res, next) => {
  try {
    if (Number(req.params.accountId) === req.account.id) {
      return res.status(400).json({ error: "You can't remove yourself from the team" });
    }
    const { rows } = await pool.query(
      'DELETE FROM org_members WHERE org_id = $1 AND account_id = $2 RETURNING id',
      [req.account.orgId, req.params.accountId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
