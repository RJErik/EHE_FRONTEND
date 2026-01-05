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

