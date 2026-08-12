require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./server/config/db');

const membershipRoutes = require('./server/routes/membershipRoutes');
const paymentRoutes = require('./server/routes/paymentRoutes');
const committeeRoutes = require('./server/routes/committeeRoutes');
const adminRoutes = require('./server/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Trust Proxy for Vercel / Reverse Proxy headers
app.set('trust proxy', 1);

// Security Headers (Configured for Razorpay, CDNs & XSS protection)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        connectSrc: ["'self'", "https://lsa.org.in", "https://api.razorpay.com"],
        frameSrc: ["'self'", "https://api.razorpay.com"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// CORS
app.use(cors());

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/admin/login', authLimiter);

// Express Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'lsa_membership_super_secret_session_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// Auto-initialize DB on first request for serverless environments
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error('[DB Serverless Init Error]', err);
    }
  }
  next();
});

// Serve Static Frontend Files with clean URLs
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/admin', express.static(path.join(__dirname, 'admin'), { extensions: ['html'] }));

// API Routes (Mounted on both /api/path and /path to handle Vercel serverless path rewrites)
app.use(['/api/membership', '/membership'], membershipRoutes);
app.use(['/api/payment', '/payment'], paymentRoutes);
app.use(['/api/committee', '/committee'], committeeRoutes);
app.use(['/api/admin', '/admin'], adminRoutes);

// Health Check API
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'online',
    appName: 'Lakshadweep Students Association Membership Portal',
    timestamp: new Date()
  });
});

// Root & Admin explicit HTML routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Fallback for HTML routing (bypasses API calls and JSON requests)
app.get('/admin/*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Global 404 Handler for API & Unmatched Routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint Not Found: ${req.originalUrl}` });
});

module.exports = app;

if (!process.env.VERCEL) {
  async function startServer() {
    try {
      await initDatabase();
      dbInitialized = true;
      app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`  LSA Membership Portal is running on port ${PORT}`);
        console.log(`  Website URL: http://localhost:${PORT}`);
        console.log(`  Admin Login: http://localhost:${PORT}/admin/login.html`);
        console.log(`=======================================================`);
      });
    } catch (err) {
      console.error('Failed to start application server:', err);
      process.exit(1);
    }
  }

  startServer();
}
