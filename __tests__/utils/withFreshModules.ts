/**
 * Helper to run an async callback with a fresh module registry.
 * It centralizes jest.resetModules() + jest.isolateModules so tests can require
 * modules in isolation without sprinkling dynamic requires throughout the suite.
 */
export async function withFreshModules<T>(fn: () => Promise<T>): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    try {
      jest.resetModules();
      jest.isolateModules(() => {
        // Run the async callback inside the isolated module registry
        fn().then(resolve).catch(reject);
      });
    } catch (err) {
      reject(err);
    }
  });
}
