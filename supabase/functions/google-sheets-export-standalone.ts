// Edge Function: google-sheets-export
// Copy this entire code into Supabase Dashboard > Edge Functions > New Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Google Auth Helper
async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600

  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now
  }

  const base64urlEncode = (obj: object) => {
    const json = JSON.stringify(obj)
    const base64 = btoa(json)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const headerEncoded = base64urlEncode(header)
  const claimSetEncoded = base64urlEncode(claimSet)
  const signatureInput = `${headerEncoded}.${claimSetEncoded}`

  const key = privateKey.replace(/\\n/g, '\n')
  const pemContents = key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signatureInput))
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${signatureInput}.${signatureBase64}`

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })

  if (!tokenResponse.ok) throw new Error(`Token error: ${await tokenResponse.text()}`)
  return (await tokenResponse.json()).access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const { expenseIds } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // Get user's sheet ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_sheet_id, google_sheet_url, name')
      .eq('id', user.id)
      .single()

    // Get credentials
    const clientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
    if (!clientEmail || !privateKey) throw new Error('Google credentials not configured')

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey)

    let sheetId = profile?.google_sheet_id
    let sheetUrl = profile?.google_sheet_url

    // Create sheet if doesn't exist
    if (!sheetId) {
      const userName = profile?.name || user.email?.split('@')[0] || 'User'
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: `Expense Tracker - ${userName}` },
          sheets: [{
            properties: {
              title: 'Expenses',
              gridProperties: { rowCount: 1000, columnCount: 10 }
            }
          }]
        })
      })

      if (!createResponse.ok) throw new Error(`Failed to create sheet: ${await createResponse.text()}`)

      const spreadsheet = await createResponse.json()
      sheetId = spreadsheet.spreadsheetId
      sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`

      // Add headers
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Expenses!A1:G1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['Date', 'Time', 'Category', 'Vendor', 'Description', 'Amount', 'Has Receipt']] })
        }
      )

      // Format header
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          }]
        })
      })

      // Share with user
      if (user.email) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: user.email })
        })
      }

      // Save to profile
      await supabase.from('profiles').update({
        google_sheet_id: sheetId,
        google_sheet_url: sheetUrl
      }).eq('id', user.id)
    }

    // Get expenses to export
    let query = supabase
      .from('expenses')
      .select('*, expense_images (id)')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (expenseIds && expenseIds.length > 0) {
      query = query.in('id', expenseIds)
    }

    const { data: expenses, error: expensesError } = await query
    if (expensesError) throw expensesError

    if (!expenses || expenses.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No expenses to export',
        exportedCount: 0,
        sheetUrl
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get current row count
    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Expenses!A:A`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    const getData = await getResponse.json()
    const startRow = (getData.values?.length || 1) + 1

    // Format expenses
    const rows = expenses.map(exp => [
      exp.date,
      exp.time || '',
      exp.category,
      exp.vendor || 'N/A',
      exp.description || 'N/A',
      exp.amount,
      exp.expense_images?.length > 0 ? 'Yes' : 'No'
    ])

    // Append to sheet
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Expenses!A${startRow}:G${startRow + rows.length - 1}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows })
      }
    )

    if (!appendResponse.ok) throw new Error(`Failed to append: ${await appendResponse.text()}`)

    // Mark as exported
    await supabase
      .from('expenses')
      .update({ exported_to_sheets: true, exported_at: new Date().toISOString() })
      .in('id', expenses.map(e => e.id))

    return new Response(JSON.stringify({
      success: true,
      message: `Exported ${expenses.length} expenses to Google Sheets`,
      exportedCount: expenses.length,
      sheetUrl
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
