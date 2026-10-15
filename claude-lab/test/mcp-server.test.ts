import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const serverEntry = fileURLToPath(new URL('../src/mcp-server.ts', import.meta.url))

interface TextBlock {
  type: 'text'
  text: string
}

// Calls a tool and returns the parsed JSON body with the error flag.
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args })
  const [block] = result.content as TextBlock[]
  assert.ok(block, 'the tool answered with no content')
  return { isError: result.isError === true, body: JSON.parse(block.text) as Record<string, unknown> }
}

// The real server, started as a child process and spoken to over stdio, the
// way an MCP client such as Claude Code would run it.
describe('collection MCP server over stdio', () => {
  const client = new Client({ name: 'lab-test', version: '0.0.0' })

  before(async () => {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverEntry] }))
  })

  after(async () => {
    await client.close()
  })

  it('lists two read-only tools with real descriptions', async () => {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['list_missing_volumes', 'owns_volume'])
    for (const tool of tools) {
      assert.ok((tool.description ?? '').length > 80, `${tool.name} needs a description the model can use`)
      assert.equal(tool.annotations?.readOnlyHint, true)
    }
  })

  it('answers owns_volume with one status per edition', async () => {
    const { isError, body } = await call(client, 'owns_volume', { series: 'Fullmetal Alchemist', volume: 9 })
    assert.equal(isError, false)
    assert.deepEqual(body.editions, [
      { edition: 'Perfect Edition', status: 'missing' },
      { edition: 'Édition classique', status: 'missing' },
      { edition: 'Collector', status: 'out_of_range' },
    ])
  })

  it('answers list_missing_volumes with the gaps', async () => {
    const { isError, body } = await call(client, 'list_missing_volumes', { series: 'chainsaw' })
    assert.equal(isError, false)
    assert.deepEqual(body.editions, [{ edition: 'Édition Kazé', owned: 14, total: 17, missing: [15, 16, 17] }])
  })

  it('treats a series that is not owned as a normal answer', async () => {
    const { isError, body } = await call(client, 'owns_volume', { series: 'Berserk', volume: 1 })
    assert.equal(isError, false)
    assert.equal(body.kind, 'unknown_series')
  })

  it('flags an ambiguous title as an error and says how to fix the call', async () => {
    const { isError, body } = await call(client, 'owns_volume', { series: 'dragon', volume: 1 })
    assert.equal(isError, true)
    assert.deepEqual(body.candidates, ['Dragon Ball', 'Dragon Ball Super'])
    assert.match(String(body.message), /candidate titles/)
  })

  it('refuses a volume number that cannot exist', async () => {
    // Depending on its version, the SDK reports invalid input either as an
    // error result or as a protocol error. Both mean "refused".
    const refused = await client
      .callTool({ name: 'owns_volume', arguments: { series: 'One Piece', volume: 0 } })
      .then((result) => result.isError === true)
      .catch(() => true)
    assert.equal(refused, true)
  })
})
