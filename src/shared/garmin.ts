import type { SourceRef } from './models'
export interface GarminMetric { value: number | null; unit: string; date: string | null; collectedAt: string | null; partial: boolean; stale: boolean; source: SourceRef }
export interface GarminActivity { id: string; name: string; type: string; date: string; startTime: string; durationMin: number | null; distanceKm: number | null; source: SourceRef }
export interface GarminWorkout { id: string; date: string; name: string; description: string; rest: boolean; completed: boolean | null; durationMin: number | null; collectedAt: string | null; source: SourceRef }
export interface GarminOverview {
  requestedDate: string; archiveDate: string | null; readAt: string; lastSuccessAt: string | null
  status: 'no_data' | 'success' | 'partial' | 'failed' | 'unknown'; collectionStatus: string; unitSystem: string
  metrics: Record<'steps' | 'sleepHours' | 'restingHr' | 'readiness' | 'recoveryHours', GarminMetric>
  sources: SourceRef[]; quality: string[]; missing: string[]; coverage: unknown; newActivityCount: number | null
  activities: GarminActivity[]; workouts: GarminWorkout[]
}
