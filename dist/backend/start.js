import { ReadableStream } from "stream/web";
// Apply ReadableStream polyfill globally
if (!globalThis.ReadableStream) {
    globalThis.ReadableStream = ReadableStream;
}
// Import and start the server
import "./server.js";
//# sourceMappingURL=start.js.map