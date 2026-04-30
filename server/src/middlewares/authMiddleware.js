import jwt from 'jsonwebtoken';

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Acesso negado. Autenticação necessária." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
    
    req.user = decoded; 
    next();
  } catch (err) {
    console.error(err);
    return res.status(403).json({ error: "Sessão expirada ou token inválido." });
  }
}

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: "Acesso negado. Cargo não identificado." });
    }
    
    const hasRole = allowedRoles.some(role => req.user.role.startsWith(role));
    
    if (!hasRole) {
      return res.status(403).json({ error: "Acesso negado. Permissão insuficiente." });
    }
    
    next();
  };
};