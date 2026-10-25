import { z } from 'zod'
import { RecordSchema } from './schemas'
export const CapturePreviewSchema = z.object({
  sourceId: z.uuid(), rawText: z.string().min(1).max(100000), createdAt: z.iso.datetime({ offset: true }), attachmentIds: z.array(z.string()),
  entries: z.array(z.object({ record: RecordSchema, start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), basis: z.string(), pending: z.boolean() })).min(1)
})
export type CapturePreview = z.infer<typeof CapturePreviewSchema>
export interface CaptureReceipt {
  sourceId: string; requestHash: string; status: 'committed' | 'undone'; versions: { id: string; hash: string }[]
  recordIds: string[]; localState: 'saved'; cloudState: 'not_connected'
}
