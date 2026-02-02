// Supabase Edge Function: WhatsApp Webhook Handler
// Handles incoming Twilio WhatsApp messages

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Category auto-detection keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Meals - Food': ['lunch', 'dinner', 'breakfast', 'food', 'meal', 'eat', 'biryani', 'canteen'],
  'Meals - Snacks': ['snack', 'coffee', 'tea', 'cafe', 'juice', 'samosa'],
  'Meals - Restaurant': ['restaurant', 'hotel', 'pizza', 'burger', 'swiggy', 'zomato', 'dine'],
  'Transportation - Cab': ['uber', 'ola', 'cab', 'taxi', 'rapido'],
  'Transportation - Auto': ['auto', 'rickshaw'],
  'Transportation - Bus': ['bus', 'metro', 'train'],
  'Fuel - Petrol': ['fuel', 'petrol', 'diesel', 'gas station'],
  'Shopping - Online': ['amazon', 'flipkart', 'myntra', 'online'],
  'Shopping - Clothes': ['clothes', 'shoes', 'dress', 'shirt', 'wear'],
  'Shopping - General': ['shop', 'mall', 'buy', 'purchase', 'store'],
  'Utilities - Bills': ['electricity', 'water', 'gas', 'internet', 'wifi', 'bill'],
  'Utilities - Recharge': ['recharge', 'mobile', 'phone', 'jio', 'airtel', 'vi'],
  'Entertainment - Movies': ['movie', 'cinema', 'pvr', 'inox', 'film'],
  'Entertainment - Subscription': ['netflix', 'spotify', 'prime', 'hotstar', 'subscription'],
  'Health - Medicine': ['medicine', 'pharmacy', 'medical', 'tablet'],
  'Health - Doctor': ['doctor', 'hospital', 'clinic', 'apollo', 'consultation'],
  'Groceries': ['grocery', 'vegetables', 'fruits', 'milk', 'supermarket', 'bigbasket', 'blinkit', 'zepto', 'dmart']
}

function detectCategory(description: string): string {
  const desc = description.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return category
    }
  }
  return 'Miscellaneous'
}

function extractVendor(description: string): string {
  const desc = description.trim()
  const atMatch = desc.match(/(?:at|from|@)\s+(.+)/i)
  if (atMatch && atMatch[1]) {
    return capitalizeWords(atMatch[1].trim())
  }

  const knownVendors = ['amazon', 'flipkart', 'swiggy', 'zomato', 'uber', 'ola', 'rapido',
    'starbucks', 'ccd', 'dominos', 'mcdonalds', 'kfc', 'subway',
    'bigbasket', 'blinkit', 'zepto', 'dmart', 'reliance', 'apollo']
  const descLower = desc.toLowerCase()
  for (const vendor of knownVendors) {
    if (descLower.includes(vendor)) {
      return capitalizeWords(vendor)
    }
  }

  return 'N/A'
}

function capitalizeWords(str: string): string {
  return str.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function parseExpenseFromMessage(text: string): { amount: number; description: string } | null {
  if (!text) return null

  // Pattern: "500 lunch" or "lunch 500"
  const amountFirst = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i)
  if (amountFirst) {
    return {
      amount: parseFloat(amountFirst[1]),
      description: amountFirst[2].trim()
    }
  }

  const amountLast = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/i)
  if (amountLast) {
    return {
      amount: parseFloat(amountLast[2]),
      description: amountLast[1].trim()
    }
  }

  return null
}

async function sendWhatsAppMessage(to: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Twilio credentials not configured')
    return
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      From: `whatsapp:${fromNumber}`,
      To: toNumber,
      Body: message
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Twilio error:', error)
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData()
    const From = formData.get('From') as string
    const Body = formData.get('Body') as string
    const NumMedia = formData.get('NumMedia') as string

    console.log('WhatsApp webhook:', { From, Body, NumMedia })

    const phoneNumber = From?.replace('whatsapp:', '')

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find user by phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('whatsapp_number', phoneNumber)
      .single()

    if (profileError || !profile) {
      await sendWhatsAppMessage(From,
        '❌ *Number Not Registered*\n\n' +
        'Register at your expense tracker app.\n' +
        'Then add your WhatsApp in Settings.'
      )
      return new Response('OK', { status: 200 })
    }

    const messageText = Body?.trim()
    const messageLower = messageText?.toLowerCase()

    // === COMMANDS ===

    // Cancel
    if (messageLower === 'cancel' || messageLower === 'exit') {
      await supabase
        .from('pending_whatsapp_expenses')
        .delete()
        .eq('user_id', profile.id)

      await sendWhatsAppMessage(From, '❌ Cancelled.\n\nSend *add* to start again.')
      return new Response('OK', { status: 200 })
    }

    // Help
    if (messageLower === 'help' || messageLower === '?') {
      await sendWhatsAppMessage(From,
        '📱 *Expense Tracker*\n\n' +
        '*Quick Add (3 steps):*\n' +
        '📝 *add* - Start adding expense\n\n' +
        '*Instant Add:*\n' +
        '⚡ Just send: *500 lunch*\n\n' +
        '*Reports:*\n' +
        '📊 *summary* - Today\n' +
        '📅 *week* - This week\n' +
        '📆 *month* - This month\n\n' +
        '❌ *cancel* - Cancel current'
      )
      return new Response('OK', { status: 200 })
    }

    // Summary commands
    if (messageLower === 'summary' || messageLower === 'today') {
      await sendSummary(supabase, From, profile.id, 'today')
      return new Response('OK', { status: 200 })
    }
    if (messageLower === 'week') {
      await sendSummary(supabase, From, profile.id, 'week')
      return new Response('OK', { status: 200 })
    }
    if (messageLower === 'month') {
      await sendSummary(supabase, From, profile.id, 'month')
      return new Response('OK', { status: 200 })
    }

    // Start new expense
    if (messageLower === 'add' || messageLower === 'new') {
      await supabase
        .from('pending_whatsapp_expenses')
        .upsert({
          user_id: profile.id,
          whatsapp_number: phoneNumber,
          step: 'amount'
        }, { onConflict: 'user_id' })

      await sendWhatsAppMessage(From,
        '📝 *New Expense*\n\n' +
        '*Step 1/3: Amount*\n' +
        'Enter the amount:\n\n' +
        '_Example: 500_'
      )
      return new Response('OK', { status: 200 })
    }

    // Check for pending expense
    const { data: pending } = await supabase
      .from('pending_whatsapp_expenses')
      .select('*')
      .eq('user_id', profile.id)
      .single()

    // === INSTANT ADD ===
    if (!pending) {
      const parsed = parseExpenseFromMessage(messageText)
      if (parsed) {
        const category = detectCategory(parsed.description)
        const vendor = extractVendor(parsed.description)

        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            user_id: profile.id,
            amount: parsed.amount,
            description: parsed.description,
            category: category,
            vendor: vendor,
            date: new Date().toISOString().split('T')[0]
          })

        if (!insertError) {
          await sendWhatsAppMessage(From,
            '⚡ *Expense Added!*\n\n' +
            `💰 ₹${parsed.amount}\n` +
            `📝 ${parsed.description}\n` +
            `📁 ${category}\n` +
            `🏪 ${vendor}\n` +
            `📅 ${formatDate(new Date())}\n\n` +
            '_Send another or type *summary*_'
          )
        }
        return new Response('OK', { status: 200 })
      }

      // Unknown message
      await sendWhatsAppMessage(From,
        '👋 *Hi!*\n\n' +
        '⚡ Send: *500 lunch* to add expense\n' +
        '📝 Send: *add* for step-by-step\n' +
        '❓ Send: *help* for all commands'
      )
      return new Response('OK', { status: 200 })
    }

    // === STEP FLOW PROCESSING ===
    await processStep(supabase, From, profile, pending, messageText)

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('OK', { status: 200 })
  }
})

async function processStep(
  supabase: any,
  from: string,
  profile: any,
  pending: any,
  message: string
) {
  const input = message?.trim()
  const inputLower = input?.toLowerCase()

  switch (pending.step) {
    case 'amount':
      const amount = parseFloat(input.replace(/[₹,Rs\s]/gi, ''))
      if (isNaN(amount) || amount <= 0) {
        await sendWhatsAppMessage(from,
          '❌ Please enter a valid amount.\n\n_Example: 500_'
        )
        return
      }

      await supabase
        .from('pending_whatsapp_expenses')
        .update({ amount: amount, step: 'description' })
        .eq('user_id', profile.id)

      await sendWhatsAppMessage(from,
        `✅ Amount: ₹${amount}\n\n` +
        '*Step 2/3: Description*\n' +
        'What was this for?\n\n' +
        '_Example: Lunch at Cafe Coffee Day_'
      )
      break

    case 'description':
      if (!input || input.length < 2) {
        await sendWhatsAppMessage(from,
          '❌ Please enter a description.\n\n_Example: Lunch at office_'
        )
        return
      }

      const category = detectCategory(input)
      const vendor = extractVendor(input)

      await supabase
        .from('pending_whatsapp_expenses')
        .update({
          description: input,
          category: category,
          vendor: vendor,
          step: 'confirm'
        })
        .eq('user_id', profile.id)

      // Get updated pending
      const { data: updatedPending } = await supabase
        .from('pending_whatsapp_expenses')
        .select('*')
        .eq('user_id', profile.id)
        .single()

      await sendWhatsAppMessage(from,
        '📋 *Step 3/3: Confirm*\n\n' +
        `💰 Amount: ₹${updatedPending.amount}\n` +
        `📝 Description: ${input}\n` +
        `📁 Category: ${category}\n` +
        `🏪 Vendor: ${vendor}\n` +
        `📅 Date: ${formatDate(new Date())}\n\n` +
        'Reply:\n' +
        '1️⃣ *yes* - Save expense\n' +
        '2️⃣ *no* - Cancel'
      )
      break

    case 'confirm':
      if (inputLower === 'yes' || inputLower === 'y' || inputLower === 'ok' || input === '1') {
        // Create expense
        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            user_id: profile.id,
            amount: pending.amount,
            description: pending.description,
            category: pending.category,
            vendor: pending.vendor,
            date: new Date().toISOString().split('T')[0]
          })

        // Delete pending
        await supabase
          .from('pending_whatsapp_expenses')
          .delete()
          .eq('user_id', profile.id)

        if (!insertError) {
          await sendWhatsAppMessage(from,
            '✅ *Expense Saved!*\n\n' +
            `💰 ₹${pending.amount}\n` +
            `📝 ${pending.description}\n` +
            `📁 ${pending.category}\n` +
            `🏪 ${pending.vendor}\n` +
            `📅 ${formatDate(new Date())}\n\n` +
            '_Send *add* for another or *summary* for report_'
          )
        }
      } else if (inputLower === 'no' || inputLower === 'n' || inputLower === 'cancel' || input === '2') {
        await supabase
          .from('pending_whatsapp_expenses')
          .delete()
          .eq('user_id', profile.id)

        await sendWhatsAppMessage(from,
          '❌ *Expense Cancelled*\n\nSend *add* to start again.'
        )
      } else {
        await sendWhatsAppMessage(from,
          '❓ Reply:\n' +
          '• *1* or *yes* - Save expense\n' +
          '• *2* or *no* - Cancel'
        )
      }
      break
  }
}

async function sendSummary(supabase: any, to: string, userId: string, period: string) {
  let startDate = new Date()
  let periodLabel = 'Today'

  if (period === 'today') {
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7)
    periodLabel = 'This Week'
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1)
    periodLabel = 'This Month'
  }

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: false })

  const total = expenses?.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0) || 0
  const byCategory: Record<string, number> = {}

  expenses?.forEach((exp: any) => {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + parseFloat(exp.amount)
  })

  let message = `📊 *${periodLabel}'s Expenses*\n\n`

  if (!expenses || expenses.length === 0) {
    message += '_No expenses recorded_'
  } else {
    message += `💰 *Total: ₹${total.toFixed(0)}*\n`
    message += `📝 ${expenses.length} expense${expenses.length > 1 ? 's' : ''}\n\n`

    if (Object.keys(byCategory).length > 0) {
      message += `📁 *By Category:*\n`
      Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, amt]) => {
          message += `• ${cat}: ₹${amt.toFixed(0)}\n`
        })
    }

    if (expenses.length > 0) {
      message += `\n📋 *Recent:*\n`
      expenses.slice(0, 5).forEach((exp: any, i: number) => {
        message += `${i + 1}. ${exp.description} - ₹${exp.amount}\n`
      })
    }
  }

  await sendWhatsAppMessage(to, message)
}
