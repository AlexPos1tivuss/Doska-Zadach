import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { Board } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, LayoutDashboard, LogOut, Trash2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const BOARD_COLORS = [
  "#a8d8ea", "#aa96da", "#fcbad3", "#ffffd2",
  "#b5eadd", "#c3bef7", "#f8b595", "#f5c6aa",
  "#a8e6cf", "#dcedc1", "#ffd3b6", "#ffaaa5",
];

export default function BoardsPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(BOARD_COLORS[0]);

  const { data: boards, isLoading } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const createBoardMutation = useMutation({
    mutationFn: async (data: { title: string; color: string }) => {
      const res = await apiRequest("POST", "/api/boards", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setDialogOpen(false);
      setNewTitle("");
      toast({ title: "Доска создана!" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      await apiRequest("DELETE", `/api/boards/${boardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast({ title: "Доска удалена" });
    },
  });

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createBoardMutation.mutate({ title: newTitle, color: newColor });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">ТрелоПародия</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.displayName}
            </span>
            <Button variant="secondary" size="sm" onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-1" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold">Мои доски</h2>
            <p className="text-muted-foreground mt-1">Выберите доску или создайте новую</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-board">
                <Plus className="w-4 h-4 mr-2" />
                Новая доска
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать доску</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateBoard} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    placeholder="Название доски"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    data-testid="input-board-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Цвет</Label>
                  <div className="flex flex-wrap gap-2">
                    {BOARD_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="w-8 h-8 rounded-md transition-transform"
                        style={{
                          backgroundColor: color,
                          outline: newColor === color ? "3px solid hsl(var(--primary))" : "none",
                          outlineOffset: "2px",
                          transform: newColor === color ? "scale(1.1)" : "scale(1)",
                        }}
                        onClick={() => setNewColor(color)}
                        data-testid={`button-color-${color}`}
                      />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createBoardMutation.isPending} data-testid="button-submit-board">
                  {createBoardMutation.isPending ? "Создание..." : "Создать"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : boards && boards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board, idx) => (
              <div
                key={board.id}
                className="group relative rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-in"
                style={{
                  backgroundColor: board.color,
                  animationDelay: `${idx * 50}ms`,
                }}
                onClick={() => setLocation(`/board/${board.id}`)}
                data-testid={`card-board-${board.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-800 leading-tight">{board.title}</h3>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBoardMutation.mutate(board.id);
                    }}
                    data-testid={`button-delete-board-${board.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="mt-6 flex items-center gap-1 text-gray-600">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs">Совместная</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Пока нет досок</h3>
            <p className="text-muted-foreground mb-6">Создайте первую доску, чтобы начать работу</p>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-create-board-empty">
              <Plus className="w-4 h-4 mr-2" />
              Создать доску
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
