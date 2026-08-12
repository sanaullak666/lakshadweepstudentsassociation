const activeTokens = new Set();

/**
 * Auth Middleware to protect Admin endpoints
 */
function requireAdmin(req, res, next) {
  // Check session
  if (req.session && req.session.admin) {
    return next();
  }

  // Check Auth Header (Authorization: Bearer <token>) or query token parameter
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token && (activeTokens.has(token) || (req.session && req.session.adminToken === token))) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized access. Admin authentication required.'
  });
}

function registerAdminToken(token) {
  if (token) activeTokens.add(token);
}

function removeAdminToken(token) {
  if (token) activeTokens.delete(token);
}

module.exports = {
  requireAdmin,
  registerAdminToken,
  removeAdminToken
};
