import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionsStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { markProductCatalogSyncNeeded } from '../../store/syncNeeded';
import { ProductCatalogSyncBanner } from '../../components/ui/ProductCatalogSyncBanner';
import PageHeader from '../../components/layout/PageHeader';
import CatalogHelpLink from '../../components/layout/CatalogHelpLink';
import SessionTutorial from '../../components/tutorials/session-tutorial';
import SearchInput from '../../components/forms/SearchInput';
import { Button } from '../../components/ui/Button';
import { CatalogListEmptyState } from '../../components/ui/CatalogListEmptyState';
import { DeleteConfirmationModal, deleteConfirmTitle } from '../../components/ui/DeleteConfirmationModal';
import DesktopLayout from '../../../layout/DesktopLayout';
import { useDesktopTopBar } from '../../../../context/DesktopLayoutContext';
import { pcPaths, PC_BASE } from '../../paths';
import {
  catalogListActionButtonStyle,
  catalogListActionEnterDefault,
  catalogListActionLeaveDefault,
  catalogListActionEnterDanger,
  catalogListActionLeaveDanger,
  CATALOG_LIST_ACTION_ICON_PX,
} from '../../catalogEntityActions';
import BottomNav from '../../../BottomNav';
import { Bone } from '../../../../components/Shimmer';
import type { Session } from '../../data/types';
import {
  formatSlotDaysLong,
  formatTime12h,
  formatSlotSummaryLine,
  getSessionWeeklyHours,
  sortSessionSlotsByWeekdayOrder,
  timeToDecimal,
  DAY_SHORT,
  SESSION_GRID_HOURS,
  SESSION_GRID_START,
} from './sessionFormatting';
import { useErrorToast } from '../../hooks/useErrorToast';
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatHour(h: number): string {
  const suffix = h >= 12 ? 'pm' : 'am';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}${suffix}`;
}

function timeToHour(t: string): number {
  return timeToDecimal(t);
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';
const BORDER = '#E6DFD3';

/** Stable pseudo-random hex per session for the weekly overview only (ignores stored session color). Uses hex so bar/tooltip alpha suffixes like `${color}55` work. */
function getWeeklyOverviewSessionColor(sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = ((h << 5) - h + sessionId.charCodeAt(i)) | 0;
  }
  const u = h >>> 0;
  const r = ((u & 0xff) % 140) + 80;
  const g = (((u >> 8) & 0xff) % 130) + 70;
  const b = (((u >> 16) & 0xff) % 130) + 75;
  const x = (n: number) => n.toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`;
}

const MINI_TIMELINE_BAR = '#94A3B8';

// ── Lane assignment: pack blocks into non-overlapping lanes ─────────────
type GridBlock = { session: Session; startH: number; endH: number; startTime: string; endTime: string };

function assignLanes(blocks: GridBlock[]): Array<GridBlock & { lane: number; laneCount: number }> {
  const sorted = [...blocks].sort((a, b) => a.startH - b.startH);
  const lanes: number[] = []; // tracks end time of last block in each lane
  const assigned = sorted.map((block) => {
    let lane = lanes.findIndex((end) => end <= block.startH);
    if (lane === -1) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = block.endH;
    return { ...block, lane };
  });
  const laneCount = lanes.length;
  return assigned.map((b) => ({ ...b, laneCount }));
}

// ── Tooltip component ───────────────────────────────────────────────────
function BlockTooltip({ block, color }: { block: GridBlock; color: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
  };

  const startLabel = formatTime12h(block.startTime);
  const endLabel = formatTime12h(block.endTime);

  const TOOLTIP_EST_W = 220;
  const TOOLTIP_EST_H = 52;
  const OFFSET = 12;
  const tooltipLeft = pos.x + OFFSET + TOOLTIP_EST_W > window.innerWidth - 8
    ? pos.x - OFFSET - TOOLTIP_EST_W
    : pos.x + OFFSET;
  const tooltipTop = Math.max(8, pos.y + OFFSET + TOOLTIP_EST_H > window.innerHeight - 8
    ? pos.y - TOOLTIP_EST_H - OFFSET
    : pos.y - 40);

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onMouseMove={handleMouseMove}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 3,
          background: `${color}55`,
          borderTop: `3px solid ${color}`,
          cursor: 'default',
          transition: 'background 0.1s',
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${color}88`; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${color}55`; }}
      />
      {visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltipLeft,
            top: tooltipTop,
            zIndex: 9999,
            background: '#453F39',
            color: '#FFFFFF',
            borderRadius: 2,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: '#FFFFFF', marginBottom: 1 }}>{block.session.name}</div>
          <div style={{ opacity: 0.75, fontWeight: 400 }}>{startLabel} – {endLabel}</div>
        </div>
      )}
    </>
  );
}

// ── Weekly overview grid ────────────────────────────────────────────────
function WeeklyOverviewGrid({
  sessions,
  daySessionBlocks,
  colWidth,
  dayLabelWidth,
}: {
  sessions: Session[];
  daySessionBlocks: Record<string, GridBlock[]>;
  colWidth: number;
  dayLabelWidth: number;
}) {
  const LANE_H = 10;
  const LANE_GAP = 3;
  const ROW_PADDING = 8;
  const DAY_ORDER_LOCAL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT_LOCAL: Record<string, string> = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' };

  return (
    <div style={{ background: 'var(--surface,#FFF)', border: `1px solid ${BORDER}`, borderRadius: 2, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: T1 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent,#B89550)' }}>calendar_month</span>
          Weekly Schedule
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 4, borderRadius: 2, background: getWeeklyOverviewSessionColor(s.id) }} />
              <span style={{ fontSize: 10, color: T2 }}>{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: dayLabelWidth + SESSION_GRID_HOURS.length * colWidth }}>
          {/* Hour labels */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ width: dayLabelWidth, flexShrink: 0 }} />
            {SESSION_GRID_HOURS.map((h) => (
              <div key={h} style={{ width: colWidth, flexShrink: 0, textAlign: 'center', fontSize: 10, color: T3, padding: '6px 0', borderRight: '1px solid #F4F0E8' }}>
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {DAY_ORDER_LOCAL.map((day) => {
            const blocks = daySessionBlocks[day] ?? [];
            const laned = assignLanes(blocks);
            const maxLanes = laned.length > 0 ? Math.max(...laned.map((b) => b.laneCount)) : 1;
            const rowH = ROW_PADDING * 2 + maxLanes * LANE_H + (maxLanes - 1) * LANE_GAP;

            return (
              <div key={day} style={{ display: 'flex', borderBottom: '1px solid #F4F0E8' }}>
                <div style={{ width: dayLabelWidth, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 11, fontWeight: 700, color: T2, borderRight: `1px solid ${BORDER}`, minHeight: rowH }}>
                  {DAY_SHORT_LOCAL[day]}
                </div>
                <div style={{ flex: 1, position: 'relative', height: rowH }}>
                  {/* Grid lines */}
                  {SESSION_GRID_HOURS.map((h) => (
                    <div key={h} style={{ position: 'absolute', left: (h - SESSION_GRID_START) * colWidth, top: 0, bottom: 0, width: 1, background: '#F4F0E8' }} />
                  ))}
                  {/* Session bars */}
                  {laned.map((block, idx) => {
                    const rawLeft = (block.startH - SESSION_GRID_START) * colWidth;
                    const left = Math.max(0, rawLeft);
                    const rawWidth = (block.endH - block.startH) * colWidth;
                    const width = Math.max(rawLeft < 0 ? rawWidth + rawLeft : rawWidth, 4);
                    const top = ROW_PADDING + block.lane * (LANE_H + LANE_GAP);
                    const color = getWeeklyOverviewSessionColor(block.session.id);
                    return (
                      <div
                        key={`${block.session.id}-${idx}`}
                        style={{ position: 'absolute', left, top, width, height: LANE_H }}
                      >
                        <BlockTooltip block={block} color={color} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Shimmer placeholders while sessions are fetched (mobile + desktop layouts). */
function SessionsListShimmer({ isMobile, isSm = true }: { isMobile: boolean; isSm?: boolean }) {
  const cardCount = 4;
  const gap = isMobile ? 8 : 12;
  const pad = isMobile ? '12px 14px' : isSm ? '14px 20px' : '12px 14px';

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading sessions"
      style={{ display: 'flex', flexDirection: 'column', gap }}
    >
      {Array.from({ length: cardCount }).map((_, i) => (
        <div
          key={i}
          style={{
            background: isMobile ? '#fff' : 'var(--surface, #FFFFFF)',
            borderRadius: isMobile ? 12 : 14,
            border: `1px solid ${BORDER}`,
            borderLeft: `4px solid ${['#E8E0D1', '#E6DFD3', '#F1ECE2', '#E8E0D1'][i % 4]}`,
            overflow: 'hidden',
            padding: pad,
            boxShadow: isMobile ? undefined : '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: isSm && !isMobile ? 'center' : 'flex-start',
              gap: isMobile ? 10 : 12,
            }}
          >
            <Bone
              w={isMobile ? 9 : 12}
              h={isMobile ? 9 : 12}
              r={6}
              style={{
                borderRadius: '50%',
                flexShrink: 0,
                marginTop: isSm && !isMobile ? 0 : 4,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 6,
                }}
              >
                <Bone w={`${48 + (i % 4) * 6}%`} h={isMobile ? 14 : 14} />
                <Bone w={44} h={16} r={4} />
              </div>
              <Bone w={`${72 + (i % 3) * 5}%`} h={11} mb={8} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                <Bone w={76} h={22} r={999} />
                <Bone w={92} h={22} r={999} />
              </div>
              {isMobile || !isSm ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Bone w={52} h={10} />
                  <Bone w={48} h={10} />
                  <Bone w={56} h={10} />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <Bone w={72} h={11} />
                  <Bone w={68} h={11} />
                  <Bone w={80} h={11} />
                  <Bone w={52} h={11} />
                </div>
              )}
            </div>
            {isMobile ? (
              <Bone w={18} h={18} r={4} style={{ flexShrink: 0 }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Bone w={34} h={34} r={8} />
                <Bone w={34} h={34} r={8} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Align `?highlight=` with list row `id` when API uses sessionGroup vs session UUID interchangeably. */
function resolveSessionRowIdForHighlight(highlightId: string, list: Session[]): string {
  const h = String(highlightId).trim();
  if (!h) return h;
  for (const s of list) {
    if (String(s.id) === h) return s.id;
    if (s.sessionGroupId && String(s.sessionGroupId) === h) return s.id;
    if (s.sessionMatchIds?.some((x) => String(x) === h)) return s.id;
  }
  return h;
}

const SESSION_ROW_HIGHLIGHT: CSSProperties = {
  boxShadow: 'inset 0 0 0 2px rgba(184,149,80,0.9)',
  borderRadius: 2,
};

export default function SessionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    sessions,
    fetchSessions,
    clearSessionsCache,
    loading,
    error,
    setEditingSessionId,
    deleteSessionOnServer,
    loadedLocationId: sessionsLoadedLocationId,
  } = useSessionsStore();
  const { addToast } = useToastStore();
  const { auth } = useAuth();
  const { selectedBranch } = useBranch();
  const isSm = useMediaQuery('(min-width: 640px)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const setTopBarProps = useDesktopTopBar();
  useEffect(() => {
    setTopBarProps({ title: 'Sessions', breadcrumbs: 'Product Catalog' });
  }, [setTopBarProps]);

  // GET sessions when opening this page or when branch/token changes. `skipDuplicateMs` avoids double GET from React Strict Mode / double effect; mutations omit it.
  useEffect(() => {
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) return;
    void fetchSessions(locationId, token, { skipDuplicateMs: 750 });
  }, [
    selectedBranch?.id,
    selectedBranch?.locationId,
    auth?.accessToken,
    auth?.access_token,
    fetchSessions,
  ]);

  useErrorToast(error);

  const branchLocationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
  const listReadyForBranch =
    Boolean(branchLocationId) && sessionsLoadedLocationId === branchLocationId;

  const [search, setSearch] = useState('');
  const [showWeekly, setShowWeekly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingHighlightSessionId, setPendingHighlightSessionId] = useState<string | null>(null);
  const [highlightSessionId, setHighlightSessionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.name.toLowerCase().includes(q));
  }, [sessions, search]);

  const sortedSessions = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      const aStart = a.slots[0] ? timeToDecimal(a.slots[0].startTime) : 24;
      const bStart = b.slots[0] ? timeToDecimal(b.slots[0].startTime) : 24;
      return aStart - bStart;
    });
  }, [filtered]);

  useEffect(() => {
    const hid = searchParams.get('highlight')?.trim();
    if (!hid || !listReadyForBranch) return;
    if (pendingHighlightSessionId === hid) return;
    setPendingHighlightSessionId(hid);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, listReadyForBranch, pendingHighlightSessionId]);

  useEffect(() => {
    const hid = pendingHighlightSessionId;
    if (!hid) return;
    const resolvedRowId = resolveSessionRowIdForHighlight(hid, sessions);
    setHighlightSessionId(resolvedRowId);

    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 300;
    const waitForRow = () => {
      const row = document.getElementById(`catalog-session-row-${resolvedRowId}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) rafId = window.requestAnimationFrame(waitForRow);
    };
    rafId = window.requestAnimationFrame(waitForRow);

    const clearTimer = window.setTimeout(() => {
      setHighlightSessionId(null);
      setPendingHighlightSessionId(null);
    }, 3000);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      clearTimeout(clearTimer);
    };
  }, [pendingHighlightSessionId, sessions]);

  const daySessionBlocks = useMemo(() => {
    const map: Record<string, GridBlock[]> = {};
    for (const day of DAY_ORDER) map[day] = [];
    for (const s of sessions) {
      for (const slot of s.slots) {
        for (const day of slot.days) {
          if (map[day]) {
            map[day].push({ session: s, startH: timeToHour(slot.startTime), endH: timeToHour(slot.endTime), startTime: slot.startTime, endTime: slot.endTime });
          }
        }
      }
    }
    return map;
  }, [sessions]);

  const assignedItemsListForSession = useCallback(
    (session: Session) => {
      return session.assignedSessionItems ?? [];
    },
    [],
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deletingSessionId) return;
    const locationId = selectedBranch?.id ?? selectedBranch?.locationId ?? '';
    const token = auth?.accessToken ?? auth?.access_token ?? null;
    if (!locationId) {
      addToast('Location is required to delete session.', 'error');
      return;
    }
    setDeletingSessionId(deleteTarget.id);
    try {
      await deleteSessionOnServer({ locationId, sessionId: deleteTarget.id }, token);
      markProductCatalogSyncNeeded();
      setDeleteTarget(null);
      clearSessionsCache();
      addToast('Session deleted', 'success');
      // Refresh list in background; do not block popup close on refetch.
      void fetchSessions(locationId, token, { force: true });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to delete session', 'error');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const colWidth = 70;
  const dayLabelWidth = 60;
  const rowHeight = 40;

  const customSessionCount = sessions.filter((s) => !s.isDefault).length;

  if (isMobile) return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E6DFD3', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(PC_BASE)} className="material-symbols-rounded" style={{ fontSize: 22, color: T1, cursor: 'pointer' }}>arrow_back</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T1, margin: 0 }}>Sessions</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowWeekly((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 2, border: showWeekly ? '1px solid var(--accent,#B89550)' : `1px solid ${BORDER}`,
            background: showWeekly ? 'rgba(184,149,80,0.07)' : '#FFFFFF',
            color: showWeekly ? 'var(--accent,#B89550)' : T2,
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>calendar_view_week</span>
          Weekly
        </button>
      </div>

      <div style={{ padding: 16, paddingBottom: 100 }}>
        <ProductCatalogSyncBanner compact syncOnly />

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search sessions..." />
        </div>

        {/* Weekly overview */}
        {showWeekly && sessions.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <WeeklyOverviewGrid
              sessions={sessions}
              daySessionBlocks={daySessionBlocks}
              colWidth={50}
              dayLabelWidth={44}
            />
          </div>
        )}

        {loading ? (
          <SessionsListShimmer isMobile />
        ) : sortedSessions.length === 0 ? (
          <CatalogListEmptyState
            icon="schedule"
            name="sessions"
            description={search ? 'Try adjusting your search terms.' : 'Create your first session to get started.'}
            action={!search ? <Button onClick={() => {
            setEditingSessionId(null);
            navigate(pcPaths.sessionsCreate);
          }}>Add Session</Button> : undefined}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedSessions.map((session) => {
              const isExpanded = expandedId === session.id;
              const weeklyHours = getSessionWeeklyHours(session);
              const assignedItems = assignedItemsListForSession(session);
              const assignedCount = session.assignedItemCount ?? assignedItems.length;
              const slotCount = session.slots.length;

              return (
                <div
                  key={session.id}
                  id={`catalog-session-row-${session.id}`}
                  style={{
                    background: '#fff', borderRadius: 2,
                    border: `1px solid ${BORDER}`,
                    overflow: 'hidden',
                    ...(String(highlightSessionId) === String(session.id) ? SESSION_ROW_HIGHLIGHT : {}),
                  }}
                >
                  {/* Card header row */}
                  <div
                    style={{ padding: '12px 14px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span title={session.name} style={{ fontSize: 14, fontWeight: 700, color: T1, flex: 1 }}>{session.name.length > 30 ? session.name.slice(0, 30) + '...' : session.name}</span>
                      {session.isDefault && (
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#7D8F69', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          Default
                        </span>
                      )}
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: T3 }}>
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                    {session.description && (
                      <p style={{ fontSize: 11, color: T3, margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
                      {sortSessionSlotsByWeekdayOrder(session.slots).map((slot) => (
                        <div key={slot.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 9, fontWeight: 600, background: '#F4F0E8', color: T2 }}>
                          <span>{formatSlotDaysLong(slot.days)}</span>
                          <span style={{ opacity: 0.4 }}>|</span>
                          <span>{formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: T3 }}>
                      <span>{assignedCount} items</span>
                      <span>{slotCount} slot{slotCount !== 1 ? 's' : ''}</span>
                      <span>{weeklyHours}h/week</span>
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #F4F0E8', background: '#FDFCF9', padding: '12px 14px' }}>
                      {/* Mini timeline */}
                      <MiniWeeklyTimeline session={session} />

                      {/* Time slots */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T1, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                          Time slots ({slotCount})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {sortSessionSlotsByWeekdayOrder(session.slots).map((slot) => (
                            <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F4F0E8', borderRadius: 2, padding: '10px 12px' }}>
                              <span className="material-symbols-rounded" style={{ fontSize: 14, color: T3 }}>schedule</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{formatSlotSummaryLine(slot.days, slot.startTime, slot.endTime)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Assigned items */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T1, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                          Assigned items ({assignedCount})
                        </div>
                        {assignedItems.length === 0 ? (
                          <p style={{ fontSize: 11, color: T3, margin: 0 }}>No items assigned.</p>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {assignedItems.map((item) => (
                              <span key={item.id} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 2, background: '#F4F0E8', color: T2 }}>
                                {item.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSessionId(session.id);
                            navigate(pcPaths.sessionEdit);
                          }}
                          style={{ flex: 1, padding: '9px 0', borderRadius: 2, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 12, fontWeight: 600, color: T1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>edit</span>
                          Edit
                        </button>
                        {!session.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(session)}
                            style={{ flex: 1, padding: '9px 0', borderRadius: 2, border: '1px solid rgba(184,149,80,0.3)', background: 'rgba(184,149,80,0.05)', fontSize: 12, fontWeight: 600, color: '#B89550', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>delete</span>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <div
        onClick={() => {
            setEditingSessionId(null);
            navigate(pcPaths.sessionsCreate);
          }}
        style={{
          position: 'fixed', bottom: 80, right: 16, width: 56, height: 56,
          background: '#B89550', borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(184,149,80,0.35)', cursor: 'pointer', zIndex: 999,
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 28, color: '#fff' }}>add</span>
      </div>

      <DeleteConfirmationModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirmLoading={Boolean(deletingSessionId)}
        title={deleteTarget ? deleteConfirmTitle(deleteTarget.name) : deleteConfirmTitle('this session')}
        description={
          deleteTarget ? (
            <>
              {(deleteTarget.assignedItemCount ?? 0) > 0 ? (
                <>
                  Applied to {deleteTarget.assignedItemCount} item
                  {deleteTarget.assignedItemCount !== 1 ? 's' : ''}.{' '}
                </>
              ) : null}
              This will remove all associated time slots and cannot be undone.
            </>
          ) : null
        }
      />
      <BottomNav />
    </div>
  );

  return (
    <DesktopLayout>
      <div style={{ padding: 25 }}>
        <PageHeader
          icon={
            <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)' }}>
              schedule
            </span>
          }
          title="Sessions"
          subtitle={
            loading
              ? 'Loading…'
              : `${customSessionCount} custom session${customSessionCount !== 1 ? 's' : ''}`
          }
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <CatalogHelpLink topic="Sessions" Tutorial={SessionTutorial} createPath={pcPaths.sessionsCreate} />
              <Button
                icon={
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)' }}>
                    add
                  </span>
                }
                onClick={() => {
            setEditingSessionId(null);
            navigate(pcPaths.sessionsCreate);
          }}
              >
                Add Session
              </Button>
            </div>
          }
        />

        <ProductCatalogSyncBanner syncOnly />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 360, flex: 1, minWidth: 200 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search sessions..." />
          </div>
          <button
            type="button"
            onClick={() => setShowWeekly((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 2,
              border: showWeekly ? '1px solid var(--accent, #B89550)' : `1px solid ${BORDER}`,
              background: showWeekly ? 'rgba(184,149,80,0.08)' : 'var(--surface, #FFFFFF)',
              color: showWeekly ? 'var(--accent, #B89550)' : T2,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              calendar_view_week
            </span>
            Weekly Overview
          </button>
        </div>

        {showWeekly && sessions.length > 0 && (
          <WeeklyOverviewGrid
            sessions={sessions}
            daySessionBlocks={daySessionBlocks}
            colWidth={colWidth}
            dayLabelWidth={dayLabelWidth}
          />
        )}

        {loading ? (
          <SessionsListShimmer isMobile={false} isSm={isSm} />
        ) : sortedSessions.length === 0 ? (
          <CatalogListEmptyState
            icon="schedule"
            name="sessions"
            description={search ? 'Try adjusting your search terms.' : 'Create your first session to get started.'}
            action={!search ? <Button onClick={() => {
            setEditingSessionId(null);
            navigate(pcPaths.sessionsCreate);
          }}>Add Session</Button> : undefined}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedSessions.map((session) => {
              const isExpanded = expandedId === session.id;
              const weeklyHours = getSessionWeeklyHours(session);
              const assignedItems = assignedItemsListForSession(session);
              const assignedCount = session.assignedItemCount ?? assignedItems.length;
              const slotCount = session.slots.length;

              const cardShadow: CSSProperties =
                String(highlightSessionId) === String(session.id)
                  ? SESSION_ROW_HIGHLIGHT
                  : { boxShadow: '0 1px 3px rgba(0,0,0,0.03)' };

              return (
                <div
                  key={session.id}
                  id={`catalog-session-row-${session.id}`}
                  style={{
                    background: 'var(--surface, #FFFFFF)',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'box-shadow 0.15s ease',
                    ...cardShadow,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : session.id);
                      }
                    }}
                    style={{ padding: isSm ? '14px 20px' : '12px 14px', cursor: 'pointer' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: isSm ? 'center' : 'flex-start',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span title={session.name} style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{session.name.length > 30 ? session.name.slice(0, 30) + '...' : session.name}</span>
                          {session.isDefault && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#7D8F69',
                                background: 'rgba(59,130,246,0.1)',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                        {session.description && (
                          <p
                            style={{
                              fontSize: 11,
                              color: T3,
                              margin: '4px 0 0',
                              maxWidth: 520,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.45,
                            }}
                          >
                            {session.description}
                          </p>
                        )}
                      </div>

                      {isSm && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, marginRight: 8 }}>
                            <Stat icon="layers" label={`${assignedCount} items`} />
                            <Stat icon="schedule" label={`${slotCount} slot${slotCount !== 1 ? 's' : ''}`} />
                            <span style={{ fontSize: 11, color: T3 }}>{weeklyHours}h/week</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSessionId(session.id);
                                navigate(pcPaths.sessionEdit);
                              }}
                              style={catalogListActionButtonStyle}
                              onMouseEnter={catalogListActionEnterDefault}
                              onMouseLeave={catalogListActionLeaveDefault}
                              title="Edit"
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                                edit
                              </span>
                            </button>
                            {!session.isDefault && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(session);
                                }}
                                style={catalogListActionButtonStyle}
                                onMouseEnter={catalogListActionEnterDanger}
                                onMouseLeave={catalogListActionLeaveDanger}
                                title="Delete"
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                                  delete
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(isExpanded ? null : session.id);
                              }}
                              style={{
                                ...catalogListActionButtonStyle,
                                marginLeft: 2,
                              }}
                              onMouseEnter={catalogListActionEnterDefault}
                              onMouseLeave={catalogListActionLeaveDefault}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                              aria-expanded={isExpanded}
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                                {isExpanded ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                          </div>
                        </>
                      )}

                      {!isSm && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : session.id);
                          }}
                          style={{
                            ...catalogListActionButtonStyle,
                            marginTop: 2,
                          }}
                          onMouseEnter={catalogListActionEnterDefault}
                          onMouseLeave={catalogListActionLeaveDefault}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                          aria-expanded={isExpanded}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      )}
                    </div>

                    {!isSm && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 10,
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                          <Stat icon="layers" label={`${assignedCount} items`} />
                          <Stat icon="schedule" label={`${slotCount} slot${slotCount !== 1 ? 's' : ''}`} />
                          <span style={{ fontSize: 11, color: T3 }}>{weeklyHours}h/week</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(session.id);
                              navigate(pcPaths.sessionEdit);
                            }}
                            style={catalogListActionButtonStyle}
                            onMouseEnter={catalogListActionEnterDefault}
                            onMouseLeave={catalogListActionLeaveDefault}
                            title="Edit"
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                              edit
                            </span>
                          </button>
                          {!session.isDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(session);
                              }}
                              style={catalogListActionButtonStyle}
                              onMouseEnter={catalogListActionEnterDanger}
                              onMouseLeave={catalogListActionLeaveDanger}
                              title="Delete"
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: CATALOG_LIST_ACTION_ICON_PX }}>
                                delete
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '0 14px 12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sortSessionSlotsByWeekdayOrder(session.slots).map((slot) => (
                      <div
                        key={slot.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          background: '#F4F0E8',
                          color: T2,
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>calendar_today</span>
                        <span>{formatSlotDaysLong(slot.days)}</span>
                        <span style={{ opacity: 0.45 }}>|</span>
                        <span>
                          {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: `1px solid #F4F0E8`, padding: '14px 18px', background: '#FDFCF9' }}>
                      <MiniWeeklyTimeline session={session} />

                      <div style={{ marginTop: 16 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 8,
                          }}
                        >
                          Time slots ({session.slots.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {sortSessionSlotsByWeekdayOrder(session.slots).map((slot) => (
                            <div
                              key={slot.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                background: '#FFFFFF',
                                borderRadius: 2,
                                padding: '12px 14px',
                              }}
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: 16, color: T3 }}>schedule</span>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T1, lineHeight: 1.4 }}>
                                {formatSlotSummaryLine(slot.days, slot.startTime, slot.endTime)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 8,
                          }}
                        >
                          Assigned items ({assignedItems.length})
                        </div>
                        {assignedItems.length === 0 ? (
                          <p style={{ fontSize: 11, color: T3, margin: 0 }}>No items assigned to this session.</p>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 6,
                              maxHeight: 200,
                              overflowY: 'auto',
                              paddingRight: 4,
                            }}
                          >
                            {assignedItems.map((item) => (
                              <span
                                key={item.id}
                                style={{
                                  fontSize: 10,
                                  padding: '4px 8px',
                                  borderRadius: 2,
                                  background: '#F4F0E8',
                                  color: T2,
                                }}
                              >
                                {item.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DeleteConfirmationModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          confirmLoading={Boolean(deletingSessionId)}
          title={deleteTarget ? deleteConfirmTitle(deleteTarget.name) : deleteConfirmTitle('this session')}
          description={
            deleteTarget ? (
              <>
                {(deleteTarget.assignedItemCount ?? 0) > 0 ? (
                  <>
                    Applied to {deleteTarget.assignedItemCount} item
                    {deleteTarget.assignedItemCount !== 1 ? 's' : ''}.{' '}
                  </>
                ) : null}
                This will remove all associated time slots and cannot be undone.
              </>
            ) : null
          }
        />
      </div>
    </DesktopLayout>
  );
}

function Stat({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T2 }}>
      <span className="material-symbols-rounded" style={{ fontSize: 14, color: T3 }}>
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}

function MiniWeeklyTimeline({ session }: { session: Session }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: T1,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}
      >
        Weekly timeline
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 620 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 48, flexShrink: 0 }} />
            {SESSION_GRID_HOURS.map((hour) => (
              <div key={hour} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: T3, paddingBottom: 4 }}>
                {formatHour(hour)}
              </div>
            ))}
          </div>
          {DAY_ORDER.map((day) => {
            const matchingSlots = sortSessionSlotsByWeekdayOrder(session.slots.filter((s) => s.days.includes(day)));
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', height: 28, borderTop: '1px solid #F4F0E8' }}>
                <div style={{ width: 48, flexShrink: 0, fontSize: 9, fontWeight: 600, color: T3 }}>
                  {DAY_SHORT[day]}
                </div>
                <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                  {SESSION_GRID_HOURS.map((hour) => (
                    <div key={hour} style={{ flex: 1, borderLeft: '1px solid #F7F4EC', height: 20 }} />
                  ))}
                  {matchingSlots.map((slot) => {
                    const startDec = timeToDecimal(slot.startTime);
                    const endDec = timeToDecimal(slot.endTime);
                    const gridStart = SESSION_GRID_HOURS[0];
                    const gridEnd = SESSION_GRID_HOURS[SESSION_GRID_HOURS.length - 1] + 1;
                    const total = gridEnd - gridStart;
                    const leftPct = ((Math.max(startDec, gridStart) - gridStart) / total) * 100;
                    const widthPct = ((Math.min(endDec, gridEnd) - Math.max(startDec, gridStart)) / total) * 100;
                    if (widthPct <= 0) return null;
                    return (
                      <div
                        key={slot.id}
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          top: 4,
                          height: 14,
                          borderRadius: 3,
                          background: `${MINI_TIMELINE_BAR}40`,
                          border: `1px solid ${MINI_TIMELINE_BAR}90`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
