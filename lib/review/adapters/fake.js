import "server-only";

// A model adapter that returns scripted output and never calls Claude.
// Every adapter has the same shape: { name, complete(prompt) => Promise<string> }.
// Review owns the prompt; an adapter only carries it to a model and returns the raw reply.

export const FAKE_ADAPTER_NAME = "redline-model-adapter:fake";

export class FakeAdapterError extends Error {
  constructor(message) {
    super(`${FAKE_ADAPTER_NAME}: ${message}`);
    this.name = "FakeAdapterError";
  }
}

/**
 * @param {{ responses: (string | ((prompt: string) => string))[] }} script
 *   Replies returned in order, one per call. A function reply receives the prompt.
 */
export function createFakeAdapter({ responses }) {
  const queue = [...responses];
  return {
    name: FAKE_ADAPTER_NAME,
    async complete(prompt) {
      if (queue.length === 0) throw new FakeAdapterError("no scripted reply left");
      const next = queue.shift();
      return typeof next === "function" ? next(prompt) : next;
    },
  };
}
