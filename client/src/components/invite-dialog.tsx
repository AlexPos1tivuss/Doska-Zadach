import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, X } from "lucide-react";
import type { User } from "@shared/schema";

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  boardId: string;
}

export function InviteDialog({ open, onClose, boardId }: InviteDialogProps) {
  const [username, setUsername] = useState("");
  const { toast } = useToast();

  const { data: members } = useQuery<(User & { memberId: string })[]>({
    queryKey: ["/api/boards", boardId, "members"],
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: async (username: string) => {
      await apiRequest("POST", `/api/boards/${boardId}/members`, { username });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "members"] });
      setUsername("");
      toast({ title: "Пользователь приглашен!" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("DELETE", `/api/boards/${boardId}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "members"] });
      toast({ title: "Участник удален" });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    inviteMutation.mutate(username);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Участники доски
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              placeholder="Логин пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1"
              data-testid="input-invite-username"
            />
            <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-invite-submit">
              <UserPlus className="w-4 h-4 mr-1" />
              Пригласить
            </Button>
          </form>

          {members && members.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Участники</Label>
              {members.map((member) => (
                <div key={member.memberId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 animate-fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {member.displayName?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{member.username}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-7 w-7"
                    onClick={() => removeMemberMutation.mutate(member.memberId)}
                    data-testid={`button-remove-member-${member.memberId}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
