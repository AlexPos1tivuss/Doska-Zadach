import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Board, List, Card, User } from "@shared/schema";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardList } from "@/components/board-list";
import { CardDetail } from "@/components/card-detail";
import { InviteDialog } from "@/components/invite-dialog";
import { NotificationsBell } from "@/components/notifications-bell";

type CardWithAssignee = Card & { assignee?: { id: string; displayName: string } | null };
type ListWithCards = List & { cards: CardWithAssignee[] };

export default function BoardPage() {
  const { id: boardId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newListTitle, setNewListTitle] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardWithAssignee | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: board } = useQuery<Board>({
    queryKey: ["/api/boards", boardId],
  });

  const { data: listsData, isLoading: listsLoading } = useQuery<ListWithCards[]>({
    queryKey: ["/api/boards", boardId, "lists"],
  });

  const { data: members } = useQuery<(User & { memberId: string })[]>({
    queryKey: ["/api/boards", boardId, "members"],
  });

  const lists = listsData || [];

  const createListMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/lists", {
        title,
        boardId,
        position: lists.length,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "lists"] });
      setNewListTitle("");
      setAddingList(false);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: async (data: { cardId: string; listId: string; position: number }) => {
      await apiRequest("PATCH", `/api/cards/${data.cardId}/move`, {
        listId: data.listId,
        position: data.position,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "lists"] });
    },
  });

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    moveCardMutation.mutate({
      cardId: draggableId,
      listId: destination.droppableId,
      position: destination.index,
    });
  }, [moveCardMutation]);

  const handleAddList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    createListMutation.mutate(newListTitle);
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: board?.color || "#a8d8ea" }}>
      <header className="bg-black/10 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold text-white truncate">{board?.title || "..."}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setInviteOpen(true)}
            data-testid="button-invite"
          >
            <UserPlus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Пригласить</span>
          </Button>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full items-start">
            {listsLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="w-72 h-64 rounded-xl shrink-0" />
                ))}
              </>
            ) : (
              <>
                {lists.map((list, idx) => (
                  <BoardList
                    key={list.id}
                    list={list}
                    cards={list.cards || []}
                    boardId={boardId!}
                    index={idx}
                    members={members || []}
                    onCardClick={(card) => setSelectedCard(card)}
                  />
                ))}
              </>
            )}

            <div className="w-72 shrink-0">
              {addingList ? (
                <form onSubmit={handleAddList} className="bg-card rounded-xl p-3 space-y-2 shadow-md animate-fade-in">
                  <Input
                    placeholder="Название списка"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    autoFocus
                    data-testid="input-new-list"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={createListMutation.isPending} data-testid="button-submit-list">
                      Добавить
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setAddingList(false)}>
                      Отмена
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full justify-start bg-white/20 text-white border-none"
                  onClick={() => setAddingList(true)}
                  data-testid="button-add-list"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить список
                </Button>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          boardId={boardId!}
          members={members || []}
          onClose={() => setSelectedCard(null)}
        />
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        boardId={boardId!}
      />
    </div>
  );
}
