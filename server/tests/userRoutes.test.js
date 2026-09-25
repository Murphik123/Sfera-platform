const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeUser, buildProfileUpdates } = require('../src/routes/userRoutes');

test('sanitizeUser removes sensitive fields and keeps safe profile fields', () => {
  const user = {
    _id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    password: 'super-secret',
    role: 'admin',
    isBlocked: false,
    avatar: 'avatar.png',
    online: true,
    lastSeen: '2025-01-01T00:00:00.000Z'
  };

  const result = sanitizeUser(user);

  assert.deepEqual(result, {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    avatar: 'avatar.png',
    online: true,
    lastSeen: '2025-01-01T00:00:00.000Z'
  });
});

test('buildProfileUpdates only accepts safe editable fields', () => {
  const updates = buildProfileUpdates({
    username: 'bob',
    email: 'bob@example.com',
    avatar: 'new.png',
    password: 'hacked',
    role: 'admin',
    isBlocked: true,
    __v: 2
  });

  assert.deepEqual(updates, {
    username: 'bob',
    email: 'bob@example.com',
    avatar: 'new.png'
  });
});
