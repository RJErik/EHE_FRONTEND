// Simple event system to share stock/platform selection between components
// Separated from component files to satisfy react-refresh only-export-components rule
const stockSelectionEvents = {
  listeners: [],
  subscribe: (callback) => {
    stockSelectionEvents.listeners.push(callback);
    return () => {
      stockSelectionEvents.listeners = stockSelectionEvents.listeners.filter(
        (cb) => cb !== callback
      );
    };
  },
  notify: (platform, stock) => {
    stockSelectionEvents.listeners.forEach((callback) => callback(platform, stock));
  },
};

export { stockSelectionEvents };

