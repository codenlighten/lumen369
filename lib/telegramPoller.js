/**
 * TelegramPoller - Strategic message batch processor
 * 
 * Switches from reactive (event-per-message) to proactive (polling with landscape analysis).
 * Every 3 seconds, analyzes accumulated messages and processes them strategically.
 */

import { queryOpenAI } from './openaiWrapper.js';
import { landscapeAgentResponseSchema } from '../schemas/landscapeAgent.js';

class TelegramPoller {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.interval = options.interval || 3000;
    this.inTray = []; // Accumulator for incoming messages
    this.processedIds = new Set(); // Deduplication
    this.isProcessing = false;
    this.onBatchReady = options.onBatchReady; // async (batch, landscape) => {}
    this.pollTimer = null;
  }

  /**
   * Add message to queue (called by bot.on('message'))
   */
  enqueue(msg) {
    if (this.processedIds.has(msg.message_id)) {
      console.log(`🔄 Message ${msg.message_id} already processed, skipping`);
      return false;
    }
    
    this.inTray.push(msg);
    this.processedIds.add(msg.message_id);
    
    console.log(`📥 [${msg.chat.id}] Message enqueued [ID: ${msg.message_id}]: "${msg.text?.substring(0, 50)}..."`);
    return true;
  }

  /**
   * Start the polling loop
   */
  start() {
    console.log(`🚀 TelegramPoller started with ${this.interval}ms interval`);
    this.pollTimer = setInterval(() => this.poll(), this.interval);
  }

  /**
   * Stop the polling loop
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      console.log('⏸️ TelegramPoller stopped');
    }
  }

  /**
   * Main polling cycle
   */
  async poll() {
    // Skip if already processing or no messages
    if (this.isProcessing || this.inTray.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = [...this.inTray];
    this.inTray = []; // Clear tray for new arrivals during processing

    try {
      console.log(`\n📦 [Batch] Processing ${batch.length} message(s)`);
      
      // Phase 1: Landscape Analysis (Meta-view)
      const landscape = await this.analyzeLandscape(batch);
      console.log(`🗺️ [Landscape] ${landscape.situationSummary}`);
      console.log(`🎯 [Intent] ${landscape.overallIntent}`);
      console.log(`📋 [Approach] ${landscape.suggestedApproach}`);
      console.log(`⚠️ [Priority] ${landscape.priority.toUpperCase()}`);
      
      // Phase 2: Execute batch processing callback
      if (this.onBatchReady) {
        await this.onBatchReady(batch, landscape);
      }
      
      console.log(`✅ [Batch] Completed processing ${batch.length} message(s)\n`);
    } catch (error) {
      console.error('❌ [Poller] Error during batch processing:', error);
      
      // Return messages to tray on failure (optional - could lose messages otherwise)
      // this.inTray.unshift(...batch);
    } finally {
      this.isProcessing = false;
      
      // Cleanup old processed IDs to prevent memory leak (keep last 1000)
      if (this.processedIds.size > 1000) {
        const idsArray = Array.from(this.processedIds);
        this.processedIds = new Set(idsArray.slice(-1000));
      }
    }
  }

  /**
   * Landscape analysis - understand the big picture before responding
   */
  async analyzeLandscape(batch) {
    const combinedText = batch
      .map(m => `[ID:${m.message_id}, Time:${new Date(m.date * 1000).toISOString()}]: ${m.text}`)
      .join('\n');
    
    const landscapeQuery = `You are analyzing a batch of incoming messages to form a strategic response plan.

Messages in this batch:
${combinedText}

Analyze the overall situation, intent, and recommended approach for handling these messages as a cohesive unit.`;

    const response = await queryOpenAI(landscapeQuery, {
      schema: landscapeAgentResponseSchema,
      context: 'You are a strategic message analyzer for an infrastructure operations agent.'
    });

    return response;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      queuedMessages: this.inTray.length,
      processedTotal: this.processedIds.size,
      isProcessing: this.isProcessing,
      pollingInterval: this.interval
    };
  }
}

export { TelegramPoller };
