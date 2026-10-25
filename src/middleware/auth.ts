import { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  isAnonymous?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const guestHeader = req.headers['x-guest-user'] as string | undefined;

  // 1. Try Firebase Auth token first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || `${decodedToken.uid}@codetogether.local`,
        displayName: decodedToken.name || decodedToken.email?.split('@')[0] || 'Developer',
        photoURL: decodedToken.picture || null,
        isAnonymous: false,
      };
      return next();
    } catch (err) {
      console.warn('Bearer token verification failed, falling back to guest header if provided');
    }
  }

  // 2. Allow guest user header for peer joining & testing
  if (guestHeader) {
    try {
      const parsed = JSON.parse(guestHeader);
      if (parsed.uid && parsed.displayName) {
        req.user = {
          uid: parsed.uid,
          email: parsed.email || `${parsed.uid}@guest.codetogether`,
          displayName: parsed.displayName,
          photoURL: parsed.photoURL || null,
          isAnonymous: true,
        };
        return next();
      }
    } catch {
      // invalid json guest header
    }
  }

  // 3. Fallback: generate ephemeral guest id for session
  const clientIp = req.ip || 'anonymous';
  const shortId = Math.random().toString(36).substring(2, 7);
  req.user = {
    uid: `guest_${shortId}`,
    email: `guest_${shortId}@codetogether.local`,
    displayName: `Dev-${shortId}`,
    isAnonymous: true,
  };
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || `${decodedToken.uid}@codetogether.local`,
      displayName: decodedToken.name || decodedToken.email?.split('@')[0] || 'Developer',
      photoURL: decodedToken.picture || null,
      isAnonymous: false,
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication token' });
  }
};
