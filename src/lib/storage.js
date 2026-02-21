// Storage layer — backed by DynamoDB via Amplify Data.
// Chats and messages are persisted server-side for cross-device sync.
// File attachments (images, text files) still use IndexedDB locally.

import {
  createChat as dbCreateChat,
  updateChat as dbUpdateChat,
  deleteChat as dbDeleteChat,
  loadAllChats as dbLoadAllChats,
  deleteAllChats as dbDeleteAllChats,
  createChatMessage,
  loadChatMessages,
  deleteChatMessages,
  deleteChatMessagesFrom,
} from './api';

// ── Load all chat metadata from DynamoDB ──
export async function loadChats() {
  const chats = await dbLoadAllChats();
  return chats.map(c => ({
    id: c.id,
    title: c.title,
    created: c.created,
    messages: [], // messages loaded lazily
  }));
}

// ── Load messages for a specific chat ──
export async function loadMessages(chatId) {
  return loadChatMessages(chatId);
}

// ── Create a new chat ──
export async function createChat(chat) {
  await dbCreateChat(chat);
}

// ── Update chat metadata (e.g. title) ──
export async function updateChatMeta(id, fields) {
  await dbUpdateChat(id, fields);
}

// ── Add a single message to a chat ──
export async function addMessage(chatId, msg, sortKey) {
  await createChatMessage(chatId, msg, sortKey);
}

// ── Delete messages from a given sortKey onward ──
export async function truncateMessages(chatId, fromSortKey) {
  await deleteChatMessagesFrom(chatId, fromSortKey);
}

// ── Delete all messages in a chat ──
export async function clearMessages(chatId) {
  await deleteChatMessages(chatId);
}

// ── Delete a chat and its messages ──
export async function removeChat(id) {
  await dbDeleteChat(id);
}

// ── Delete all chats ──
export async function removeAllChats() {
  await dbDeleteAllChats();
}
