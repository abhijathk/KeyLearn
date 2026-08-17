import { type NoticeKind, Pages } from "@keylearn/pages-shared";
import { Range } from "@keylearn/widget";
import { clsx } from "clsx";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink, useNavigate } from "react-router";
import dashboardBannerDark from "./assets/dashboard-banner-dark.png";
import dashboardBannerLight from "./assets/dashboard-banner-light.png";
import * as common from "./common.module.less";
import * as styles from "./DashboardPage.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { type DashboardStats, SupportService } from "./service.ts";

// Hand-placed positions loosely suggesting continents — this is the mock's
// own "Illustrative" dot map (§07), not a real geographic projection. No
// mapping library, no topojson: a fixed set of slots, filled by rank.
const DOT_SLOTS: readonly { readonly left: number; readonly top: number }[] = [
  { left: 16, top: 36 },
  { left: 23, top: 60 },
  { left: 46, top: 30 },
  { left: 52, top: 44 },
  { left: 70, top: 50 },
  { left: 80, top: 68 },
  { left: 38, top: 52 },
  { left: 60, top: 22 },
];

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AU: "Australia",
  CA: "Canada",
  NZ: "New Zealand",
  IE: "Ireland",
  SG: "Singapore",
  ZA: "South Africa",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  BR: "Brazil",
  MX: "Mexico",
  NG: "Nigeria",
  PK: "Pakistan",
  PH: "Philippines",
  AE: "United Arab Emirates",
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

const METHOD_NAMES: Record<string, string> = {
  "google": "Google",
  "facebook": "Facebook",
  "microsoft": "Microsoft",
  "password": "Email + password",
  "magic-link": "Magic link",
};

function methodName(method: string): string {
  return METHOD_NAMES[method] ?? method;
}

function noticeAge(iso: string): string {
  const min = Math.max(
    1,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (min < 60) {
    return `${min} min ago`;
  }
  const hours = Math.floor(min / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)} days ago`;
}

/** "today, 8:00 AM" or "tomorrow, 8:00 AM", relative to {@link hour} (server-local, digest hour). */
function nextDigestText(hour: number): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  const tomorrow = next.getTime() <= now.getTime();
  if (tomorrow) {
    next.setDate(next.getDate() + 1);
  }
  const time = next.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return tomorrow ? `tomorrow, ${time}` : `today, ${time}`;
}

const NOTICE_STAMP_CLASS: Record<NoticeKind, string | null> = {
  incident: "noticeStampError",
  maintenance: "noticeStampWarn",
  feature: null,
};

const NOTICE_CARD_CLASS: Record<NoticeKind, string | null> = {
  incident: "noticeIncident",
  maintenance: "noticeMaintenance",
  feature: null,
};

export function DashboardPage(): ReactNode {
  return (
    <DeskShell active="dashboard">
      <Dashboard />
    </DeskShell>
  );
}

function Dashboard(): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState(false);
  const [signupRange, setSignupRange] = useState<"today" | "14d" | "all">(
    "14d",
  );
  const [signupSmoothness, setSignupSmoothness] = useState(0.5);

  // "/desk" always resolves to this component (see DeskShell's dashboard
  // nav entry) — a staffer who'd rather land on the Inbox is bounced there
  // once, right after mount, per their own default-landing-page setting.
  useEffect(() => {
    SupportService.getSettings().then((s) => {
      if (s.defaultLandingPage === "inbox") {
        navigate(Pages.deskInbox.path, { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    SupportService.getDashboard()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The header shows this, not the page — it lives outside the Dashboard's
  // own render tree, so the timestamp is broadcast rather than rendered
  // here directly, same pattern as the practice page's streak/focus-mode
  // state (see Header.tsx). Cleared on unmount so it doesn't linger once
  // the visitor has left the Dashboard.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("keylearn:desk-dashboard-asof", {
        detail: stats?.computedAt ?? null,
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("keylearn:desk-dashboard-asof", { detail: null }),
      );
    };
  }, [stats?.computedAt]);

  if (error) {
    return (
      <p className={common.note}>
        <FormattedMessage
          id="deskDashboard.error"
          defaultMessage="Couldn't load the numbers. Try again in a moment."
        />
      </p>
    );
  }

  if (stats == null) {
    return (
      <p className={common.note}>
        <FormattedMessage
          id="deskDashboard.loading"
          defaultMessage="Loading…"
        />
      </p>
    );
  }

  const countryRows = stats.byCountry.filter((r) => r.country !== "other");
  const countryOtherBucket = stats.byCountry.find((r) => r.country === "other");
  const countryTop = countryRows.slice(0, 5);
  const countryRest = countryRows.slice(5);
  const countryOtherCount =
    countryRest.reduce((sum, r) => sum + r.count, 0) +
    (countryOtherBucket?.count ?? 0);
  const countryTotal =
    countryRows.reduce((sum, r) => sum + r.count, 0) +
    (countryOtherBucket?.count ?? 0);

  const dotRows = countryRows.slice(0, DOT_SLOTS.length);
  const maxDotCount = Math.max(1, ...dotRows.map((r) => r.count));

  return (
    <>
      <div className={styles.banner} aria-hidden={true}>
        <img className={styles.bannerImg} src={dashboardBannerDark} alt="" />
        <img
          className={styles.bannerImgLight}
          src={dashboardBannerLight}
          alt=""
        />
      </div>

      <div className={styles.opsGrid}>
        <div className={clsx(styles.ccard, styles.opsHeroAttn)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                <FormattedMessage
                  id="deskDashboard.attention.title"
                  defaultMessage="{count, plural, =0 {Nothing needs you right now} one {# needs a look} other {# need a look}}"
                  values={{ count: stats.urgent?.count ?? 0 }}
                />
              }
              stamp={<span className={styles.stamp}>ATTENTION</span>}
            />
            {stats.urgent != null && (
              <div className={styles.focus}>
                <div>
                  <span className={styles.focusLead}>
                    <FormattedMessage
                      id="deskDashboard.attention.focusLead"
                      defaultMessage="Needs a look"
                    />
                  </span>
                  <span className={styles.focusBody}>
                    <FormattedMessage
                      id="deskDashboard.attention.focusBody"
                      defaultMessage="{subject}, ticket #{id}, unresolved {hours}h."
                      values={{
                        subject: stats.urgent.subject,
                        id: stats.urgent.ticketId,
                        hours: stats.urgent.ageHours,
                      }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div className={common.btnRow}>
              <RouterLink
                to={Pages.deskInbox.path}
                className={clsx(common.btn, common.primary, common.small)}
              >
                <FormattedMessage
                  id="deskDashboard.attention.openInbox"
                  defaultMessage="Open the inbox"
                />
              </RouterLink>
              <RouterLink
                to={Pages.deskAudit.path}
                className={clsx(common.btn, common.ghost, common.small)}
              >
                <FormattedMessage
                  id="deskDashboard.attention.fullReport"
                  defaultMessage="See the full report"
                />
              </RouterLink>
            </div>
            <p className={styles.encourage}>
              {stats.urgent != null ? (
                <FormattedMessage
                  id="deskDashboard.attention.handling"
                  defaultMessage="Everything else is handling itself."
                />
              ) : (
                <FormattedMessage
                  id="deskDashboard.attention.quiet"
                  defaultMessage="Quiet week. Keep it up."
                />
              )}
              <span className={styles.encourageSub}>
                <FormattedMessage
                  id="deskDashboard.attention.nextDigest"
                  defaultMessage="Next digest {when}"
                  values={{ when: nextDigestText(stats.digestHour) }}
                />
              </span>
            </p>
          </div>
        </div>

        <div className={clsx(styles.ccard, styles.opsHeroChart)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                signupRange === "today" ? (
                  <FormattedMessage
                    id="deskDashboard.trend.titleToday"
                    defaultMessage="Signups, today"
                  />
                ) : signupRange === "all" ? (
                  <FormattedMessage
                    id="deskDashboard.trend.titleAll"
                    defaultMessage="Signups, all time"
                  />
                ) : (
                  <FormattedMessage
                    id="deskDashboard.trend.title"
                    defaultMessage="Signups, last 14 days"
                  />
                )
              }
              stamp={<span className={styles.stamp}>SIGNUPS</span>}
            />
            <div className={common.tabs} style={{ marginBlockEnd: "0.7rem" }}>
              <button
                type="button"
                className={clsx(
                  common.tab,
                  signupRange === "today" && common.tabOn,
                )}
                onClick={() => setSignupRange("today")}
              >
                <FormattedMessage
                  id="deskDashboard.trend.rangeToday"
                  defaultMessage="Today"
                />
              </button>
              <button
                type="button"
                className={clsx(
                  common.tab,
                  signupRange === "14d" && common.tabOn,
                )}
                onClick={() => setSignupRange("14d")}
              >
                <FormattedMessage
                  id="deskDashboard.trend.range14d"
                  defaultMessage="14 days"
                />
              </button>
              <button
                type="button"
                className={clsx(
                  common.tab,
                  signupRange === "all" && common.tabOn,
                )}
                onClick={() => setSignupRange("all")}
              >
                <FormattedMessage
                  id="deskDashboard.trend.rangeAll"
                  defaultMessage="All time"
                />
              </button>
            </div>
            <SignupTrendChart
              range={signupRange}
              trend={
                signupRange === "today"
                  ? stats.signupTrendToday
                  : signupRange === "all"
                    ? stats.signupTrendAllTime
                    : stats.signupTrend
              }
              smoothness={signupSmoothness}
              onSmoothnessChange={(v) => setSignupSmoothness(v)}
            />
          </div>
        </div>

        <div className={clsx(styles.ccard, styles.opsTile)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                <FormattedMessage
                  id="deskDashboard.automation.title"
                  defaultMessage="Tab, last 7 days"
                />
              }
              stamp={
                <span className={styles.stampRow}>
                  <span className={styles.stamp}>TAB</span>
                  <span
                    className={styles.aiBadge}
                    title={formatMessage({
                      id: "deskDashboard.automation.aiBadgeTitle",
                      defaultMessage:
                        "Handled by Tab, KeyLearn's support agent — not a human reply.",
                    })}
                  >
                    <FormattedMessage
                      id="deskDashboard.automation.aiBadge"
                      defaultMessage="AI"
                    />
                  </span>
                </span>
              }
            />
            <div className={styles.rows}>
              <LRow
                k={
                  <FormattedMessage
                    id="deskDashboard.automation.autoResolved"
                    defaultMessage="Auto-resolved"
                  />
                }
                val={`${Math.round(stats.automation.autoResolvedPct)}%`}
                tone="accent"
              />
              <LRow
                k={
                  <FormattedMessage
                    id="deskDashboard.automation.escalated"
                    defaultMessage="Escalated to a human"
                  />
                }
                val={`${Math.round(stats.automation.escalatedPct)}%`}
                tone="warn"
              />
              <LRow
                k={
                  <FormattedMessage
                    id="deskDashboard.automation.reopened"
                    defaultMessage="Reopened after a reply"
                  />
                }
                val={`${stats.automation.reopenedPct.toFixed(1)}%`}
                tone="error"
              />
            </div>
          </div>
        </div>

        <div className={clsx(styles.ccard, styles.opsTile)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                <FormattedMessage
                  id="deskDashboard.accounts.title"
                  defaultMessage="Accounts"
                />
              }
              stamp={<span className={styles.stamp}>ACCOUNTS</span>}
            />
            <div className={styles.rows}>
              <LRow
                k={
                  <FormattedMessage
                    id="deskDashboard.stat.accounts"
                    defaultMessage="Accounts created, all time"
                  />
                }
                val={stats.accountsTotal.toLocaleString()}
              />
              <LRow
                k={
                  <FormattedMessage
                    id="deskDashboard.stat.newSignups"
                    defaultMessage="New signups, last 7 days"
                  />
                }
                val={`+${stats.newLast7Days.toLocaleString()}`}
                tone="accent"
              />
              <LRow
                k={
                  <FormattedMessage
                    id="deskDashboard.stat.avgLogins"
                    defaultMessage="Avg. logins / week, per active user"
                  />
                }
                val={stats.avgLoginsPerActiveUserPerWeek.toFixed(1)}
              />
              <LRow
                k={
                  <FormattedMessage
                    id="deskDashboard.stat.avgSessions"
                    defaultMessage="Avg. practice sessions / week, per active user"
                  />
                }
                val={stats.avgSessionsPerActiveUserPerWeek.toFixed(1)}
              />
              {stats.topCountry != null && (
                <LRow
                  k={
                    <FormattedMessage
                      id="deskDashboard.stat.topCountry"
                      defaultMessage="Top country"
                    />
                  }
                  val={countryName(stats.topCountry)}
                />
              )}
            </div>
          </div>
        </div>

        <div className={clsx(styles.ccard, styles.opsTile)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                <FormattedMessage
                  id="deskDashboard.method.title"
                  defaultMessage="How they signed up"
                />
              }
              stamp={<span className={styles.stamp}>SIGN-UP</span>}
            />
            <RankedBars
              rows={stats.bySignupMethod
                .filter((r) => r.count > 0)
                .map((r) => ({ name: methodName(r.method), count: r.count }))}
              total={stats.bySignupMethod.reduce((s, r) => s + r.count, 0)}
            />
          </div>
        </div>

        <div className={clsx(styles.ccard, styles.opsTile)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                <FormattedMessage
                  id="deskDashboard.kids.title"
                  defaultMessage="Grown-up vs kid profiles"
                />
              }
              stamp={<span className={styles.stamp}>PROFILES</span>}
            />
            <RankedBars
              rows={stats.kidsVsGrownups.map((r) => ({
                name: r.kind === "kid" ? "Kids" : "Grown-ups",
                count: r.count,
              }))}
              total={stats.kidsVsGrownups.reduce((s, r) => s + r.count, 0)}
            />
          </div>
        </div>

        <div className={clsx(styles.ccard, styles.opsWide)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                <FormattedMessage
                  id="deskDashboard.geo.title"
                  defaultMessage="Where people are, by country"
                />
              }
              stamp={<span className={styles.stamp}>GEO</span>}
            />
            <div className={styles.worldMap}>
              <span className={styles.worldMapCap}>
                <FormattedMessage
                  id="deskDashboard.geo.caption"
                  defaultMessage="Illustrative — one dot per country with 5+ learners, sized by count"
                />
              </span>
              {dotRows.map((row, i) => {
                const size = 0.85 + (row.count / maxDotCount) * 1.45;
                const slot = DOT_SLOTS[i];
                return (
                  <span
                    key={row.country}
                    className={styles.geoDot}
                    style={{
                      inlineSize: `${size}rem`,
                      blockSize: `${size}rem`,
                      insetInlineStart: `${slot.left}%`,
                      insetBlockStart: `${slot.top}%`,
                    }}
                    title={countryName(row.country)}
                  />
                );
              })}
            </div>
            <RankedBars
              rows={countryTop.map((r) => ({
                name: countryName(r.country),
                count: r.count,
              }))}
              otherLabel={
                countryOtherCount > 0
                  ? formatMessage(
                      {
                        id: "deskDashboard.geo.other",
                        defaultMessage: "Other · {n} countries",
                      },
                      {
                        n:
                          countryRest.length +
                          (countryOtherBucket != null ? 1 : 0),
                      },
                    )
                  : undefined
              }
              otherCount={countryOtherCount}
              total={countryTotal}
            />
            <p className={styles.cnote}>
              <FormattedMessage
                id="deskDashboard.geo.note"
                defaultMessage="Grouped rather than named — a country with one learner in it is a person, not a data point, and the map should not be able to single them out."
              />
            </p>
          </div>
        </div>

        <div className={clsx(styles.ccard, styles.opsWide)}>
          <div className={styles.cbody}>
            <CardHead
              title={
                <FormattedMessage
                  id="deskDashboard.language.title"
                  defaultMessage="Language, by site preference"
                />
              }
              stamp={<span className={styles.stamp}>LANG</span>}
            />
            {stats.byLanguage.length === 0 ? (
              <p className={styles.cnote}>
                <FormattedMessage
                  id="deskDashboard.language.notTracked"
                  defaultMessage="Not tracked yet — no locale column exists on accounts to aggregate."
                />
              </p>
            ) : (
              <RankedBars
                rows={stats.byLanguage.map((r) => ({
                  name: r.language,
                  count: r.count,
                }))}
                total={stats.byLanguage.reduce((s, r) => s + r.count, 0)}
              />
            )}
          </div>
        </div>

        <div className={styles.opsNotices}>
          <p className={styles.sectLabel}>
            <FormattedMessage
              id="deskDashboard.notices.title"
              defaultMessage="Site notices"
            />
          </p>
          {stats.notices.length === 0 ? (
            <p className={common.note}>
              <FormattedMessage
                id="deskDashboard.notices.empty"
                defaultMessage="Nothing posted right now."
              />
            </p>
          ) : (
            <div className={styles.noticeStack}>
              {stats.notices.map((n) => (
                <div
                  key={n.id}
                  className={clsx(
                    styles.ccard,
                    NOTICE_CARD_CLASS[n.kind] != null &&
                      styles[NOTICE_CARD_CLASS[n.kind]!],
                  )}
                >
                  <div className={styles.cbody}>
                    <CardHead
                      title={n.message}
                      stamp={
                        <span
                          className={clsx(
                            styles.stamp,
                            NOTICE_STAMP_CLASS[n.kind] != null &&
                              styles[NOTICE_STAMP_CLASS[n.kind]!],
                          )}
                        >
                          {n.kind === "incident" && (
                            <FormattedMessage
                              id="deskNotices.kind.incident"
                              defaultMessage="Incident"
                            />
                          )}
                          {n.kind === "maintenance" && (
                            <FormattedMessage
                              id="deskNotices.kind.maintenance"
                              defaultMessage="Maintenance"
                            />
                          )}
                          {n.kind === "feature" && (
                            <FormattedMessage
                              id="deskNotices.kind.feature"
                              defaultMessage="Feature"
                            />
                          )}
                        </span>
                      }
                    />
                    <p className={styles.cmeta}>
                      <FormattedMessage
                        id="deskDashboard.notices.posted"
                        defaultMessage="Posted {when} · {dismissible, select, true {dismissible} other {not dismissible}}"
                        values={{
                          when: noticeAge(n.createdAt),
                          dismissible: String(n.dismissible),
                        }}
                      />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Every ccard header: title on the left, the rotated stamp badge on the right. */
function CardHead({
  title,
  stamp,
}: {
  readonly title: ReactNode;
  readonly stamp: ReactNode;
}): ReactNode {
  return (
    <div className={styles.cardHead}>
      <h3 className={styles.ctitle}>{title}</h3>
      {stamp}
    </div>
  );
}

const TONE_CLASS = {
  accent: "valAccent",
  warn: "valWarn",
  error: "valError",
} as const;

function LRow({
  k,
  val,
  tone,
}: {
  readonly k: ReactNode;
  readonly val: ReactNode;
  readonly tone?: "accent" | "warn" | "error";
}): ReactNode {
  return (
    <div className={styles.lrow}>
      <span className={styles.k}>{k}</span>
      <span className={styles.fill} />
      <span
        className={
          tone != null
            ? `${styles.val} ${styles[TONE_CLASS[tone]]}`
            : styles.val
        }
      >
        {val}
      </span>
    </div>
  );
}

const CHART_W = 1000;
const CHART_H = 200;
const CHART_PAD = 8;

/**
 * A straight-line path through every point — no data altered, no curve.
 * `smoothness === 0` on {@link smoothPath} reduces to exactly this.
 */
function pathOf(pts: readonly (readonly [number, number])[]): string {
  return pts
    .map(
      ([px, py], i) =>
        `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`,
    )
    .join(" ");
}

/**
 * The same points {@link pathOf} draws, but connected with a Catmull-Rom
 * spline instead of straight segments — the slider changes how the line
 * *looks* between real days, never the days' actual values. `smoothness`
 * (0–1, straight to curviest) is the spline's tension, converted to cubic
 * Bézier control points per segment.
 */
function smoothPath(
  pts: readonly (readonly [number, number])[],
  smoothness: number,
): string {
  if (pts.length < 3 || smoothness <= 0) {
    return pathOf(pts);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * smoothness;
    // The spline can swing a control point past the chart's own baseline
    // near a flat or low stretch — clamped so the curve never dips below
    // the x-axis the data itself never goes under.
    const c1y = Math.min(
      p1[1] + ((p2[1] - p0[1]) / 6) * smoothness,
      CHART_H - CHART_PAD,
    );
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * smoothness;
    const c2y = Math.min(
      p2[1] - ((p3[1] - p1[1]) / 6) * smoothness,
      CHART_H - CHART_PAD,
    );
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * The trailing-14-day signup trend, split into this week vs. last week so
 * the two are directly comparable — a real SVG line chart (gradient fill,
 * peak marker, hover tooltip) instead of the plain bar-per-day view this
 * replaced, matching the same visual language as the learner Profile
 * page's own charts (packages/page-profile/lib/profile/road/charts.tsx).
 *
 * "Today" and "All time" don't have a natural week-over-week comparison —
 * those ranges fall through to {@link SingleTrendChart} instead.
 */
function SignupTrendChart({
  trend,
  range,
  smoothness,
  onSmoothnessChange,
}: {
  readonly trend: readonly number[];
  readonly range: "today" | "14d" | "all";
  readonly smoothness: number;
  readonly onSmoothnessChange: (value: number) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (range !== "14d") {
    return (
      <SingleTrendChart
        trend={trend}
        smoothness={smoothness}
        onSmoothnessChange={onSmoothnessChange}
      />
    );
  }

  const days = 7;
  const lastWeek = trend.slice(0, days);
  const thisWeek = trend.slice(days, days * 2);

  const maxV = Math.max(1, ...thisWeek, ...lastWeek);
  const x = (i: number) =>
    CHART_PAD + (i / (days - 1)) * (CHART_W - CHART_PAD * 2);
  const y = (v: number) =>
    CHART_H - CHART_PAD - (v / maxV) * (CHART_H - CHART_PAD * 2 - 24);
  const curPts = thisWeek.map((v, i) => [x(i), y(v)] as const);
  const prevPts = lastWeek.map((v, i) => [x(i), y(v)] as const);
  const curPath = smoothPath(curPts, smoothness);
  const fillPath = `${curPath} L ${x(days - 1)} ${CHART_H - CHART_PAD} L ${x(0)} ${CHART_H - CHART_PAD} Z`;
  let peakI = 0;
  for (let i = 1; i < thisWeek.length; i++) {
    if (thisWeek[i] > thisWeek[peakI]) {
      peakI = i;
    }
  }

  const onMove = (ev: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect == null) {
      return;
    }
    const mx = ((ev.clientX - rect.left) / rect.width) * CHART_W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < days; i++) {
      const d = Math.abs(x(i) - mx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  return (
    <div className={styles.chartWrap}>
      <svg
        ref={svgRef}
        className={styles.chart}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="signup-trend-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[1, 2, 3].map((i) => {
          const gy = CHART_PAD + (i / 4) * (CHART_H - CHART_PAD * 2 - 24);
          return (
            <line
              key={i}
              x1={CHART_PAD}
              x2={CHART_W - CHART_PAD}
              y1={gy}
              y2={gy}
              stroke="var(--primary-d2, var(--primary-d1))"
              strokeWidth={1}
            />
          );
        })}
        <path d={fillPath} fill="url(#signup-trend-g)" stroke="none" />
        <path
          d={smoothPath(prevPts, smoothness)}
          fill="none"
          stroke="var(--accent-l1)"
          strokeWidth={2}
          opacity={0.6}
        />
        <path
          d={curPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
        />
        {curPts[peakI][0] < x(days - 1) - 60 && (
          <>
            <circle
              cx={curPts[peakI][0]}
              cy={curPts[peakI][1]}
              r={4}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.6}
            />
            <text
              x={curPts[peakI][0] + 8}
              y={curPts[peakI][1] - 8}
              fill="var(--accent)"
              fontSize={11}
            >
              peak {Math.round(thisWeek[peakI])}
            </text>
          </>
        )}
        <circle
          cx={curPts[days - 1][0]}
          cy={curPts[days - 1][1]}
          r={9}
          fill="var(--accent)"
          opacity={0.25}
        />
        <circle
          cx={curPts[days - 1][0]}
          cy={curPts[days - 1][1]}
          r={4}
          fill="var(--accent)"
        />
        {hover != null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={CHART_PAD}
              y2={CHART_H - CHART_PAD}
              stroke="var(--text-color-f2)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <circle
              cx={curPts[hover][0]}
              cy={curPts[hover][1]}
              r={4.5}
              fill="var(--accent)"
            />
            <circle
              cx={prevPts[hover][0]}
              cy={prevPts[hover][1]}
              r={4.5}
              fill="var(--accent-l1)"
            />
          </>
        )}
      </svg>
      {hover != null && (
        <div
          className={styles.chartTip}
          style={{
            left: `${(x(hover) / CHART_W) * 100}%`,
            top: `${(curPts[hover][1] / CHART_H) * 100}%`,
          }}
        >
          <b>{Math.round(thisWeek[hover])}</b> this week
          <span className={styles.chartTipSep}>·</span>
          <b>{Math.round(lastWeek[hover])}</b> last week
        </div>
      )}
      <div className={styles.chartLegend}>
        <span>
          <i style={{ backgroundColor: "var(--accent)" }} />
          <FormattedMessage
            id="deskDashboard.trend.thisWeek"
            defaultMessage="This week"
          />
        </span>
        <span>
          <i style={{ backgroundColor: "var(--accent-l1)" }} />
          <FormattedMessage
            id="deskDashboard.trend.lastWeek"
            defaultMessage="Last week"
          />
        </span>
        <span className={styles.legendSlider}>
          <Range
            size={10}
            min={0}
            max={100}
            step={10}
            value={Math.round(smoothness * 100)}
            title={formatMessage({
              id: "deskDashboard.trend.smoothingDescription",
              defaultMessage:
                "Filters out day-to-day noise so the trend reads more clearly.",
            })}
            onChange={(value) => onSmoothnessChange(value / 100)}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * A single line, for the ranges that have no natural week-over-week
 * comparison (today's hourly signups, or the whole lifetime's monthly
 * signups) — same visual language as {@link SignupTrendChart}'s "this
 * week" line, without the second series.
 */
function SingleTrendChart({
  trend,
  smoothness,
  onSmoothnessChange,
}: {
  readonly trend: readonly number[];
  readonly smoothness: number;
  readonly onSmoothnessChange: (value: number) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const n = Math.max(1, trend.length);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const maxV = Math.max(1, ...trend);
  const x = (i: number) =>
    n === 1
      ? CHART_W / 2
      : CHART_PAD + (i / (n - 1)) * (CHART_W - CHART_PAD * 2);
  const y = (v: number) =>
    CHART_H - CHART_PAD - (v / maxV) * (CHART_H - CHART_PAD * 2 - 24);
  const pts = trend.map((v, i) => [x(i), y(v)] as const);
  const linePath = smoothPath(pts, smoothness);
  const fillPath =
    pts.length === 0
      ? ""
      : `${linePath} L ${x(n - 1)} ${CHART_H - CHART_PAD} L ${x(0)} ${CHART_H - CHART_PAD} Z`;
  let peakI = 0;
  for (let i = 1; i < trend.length; i++) {
    if (trend[i] > trend[peakI]) {
      peakI = i;
    }
  }

  const onMove = (ev: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect == null) {
      return;
    }
    const mx = ((ev.clientX - rect.left) / rect.width) * CHART_W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - mx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  if (trend.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartWrap}>
      <svg
        ref={svgRef}
        className={styles.chart}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="signup-trend-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[1, 2, 3].map((i) => {
          const gy = CHART_PAD + (i / 4) * (CHART_H - CHART_PAD * 2 - 24);
          return (
            <line
              key={i}
              x1={CHART_PAD}
              x2={CHART_W - CHART_PAD}
              y1={gy}
              y2={gy}
              stroke="var(--primary-d2, var(--primary-d1))"
              strokeWidth={1}
            />
          );
        })}
        <path d={fillPath} fill="url(#signup-trend-g)" stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
        />
        {peakI !== n - 1 && (
          <>
            <circle
              cx={pts[peakI][0]}
              cy={pts[peakI][1]}
              r={4}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.6}
            />
            <text
              x={pts[peakI][0] + 8}
              y={pts[peakI][1] - 8}
              fill="var(--accent)"
              fontSize={11}
            >
              peak {Math.round(trend[peakI])}
            </text>
          </>
        )}
        <circle
          cx={pts[n - 1][0]}
          cy={pts[n - 1][1]}
          r={9}
          fill="var(--accent)"
          opacity={0.25}
        />
        <circle
          cx={pts[n - 1][0]}
          cy={pts[n - 1][1]}
          r={4}
          fill="var(--accent)"
        />
        {hover != null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={CHART_PAD}
              y2={CHART_H - CHART_PAD}
              stroke="var(--text-color-f2)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <circle
              cx={pts[hover][0]}
              cy={pts[hover][1]}
              r={4.5}
              fill="var(--accent)"
            />
          </>
        )}
      </svg>
      {hover != null && (
        <div
          className={styles.chartTip}
          style={{
            left: `${(x(hover) / CHART_W) * 100}%`,
            top: `${(pts[hover][1] / CHART_H) * 100}%`,
          }}
        >
          <b>{Math.round(trend[hover])}</b>
        </div>
      )}
      <div className={styles.chartLegend}>
        <span className={styles.legendSlider}>
          <Range
            size={10}
            min={0}
            max={100}
            step={10}
            value={Math.round(smoothness * 100)}
            title={formatMessage({
              id: "deskDashboard.trend.smoothingDescription",
              defaultMessage:
                "Filters out day-to-day noise so the trend reads more clearly.",
            })}
            onChange={(value) => onSmoothnessChange(value / 100)}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * A ranked bar list — used 4 times on this one screen (country, language,
 * signup method, kids vs. grown-ups). Bar width is relative to the top row
 * (so the biggest bucket always reads full-width); the percentage label is
 * each row's actual share of `total`.
 */
function RankedBars({
  rows,
  total,
  otherLabel,
  otherCount = 0,
}: {
  readonly rows: readonly { readonly name: string; readonly count: number }[];
  readonly total: number;
  readonly otherLabel?: string;
  readonly otherCount?: number;
}): ReactNode {
  const max = Math.max(1, ...rows.map((r) => r.count), otherCount);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className={styles.geoList}>
      {rows.map((row, i) => (
        <div className={styles.geoRow} key={row.name}>
          <span className={styles.rank}>{String(i + 1).padStart(2, "0")}</span>
          <span className={styles.geoName}>{row.name}</span>
          <span className={styles.bar}>
            <i style={{ inlineSize: `${(row.count / max) * 100}%` }} />
          </span>
          <span className={styles.pct}>{pct(row.count)}%</span>
        </div>
      ))}
      {otherLabel != null && (
        <div className={styles.geoRowOther}>
          <span className={styles.rank}>—</span>
          <span className={styles.geoName}>{otherLabel}</span>
          <span className={styles.bar}>
            <i style={{ inlineSize: `${(otherCount / max) * 100}%` }} />
          </span>
          <span className={styles.pct}>{pct(otherCount)}%</span>
        </div>
      )}
    </div>
  );
}
