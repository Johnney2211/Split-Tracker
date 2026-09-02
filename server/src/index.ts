import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import authRouter from './routes/auth.js';
import expensesRouter from './routes/expenses.js';
import groupsRouter from './routes/groups.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'housemate-split-api',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/groups/:groupId/expenses', expensesRouter);
app.use('/api/v1/groups', groupsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
