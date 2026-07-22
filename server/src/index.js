require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const companiesRoutes = require('./routes/companies');
const documentsRoutes = require('./routes/documents');
const vendorsRoutes = require('./routes/vendors');
const complianceRoutes = require('./routes/compliance');

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5300')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(Object.assign(new Error(`Origin ${origin} is not allowed`), { status: 403 }));
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/compliance', complianceRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const port = process.env.PORT || 4300;
app.listen(port, () => console.log(`AI Compliance Assistant API listening on :${port}`));
