// Auth events can run under Supabase's session lock. A promise microtask is
// too early: start API work in the next task, after the SDK releases its lock.
// Callers must handle errors and check whether their session is still current.
export function deferAuthWork(work: () => Promise<void>): void {
  setTimeout(() => {
    void work();
  }, 0);
}
