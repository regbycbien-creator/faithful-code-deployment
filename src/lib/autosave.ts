// Cloud writes for the book go through one queue so they land in order, skip
// content already saved, and stay "dirty" after a failure so the next try retries.
export function createCloudSaver(write: (json: string) => Promise<void>) {
  let lastSynced: string | null = null;
  let latest: string | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  let inFlight = 0;

  function save(json: string): Promise<boolean> {
    latest = json;
    inFlight++;
    const job = chain.then(async () => {
      // A newer snapshot is queued behind this one, or this one is already saved.
      if (json !== latest || json === lastSynced) return true;
      try {
        await write(json);
        lastSynced = json;
        return true;
      } catch {
        return false;
      }
    });
    chain = job.finally(() => inFlight--);
    return job;
  }

  return {
    save,
    markSynced: (json: string) => { lastSynced = json; latest = json; },
    isDirty: (json: string) => json !== lastSynced,
    busy: () => inFlight > 0,
    idle: () => chain.then(() => undefined),
  };
}

export type CloudSaver = ReturnType<typeof createCloudSaver>;

/** How often the page checks the book for changes that are not yet saved. */
export const AUTOSAVE_INTERVAL_MS = 3000;
/** localStorage key the user's HTML file uses for its on-device copy. */
export const BOOK_LOCAL_KEY = "sodo-phuhach-web-v1";
