import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { roomMembers, rooms, savedVersions, sourceFiles } from './schema.ts';

const STARTER_CODE = {
  javascript: `// Welcome to CodeTogether!
// Collaborate in real-time with multiple developers.

function calculateMetrics(data) {
  const sum = data.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / data.length;
  return {
    total: sum,
    average: Math.round(avg * 100) / 100,
    count: data.length
  };
}

const scores = [88, 92, 79, 95, 100, 84];
const report = calculateMetrics(scores);
console.log("Analysis results:", report);
`,
  python: `# Welcome to CodeTogether!
# Collaborate in real-time with multiple developers.

def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

numbers = [38, 27, 43, 3, 9, 82, 10]
sorted_list = quick_sort(numbers)
print(f"Sorted sequence: {sorted_list}")
`,
};

export async function createRoom(data: {
  id: string;
  name: string;
  description?: string;
  ownerUid: string;
  ownerName: string;
  isPublic?: boolean;
  accessPassword?: string | null;
  defaultLanguage?: 'javascript' | 'python';
}) {
  try {
    const lang = data.defaultLanguage || 'javascript';
    const initialContent = STARTER_CODE[lang] || STARTER_CODE.javascript;

    // Insert room
    const [newRoom] = await db
      .insert(rooms)
      .values({
        id: data.id,
        name: data.name,
        description: data.description || '',
        ownerUid: data.ownerUid,
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
        accessPassword: data.accessPassword || null,
        defaultLanguage: lang,
      })
      .returning();

    // Insert initial source file
    const [file] = await db
      .insert(sourceFiles)
      .values({
        roomId: newRoom.id,
        fileName: lang === 'python' ? 'main.py' : 'main.js',
        language: lang,
        content: initialContent,
        version: 1,
        updatedByUid: data.ownerUid,
        updatedByName: data.ownerName,
      })
      .returning();

    // Add owner as room member
    await db.insert(roomMembers).values({
      roomId: newRoom.id,
      userUid: data.ownerUid,
      displayName: data.ownerName,
      role: 'owner',
    });

    // Save initial version checkpoint
    await db.insert(savedVersions).values({
      roomId: newRoom.id,
      versionNumber: 1,
      label: 'Initial repository state',
      content: initialContent,
      language: lang,
      authorUid: data.ownerUid,
      authorName: data.ownerName,
    });

    return { room: newRoom, file };
  } catch (error) {
    console.error('Failed to create room in database:', error);
    throw new Error('Could not create room in database', { cause: error });
  }
}

export async function getRoomById(id: string) {
  try {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
    if (!room) return null;

    const [file] = await db.select().from(sourceFiles).where(eq(sourceFiles.roomId, id)).limit(1);
    const members = await db.select().from(roomMembers).where(eq(roomMembers.roomId, id));

    return {
      ...room,
      hasPassword: Boolean(room.accessPassword),
      file: file || null,
      members,
    };
  } catch (error) {
    console.error('Failed to get room by id:', error);
    throw new Error('Could not retrieve room details', { cause: error });
  }
}

export async function listRooms(userUid?: string) {
  try {
    const allRooms = await db
      .select()
      .from(rooms)
      .orderBy(desc(rooms.createdAt))
      .limit(50);

    return allRooms.map((r) => ({
      ...r,
      hasPassword: Boolean(r.accessPassword),
      accessPassword: undefined, // do not leak password hash
    }));
  } catch (error) {
    console.error('Failed to list rooms:', error);
    throw new Error('Could not list rooms', { cause: error });
  }
}

export async function updateSourceFileContent(params: {
  roomId: string;
  content: string;
  expectedVersion?: number;
  language?: string;
  yjsState?: string;
  userUid?: string;
  userName?: string;
}) {
  try {
    const [current] = await db
      .select()
      .from(sourceFiles)
      .where(eq(sourceFiles.roomId, params.roomId))
      .limit(1);

    if (!current) {
      throw new Error('Room source file does not exist');
    }

    // Version conflict detection
    if (params.expectedVersion !== undefined && params.expectedVersion !== current.version) {
      return {
        success: false,
        conflict: true,
        currentVersion: current.version,
        currentContent: current.content,
        error: `Conflict detected: client sent version ${params.expectedVersion}, but current database version is ${current.version}`,
      };
    }

    const nextVersion = current.version + 1;
    const [updated] = await db
      .update(sourceFiles)
      .set({
        content: params.content,
        version: nextVersion,
        language: params.language || current.language,
        yjsState: params.yjsState !== undefined ? params.yjsState : current.yjsState,
        updatedByUid: params.userUid || current.updatedByUid,
        updatedByName: params.userName || current.updatedByName,
        updatedAt: new Date(),
      })
      .where(eq(sourceFiles.roomId, params.roomId))
      .returning();

    return {
      success: true,
      conflict: false,
      file: updated,
    };
  } catch (error) {
    console.error('Failed to update source file:', error);
    throw new Error('Failed to update source file', { cause: error });
  }
}

export async function saveSnapshotVersion(params: {
  roomId: string;
  label: string;
  content: string;
  language: string;
  authorUid: string;
  authorName: string;
}) {
  try {
    const latestVersions = await db
      .select()
      .from(savedVersions)
      .where(eq(savedVersions.roomId, params.roomId))
      .orderBy(desc(savedVersions.versionNumber))
      .limit(1);

    const nextNumber = latestVersions.length > 0 ? latestVersions[0].versionNumber + 1 : 1;

    const [saved] = await db
      .insert(savedVersions)
      .values({
        roomId: params.roomId,
        versionNumber: nextNumber,
        label: params.label || `Saved snapshot v${nextNumber}`,
        content: params.content,
        language: params.language,
        authorUid: params.authorUid,
        authorName: params.authorName,
      })
      .returning();

    return saved;
  } catch (error) {
    console.error('Failed to save version snapshot:', error);
    throw new Error('Failed to save version snapshot', { cause: error });
  }
}

export async function getRoomVersions(roomId: string) {
  try {
    return await db
      .select()
      .from(savedVersions)
      .where(eq(savedVersions.roomId, roomId))
      .orderBy(desc(savedVersions.versionNumber));
  } catch (error) {
    console.error('Failed to get room versions:', error);
    throw new Error('Could not retrieve version history', { cause: error });
  }
}

export async function recordRoomMember(params: {
  roomId: string;
  userUid: string;
  displayName: string;
  role?: string;
}) {
  try {
    const existing = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, params.roomId), eq(roomMembers.userUid, params.userUid)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(roomMembers)
        .set({
          displayName: params.displayName,
          role: params.role || existing[0].role,
          lastSeenAt: new Date(),
        })
        .where(eq(roomMembers.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(roomMembers)
      .values({
        roomId: params.roomId,
        userUid: params.userUid,
        displayName: params.displayName,
        role: params.role || 'editor',
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Failed to record room member:', error);
    // Non-fatal, return null
    return null;
  }
}
