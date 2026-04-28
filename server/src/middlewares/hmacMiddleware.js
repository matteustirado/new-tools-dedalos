import crypto from 'crypto';

const hmacMiddleware = (req, res, next) => {
  const signature = req.headers['x-app-signature'];
  const timestamp = req.headers['x-app-timestamp'];
  const secret = process.env.APP_SIGNATURE_SECRET;

  if (!secret) return next();

  if (!signature || !timestamp) {
    return res.status(403).json({ error: "Acesso bloqueado. Assinatura ausente." });
  }

  const now = Date.now();
  const reqTime = parseInt(timestamp, 10);
  
  if (Math.abs(now - reqTime) > 300000) {
    return res.status(403).json({ error: "Acesso bloqueado. Requisição expirada." });
  }

  const message = `${req.originalUrl}:${timestamp}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex');

  if (signature !== expectedSignature) {
    return res.status(403).json({ error: "Acesso bloqueado. Assinatura de aplicativo inválida." });
  }

  next();
};

export default hmacMiddleware;