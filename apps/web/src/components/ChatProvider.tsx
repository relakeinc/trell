"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ChatContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openChat: () => void;
  closeChat: () => void;
}

const ChatContext = createContext<ChatContextValue>({
  open: false,
  setOpen: () => {},
  openChat: () => {},
  closeChat: () => {},
});

export function useChat(): ChatContextValue {
  return useContext(ChatContext);
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, setOpen, openChat, closeChat }), [open, setOpen, openChat, closeChat]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
