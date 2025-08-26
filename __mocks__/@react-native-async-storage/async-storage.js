// __mocks__/@react-native-async-storage/async-storage.js
const jestMock = require('jest-mock');

function createAsyncStorageMock() {
  let store = {};
  return {
    setItem: jestMock.fn(async (key, value) => {
      store[key] = value;
    }),
    getItem: jestMock.fn(async (key) => {
      return store.hasOwnProperty(key) ? store[key] : null;
    }),
    removeItem: jestMock.fn(async (key) => {
      delete store[key];
    }),
    clear: jestMock.fn(async () => {
      store = {};
    }),
    getAllKeys: jestMock.fn(async () => Object.keys(store)),
    multiGet: jestMock.fn(async (keys) => keys.map(key => [key, store[key] || null])),
    multiSet: jestMock.fn(async (pairs) => {
      pairs.forEach(([key, value]) => { store[key] = value; });
    }),
    multiRemove: jestMock.fn(async (keys) => {
      keys.forEach(key => { delete store[key]; });
    }),
    __resetStore: () => { store = {}; },
  };
}

module.exports = createAsyncStorageMock();
