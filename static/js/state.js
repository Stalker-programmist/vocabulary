export function createState() {
  return {
    isAuthed: false,
    words: [],
    reviewQueue: [],
    currentReview: null,
    editingId: null,
    wordsPaging: {
      pageSize: 10,
      offset: 0,
      hasNext: false,
      hasPrev: false,
      lastKey: "",
    },
  };
}

