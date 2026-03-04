import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    passport: { user: string };
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      displayName: string;
      password: string;
      role: string;
    }
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgSession = ConnectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "trello-parody-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Пользователь не найден" });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return done(null, false, { message: "Неверный пароль" });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || undefined);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, displayName, role } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "Заполните все поля" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Пользователь уже существует" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName,
        role: role || "преподаватель",
      });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Ошибка входа" });
        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Ошибка входа" });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Ошибка выхода" });
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Не авторизован" });
    const { password: _, ...safeUser } = req.user!;
    res.json(safeUser);
  });

  app.get("/api/boards", requireAuth, async (req, res) => {
    const boardsList = await storage.getBoards(req.user!.id);
    res.json(boardsList);
  });

  app.get("/api/boards/:id", requireAuth, async (req, res) => {
    const board = await storage.getBoard(req.params.id);
    if (!board) return res.status(404).json({ message: "Доска не найдена" });
    const isMember = await storage.isBoardMember(req.params.id, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    res.json(board);
  });

  app.post("/api/boards", requireAuth, async (req, res) => {
    const { title, color } = req.body;
    if (!title) return res.status(400).json({ message: "Укажите название" });
    const board = await storage.createBoard({ title, color: color || "#a8d8ea", ownerId: req.user!.id });
    res.json(board);
  });

  app.delete("/api/boards/:id", requireAuth, async (req, res) => {
    const board = await storage.getBoard(req.params.id);
    if (!board) return res.status(404).json({ message: "Доска не найдена" });
    if (board.ownerId !== req.user!.id) return res.status(403).json({ message: "Нет прав" });
    await storage.deleteBoard(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/boards/:id/lists", requireAuth, async (req, res) => {
    const isMember = await storage.isBoardMember(req.params.id, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const listsWithCards = await storage.getListsWithCards(req.params.id);
    res.json(listsWithCards);
  });

  app.get("/api/boards/:id/members", requireAuth, async (req, res) => {
    const isMember = await storage.isBoardMember(req.params.id, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const members = await storage.getBoardMembers(req.params.id);
    const board = await storage.getBoard(req.params.id);
    const owner = await storage.getUser(board!.ownerId);
    const ownerSafe = owner ? { ...owner, memberId: "owner", password: undefined } : null;
    const safeMems = members.map(({ password: _, ...rest }) => rest);
    if (ownerSafe && !safeMems.some(m => m.id === ownerSafe.id)) {
      const { password: __, ...safeOwner } = owner!;
      safeMems.unshift({ ...safeOwner, memberId: "owner" });
    }
    res.json(safeMems);
  });

  app.post("/api/boards/:id/members", requireAuth, async (req, res) => {
    const isMember = await storage.isBoardMember(req.params.id, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "Укажите логин" });
    const user = await storage.getUserByUsername(username);
    if (!user) return res.status(404).json({ message: "Пользователь не найден" });
    await storage.addBoardMember(req.params.id, user.id);

    const board = await storage.getBoard(req.params.id);
    await storage.createNotification({
      userId: user.id,
      type: "board_invite",
      title: "Приглашение на доску",
      message: `Вас пригласили на доску «${board?.title}»`,
      boardId: req.params.id,
    });

    res.json({ ok: true });
  });

  app.delete("/api/boards/:id/members/:memberId", requireAuth, async (req, res) => {
    const board = await storage.getBoard(req.params.id);
    if (!board || board.ownerId !== req.user!.id) return res.status(403).json({ message: "Нет прав" });
    await storage.removeBoardMember(req.params.memberId);
    res.json({ ok: true });
  });

  app.post("/api/lists", requireAuth, async (req, res) => {
    const { title, boardId, position } = req.body;
    if (!title || !boardId) return res.status(400).json({ message: "Укажите название и доску" });
    const isMember = await storage.isBoardMember(boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const list = await storage.createList({ title, boardId, position: position || 0 });
    res.json(list);
  });

  app.delete("/api/lists/:id", requireAuth, async (req, res) => {
    const list = await storage.getList(req.params.id);
    if (!list) return res.status(404).json({ message: "Список не найден" });
    const isMember = await storage.isBoardMember(list.boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    await storage.deleteList(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/cards", requireAuth, async (req, res) => {
    const { title, listId, position, assigneeId, deadline } = req.body;
    if (!title || !listId) return res.status(400).json({ message: "Укажите название и список" });
    const list = await storage.getList(listId);
    if (!list) return res.status(404).json({ message: "Список не найден" });
    const isMember = await storage.isBoardMember(list.boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const card = await storage.createCard({
      title,
      listId,
      position: position || 0,
      assigneeId: assigneeId || null,
      deadline: deadline ? new Date(deadline) : null,
    });

    if (assigneeId && assigneeId !== req.user!.id) {
      const board = await storage.getBoard(list.boardId);
      const deadlineStr = deadline ? ` (дедлайн: ${new Date(deadline).toLocaleDateString("ru-RU")})` : "";
      await storage.createNotification({
        userId: assigneeId,
        type: "task_assigned",
        title: "Новое задание",
        message: `Вам назначена задача «${title}»${deadlineStr}`,
        boardId: list.boardId,
        cardId: card.id,
      });
    }

    res.json(card);
  });

  app.patch("/api/cards/:id", requireAuth, async (req, res) => {
    const existingCard = await storage.getCard(req.params.id);
    if (!existingCard) return res.status(404).json({ message: "Карточка не найдена" });
    const list = await storage.getList(existingCard.listId);
    if (!list) return res.status(404).json({ message: "Список не найден" });
    const isMember = await storage.isBoardMember(list.boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });

    const updateData: any = { ...req.body };
    if (updateData.deadline) {
      updateData.deadline = new Date(updateData.deadline);
    }
    if (updateData.deadline === null) {
      updateData.deadline = null;
    }

    const card = await storage.updateCard(req.params.id, updateData);

    if (req.body.assigneeId && req.body.assigneeId !== existingCard.assigneeId && req.body.assigneeId !== req.user!.id) {
      const board = await storage.getBoard(list.boardId);
      const deadlineStr = card.deadline ? ` (дедлайн: ${new Date(card.deadline).toLocaleDateString("ru-RU")})` : "";
      await storage.createNotification({
        userId: req.body.assigneeId,
        type: "task_assigned",
        title: "Новое задание",
        message: `Вам назначена задача «${card.title}»${deadlineStr}`,
        boardId: list.boardId,
        cardId: card.id,
      });
    }

    res.json(card);
  });

  app.patch("/api/cards/:id/move", requireAuth, async (req, res) => {
    const existingCard = await storage.getCard(req.params.id);
    if (!existingCard) return res.status(404).json({ message: "Карточка не найдена" });
    const list = await storage.getList(existingCard.listId);
    if (!list) return res.status(404).json({ message: "Список не найден" });
    const isMember = await storage.isBoardMember(list.boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const { listId, position } = req.body;
    await storage.moveCard(req.params.id, listId, position);
    res.json({ ok: true });
  });

  app.delete("/api/cards/:id", requireAuth, async (req, res) => {
    const existingCard = await storage.getCard(req.params.id);
    if (!existingCard) return res.status(404).json({ message: "Карточка не найдена" });
    const list = await storage.getList(existingCard.listId);
    if (!list) return res.status(404).json({ message: "Список не найден" });
    const isMember = await storage.isBoardMember(list.boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    await storage.deleteCard(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/cards/:id/checklist", requireAuth, async (req, res) => {
    const card = await storage.getCard(req.params.id);
    if (!card) return res.status(404).json({ message: "Карточка не найдена" });
    const list = await storage.getList(card.listId);
    if (!list) return res.status(404).json({ message: "Список не найден" });
    const isMember = await storage.isBoardMember(list.boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const items = await storage.getChecklistItems(req.params.id);
    res.json(items);
  });

  app.post("/api/checklist", requireAuth, async (req, res) => {
    const { cardId, text, position } = req.body;
    if (!cardId || !text) return res.status(400).json({ message: "Укажите текст" });
    const card = await storage.getCard(cardId);
    if (!card) return res.status(404).json({ message: "Карточка не найдена" });
    const list = await storage.getList(card.listId);
    if (!list) return res.status(404).json({ message: "Список не найден" });
    const isMember = await storage.isBoardMember(list.boardId, req.user!.id);
    if (!isMember) return res.status(403).json({ message: "Нет доступа" });
    const item = await storage.createChecklistItem({ cardId, text, position: position || 0 });
    res.json(item);
  });

  app.patch("/api/checklist/:id", requireAuth, async (req, res) => {
    const item = await storage.updateChecklistItem(req.params.id, req.body);
    res.json(item);
  });

  app.delete("/api/checklist/:id", requireAuth, async (req, res) => {
    await storage.deleteChecklistItem(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    const notifs = await storage.getNotifications(req.user!.id);
    res.json(notifs);
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const count = await storage.getUnreadNotificationCount(req.user!.id);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await storage.markNotificationRead(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    await storage.markAllNotificationsRead(req.user!.id);
    res.json({ ok: true });
  });

  return httpServer;
}
