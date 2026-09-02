import type { User } from '@prisma/client';
import jwt from 'jsonwebtoken';

export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl' | 'createdAt'>;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), {
    expiresIn: '7d',
  });
}

export function toPublicUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
