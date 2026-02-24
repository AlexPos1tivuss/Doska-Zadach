import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
});

export const boards = pgTable("boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  color: text("color").notNull().default("#a8d8ea"),
});

export const boardMembers = pgTable("board_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
});

export const lists = pgTable("lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const cards = pgTable("cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").default(""),
  listId: varchar("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  labels: jsonb("labels").$type<string[]>().default([]),
  completed: boolean("completed").notNull().default(false),
});

export const checklistItems = pgTable("checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cardId: varchar("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  checked: boolean("checked").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
});

export const loginSchema = z.object({
  username: z.string().min(3, "Минимум 3 символа"),
  password: z.string().min(4, "Минимум 4 символа"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Минимум 3 символа"),
  password: z.string().min(4, "Минимум 4 символа"),
  displayName: z.string().min(1, "Укажите имя"),
});

export const insertBoardSchema = createInsertSchema(boards).pick({
  title: true,
  color: true,
});

export const insertListSchema = createInsertSchema(lists).pick({
  title: true,
  boardId: true,
  position: true,
});

export const insertCardSchema = createInsertSchema(cards).pick({
  title: true,
  listId: true,
  position: true,
  description: true,
  labels: true,
});

export const insertChecklistItemSchema = createInsertSchema(checklistItems).pick({
  cardId: true,
  text: true,
  position: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type BoardMember = typeof boardMembers.$inferSelect;
export type List = typeof lists.$inferSelect;
export type InsertList = z.infer<typeof insertListSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
