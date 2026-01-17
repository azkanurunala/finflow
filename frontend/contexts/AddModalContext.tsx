import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AddModalContextType {
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
}

const AddModalContext = createContext<AddModalContextType | undefined>(undefined);

export function AddModalProvider({ children }: { children: ReactNode }) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <AddModalContext.Provider value={{ showAddModal, setShowAddModal }}>
      {children}
    </AddModalContext.Provider>
  );
}

export function useAddModal() {
  const context = useContext(AddModalContext);
  if (context === undefined) {
    throw new Error('useAddModal must be used within an AddModalProvider');
  }
  return context;
}
