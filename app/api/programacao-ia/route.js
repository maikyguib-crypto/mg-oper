import { NextResponse } from 'next/server'

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggested_date: { type: ['string', 'null'] },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          sector_name: { type: ['string', 'null'] },
          deadline: { type: ['string', 'null'] },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
          member_names: { type: 'array', items: { type: 'string' } },
          notes: { type: ['string', 'null'] }
        },
        required: ['title', 'quantity', 'sector_name', 'deadline', 'priority', 'member_names', 'notes']
      }
    },
    warnings: { type: 'array', items: { type: 'string' } }
  },
  required: ['suggested_date', 'tasks', 'warnings']
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'A IA ainda não foi ativada. Configure OPENAI_API_KEY na Vercel.' }, { status: 503 })
    }

    const body = await request.json()
    const prompt = String(body?.prompt || '').trim()
    if (!prompt) return NextResponse.json({ error: 'Escreva a programação.' }, { status: 400 })

    const targetDate = body?.targetDate || new Date().toISOString().slice(0, 10)
    const members = Array.isArray(body?.members) ? body.members : []
    const sectors = Array.isArray(body?.sectors) ? body.sectors : []

    const instructions = `Você é o Assistente de Programação do MG Oper. Converta a instrução do gestor em tarefas estruturadas para um sistema operacional de equipes.\n\nData selecionada no sistema: ${targetDate}.\nFuncionários cadastrados: ${members.map(m => m.name).join(', ') || 'nenhum'}.\nSetores cadastrados: ${sectors.map(s => s.name).join(', ') || 'nenhum'}.\n\nRegras:\n- Nunca invente funcionários ou setores. Use o nome cadastrado quando houver correspondência clara.\n- Se algo estiver ambíguo ou não existir no cadastro, preserve o texto mais próximo no campo correspondente e adicione um aviso em warnings.\n- Interprete hoje/amanhã/datas relativas tomando ${targetDate} como data de referência do planejamento.\n- suggested_date deve ser YYYY-MM-DD quando a instrução indicar uma data; caso contrário use ${targetDate}.\n- deadline deve ser HH:MM em 24h ou null.\n- priority: low, normal ou high. Se não informado, normal.\n- quantity é número ou null.\n- Uma mesma tarefa pode ter vários funcionários.\n- Não salve nada e não execute ações; apenas produza o rascunho.`

    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        store: false,
        instructions,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'mg_oper_programacao',
            strict: true,
            schema
          }
        }
      })
    })

    const result = await apiResponse.json()
    if (!apiResponse.ok) {
      console.error('OpenAI API error', result)
      return NextResponse.json({ error: result?.error?.message || 'Erro ao consultar a IA.' }, { status: apiResponse.status })
    }

    const outputText = result.output_text || result.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text
    if (!outputText) return NextResponse.json({ error: 'A IA não retornou um rascunho.' }, { status: 502 })

    return NextResponse.json(JSON.parse(outputText))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Não foi possível montar a programação com IA.' }, { status: 500 })
  }
}
