/**
 * Reflection Agent - Analyzes conversation patterns and speaks up about issues
 * 
 * Detects problems like:
 * - High message volume (many responses in short time)
 * - User frustration signals (Stop, too many messages, etc.)
 * - Ineffective patterns (repeated issues, loops)
 * - Feature problems (thinking step creating noise, etc.)
 */

import { getCurrentMemory } from './memorySystem.js';

/**
 * Analyze recent interactions for problems
 */
export async function analyzeConversationHealth() {
  const memory = await getCurrentMemory();
  const interactions = memory.interactions || [];
  
  if (interactions.length < 3) return null;
  
  const issues = [];
  
  // Check 1: User frustration signals in last N interactions
  const lastFive = interactions.slice(-5);
  const frustratedSignals = lastFive.filter(inter => {
    const query = typeof inter.userRequest === 'string' ? inter.userRequest : (inter.userRequest?.query || '');
    return /stop|too many|excessive|spam|enough|reduce|fewer|less/i.test(query);
  });
  
  if (frustratedSignals.length >= 2) {
    issues.push({
      type: 'USER_FRUSTRATION',
      severity: 'HIGH',
      message: `User has expressed frustration about message volume or bot behavior ${frustratedSignals.length} times in last 5 interactions`,
      detail: frustratedSignals.map(i => i.userRequest?.query || i.userRequest).join(' | ')
    });
  }
  
  // Check 2: Message volume spike
  const recentTimestamps = lastFive.map(i => new Date(i.ts).getTime());
  if (recentTimestamps.length > 2) {
    const timeGaps = [];
    for (let i = 1; i < recentTimestamps.length; i++) {
      timeGaps.push(recentTimestamps[i] - recentTimestamps[i-1]);
    }
    const avgGap = timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length;
    
    // If average gap is very small (< 15 seconds), there's a rapid-fire pattern
    if (avgGap < 15000) {
      issues.push({
        type: 'MESSAGE_VOLUME',
        severity: 'HIGH',
        message: `Detected rapid message generation (${Math.round(avgGap/1000)}s average between interactions)`,
        detail: `This may be from thinking step or continuous loops`
      });
    }
  }
  
  // Check 3: Repeated thinking steps (indicator of ineffective feature)
  const thinkingSteps = lastFive.filter(inter => {
    const query = typeof inter.userRequest === 'string' ? inter.userRequest : (inter.userRequest?.query || '');
    return /thinking step/i.test(query);
  });
  
  if (thinkingSteps.length >= 3) {
    issues.push({
      type: 'THINKING_STEP_LOOP',
      severity: 'MEDIUM',
      message: `Thinking step is generating repetitive messages`,
      detail: `${thinkingSteps.length} thinking steps in last 5 interactions - may be creating noise instead of clarity`
    });
  }
  
  // Check 4: Loop detection (same response being generated repeatedly)
  if (interactions.length >= 4) {
    const lastTwo = interactions.slice(-2);
    if (lastTwo[0].aiResponse?.response === lastTwo[1].aiResponse?.response) {
      issues.push({
        type: 'RESPONSE_LOOP',
        severity: 'HIGH',
        message: `Detected identical responses being generated repeatedly`,
        detail: `This suggests the agent is stuck in a loop`
      });
    }
  }
  
  return issues.length > 0 ? issues : null;
}

/**
 * Generate a reflection message about detected issues
 */
export function generateReflectionMessage(issues) {
  if (!issues || issues.length === 0) return null;
  
  const highSeverity = issues.filter(i => i.severity === 'HIGH');
  
  if (highSeverity.length === 0) {
    return `I've noticed some patterns in our conversation that might be worth addressing. Would you like me to adjust anything?`;
  }
  
  // User frustration takes priority
  const frustration = issues.find(i => i.type === 'USER_FRUSTRATION');
  if (frustration) {
    return `I recognize you've expressed frustration about message volume. You're right - I've been sending too many messages, especially with the thinking step creating duplicates. Should I disable the thinking step and just respond once per message?`;
  }
  
  const messageVolume = issues.find(i => i.type === 'MESSAGE_VOLUME');
  if (messageVolume) {
    return `I notice I'm generating responses very rapidly (${messageVolume.detail}). This might be from the thinking step firing on every iteration. Would you prefer I disable it?`;
  }
  
  const thinkingLoop = issues.find(i => i.type === 'THINKING_STEP_LOOP');
  if (thinkingLoop) {
    return `I see the thinking step is creating repetitive messages. It's not adding clarity, just volume. Should I turn it off?`;
  }
  
  const responseLoop = issues.find(i => i.type === 'RESPONSE_LOOP');
  if (responseLoop) {
    return `I notice I'm stuck in a loop, repeating the same response. Let me break this pattern and try a different approach.`;
  }
  
  return null;
}
