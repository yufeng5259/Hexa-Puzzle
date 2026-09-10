package com.world.hexapuzzle.yzad;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Durable reward evidence; no Android or SDK types so the production state machine is testable. */
public final class RewardLedger {
    public static final class Request {
        public final String requestId, placementId, attemptId, mapId, levelId;
        public final long contentVersion;

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
            this.errorCode = errorCode;
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
        if (entries.containsKey(request.requestId)) return "duplicate_request";
        if (activeId != null) return "presentation_busy";
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
