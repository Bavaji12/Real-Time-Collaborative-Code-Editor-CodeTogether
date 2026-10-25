import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
}

export async function getOrCreateUser(profile: UserProfile) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, profile.uid)).limit(1);
    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({
          email: profile.email,
          displayName: profile.displayName,
          photoURL: profile.photoURL || null,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, profile.uid))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database operation failed in getOrCreateUser', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Database query failed in getUserByUid', { cause: error });
  }
}
