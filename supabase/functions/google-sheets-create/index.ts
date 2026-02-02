// Edge Function: Create Google Sheet for user
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getGoogleAccessToken, getCredentials } from '../_shared/google-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Not authenticated')
    }

    // Check if user already has a sheet
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_sheet_id, name, email')
      .eq('id', user.id)
      .single()

    if (profile?.google_sheet_id) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Sheet already exists',
          sheetId: profile.google_sheet_id,
          sheetUrl: `https://docs.google.com/spreadsheets/d/${profile.google_sheet_id}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Google credentials and access token
    const credentials = getCredentials()
    const accessToken = await getGoogleAccessToken(credentials)

    // Create new spreadsheet
    const userName = profile?.name || user.email?.split('@')[0] || 'User'
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `Expense Tracker - ${userName}`
        },
        sheets: [
          {
            properties: {
              title: 'Expenses',
              gridProperties: {
                rowCount: 1000,
                columnCount: 10
              }
            }
          }
        ]
      })
    })

    if (!createResponse.ok) {
      const error = await createResponse.text()
      throw new Error(`Failed to create spreadsheet: ${error}`)
    }

    const spreadsheet = await createResponse.json()
    const sheetId = spreadsheet.spreadsheetId
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`

    // Add headers to the sheet
    const headers = [['Date', 'Time', 'Category', 'Vendor', 'Description', 'Amount', 'Has Receipt']]
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Expenses!A1:G1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: headers })
      }
    )

    // Format header row (bold, background color)
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          }
        ]
      })
    })

    // Share with user's email
    if (user.email) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'user',
          role: 'writer',
          emailAddress: user.email
        })
      })
    }

    // Save sheet ID to profile
    await supabase
      .from('profiles')
      .update({
        google_sheet_id: sheetId,
        google_sheet_url: sheetUrl
      })
      .eq('id', user.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Google Sheet created successfully',
        sheetId,
        sheetUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
