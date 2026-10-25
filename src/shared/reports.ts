import type { SourceRef } from './models'
import type { RecordView } from './api'
export interface WeeklySummary { start: string; end: string; actualCount: number; byModule: Record<string, number>; coveredDates: string[]; knownSportMinutes: number | null; unknownSportDurationCount: number; sportCount: number; plans: { total: number; done: number; pending: number }; sources: SourceRef[] }
export type TrainingAction = 'original' | 'defer' | 'skip' | 'custom'
export interface AdvicePreview { id: string; date: string; originalDate: string; workoutId: string; name: string; action: TrainingAction; basis: string[]; limitations: string[]; source: SourceRef }
export interface AdoptAdvice { proposalId: string; date: string; targetDate?: string; time?: string; reason?: string }
export interface HomeOverview { weekly: WeeklySummary; attention: { id: string; title: string; detail: string; source?: SourceRef; target?: string }[]; existingReports: RecordView[]; generatedReportId: string | null }
