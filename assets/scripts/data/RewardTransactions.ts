import { isNativeReceipt, isRecord, isRewardRequest, type NativeRewardReceipt, type RewardAcknowledgement } from '../ads/AdProtocol';
import { SaveDataError, type PendingReward, type PlacementAvailability, type RewardRequest, type RewardSettlementResult, type SaveData, type TerminalReward } from './SaveTypes';

const QUARANTINE_LIMIT = 64;
const localCloseReasons = [
  'registered_not_dispatched', 'pre_dispatch_storage_error', 'unsupported_platform', 'not_ready', 'ads_disabled',
  'non_android', 'bridge_missing', 'method_disabled', 'serialization_error', 'timer_error', 'disposed',
  'invalid_request', 'presentation_busy',
];
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,192}$/.test(value) && value !== '__proto__' && value !== 'constructor';
}
function own<T>(values: Record<string, T>, key: string): T | undefined { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined; }
function requestCopy(request: RewardRequest): RewardRequest {
  return {
    requestId: request.requestId, placementId: request.placementId, attemptId: request.attemptId,
    mapId: request.mapId, levelId: request.levelId, contentVersion: request.contentVersion,
    rewardSpec: request.placementId === 'hint_refill' ? { kind: 'hints', amount: 1 } : { kind: 'continue', bonusMoves: 3 },
  };
}
function sameRequest(a: RewardRequest, b: RewardRequest): boolean {
  return a.requestId === b.requestId && a.placementId === b.placementId && a.attemptId === b.attemptId
    && a.mapId === b.mapId && a.levelId === b.levelId && a.contentVersion === b.contentVersion
    && a.rewardSpec.kind === b.rewardSpec.kind;
}
export function placementAvailability(data: SaveData, placementId: RewardRequest['placementId'], attemptId: string): PlacementAvailability {
  const limit = placementId === 'hint_refill' ? 2 : placementId === 'challenge_continue' ? 1 : 0;
  let successes = 0;
  let reserved = 0;
  for (const id of Object.keys(data.rewards.terminal)) {
    const request = data.rewards.terminal[id];
    if (request.attemptId === attemptId && request.placementId === placementId && request.state === 'settled' && !request.compensated) successes += 1;
  }
  for (const id of Object.keys(data.rewards.pending)) {
    const request = data.rewards.pending[id];
    if (request.attemptId === attemptId && request.placementId === placementId) reserved += 1;
  }
  const current = data.currentAttempt;
  if (current?.attemptId === attemptId) successes = Math.max(successes, placementId === 'hint_refill' ? current.hintRefills : current.continuesUsed);
  let reason: PlacementAvailability['reason'] = 'available';
  if (!limit) reason = 'invalid_placement';
  else if (!current || current.attemptId !== attemptId) reason = 'stale_attempt';
  else if (current.puzzle.won || (placementId === 'hint_refill' ? current.status !== 'active' : current.status !== 'failed' || current.mode !== 'challenge')) reason = 'attempt_not_active';
  else if (reserved) reason = 'awaiting_evidence';
  else if (successes + reserved >= limit) reason = 'quota_exhausted';
  else if (placementId === 'hint_refill' && current.activeHintPieceId !== null) reason = 'hint_active';
  else if (placementId === 'hint_refill' && !current.puzzle.remainingHints.some((textureName) => {
    const piece = current.puzzle.pieces.find((candidate) => candidate.textureName === textureName);
    return piece !== undefined && (!piece.placed || !piece.correctlyMatched);
  })) reason = 'no_hint_candidate';
  else if (placementId === 'hint_refill' && data.hints > 0) reason = 'inventory_available';
  return { available: reason === 'available', reason, successes, reserved, limit };
}
export function closeUnshown(data: SaveData, requestId: string, reason: string): boolean {
  if (localCloseReasons.indexOf(reason) < 0) throw new SaveDataError('uncertain_reward_dispatch');
  const pending = own(data.rewards.pending, requestId);
  if (!pending) {
    if (own(data.rewards.terminal, requestId)) return false;
    throw new SaveDataError('unknown_reward_request');
  }
  if ((reason === 'registered_not_dispatched' || reason === 'pre_dispatch_storage_error') && pending.state !== 'registered') throw new SaveDataError('uncertain_reward_dispatch');
  data.rewards.terminal[requestId] = {
    ...requestCopy(pending), state: 'closed_no_reward', settlement: null, compensated: false,
    nativeAcknowledged: true, receipts: {}, localCloseReason: reason,
  };
  delete data.rewards.pending[requestId];
  return true;
}
type ReceiptDecision = Omit<RewardSettlementResult, 'save'> & { changed: boolean };
function quarantine(data: SaveData, receipt: NativeRewardReceipt, reason: SaveData['rewards']['quarantinedReceipts'][number]['reason']): ReceiptDecision {
  const previous = data.rewards.quarantinedReceipts.find((entry) => entry.requestId === receipt.requestId && entry.receiptId === receipt.receiptId);
  if (!previous) {
    data.rewards.quarantinedReceipts.push({ requestId: receipt.requestId, receiptId: receipt.receiptId, reason, acknowledged: false });
    data.rewards.quarantinedReceipts = data.rewards.quarantinedReceipts.slice(-QUARANTINE_LIMIT);
  }
  return { status: 'quarantined', settlement: null, ack: { requestId: receipt.requestId, receiptId: receipt.receiptId, disposition: 'quarantined' }, changed: !previous };
}
function grantHint(data: SaveData): void {
  if (data.hints === Number.MAX_SAFE_INTEGER) throw new SaveDataError('inventory_overflow');
  data.hints += 1;
}
export function settleReceipt(data: SaveData, receipt: NativeRewardReceipt, resumableAttemptId: string | null): ReceiptDecision {
  if (!isNativeReceipt(receipt)) throw new SaveDataError('invalid_reward_receipt');
  const pending = own(data.rewards.pending, receipt.requestId);
  const terminal = own(data.rewards.terminal, receipt.requestId);
  const registered = pending ?? terminal;
  if (!registered) return quarantine(data, receipt, 'unknown_request');
  if (!sameRequest(registered, receipt)) return quarantine(data, receipt, 'identity_mismatch');
  if (terminal?.state === 'quarantined') return quarantine(data, receipt, 'receipt_conflict');
  const previousReceipt = terminal ? own(terminal.receipts, receipt.receiptId) : undefined;
  if (previousReceipt && previousReceipt.outcome !== receipt.outcome) return quarantine(data, receipt, 'receipt_conflict');
  const ack: RewardAcknowledgement = { requestId: receipt.requestId, receiptId: receipt.receiptId, disposition: 'settled' };
  if (previousReceipt) return { status: 'duplicate', settlement: terminal!.settlement, ack, changed: false };
  const updated: TerminalReward = terminal ?? {
    ...requestCopy(registered), state: 'closed_no_reward', nativeAcknowledged: false,
    settlement: null, compensated: false, receipts: {},
  };
  let status: ReceiptDecision['status'] = 'duplicate';
  if (receipt.outcome === 'earned' && updated.state !== 'settled') {
    const current = data.currentAttempt;
    const sameAttempt = current !== null && current.attemptId === registered.attemptId
      && current.mapId === registered.mapId && current.levelId === registered.levelId && current.contentVersion === registered.contentVersion;
    if (terminal?.state === 'closed_no_reward') {
      grantHint(data);
      updated.settlement = 'compensated_hint';
      updated.compensated = true;
    } else if (registered.placementId === 'hint_refill') {
      grantHint(data);
      updated.settlement = 'hint';
      if (sameAttempt) current!.hintRefills = Math.min(2, current!.hintRefills + 1);
    } else if (sameAttempt && resumableAttemptId === registered.attemptId && current!.mode === 'challenge'
      && current!.status === 'failed' && !current!.puzzle.won && current!.continuesUsed === 0 && current!.bonusMoves === 0) {
      current!.continuesUsed = 1;
      current!.bonusMoves = 3;
      current!.status = 'active';
      updated.settlement = 'continue';
    } else {
      grantHint(data);
      updated.settlement = 'converted_hint';
    }
    updated.state = 'settled';
    status = 'settled';
  } else if (receipt.outcome === 'closed_no_reward' && updated.state !== 'settled') {
    updated.state = 'closed_no_reward';
    status = 'closed_no_reward';
  }
  updated.receipts[receipt.receiptId] = { outcome: receipt.outcome, acknowledged: false };
  updated.nativeAcknowledged = false;
  data.rewards.terminal[receipt.requestId] = updated;
  delete data.rewards.pending[receipt.requestId];
  return { status, settlement: updated.settlement, ack, changed: true };
}
export function acknowledgeReceipt(data: SaveData, acknowledgement: RewardAcknowledgement): boolean {
  const { requestId, receiptId, disposition } = acknowledgement;
  if (disposition === 'quarantined') {
    const entry = data.rewards.quarantinedReceipts.find((value) => value.requestId === requestId && value.receiptId === receiptId);
    if (!entry) throw new SaveDataError('unknown_reward_receipt');
    if (entry.acknowledged) return false;
    entry.acknowledged = true;
    return true;
  }
  if (disposition !== 'settled') throw new SaveDataError('invalid_reward_acknowledgement');
  const terminal = own(data.rewards.terminal, requestId);
  const receipt = terminal ? own(terminal.receipts, receiptId) : undefined;
  if (!receipt) throw new SaveDataError('unknown_reward_receipt');
  if (receipt.acknowledged) return false;
  receipt.acknowledged = true;
  terminal!.nativeAcknowledged = Object.keys(terminal!.receipts).every((id) => terminal!.receipts[id].acknowledged);
  return true;
}
export function outstandingAcknowledgements(data: SaveData): RewardAcknowledgement[] {
  const results: RewardAcknowledgement[] = [];
  for (const requestId of Object.keys(data.rewards.terminal)) {
    for (const receiptId of Object.keys(data.rewards.terminal[requestId].receipts)) {
      if (!data.rewards.terminal[requestId].receipts[receiptId].acknowledged) results.push({ requestId, receiptId, disposition: 'settled' });
    }
  }
  for (const entry of data.rewards.quarantinedReceipts) if (!entry.acknowledged) results.push({ requestId: entry.requestId, receiptId: entry.receiptId, disposition: 'quarantined' });
  return results;
}
export function normalizeRewards(value: unknown): SaveData['rewards'] {
  if (!isRecord(value) || !isRecord(value.pending) || !isRecord(value.terminal)) throw new SaveDataError('invalid_rewards');
  const result: SaveData['rewards'] = { pending: {}, terminal: {}, quarantinedReceipts: [] };
  for (const group of ['pending', 'terminal'] as const) {
    const source = value[group] as Record<string, unknown>;
    for (const id of Object.keys(source)) {
      const raw = source[id];
      if (!isRewardRequest(raw) || !isRecord(raw) || raw.requestId !== id) throw new SaveDataError('invalid_rewards');
      const request = requestCopy(raw);
      if (group === 'pending') {
        if (raw.state !== 'registered' && raw.state !== 'awaiting_evidence') throw new SaveDataError('invalid_rewards');
        result.pending[id] = { ...request, state: raw.state };
        continue;
      }
      if (own(result.pending, id)) throw new SaveDataError('duplicate_reward_identity');
      if (['settled', 'closed_no_reward', 'quarantined'].indexOf(raw.state as string) < 0
        || [null, 'hint', 'continue', 'converted_hint', 'compensated_hint'].indexOf(raw.settlement as string | null) < 0
        || typeof raw.nativeAcknowledged !== 'boolean'
        || (raw.compensated !== undefined && typeof raw.compensated !== 'boolean')
        || (raw.receipts !== undefined && !isRecord(raw.receipts))
        || (raw.localCloseReason !== undefined && localCloseReasons.indexOf(raw.localCloseReason as string) < 0)) throw new SaveDataError('invalid_rewards');
      const terminal: TerminalReward = {
        ...request, state: raw.state as TerminalReward['state'], settlement: raw.settlement as TerminalReward['settlement'],
        nativeAcknowledged: raw.nativeAcknowledged, compensated: raw.compensated === true, receipts: {},
      };
      if ((terminal.state === 'settled') !== (terminal.settlement !== null)
        || terminal.compensated !== (terminal.settlement === 'compensated_hint')) throw new SaveDataError('invalid_reward_terminal_state');
      for (const receiptId of Object.keys(raw.receipts ?? {})) {
        const receipt = (raw.receipts as Record<string, unknown>)[receiptId];
        if (!validId(receiptId) || !isRecord(receipt) || (receipt.outcome !== 'earned' && receipt.outcome !== 'closed_no_reward') || typeof receipt.acknowledged !== 'boolean') throw new SaveDataError('invalid_reward_receipt_state');
        terminal.receipts[receiptId] = { outcome: receipt.outcome, acknowledged: receipt.acknowledged };
      }
      if (Object.keys(terminal.receipts).length) terminal.nativeAcknowledged = Object.keys(terminal.receipts).every((key) => terminal.receipts[key].acknowledged);
      const hasEarned = Object.keys(terminal.receipts).some((key) => terminal.receipts[key].outcome === 'earned');
      const hasClosed = Object.keys(terminal.receipts).some((key) => terminal.receipts[key].outcome === 'closed_no_reward');
      if (hasEarned && terminal.state !== 'settled') throw new SaveDataError('invalid_reward_terminal_state');
      if (terminal.state === 'settled' && !hasEarned) throw new SaveDataError('invalid_reward_terminal_state');
      if (terminal.state === 'closed_no_reward' && !hasClosed && raw.localCloseReason === undefined) throw new SaveDataError('invalid_reward_terminal_state');
      if (raw.localCloseReason !== undefined) terminal.localCloseReason = raw.localCloseReason as string;
      result.terminal[id] = terminal;
    }
  }
  if (value.quarantinedReceipts !== undefined && !Array.isArray(value.quarantinedReceipts)) throw new SaveDataError('invalid_reward_quarantine');
  for (const raw of (value.quarantinedReceipts as unknown[] ?? []).slice(-QUARANTINE_LIMIT)) {
    if (!isRecord(raw) || !validId(raw.requestId) || !validId(raw.receiptId) || typeof raw.acknowledged !== 'boolean'
      || ['unknown_request', 'identity_mismatch', 'receipt_conflict'].indexOf(raw.reason as string) < 0) throw new SaveDataError('invalid_reward_quarantine');
    result.quarantinedReceipts.push({ requestId: raw.requestId, receiptId: raw.receiptId, acknowledged: raw.acknowledged, reason: raw.reason as SaveData['rewards']['quarantinedReceipts'][number]['reason'] });
  }
  return result;
}
