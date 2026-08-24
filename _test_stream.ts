import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

async function test() {
  const id = globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}`
  const text = 'Hola, soy compe. Ventas de Bogotá filtradas.\n{"action":"setFilter","column":"city","operator":"equals","value":"Bogotá"}'
  const stream = createUIMessageStream({
    execute({ writer }) {
      writer.write({ type: 'text-start', id } as any)
      writer.write({ type: 'text-delta', delta: text } as any)
      writer.write({ type: 'text-end', id } as any)
    },
  })
  const res = createUIMessageStreamResponse({ stream })
  console.log('status:', res.status, 'ct:', res.headers.get('content-type'))
  if (res.body) {
    const reader = res.body.getReader()
    let n = 0
    const dec = new TextDecoder()
    let out = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      n += value.length
      out += dec.decode(value, { stream: true })
    }
    console.log('stream bytes:', n)
    console.log('SSE preview:', out.slice(0, 300))
  } else {
    console.log('NO BODY', await res.text())
  }
}
test().catch((e) => console.error('CRASH:', e))
