const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  try {
    req.account = jwt.verify(token, process.env.JWT_SECRET);
    // A token minted before org support existed won't carry orgId — every
    // company-scoped query below now filters on it, so silently proceeding
    // would 404 as if every company vanished. Fail with a clear message
    // instead of a confusing empty app.
    if (!req.account.orgId) {
      return res.status(401).json({ error: 'Session outdated — please log in again' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
