'use strict';

const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Firestore クライアント（Cloud Run上ではADCで自動認証）
const firestore = new Firestore();
const COLLECTION = 'diagnosis_progress';

app.use(express.json());

// 静的ファイルのサーブ
app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// POST /api/sessions
// 新規セッション作成
// ========================================
app.post('/api/sessions', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const now = Firestore.Timestamp.now();

    await firestore.collection(COLLECTION).doc(sessionId).set({
      max_block: 1,
      completed: false,
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({ session_id: sessionId });
  } catch (err) {
    console.error('POST /api/sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// GET /api/sessions/:id
// セッション取得（再開用）
// ========================================
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const docRef = firestore.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const data = doc.data();
    res.json({
      session_id: doc.id,
      max_block: data.max_block,
      completed: data.completed,
    });
  } catch (err) {
    console.error('GET /api/sessions/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// PATCH /api/sessions/:id
// 進捗更新（max_block は後退しない）
// ========================================
app.patch('/api/sessions/:id', async (req, res) => {
  try {
    const { max_block, completed } = req.body;

    const docRef = firestore.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const current = doc.data();
    const updates = { updated_at: Firestore.Timestamp.now() };

    // max_block は後退させない
    if (typeof max_block === 'number') {
      updates.max_block = Math.max(current.max_block, max_block);
    }

    if (typeof completed === 'boolean') {
      updates.completed = completed;
    }

    await docRef.update(updates);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/sessions/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SPA フォールバック（不要だがSPA対応として念のため）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
