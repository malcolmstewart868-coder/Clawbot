import { API_BASE } from "./observerApi";

export function connectEventStream(onMessage: (data: unknown) => void) {
  const stream = new EventSource(`${API_BASE}/api/events`);

  stream.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onMessage(parsed);
    } catch {
      onMessage({ raw: event.data });
    }
  };

  stream.onerror = () => {
    console.error("SSE connection error");
  };

  return () => stream.close();
}