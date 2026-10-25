import { z } from 'zod'
export const ScheduleSchema = z.object({ sourceId: z.uuid().nullable().optional(), title: z.string().min(1).optional(), date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), priority: z.enum(['low', 'normal', 'high']).optional() })
export type ScheduleInput = z.infer<typeof ScheduleSchema>
export type PlanStatus = 'pending' | 'done' | 'cancelled'
