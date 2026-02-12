/**
 * MessageBuffer - Coalescing message buffer with debounce
 * 
 * Collects messages per user/session and flushes them after
 * a period of silence, enabling batch processing. Prevents
 * overlapping executions and queues overflow messages.
 */
class MessageBuffer {
  constructor(options = {}) {
    this.debounceMs = options.debounceMs || 3000;
    this.onFlush = options.onFlush; // async (id, messages) => {}
    this.buffers = new Map(); // id -> { messages: [], timer: null, processing: false, nextQueue: [] }
  }

  addMessage(id, message) {
    if (!this.buffers.has(id)) {
      this.buffers.set(id, {
        messages: [],
        timer: null,
        processing: false,
        nextQueue: []
      });
    }

    const buffer = this.buffers.get(id);

    // If we are currently processing a batch, push to the secondary queue
    if (buffer.processing) {
      buffer.nextQueue.push({
        text: message,
        timestamp: Date.now()
      });
      console.log(`[MessageBuffer] ${id} - Message queued for next batch (processing in progress)`);
      return false; 
    }

    buffer.messages.push({
      text: message,
      timestamp: Date.now()
    });

    if (buffer.timer) clearTimeout(buffer.timer);

    buffer.timer = setTimeout(() => this.flush(id), this.debounceMs);
    console.log(`[MessageBuffer] ${id} - Message added, timer reset (${this.debounceMs}ms)`);
    return true;
  }

  async flush(id) {
    const buffer = this.buffers.get(id);
    if (!buffer || buffer.messages.length === 0) return;

    buffer.processing = true;
    const messagesToProcess = [...buffer.messages];
    
    console.log(`[MessageBuffer] ${id} - Flushing ${messagesToProcess.length} message(s)`);
    
    // Clear primary buffer
    buffer.messages = [];
    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = null;
    }

    try {
      if (this.onFlush) {
        await this.onFlush(id, messagesToProcess);
      }
    } catch (error) {
      console.error(`[MessageBuffer] Error flushing buffer ${id}:`, error);
    } finally {
      buffer.processing = false;
      
      // If messages arrived during processing, move them to the primary 
      // buffer and trigger a flush timer for them.
      if (buffer.nextQueue.length > 0) {
        console.log(`[MessageBuffer] ${id} - Moving ${buffer.nextQueue.length} queued message(s) to primary buffer`);
        buffer.messages = [...buffer.nextQueue];
        buffer.nextQueue = [];
        buffer.timer = setTimeout(() => this.flush(id), this.debounceMs);
      }
    }
  }

  isProcessing(id) {
    return this.buffers.get(id)?.processing || false;
  }

  clear(id) {
    const buffer = this.buffers.get(id);
    if (buffer?.timer) clearTimeout(buffer.timer);
    this.buffers.delete(id);
    console.log(`[MessageBuffer] ${id} - Buffer cleared`);
  }

  getStats(id) {
    const buffer = this.buffers.get(id);
    if (!buffer) return null;
    
    return {
      currentMessages: buffer.messages.length,
      queuedMessages: buffer.nextQueue.length,
      processing: buffer.processing,
      hasTimer: buffer.timer !== null
    };
  }
}

export { MessageBuffer };
