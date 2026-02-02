// Edge Function: Export expenses to Google Sheet
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getGoogleAccessToken, getCredentials } from '../_shared/google-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { expenseIds } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Not authenticated')
    }

    // Get user's sheet ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_sheet_id, google_sheet_url')
      .eq('id', user.id)
      .single()

    let sheetId = profile?.google_sheet_id
    let sheetUrl = profile?.google_sheet_url

    const credentials = getCredentials()
    const accessToken = await getGoogleAccessToken(credentials)

    // Create sheet if doesn't exist
    if (!sheetId) {
      const createResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheets-create`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        }
      )
      const createResult = await createResponse.json()
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create sheet')
      }
      sheetId = createResult.sheetId
      sheetUrl = createResult.sheetUrl
    }

    // Get expenses to export
    let query = supabase
      .from('expenses')
      .select(`
        *,
        expense_images (id)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (expenseIds && expenseIds.length > 0) {
      query = query.in('id', expenseIds)
    }

    const { data: expenses, error: expensesError } = await query
    if (expensesError) throw expensesError

    if (!expenses || expenses.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expenses to export',
          exportedCount: 0,
          sheetUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current row count to append after existing data
    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Expenses!A:A`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )
    const getData = await getResponse.json()
    const startRow = (getData.values?.length || 1) + 1

    // Format expenses for sheets
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
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      }
    )

    if (!appendResponse.ok) {
      const error = await appendResponse.text()
      throw new Error(`Failed to append data: ${error}`)
    }

    // Mark expenses as exported
    await supabase
      .from('expenses')
      .update({ exported_to_sheets: true, exported_at: new Date().toISOString() })
      .in('id', expenses.map(e => e.id))

    return new Response(
      JSON.stringify({
        success: true,
        message: `Exported ${expenses.length} expenses to Google Sheets`,
        exportedCount: expenses.length,
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
