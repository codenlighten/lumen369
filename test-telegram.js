/**
 * Test sending a message to the Telegram bot
 */

import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_ADMIN_ID || 'YOUR_CHAT_ID';

async function sendTestMessage() {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: '🧪 Test message from lumen-coder! Bot is running on droplet.'
    })
  });
  
  const data = await response.json();
  console.log('Response:', data);
}

sendTestMessage();
