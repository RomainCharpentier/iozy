import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
  missingVolumes,
  ownsVolume,
  type Collection,
  type LookupFailure,
  type MissingVolumesResult,
  type OwnsVolumeResult,
} from './collection.ts'
import { sampleCollection } from './sample-collection.ts'

// Written for the model that reads the answer, not for a person: it says what
// went wrong and what to try next.
function explain(failure: LookupFailure): string {
  switch (failure.kind) {
    case 'unknown_series':
      return 'No series of the collection matches this title. Either the user owns nothing of it, or the title is spelled very differently: retry once with a shorter or corrected title before concluding.'
    case 'ambiguous_series':
      return 'Several series match this title. Call again with one of the candidate titles.'
    case 'unknown_edition':
      return 'This series has no edition with that name. Call again with one of the available editions, or leave the edition out.'
  }
}

function toToolResult(result: OwnsVolumeResult | MissingVolumesResult): CallToolResult {
  if (result.kind === 'ok') return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  const body = { ...result, message: explain(result) }
  // A series that is not in the collection is a normal answer. The other two
  // failures need a corrected call, so they are flagged as errors.
  return { content: [{ type: 'text', text: JSON.stringify(body) }], isError: result.kind !== 'unknown_series' }
}

const seriesField = z
  .string()
  .min(1)
  .describe(
    'Series title as written by the user or in a listing. Case, accents and punctuation are ignored. A partial title works when only one series matches.',
  )

const editionField = z
  .string()
  .min(1)
  .optional()
  .describe('Edition name, for example "Perfect Edition". Leave it out to get every edition of the series.')

export function createServer(collection: Collection): McpServer {
  const server = new McpServer({ name: 'iozycore-lab-collection', version: '0.1.0' })

  server.registerTool(
    'owns_volume',
    {
      title: 'Check one volume',
      description:
        'Tell whether the user already owns one volume of a manga series. Use it before judging a purchase or a listing. For each edition of the series (or only the requested one) it answers "owned", "missing", or "out_of_range" when the edition has fewer volumes. A series that is not in the collection is reported as unknown_series: the user may own nothing of it.',
      inputSchema: {
        series: seriesField,
        volume: z.number().int().positive().describe('Volume number, starting at 1.'),
        edition: editionField,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ series, volume, edition }) => toToolResult(ownsVolume(collection, { series, volume, edition })),
  )

  server.registerTool(
    'list_missing_volumes',
    {
      title: 'List missing volumes',
      description:
        'List the volumes the user still misses in a manga series, per edition, with the owned and total counts. Use it to see what is left to buy. Series and edition names are matched like in owns_volume.',
      inputSchema: { series: seriesField, edition: editionField },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ series, edition }) => toToolResult(missingVolumes(collection, { series, edition })),
  )

  return server
}

// Start the stdio server only when this file is run directly, so that other
// modules can import createServer without side effects. Nothing may be
// written to stdout here: it carries the protocol.
if (import.meta.main) {
  await createServer(sampleCollection).connect(new StdioServerTransport())
}
