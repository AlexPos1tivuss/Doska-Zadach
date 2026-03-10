import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck, Clock, UserPlus2, ClipboardList, Users, CircleCheckBig } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  task_assigned: ClipboardList,
  board_invite: UserPlus2,
  deadline_warning: Clock,
  board_joined: Users,
  task_completed: CircleCheckBig,
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} д. назад`;
  return new Date(date).toLocaleDateString("ru-RU");
}

function requestBrowserPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      lang: "ru",
    });
  }
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const prevCountRef = useRef<number | null>(null);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef(true);

  useEffect(() => {
    requestBrowserPermission();
  }, []);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 15000,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: open,
  });

  useEffect(() => {
    const currentCount = unreadData?.count ?? 0;

    if (isFirstFetchRef.current && unreadData !== undefined) {
      isFirstFetchRef.current = false;
      prevCountRef.current = currentCount;
      return;
    }

    if (
      unreadData !== undefined &&
      prevCountRef.current !== null &&
      currentCount > prevCountRef.current
    ) {
      apiRequest("GET", "/api/notifications")
        .then((res) => res.json())
        .then((notifs: Notification[]) => {
          const unread = notifs.filter((n) => !n.read);
          for (const notif of unread) {
            if (!shownIdsRef.current.has(notif.id)) {
              shownIdsRef.current.add(notif.id);
              showBrowserNotification(notif.title, notif.message);
            }
          }
        })
        .catch(() => {});
    }

    if (unreadData !== undefined) {
      prevCountRef.current = currentCount;
    }
  }, [unreadData]);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse" data-testid="text-unread-count">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Уведомления</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => markAllReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Прочитать все
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notif) => {
                const Icon = NOTIFICATION_ICONS[notif.type] || Bell;
                return (
                  <div
                    key={notif.id}
                    className={`p-3 flex gap-3 cursor-pointer transition-colors hover:bg-muted/50 ${!notif.read ? "bg-primary/5" : ""}`}
                    onClick={() => {
                      if (!notif.read) markReadMutation.mutate(notif.id);
                    }}
                    data-testid={`notification-${notif.id}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.read ? "bg-primary/20" : "bg-muted"}`}>
                      <Icon className={`w-4 h-4 ${!notif.read ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!notif.read ? "font-medium" : "text-muted-foreground"}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(new Date(notif.createdAt))}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Нет уведомлений
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
