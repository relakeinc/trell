"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ChatContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openChat: () => void;
  closeChat: () => void;
  askHover: boolean;
  setAskHover: (hover: boolean) => void;
}

const ChatContext = createContext<ChatContextValue>({
  open: false,
  setOpen: () => {},
  openChat: () => {},
  closeChat: () => {},
  askHover: false,
  setAskHover: () => {},
});

export function useChat(): ChatContextValue {
  return useContext(ChatContext);
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [askHover, setAskHover] = useState(false);
  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, setOpen, openChat, closeChat, askHover, setAskHover }),
    [open, askHover],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
