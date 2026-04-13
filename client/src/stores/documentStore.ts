import { create } from 'zustand';
import type { DocumentDto } from '@shared/types';

interface DocumentState {
  documents: DocumentDto[];
  currentDocument: DocumentDto | null;
  isGenerating: boolean;
  generatedContent: string;
  reviewContent: string;
  isReviewing: boolean;
  reviewOpen: boolean;

  setDocuments: (docs: DocumentDto[]) => void;
  setCurrentDocument: (doc: DocumentDto | null) => void;
  addDocument: (doc: DocumentDto) => void;
  updateDocument: (doc: DocumentDto) => void;

  setIsGenerating: (v: boolean) => void;
  appendGeneratedContent: (delta: string) => void;
  setGeneratedContent: (content: string) => void;
  clearGeneratedContent: () => void;

  setIsReviewing: (v: boolean) => void;
  appendReviewContent: (delta: string) => void;
  clearReviewContent: () => void;
  setReviewOpen: (open: boolean) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocument: null,
  isGenerating: false,
  generatedContent: '',
  reviewContent: '',
  isReviewing: false,
  reviewOpen: false,

  setDocuments: (documents) => set({ documents }),
  setCurrentDocument: (currentDocument) => set({ currentDocument }),
  addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
  updateDocument: (doc) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === doc.id ? doc : d)),
      currentDocument: s.currentDocument?.id === doc.id ? doc : s.currentDocument,
    })),

  setIsGenerating: (isGenerating) => set({ isGenerating }),
  appendGeneratedContent: (delta) =>
    set((s) => ({ generatedContent: s.generatedContent + delta })),
  setGeneratedContent: (generatedContent) => set({ generatedContent }),
  clearGeneratedContent: () => set({ generatedContent: '', isGenerating: false }),

  setIsReviewing: (isReviewing) => set({ isReviewing }),
  appendReviewContent: (delta) =>
    set((s) => ({ reviewContent: s.reviewContent + delta })),
  clearReviewContent: () => set({ reviewContent: '', isReviewing: false }),
  setReviewOpen: (reviewOpen) => set({ reviewOpen }),
}));
