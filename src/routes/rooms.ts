import { Router } from 'express';
import { authenticateRequest, AuthRequest } from '../middleware/auth.ts';
import {
  createRoom,
  getRoomById,
  getRoomVersions,
  listRooms,
  saveSnapshotVersion,
  updateSourceFileContent,
} from '../db/rooms.ts';
import { db } from '../db/index.ts';
import { rooms, savedVersions } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const router = Router();

// 1. List active/public rooms
router.get('/', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const userUid = req.user?.uid;
    const roomList = await listRooms(userUid);
    res.json({ rooms: roomList });
  } catch (err: any) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// 2. Create room
router.post('/', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { name, description, isPublic, accessPassword, defaultLanguage } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    if (name.length > 80) {
      return res.status(400).json({ error: 'Room name cannot exceed 80 characters' });
    }

    const roomId = `room-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36).substring(4, 8)}`;
    const user = req.user!;

    const result = await createRoom({
      id: roomId,
      name: name.trim(),
      description: (description || '').trim().slice(0, 250),
      ownerUid: user.uid,
      ownerName: user.displayName,
      isPublic: isPublic !== false,
      accessPassword: accessPassword ? String(accessPassword).trim() : null,
      defaultLanguage: defaultLanguage === 'python' ? 'python' : 'javascript',
    });

    res.status(201).json({
      room: {
        ...result.room,
        hasPassword: Boolean(result.room.accessPassword),
        accessPassword: undefined,
      },
      file: result.file,
    });
  } catch (err: any) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// 3. Get room details
router.get('/:roomId', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Do not leak password
    const safeRoom = {
      ...room,
      accessPassword: undefined,
    };

    res.json({ room: safeRoom });
  } catch (err: any) {
    console.error('Error fetching room:', err);
    res.status(500).json({ error: 'Failed to retrieve room details' });
  }
});

// 4. Verify room password
router.post('/:roomId/verify-password', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body;

    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.accessPassword) {
      return res.json({ success: true, authorized: true });
    }

    if (room.accessPassword === password) {
      return res.json({ success: true, authorized: true });
    }

    return res.status(403).json({ success: false, error: 'Incorrect room password' });
  } catch (err: any) {
    console.error('Error verifying room password:', err);
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

// 5. Get saved versions / history
router.get('/:roomId/versions', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const versions = await getRoomVersions(roomId);
    res.json({ versions });
  } catch (err: any) {
    console.error('Error fetching versions:', err);
    res.status(500).json({ error: 'Failed to fetch version history' });
  }
});

// 6. Create snapshot version manually
router.post('/:roomId/versions', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const { label, content, language } = req.body;

    if (!content && content !== '') {
      return res.status(400).json({ error: 'Document content is required to create a snapshot' });
    }

    const user = req.user!;
    const saved = await saveSnapshotVersion({
      roomId,
      label: label ? label.trim().slice(0, 100) : `Snapshot by ${user.displayName}`,
      content,
      language: language || 'javascript',
      authorUid: user.uid,
      authorName: user.displayName,
    });

    res.status(201).json({ version: saved });
  } catch (err: any) {
    console.error('Error saving snapshot:', err);
    res.status(500).json({ error: 'Failed to save version snapshot' });
  }
});

// 7. Restore a previous version
router.post('/:roomId/versions/:versionId/restore', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { roomId, versionId } = req.params;
    const versionNum = parseInt(versionId, 10);

    const [target] = await db
      .select()
      .from(savedVersions)
      .where(eq(savedVersions.id, versionNum))
      .limit(1);

    if (!target || target.roomId !== roomId) {
      return res.status(404).json({ error: 'Version record not found' });
    }

    const user = req.user!;
    const updateResult = await updateSourceFileContent({
      roomId,
      content: target.content,
      language: target.language,
      userUid: user.uid,
      userName: user.displayName,
    });

    res.json({
      success: true,
      restoredVersion: target,
      file: updateResult.file,
    });
  } catch (err: any) {
    console.error('Error restoring version:', err);
    res.status(500).json({ error: 'Failed to restore selected version' });
  }
});

export default router;
