import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Card, ChecklistItem } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, FileText, Tag, ListChecks, X } from "lucide-react";

const AVAILABLE_LABELS = ["Срочно", "Важно", "В процессе", "Готово", "Идея", "Баг"];
const LABEL_COLORS: Record<string, string> = {
  "Срочно": "#ff6b6b",
  "Важно": "#ffa726",
  "В процессе": "#42a5f5",
  "Готово": "#66bb6a",
  "Идея": "#ab47bc",
  "Баг": "#ef5350",
};

interface CardDetailProps {
  card: Card;
  boardId: string;
  onClose: () => void;
}

export function CardDetail({ card, boardId, onClose }: CardDetailProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [labels, setLabels] = useState<string[]>((card.labels as string[]) || []);
  const [newCheckItem, setNewCheckItem] = useState("");
  const { toast } = useToast();

  const { data: checklistItems } = useQuery<ChecklistItem[]>({
    queryKey: ["/api/cards", card.id, "checklist"],
  });

  const updateCardMutation = useMutation({
    mutationFn: async (data: Partial<Card>) => {
      await apiRequest("PATCH", `/api/cards/${card.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "lists"] });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/cards/${card.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "lists"] });
      onClose();
    },
  });

  const addCheckItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/checklist", {
        cardId: card.id,
        text,
        position: (checklistItems || []).length,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", card.id, "checklist"] });
      setNewCheckItem("");
    },
  });

  const toggleCheckItemMutation = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      await apiRequest("PATCH", `/api/checklist/${id}`, { checked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", card.id, "checklist"] });
    },
  });

  const deleteCheckItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/checklist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", card.id, "checklist"] });
    },
  });

  const handleSave = () => {
    updateCardMutation.mutate({ title, description, labels });
    toast({ title: "Сохранено" });
  };

  const toggleLabel = (label: string) => {
    const newLabels = labels.includes(label)
      ? labels.filter((l) => l !== label)
      : [...labels, label];
    setLabels(newLabels);
    updateCardMutation.mutate({ labels: newLabels });
  };

  const handleAddCheckItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckItem.trim()) return;
    addCheckItemMutation.mutate(newCheckItem);
  };

  const checkedCount = checklistItems?.filter((i) => i.checked).length || 0;
  const totalCount = checklistItems?.length || 0;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            Карточка
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          <div className="space-y-2">
            <Label>Заголовок</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              data-testid="input-card-title"
            />
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              placeholder="Добавьте описание..."
              className="resize-none min-h-[80px]"
              data-testid="input-card-description"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Метки
            </Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_LABELS.map((label) => (
                <Badge
                  key={label}
                  className="cursor-pointer transition-all"
                  style={{
                    backgroundColor: labels.includes(label) ? LABEL_COLORS[label] : "transparent",
                    color: labels.includes(label) ? "#fff" : "hsl(var(--foreground))",
                    border: `1px solid ${LABEL_COLORS[label]}`,
                  }}
                  onClick={() => toggleLabel(label)}
                  data-testid={`badge-label-${label}`}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Чеклист
              {totalCount > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">{checkedCount}/{totalCount}</span>
              )}
            </Label>

            {totalCount > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {checklistItems?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 group animate-fade-in"
                >
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) =>
                      toggleCheckItemMutation.mutate({ id: item.id, checked: !!checked })
                    }
                    data-testid={`checkbox-${item.id}`}
                  />
                  <span className={`flex-1 text-sm ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                    {item.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteCheckItemMutation.mutate(item.id)}
                    data-testid={`button-delete-check-${item.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCheckItem} className="flex gap-2">
              <Input
                placeholder="Новый пункт..."
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                className="flex-1"
                data-testid="input-new-check-item"
              />
              <Button type="submit" size="sm" disabled={addCheckItemMutation.isPending} data-testid="button-add-check-item">
                <Plus className="w-4 h-4" />
              </Button>
            </form>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteCardMutation.mutate()}
              data-testid="button-delete-card"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить карточку
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
