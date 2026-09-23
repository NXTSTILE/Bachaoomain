"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface LostItem {
  id: string;
  itemName: string;
  description: string;
  location: string;
  lostTime: string;
  contactNumber: string;
  createdAt: number;
}

export interface HelpRequest {
  id: string;
  problemSubject: string;
  details: string;
  deadline: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  author: string;       // display name / role label
  role: "poster" | "helper" | "public";
  text: string;
  createdAt: number;
}

interface AppContextType {
  lostItems: LostItem[];
  addLostItem: (item: Omit<LostItem, "id" | "createdAt">) => void;

  helpRequests: HelpRequest[];
  addHelpRequest: (req: Omit<HelpRequest, "id" | "createdAt">) => void;

  // Public comments on lost items (accessible to everyone)
  publicComments: Record<string, Comment[]>;
  addPublicComment: (itemId: string, text: string, author: string) => void;

  // Private comments on help requests (poster <-> helper only)
  privateComments: Record<string, Comment[]>;
  addPrivateComment: (requestId: string, text: string, author: string, role: "poster" | "helper") => void;

  // Track which help requests a helper has accepted
  acceptedRequests: Set<string>;
  acceptRequest: (requestId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [publicComments, setPublicComments] = useState<Record<string, Comment[]>>({});
  const [privateComments, setPrivateComments] = useState<Record<string, Comment[]>>({});
  const [acceptedRequests, setAcceptedRequests] = useState<Set<string>>(new Set());

  const addLostItem = (item: Omit<LostItem, "id" | "createdAt">) => {
    const newItem: LostItem = {
      itemName: item.itemName.trim(),
      description: item.description.trim(),
      location: item.location.trim(),
      lostTime: item.lostTime,
      contactNumber: item.contactNumber.trim(),
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setLostItems(prev => [newItem, ...prev]);
  };

  const addHelpRequest = (req: Omit<HelpRequest, "id" | "createdAt">) => {
    const newReq: HelpRequest = {
      problemSubject: req.problemSubject.trim(),
      details: req.details.trim(),
      deadline: req.deadline,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setHelpRequests(prev => [newReq, ...prev]);
  };

  const addPublicComment = (itemId: string, text: string, author: string) => {
    const comment: Comment = {
      id: crypto.randomUUID(),
      author: author.trim() || "Anonymous",
      role: "public",
      text: text.trim(),
      createdAt: Date.now(),
    };
    setPublicComments(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] ?? []), comment],
    }));
  };

  const addPrivateComment = (
    requestId: string,
    text: string,
    author: string,
    role: "poster" | "helper"
  ) => {
    const comment: Comment = {
      id: crypto.randomUUID(),
      author: author.trim() || role,
      role,
      text: text.trim(),
      createdAt: Date.now(),
    };
    setPrivateComments(prev => ({
      ...prev,
      [requestId]: [...(prev[requestId] ?? []), comment],
    }));
  };

  const acceptRequest = (requestId: string) => {
    setAcceptedRequests(prev => new Set(prev).add(requestId));
  };

  return (
    <AppContext.Provider
      value={{
        lostItems, addLostItem,
        helpRequests, addHelpRequest,
        publicComments, addPublicComment,
        privateComments, addPrivateComment,
        acceptedRequests, acceptRequest,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
