import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, boards, boardMembers, lists, cards, checklistItems, notifications,
  type User, type InsertUser, type Board, type InsertBoard,
  type List, type InsertList, type Card, type InsertCard,
  type ChecklistItem, type InsertChecklistItem,
  type Notification, type InsertNotification,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getList(id: string): Promise<List | undefined>;

  getBoards(userId: string): Promise<Board[]>;
  getBoard(id: string): Promise<Board | undefined>;
  createBoard(data: InsertBoard & { ownerId: string }): Promise<Board>;
  deleteBoard(id: string): Promise<void>;

  getBoardMembers(boardId: string): Promise<(User & { memberId: string })[]>;
  addBoardMember(boardId: string, userId: string): Promise<void>;
  removeBoardMember(memberId: string): Promise<void>;
  isBoardMember(boardId: string, userId: string): Promise<boolean>;

  getListsWithCards(boardId: string): Promise<(List & { cards: (Card & { assignee?: { id: string; displayName: string } | null })[] })[]>;
  createList(data: InsertList): Promise<List>;
  deleteList(id: string): Promise<void>;

  getCard(id: string): Promise<Card | undefined>;
  createCard(data: InsertCard): Promise<Card>;
  updateCard(id: string, data: Partial<Card>): Promise<Card>;
  deleteCard(id: string): Promise<void>;
  moveCard(id: string, listId: string, position: number): Promise<void>;

  getChecklistItems(cardId: string): Promise<ChecklistItem[]>;
  createChecklistItem(data: InsertChecklistItem): Promise<ChecklistItem>;
  updateChecklistItem(id: string, data: Partial<ChecklistItem>): Promise<ChecklistItem>;
  deleteChecklistItem(id: string): Promise<void>;

  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getBoards(userId: string): Promise<Board[]> {
    const ownedBoards = await db.select().from(boards).where(eq(boards.ownerId, userId));
    const memberRows = await db
      .select({ boardId: boardMembers.boardId })
      .from(boardMembers)
      .where(eq(boardMembers.userId, userId));
    const memberBoardIds = memberRows.map((r) => r.boardId);

    if (memberBoardIds.length === 0) return ownedBoards;

    const memberBoards = await Promise.all(
      memberBoardIds
        .filter((bid) => !ownedBoards.some((b) => b.id === bid))
        .map(async (bid) => {
          const [board] = await db.select().from(boards).where(eq(boards.id, bid));
          return board;
        })
    );

    return [...ownedBoards, ...memberBoards.filter(Boolean)];
  }

  async getBoard(id: string): Promise<Board | undefined> {
    const [board] = await db.select().from(boards).where(eq(boards.id, id));
    return board;
  }

  async createBoard(data: InsertBoard & { ownerId: string }): Promise<Board> {
    const [board] = await db.insert(boards).values(data).returning();
    return board;
  }

  async deleteBoard(id: string): Promise<void> {
    await db.delete(boards).where(eq(boards.id, id));
  }

  async getBoardMembers(boardId: string): Promise<(User & { memberId: string })[]> {
    const members = await db
      .select({
        memberId: boardMembers.id,
        id: users.id,
        username: users.username,
        password: users.password,
        displayName: users.displayName,
        role: users.role,
      })
      .from(boardMembers)
      .innerJoin(users, eq(boardMembers.userId, users.id))
      .where(eq(boardMembers.boardId, boardId));
    return members;
  }

  async addBoardMember(boardId: string, userId: string): Promise<void> {
    const existing = await db
      .select()
      .from(boardMembers)
      .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));
    if (existing.length > 0) return;
    await db.insert(boardMembers).values({ boardId, userId });
  }

  async removeBoardMember(memberId: string): Promise<void> {
    await db.delete(boardMembers).where(eq(boardMembers.id, memberId));
  }

  async isBoardMember(boardId: string, userId: string): Promise<boolean> {
    const board = await this.getBoard(boardId);
    if (board?.ownerId === userId) return true;
    const members = await db
      .select()
      .from(boardMembers)
      .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));
    return members.length > 0;
  }

  async getList(id: string): Promise<List | undefined> {
    const [list] = await db.select().from(lists).where(eq(lists.id, id));
    return list;
  }

  async getListsWithCards(boardId: string): Promise<(List & { cards: (Card & { assignee?: { id: string; displayName: string } | null })[] })[]> {
    const boardLists = await db
      .select()
      .from(lists)
      .where(eq(lists.boardId, boardId))
      .orderBy(asc(lists.position));

    const result = await Promise.all(
      boardLists.map(async (list) => {
        const listCards = await db
          .select()
          .from(cards)
          .where(eq(cards.listId, list.id))
          .orderBy(asc(cards.position));

        const cardsWithAssignee = await Promise.all(
          listCards.map(async (card) => {
            let assignee: { id: string; displayName: string } | null = null;
            if (card.assigneeId) {
              const [user] = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(eq(users.id, card.assigneeId));
              if (user) assignee = user;
            }
            return { ...card, assignee };
          })
        );

        return { ...list, cards: cardsWithAssignee };
      })
    );

    return result;
  }

  async createList(data: InsertList): Promise<List> {
    const [list] = await db.insert(lists).values(data).returning();
    return list;
  }

  async deleteList(id: string): Promise<void> {
    await db.delete(lists).where(eq(lists.id, id));
  }

  async getCard(id: string): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card;
  }

  async createCard(data: InsertCard): Promise<Card> {
    const [card] = await db.insert(cards).values(data).returning();
    return card;
  }

  async updateCard(id: string, data: Partial<Card>): Promise<Card> {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.labels !== undefined) updateData.labels = data.labels;
    if (data.completed !== undefined) updateData.completed = data.completed;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.listId !== undefined) updateData.listId = data.listId;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;

    const [card] = await db.update(cards).set(updateData).where(eq(cards.id, id)).returning();
    return card;
  }

  async deleteCard(id: string): Promise<void> {
    await db.delete(cards).where(eq(cards.id, id));
  }

  async moveCard(id: string, listId: string, position: number): Promise<void> {
    await db.update(cards).set({ listId, position }).where(eq(cards.id, id));

    const listCards = await db
      .select()
      .from(cards)
      .where(eq(cards.listId, listId))
      .orderBy(asc(cards.position));

    for (let i = 0; i < listCards.length; i++) {
      if (listCards[i].id !== id) {
        const newPos = i >= position ? i + 1 : i;
        if (listCards[i].position !== newPos) {
          await db.update(cards).set({ position: newPos }).where(eq(cards.id, listCards[i].id));
        }
      }
    }
  }

  async getChecklistItems(cardId: string): Promise<ChecklistItem[]> {
    return db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.cardId, cardId))
      .orderBy(asc(checklistItems.position));
  }

  async createChecklistItem(data: InsertChecklistItem): Promise<ChecklistItem> {
    const [item] = await db.insert(checklistItems).values(data).returning();
    return item;
  }

  async updateChecklistItem(id: string, data: Partial<ChecklistItem>): Promise<ChecklistItem> {
    const updateData: any = {};
    if (data.checked !== undefined) updateData.checked = data.checked;
    if (data.text !== undefined) updateData.text = data.text;
    if (data.position !== undefined) updateData.position = data.position;

    const [item] = await db.update(checklistItems).set(updateData).where(eq(checklistItems.id, id)).returning();
    return item;
  }

  async deleteChecklistItem(id: string): Promise<void> {
    await db.delete(checklistItems).where(eq(checklistItems.id, id));
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result.length;
  }
}

export const storage = new DatabaseStorage();
