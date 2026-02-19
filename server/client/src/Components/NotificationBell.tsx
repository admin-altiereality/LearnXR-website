/**
 * NotificationBell - In-app notifications from approval, rejection, edit requests
 * Subscribes to user_notifications/{userId}/items
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FaBell } from 'react-icons/fa';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: { seconds: number } | null;
  link?: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const itemsRef = collection(db, 'user_notifications', user.uid, 'items');
    const q = query(
      itemsRef,
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Notification[] = [];
      let unread = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          type: data.type || '',
          title: data.title || '',
          message: data.message || '',
          read: data.read === true,
          createdAt: data.createdAt,
          link: data.link,
        });
        if (!data.read) unread++;
      });
      setNotifications(items);
      setUnreadCount(unread);
    }, (err) => {
      console.warn('NotificationBell snapshot error:', err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'user_notifications', user.uid, 'items', id), { read: true });
    } catch (err) {
      console.warn('markAsRead failed:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.uid) return;
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, 'user_notifications', user.uid, 'items', n.id), { read: true });
      } catch (err) {
        console.warn('markAsRead failed:', err);
      }
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <FaBell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="h-[280px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start gap-0.5 p-3 cursor-pointer"
                onClick={() => {
                  markAsRead(n.id);
                  if (n.link) {
                    setOpen(false);
                    navigate(n.link);
                  }
                }}
              >
                <div className={`flex w-full justify-between ${!n.read ? 'font-medium' : ''}`}>
                  <span className="text-foreground">{n.title}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
