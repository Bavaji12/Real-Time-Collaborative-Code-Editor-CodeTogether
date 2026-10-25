import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// Users / participants table (linked with Firebase Auth UID or guest identity)
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(), // Firebase Auth UID or session guest UID
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    photoURL: text('photo_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uidIdx: index('users_uid_idx').on(table.uid),
    emailIdx: index('users_email_idx').on(table.email),
  })
);

// Collaboration rooms table
export const rooms = pgTable(
  'rooms',
  {
    id: varchar('id', { length: 64 }).primaryKey(), // Nanoid or slug like room-123
    name: text('name').notNull(),
    description: text('description').default(''),
    ownerUid: text('owner_uid').notNull(), // User UID of room creator
    isPublic: boolean('is_public').default(true).notNull(),
    accessPassword: text('access_password'), // Optional hashed password for protected rooms
    defaultLanguage: varchar('default_language', { length: 32 }).default('javascript').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index('rooms_owner_idx').on(table.ownerUid),
    publicIdx: index('rooms_public_idx').on(table.isPublic),
  })
);

// Room members and role permissions (owner, editor, viewer)
export const roomMembers = pgTable(
  'room_members',
  {
    id: serial('id').primaryKey(),
    roomId: varchar('room_id', { length: 64 })
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    userUid: text('user_uid').notNull(),
    displayName: text('display_name').notNull(),
    role: varchar('role', { length: 20 }).default('editor').notNull(), // 'owner' | 'editor' | 'viewer'
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  },
  (table) => ({
    roomUserIdx: index('room_members_room_user_idx').on(table.roomId, table.userUid),
  })
);

// Active source code documents for rooms
export const sourceFiles = pgTable(
  'source_files',
  {
    id: serial('id').primaryKey(),
    roomId: varchar('room_id', { length: 64 })
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    fileName: varchar('file_name', { length: 128 }).default('main.js').notNull(),
    language: varchar('language', { length: 32 }).default('javascript').notNull(),
    content: text('content').default('').notNull(),
    version: integer('version').default(1).notNull(), // Incremental version number for conflict detection
    yjsState: text('yjs_state'), // Serialized CRDT vector update state in base64
    updatedByUid: text('updated_by_uid'),
    updatedByName: text('updated_by_name'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    roomIdIdx: index('source_files_room_id_idx').on(table.roomId),
  })
);

// Saved revision history / snapshot versions
export const savedVersions = pgTable(
  'saved_versions',
  {
    id: serial('id').primaryKey(),
    roomId: varchar('room_id', { length: 64 })
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    versionNumber: integer('version_number').notNull(),
    label: text('label').notNull(), // E.g. "Initial draft", "Added fibonacci", "Saved by Alice"
    content: text('content').notNull(),
    language: varchar('language', { length: 32 }).notNull(),
    authorUid: text('author_uid').notNull(),
    authorName: text('author_name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    roomVersionIdx: index('saved_versions_room_idx').on(table.roomId, table.versionNumber),
  })
);

// Relations
export const roomsRelations = relations(rooms, ({ many, one }) => ({
  members: many(roomMembers),
  file: one(sourceFiles, {
    fields: [rooms.id],
    references: [sourceFiles.roomId],
  }),
  versions: many(savedVersions),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(rooms, {
    fields: [roomMembers.roomId],
    references: [rooms.id],
  }),
}));

export const sourceFilesRelations = relations(sourceFiles, ({ one }) => ({
  room: one(rooms, {
    fields: [sourceFiles.roomId],
    references: [rooms.id],
  }),
}));

export const savedVersionsRelations = relations(savedVersions, ({ one }) => ({
  room: one(rooms, {
    fields: [savedVersions.roomId],
    references: [rooms.id],
  }),
}));
