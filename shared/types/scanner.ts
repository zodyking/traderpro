export type ScanMatch = {
  alertId: string
  symbolId: string
  conditionHash: string
  firedAt: string
}

export type ScanProgressEvent = {
  pct: number
  stage: string
  symbolId?: string
  match?: ScanMatch
}
