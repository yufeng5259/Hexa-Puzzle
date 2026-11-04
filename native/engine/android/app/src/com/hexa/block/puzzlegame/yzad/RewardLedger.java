package com.hexa.block.puzzlegame.yzad;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Calendar;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Durable reward evidence; no Android or SDK types so the production state machine is testable. */
public final class RewardLedger {
    public static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final int MAX_V2_ERROR_CODE_CHARS = 128;
    private static final int NEW_AUTHORIZATION_LIMIT = 256;
    public static final class Cell {
        public final int q, r;
        public Cell(int q, int r) {
            if (Math.max(Math.max(Math.abs((long) q), Math.abs((long) r)), Math.abs((long) q + r)) > 3) {
                throw new IllegalArgumentException("invalid_clear_cell");
            }
            this.q = q; this.r = r;
        }
    }
    public static final class Target {
        public final String kind, attemptId, mapId, levelId, runId, settlementId, dayKey;
        public final long contentVersion;
        private Target(String kind, String attemptId, String mapId, String levelId, long contentVersion,
                String runId, String settlementId, String dayKey) {
            this.kind = kind; this.attemptId = attemptId; this.mapId = mapId; this.levelId = levelId;
            this.contentVersion = contentVersion; this.runId = runId; this.settlementId = settlementId; this.dayKey = dayKey;
        }
        public static Target puzzle(String attemptId, String mapId, String levelId, long version) {
            if (!validId(attemptId) || !validId(mapId) || !validId(levelId) || version < 1 || version > MAX_SAFE_INTEGER) {
                throw new IllegalArgumentException("invalid_target");
            }
            return new Target("puzzle", attemptId, mapId, levelId, version, null, null, null);
        }
        public static Target endless(String id) {
            if (!validId(id)) throw new IllegalArgumentException("invalid_target");
            return new Target("endless", null, null, null, 0, id, null, null);
        }
        public static Target settlement(String id) {
            if (!validId(id)) throw new IllegalArgumentException("invalid_target");
            return new Target("settlement", null, null, null, 0, null, id, null);
        }
        public static Target supply(String day) {
            if (!validDay(day)) throw new IllegalArgumentException("invalid_target");
            return new Target("supply", null, null, null, 0, null, null, day);
        }
    }
    public static final class Reward {
        public final String kind;
        public final long amount, bonusMoves;
        public final List<Cell> clearCells;
        private Reward(String kind, long amount, long bonusMoves, List<Cell> cells) {
            this.kind = kind; this.amount = amount; this.bonusMoves = bonusMoves;
            this.clearCells = Collections.unmodifiableList(new ArrayList<>(cells));
        }
        public static Reward hints() { return new Reward("hints", 1, 0, Collections.emptyList()); }
        public static Reward continuation() { return new Reward("continue", 0, 3, Collections.emptyList()); }
        public static Reward honey(long amount) {
            if (amount < 1 || amount > MAX_SAFE_INTEGER) throw new IllegalArgumentException("invalid_reward");
            return new Reward("honey", amount, 0, Collections.emptyList());
        }
        public static Reward revive(List<Cell> cells) {
            if (cells == null || cells.isEmpty() || cells.size() > 37) throw new IllegalArgumentException("invalid_reward");
            List<String> seen = new ArrayList<>();
            for (Cell cell : cells) {
                if (cell == null || seen.contains(cell.q + "," + cell.r)) throw new IllegalArgumentException("invalid_reward");
                seen.add(cell.q + "," + cell.r);
            }
            return new Reward("endless-revive", 0, 0, cells);
        }
    }
    public static final class Request {
        public final String requestId, placementId, attemptId, mapId, levelId;
        public final long contentVersion;
        public final int requestVersion, benefitSlot;
        public final String ownerProfile, source, benefitKey, createdDay;
        public final long createdAtMs;
        public final Target target;
        public final Reward rewardSpec;

        public Request(String requestId, String placementId, String attemptId, String mapId,
                String levelId, long contentVersion) {
            if (!validId(requestId) || !validId(attemptId) || !validId(mapId) || !validId(levelId)
                    || !("hint_refill".equals(placementId) || "challenge_continue".equals(placementId))
                    || contentVersion < 1 || contentVersion > 9007199254740991L) {
                throw new IllegalArgumentException("invalid_request");
            }
            this.requestId = requestId;
            this.placementId = placementId;
            this.attemptId = attemptId;
            this.mapId = mapId;
            this.levelId = levelId;
            this.contentVersion = contentVersion;
            this.requestVersion = 1; this.ownerProfile = "prod"; this.source = "native";
            this.target = Target.puzzle(attemptId, mapId, levelId, contentVersion);
            this.rewardSpec = "hint_refill".equals(placementId) ? Reward.hints() : Reward.continuation();
            this.benefitKey = null; this.benefitSlot = 0; this.createdDay = null; this.createdAtMs = 0;
        }
        public Request(String requestId, String placementId, String ownerProfile, String source,
                Target target, String benefitKey, int benefitSlot, long createdAtMs, String createdDay, Reward rewardSpec) {
            if (!validId(requestId) || !validId(benefitKey) || "prototype".equals(requestId) || "prototype".equals(benefitKey)
                    || !"prod".equals(ownerProfile) || !"native".equals(source)
                    || target == null || rewardSpec == null || benefitSlot < 0 || benefitSlot > 1
                    || !validDay(createdDay) || !validMoment(createdAtMs)) {
                throw new IllegalArgumentException("invalid_request");
            }
            if ("prototype".equals(target.attemptId) || "prototype".equals(target.mapId) || "prototype".equals(target.levelId)
                    || "prototype".equals(target.runId) || "prototype".equals(target.settlementId)) throw new IllegalArgumentException("invalid_target");
            boolean valid = "hint_refill".equals(placementId) ? "puzzle".equals(target.kind) && "hints".equals(rewardSpec.kind)
                    : "challenge_continue".equals(placementId) ? benefitSlot == 0 && "puzzle".equals(target.kind) && "continue".equals(rewardSpec.kind)
                    : "endless_revive".equals(placementId) ? benefitSlot == 0 && "endless".equals(target.kind) && "endless-revive".equals(rewardSpec.kind)
                    : "settlement_bonus".equals(placementId) ? benefitSlot == 0 && "settlement".equals(target.kind) && "honey".equals(rewardSpec.kind)
                    : "daily_supply".equals(placementId) && "supply".equals(target.kind) && "honey".equals(rewardSpec.kind);
            if (!valid) throw new IllegalArgumentException("invalid_request");
            this.requestVersion = 2; this.requestId = requestId; this.placementId = placementId;
            this.ownerProfile = ownerProfile; this.source = source; this.target = target; this.rewardSpec = rewardSpec;
            // Non-puzzle requests deliberately have no fabricated attempt/map identity.
            this.attemptId = target.attemptId; this.mapId = target.mapId; this.levelId = target.levelId; this.contentVersion = target.contentVersion;
            this.benefitKey = benefitKey; this.benefitSlot = benefitSlot; this.createdAtMs = createdAtMs; this.createdDay = createdDay;
        }
        public boolean matches(Request other) {
            if (other == null || requestVersion != other.requestVersion || !requestId.equals(other.requestId)
                    || !placementId.equals(other.placementId) || !ownerProfile.equals(other.ownerProfile) || !source.equals(other.source)
                    || !same(target.kind, other.target.kind) || !same(attemptId, other.attemptId) || !same(mapId, other.mapId)
                    || !same(levelId, other.levelId) || contentVersion != other.contentVersion || !same(target.runId, other.target.runId)
                    || !same(target.settlementId, other.target.settlementId) || !same(target.dayKey, other.target.dayKey)
                    || !same(benefitKey, other.benefitKey) || benefitSlot != other.benefitSlot || createdAtMs != other.createdAtMs
                    || !same(createdDay, other.createdDay) || !rewardSpec.kind.equals(other.rewardSpec.kind)
                    || rewardSpec.amount != other.rewardSpec.amount || rewardSpec.bonusMoves != other.rewardSpec.bonusMoves
                    || rewardSpec.clearCells.size() != other.rewardSpec.clearCells.size()) return false;
            for (int i = 0; i < rewardSpec.clearCells.size(); i++) {
                Cell a = rewardSpec.clearCells.get(i), b = other.rewardSpec.clearCells.get(i);
                if (a.q != b.q || a.r != b.r) return false;
            }
            return true;
        }
    }

    public static final class Receipt {
        public final Request request;
        public final String receiptId, outcome, errorCode;
        public Receipt(Request request, String receiptId, String outcome, String errorCode) {
            if (!validId(receiptId) || !("earned".equals(outcome) || "closed_no_reward".equals(outcome))) {
                throw new IllegalArgumentException("invalid_receipt");
            }
            this.request = request;
            this.receiptId = receiptId;
            this.outcome = outcome;
            // Diagnostics are not reward evidence. Bound v2 UTF-16 length like
            // TS without rejecting an earned receipt during old storage recovery.
            // Keep legacy v1 tolerance and every already-valid short code intact.
            this.errorCode = request.requestVersion == 2 && errorCode != null && errorCode.length() > MAX_V2_ERROR_CODE_CHARS
                    ? "provider_diagnostic_too_long" : errorCode;
        }
    }

    public static final class Entry {
        public final Request request;
        public boolean showing, ended, earnedSeen;
        public final List<Receipt> receipts = new ArrayList<>();
        public final Map<String, String> acknowledgements = new LinkedHashMap<>();
        public Entry(Request request) { this.request = request; }
        public Entry copy() {
            Entry result = new Entry(request);
            result.showing = showing;
            result.ended = ended;
            result.earnedSeen = earnedSeen;
            result.receipts.addAll(receipts);
            result.acknowledgements.putAll(acknowledgements);
            return result;
        }
    }

    public interface Storage {
        List<Entry> read();
        boolean commit(List<Entry> entries);
    }

    public static final class Presentation {
        public final String requestId;
        public final boolean showing, presentationEnded;
        public final Receipt receipt;
        Presentation(String requestId, boolean showing, boolean ended, Receipt receipt) {
            this.requestId = requestId;
            this.showing = showing;
            this.presentationEnded = ended;
            this.receipt = receipt;
        }
    }

    private final Storage storage;
    private final Map<String, Entry> entries = new LinkedHashMap<>();
    private final Map<String, Receipt> durableReceipts = new LinkedHashMap<>();
    private String activeId;

    public RewardLedger(Storage storage) {
        this.storage = storage;
        for (Entry stored : storage.read()) {
            Entry entry = stored.copy();
            // A process restart cannot prove that a previously dispatched presentation ended.
            entry.showing = false;
            entries.put(entry.request.requestId, entry);
            for (Receipt receipt : entry.receipts) durableReceipts.put(receipt.receiptId, receipt);
            if (!entry.ended) activeId = entry.request.requestId;
        }
    }

    public static boolean validId(String value) {
        return value != null && value.matches("[A-Za-z0-9:_-]{1,192}")
                && !"__proto__".equals(value) && !"constructor".equals(value);
    }
    private static boolean same(String a, String b) { return a == null ? b == null : a.equals(b); }
    public static boolean validDay(String value) {
        if (value == null || !value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) return false;
        int year = Integer.parseInt(value.substring(0, 4)), month = Integer.parseInt(value.substring(5, 7));
        int day = Integer.parseInt(value.substring(8, 10));
        boolean leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
        int[] lengths = { 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
        return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= lengths[month - 1];
    }
    public static boolean validMoment(long value) {
        if (value < -8640000000000000L || value > 8640000000000000L) return false;
        // Match BusinessClock/JS's proleptic Gregorian local calendar, including negative epoch dates.
        GregorianCalendar calendar = new GregorianCalendar();
        calendar.setGregorianChange(new Date(Long.MIN_VALUE));
        calendar.setTimeInMillis(value);
        return calendar.get(Calendar.ERA) == GregorianCalendar.AD && calendar.get(Calendar.YEAR) <= 9999;
    }

    /** Call once when a new process creates its ledger, never on Activity replacement. */
    public synchronized boolean reconcileProcessRestart() {
        for (Entry entry : entries.values()) {
            entry.showing = false;
            entry.ended = true;
        }
        activeId = null;
        // The old SDK instance cannot cover this process. Its missing earned callback remains unknown.
        return persist();
    }

    /** A single process-owned instance serializes admission before any SDK show call. */
    public synchronized String begin(Request request) {
        Entry previous = entries.get(request.requestId);
        if (previous != null) return previous.request.matches(request) ? "duplicate_request" : "request_identity_mismatch";
        if (activeId != null) return "presentation_busy";
        // No provider-finality claim: preserve every existing promise and backpressure new ads.
        if (entries.size() >= NEW_AUTHORIZATION_LIMIT) return "ledger_capacity";
        Entry entry = new Entry(request);
        entries.put(request.requestId, entry);
        if (!persist()) {
            entries.remove(request.requestId);
            return "storage_error";
        }
        activeId = request.requestId;
        return null;
    }

    public synchronized void showing(String requestId) {
        Entry entry = entries.get(requestId);
        if (entry != null && !entry.ended && requestId.equals(activeId)) entry.showing = true;
    }

    public synchronized Presentation decline(Request request, String errorCode) {
        Entry previous = entries.get(request.requestId);
        if (previous != null && !previous.request.matches(request)) {
            // Never expose or mutate the genuine owner's evidence for a colliding request.
            return new Presentation(request.requestId, false, true, null);
        }
        if (previous == null && entries.size() >= NEW_AUTHORIZATION_LIMIT) return new Presentation(request.requestId, false, true, null);
        if (!entries.containsKey(request.requestId)) entries.put(request.requestId, new Entry(request));
        end(request.requestId, true, false, errorCode);
        return presentation(request.requestId);
    }

    public synchronized Receipt earned(String requestId) {
        Entry entry = entries.get(requestId);
        if (entry == null) return null;
        entry.earnedSeen = true;
        Receipt earned = find(entry, "earned");
        if (earned == null) {
            earned = new Receipt(entry.request, "earned:" + UUID.randomUUID(), "earned",
                    find(entry, "closed_no_reward") == null ? null : "contradictory_late_earned");
            entry.receipts.add(earned);
        }
        return persist() ? earned : null;
    }

    /** googleOrdered is valid only for Google-served ads with the documented earned-before-dismiss contract. */
    public synchronized Receipt end(String requestId, boolean definitelyNeverShown, boolean googleOrdered,
            String errorCode) {
        Entry entry = entries.get(requestId);
        if (entry == null) return null;
        entry.showing = false;
        entry.ended = true;
        if (requestId.equals(activeId)) activeId = null;
        if (!entry.earnedSeen && (definitelyNeverShown || googleOrdered)
                && find(entry, "closed_no_reward") == null) {
            entry.receipts.add(new Receipt(entry.request, "closed:" + UUID.randomUUID(),
                    "closed_no_reward", errorCode));
        }
        persist();
        return latestDurable(entry);
    }

    public synchronized Presentation presentation(String requestId) {
        Entry entry = entries.get(requestId);
        return entry == null ? new Presentation(requestId, false, false, null)
                : new Presentation(requestId, entry.showing, entry.ended, latestDurable(entry));
    }

    public synchronized List<Receipt> pending() {
        // Retain an SDK event in memory after failed disk IO, and retry it on recovery pulls.
        persist();
        List<Receipt> result = new ArrayList<>();
        for (Entry entry : entries.values()) {
            for (Receipt receipt : entry.receipts) {
                if (durableReceipts.containsKey(receipt.receiptId)
                        && !entry.acknowledgements.containsKey(receipt.receiptId)) result.add(receipt);
            }
        }
        return result;
    }

    public synchronized boolean acknowledge(String requestId, String receiptId, String disposition) {
        if (!("settled".equals(disposition) || "quarantined".equals(disposition))) return false;
        Entry entry = entries.get(requestId);
        Receipt receipt = durableReceipts.get(receiptId);
        if (entry == null || receipt == null || !receipt.request.requestId.equals(requestId)) return false;
        String previous = entry.acknowledgements.get(receiptId);
        if (previous != null) return previous.equals(disposition);
        entry.acknowledgements.put(receiptId, disposition);
        if (persist()) return true;
        entry.acknowledgements.remove(receiptId);
        return false;
    }

    public synchronized boolean hasActivePresentation() { return activeId != null; }

    private Receipt latestDurable(Entry entry) {
        Receipt latest = null;
        for (Receipt receipt : entry.receipts) {
            if (durableReceipts.containsKey(receipt.receiptId)) {
                if ("earned".equals(receipt.outcome)) return receipt;
                latest = receipt;
            }
        }
        return latest;
    }

    private static Receipt find(Entry entry, String outcome) {
        for (Receipt receipt : entry.receipts) if (receipt.outcome.equals(outcome)) return receipt;
        return null;
    }

    private boolean persist() {
        List<Entry> snapshot = new ArrayList<>();
        for (Entry entry : entries.values()) snapshot.add(entry.copy());
        boolean committed;
        try { committed = storage.commit(snapshot); }
        catch (RuntimeException failure) { committed = false; }
        if (!committed) return false;
        for (Entry entry : snapshot) {
            for (Receipt receipt : entry.receipts) durableReceipts.put(receipt.receiptId, receipt);
        }
        return true;
    }
}
