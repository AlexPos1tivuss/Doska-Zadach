import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { List, Card } from "@shared/schema";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, MoreHorizontal, GripVertical, CheckCircle2, Tag } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import confetti from "canvas-confetti";

const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  "Срочно": { bg: "#ff6b6b", text: "#fff" },
  "Важно": { bg: "#ffa726", text: "#fff" },
  "В процессе": { bg: "#42a5f5", text: "#fff" },
  "Готово": { bg: "#66bb6a", text: "#fff" },
  "Идея": { bg: "#ab47bc", text: "#fff" },
  "Баг": { bg: "#ef5350", text: "#fff" },
};

interface BoardListProps {
  list: List;
  cards: Card[];
  boardId: string;
  index: number;
  onCardClick: (card: Card) => void;
}

export function BoardList({ list, cards, boardId, index, onCardClick }: BoardListProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const { toast } = useToast();

  const createCardMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/cards", {
        title,
        listId: list.id,
        position: cards.length,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "lists"] });
      setNewCardTitle("");
      setAddingCard(false);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/lists/${list.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "lists"] });
    },
  });

  const toggleCompletedMutation = useMutation({
    mutationFn: async ({ cardId, completed }: { cardId: string; completed: boolean }) => {
      await apiRequest("PATCH", `/api/cards/${cardId}`, { completed });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "lists"] });
      if (variables.completed) {
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { y: 0.7 },
          colors: ["#a8d8ea", "#aa96da", "#fcbad3", "#b5eadd", "#66bb6a"],
        });
      }
    },
  });

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    createCardMutation.mutate(newCardTitle);
  };

  return (
    <div className="w-72 shrink-0 bg-card rounded-xl shadow-md flex flex-col max-h-[calc(100vh-8rem)] animate-fade-in">
      <div className="p-3 flex items-center justify-between gap-2 border-b">
        <h3 className="font-semibold text-sm truncate">{list.title}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" data-testid={`button-list-menu-${list.id}`}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteListMutation.mutate()}
              data-testid={`button-delete-list-${list.id}`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить список
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Droppable droppableId={list.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[40px] transition-colors duration-200"
            style={{
              backgroundColor: snapshot.isDraggingOver ? "hsl(var(--muted) / 0.5)" : "transparent",
            }}
          >
            {cards.map((card, cardIndex) => (
              <Draggable key={card.id} draggableId={card.id} index={cardIndex}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`bg-background rounded-lg p-3 shadow-sm border border-border cursor-pointer group transition-all duration-200 ${
                      snapshot.isDragging ? "shadow-lg rotate-2 scale-105" : ""
                    } ${card.completed ? "opacity-70" : ""}`}
                    onClick={() => onCardClick(card)}
                    data-testid={`card-${card.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div {...provided.dragHandleProps} className="mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {card.labels && (card.labels as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {(card.labels as string[]).map((label) => (
                              <span
                                key={label}
                                className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                                style={{
                                  backgroundColor: LABEL_COLORS[label]?.bg || "#9e9e9e",
                                  color: LABEL_COLORS[label]?.text || "#fff",
                                }}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className={`text-sm leading-snug ${card.completed ? "line-through text-muted-foreground" : ""}`}>
                          {card.title}
                        </p>
                      </div>
                      <button
                        className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompletedMutation.mutate({ cardId: card.id, completed: !card.completed });
                        }}
                        data-testid={`button-complete-${card.id}`}
                      >
                        <CheckCircle2
                          className={`w-4 h-4 transition-colors ${
                            card.completed ? "text-green-500 fill-green-500" : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="p-2 border-t">
        {addingCard ? (
          <form onSubmit={handleAddCard} className="space-y-2 animate-fade-in">
            <Input
              placeholder="Название карточки"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              autoFocus
              data-testid={`input-new-card-${list.id}`}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createCardMutation.isPending} data-testid={`button-submit-card-${list.id}`}>
                Добавить
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setAddingCard(false)}>
                Отмена
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setAddingCard(true)}
            data-testid={`button-add-card-${list.id}`}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить карточку
          </Button>
        )}
      </div>
    </div>
  );
}
