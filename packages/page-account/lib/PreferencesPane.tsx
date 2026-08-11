import {
  allLocales,
  defaultLocale,
  formatsForTimeZone,
  useIntlDates,
  useIntlDisplayNames,
} from "@keylearn/intl";
import {
  downloadBlob,
  exportFilename,
  isPremiumUser,
  loadSafeZones,
  loadThemedZones,
  myCertificates,
  Pages,
  saveSafeZones,
  saveThemedZones,
  usePageData,
  ZONES_CHANGED_EVENT,
} from "@keylearn/pages-shared";
import { SpeedUnit, uiProps } from "@keylearn/result";
import { openResultStorage } from "@keylearn/result-loader";
import { useSettings } from "@keylearn/settings";
import { useTheme } from "@keylearn/themes";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./AccountPage.module.less";
import { Segmented, Toggle } from "./controls.tsx";
import { accountProps, allTimeZones, deviceTimeZone } from "./prefs.ts";
import { ProfileChooser } from "./ProfileChooser.tsx";
import { useProfiles } from "./profiles/context.tsx";
import { ThemePicker } from "./theme/ThemePicker.tsx";

// The three interface themes, mapped to the mock's Light / Dark / System.
const THEME_IDS = ["keylearn-day", "keylearn", "auto"] as const;
type ThemeId = (typeof THEME_IDS)[number];

const THEME_OPTIONS: readonly { id: ThemeId; label: ReactNode }[] = [
  {
    id: "keylearn-day",
    label: (
      <FormattedMessage id="account.prefs.theme.light" defaultMessage="Light" />
    ),
  },
  {
    id: "keylearn",
    label: (
      <FormattedMessage id="account.prefs.theme.dark" defaultMessage="Dark" />
    ),
  },
  {
    id: "auto",
    label: (
      <FormattedMessage id="account.prefs.theme.auto" defaultMessage="Auto" />
    ),
  },
];

/**
 * Account-level Preferences: theme, speed unit, language, region, email
 * notifications and privacy — distinct from the per-profile Practice settings.
 */
/**
 * What this time zone's country actually writes, on one line.
 *
 * A worked example rather than a description: the same date, clock, price and
 * phone number the drill will serve, rendered for the zone currently chosen.
 * Changing the select changes this line, which is the fastest way to see that
 * the setting does something beyond streaks.
 */
function regionSample(timeZone: string): string {
  const f = formatsForTimeZone(timeZone);
  const date =
    f.dateOrder === "MDY"
      ? ["08", "07", "2026"]
      : f.dateOrder === "YMD"
        ? ["2026", "08", "07"]
        : ["07", "08", "2026"];
  const time = f.hour12 ? "2:32 pm" : "14:32";
  // 1234567.89 in this country's grouping, so the sample shows the shape a
  // large amount takes and not just the symbol.
  const digits = "1234567";
  const whole = f.southAsianGrouping
    ? `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, f.groupSep)}${f.groupSep}${digits.slice(-3)}`
    : digits.replace(/\B(?=(\d{3})+(?!\d))/g, f.groupSep);
  const amount = `${whole}${f.decimalSep}89`;
  const money = f.currencyBefore
    ? `${f.currencySymbol}${amount}`
    : `${amount} ${f.currencySymbol}`;
  const phone = f.phonePattern.replace(/#/g, () => "5");
  return [date.join(f.dateSep), time, money, phone].join("  ·  ");
}

export function PreferencesPane(): ReactNode {
  return (
    <div className={styles.paneScroll}>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="account.prefs.title"
          defaultMessage="Preferences"
        />
      </h2>
      <p className={styles.note}>
        <FormattedMessage
          id="account.prefs.note"
          defaultMessage="These apply to your whole account. Typing, keyboard and language-of-practice settings live in Practice settings and are kept per profile."
        />
      </p>

      <LanguageRegionCard />
      <NotificationsCard />
      <PrivacyCard />
    </div>
  );
}

/**
 * Appearance has a section of its own rather than a card inside Preferences:
 * it now carries a colour for every learner in the household, which is more
 * than a card's worth of panel and more than a settings list wants to scroll
 * past to reach the privacy switches.
 */
export function AppearancePane(): ReactNode {
  return (
    <div className={styles.paneScroll}>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="account.appearance.title"
          defaultMessage="Appearance"
        />
      </h2>
      <AppearanceCard />
    </div>
  );
}

/**
 * The colour-blind-friendly keyboard.
 *
 * Above the colour picker on purpose: somebody who needs this needs it more
 * than they need a favourite colour, and a setting that matters is not one to
 * put at the bottom of a scroll.
 */
export function AccessibilityPane(): ReactNode {
  const { household } = useProfiles();
  const profiles = household.profiles;
  const [chosenId, setChosenId] = useState<string | null>(
    () => household.activeId ?? profiles[0]?.id ?? null,
  );
  const chosen = profiles.find((p) => p.id === chosenId) ?? profiles[0] ?? null;
  const [safe, setSafe] = useState(() => loadSafeZones(chosen?.id ?? null));
  // Per learner, so the switch must re-read when the learner changes.
  const [seen, setSeen] = useState(chosen?.id ?? null);
  if (seen !== (chosen?.id ?? null)) {
    setSeen(chosen?.id ?? null);
    setSafe(loadSafeZones(chosen?.id ?? null));
  }

  return (
    <div className={styles.paneScroll}>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="account.accessibility.title"
          defaultMessage="Accessibility"
        />
      </h2>
      <div className={styles.prefCard}>
        {profiles.length > 0 && (
          <ProfileChooser
            profiles={profiles}
            chosenId={chosen?.id ?? null}
            onChoose={setChosenId}
            marked={(id) => loadSafeZones(id)}
          />
        )}

        {SafeRow({ safe, setSafe, profileId: chosen?.id ?? null })}
      </div>
    </div>
  );
}

function SafeRow({
  safe,
  setSafe,
  profileId,
}: {
  readonly safe: boolean;
  readonly setSafe: (v: boolean) => void;
  readonly profileId: string | null;
}): ReactNode {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>
          <FormattedMessage
            id="account.appearance.safeZones"
            defaultMessage="Keyboard colours for colour blindness"
          />
        </span>
        <span className={styles.rowSub}>
          <FormattedMessage
            id="account.appearance.safeZones.sub"
            defaultMessage="The finger colours are what the keyboard teaches with. These ones stay apart for red-green colour blindness, where the usual set can look almost the same."
          />
        </span>
      </div>
      <Toggle
        on={safe}
        onChange={(next) => {
          setSafe(next);
          saveSafeZones(next, profileId);
          // The provider paints them, because it is the thing that knows
          // whether this device is on night or day.
          window.dispatchEvent(new window.Event(ZONES_CHANGED_EVENT));
        }}
      />
    </div>
  );
}

/**
 * The keyboard in the learner's own colours.
 *
 * Below the colour-blind row and disabled by it: when both are asked for, the
 * one about being able to read the keyboard wins, and saying so is kinder than
 * silently ignoring the switch somebody just moved.
 */

function LanguageRegionCard(): ReactNode {
  const { locale } = usePageData();
  const { formatLocalLanguageName } = useIntlDisplayNames();
  const { settings, updateSettings } = useSettings();
  const timeZone = settings.get(accountProps.timeZone) || deviceTimeZone();
  const weekStart = settings.get(accountProps.weekStart);
  const speedUnit = settings.get(uiProps.speedUnit).id;

  const switchLocale = (next: string) => {
    const base = Pages.intlBase(locale);
    const path = window.location.pathname.startsWith(base)
      ? window.location.pathname.slice(base.length) || "/"
      : window.location.pathname;
    window.location.assign(Pages.intlPath(path, next) || "/");
  };

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="account.prefs.language"
          defaultMessage="Language & region"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.language.label"
              defaultMessage="App & email language"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.language.sub"
              defaultMessage="The language for menus, buttons and the emails we send."
            />
          </span>
        </div>
        <select
          className={styles.prefSelect}
          value={allLocales.includes(locale) ? locale : defaultLocale}
          onChange={(ev) => switchLocale(ev.target.value)}
        >
          {allLocales.map((id) => (
            <option key={id} value={id}>
              {formatLocalLanguageName(id)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.timezone"
              defaultMessage="Time zone"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.timezone.sub"
              defaultMessage="More than when your day rolls over for streaks and goals: this is how KeyLearn knows which country you are in. Dates, times, prices and phone numbers are written your country’s way because of this, and the number drills practise those local shapes rather than another country’s. Your language stays whatever you chose above — only the local conventions follow the zone."
            />
          </span>
          {/* Prose can describe the effect; showing it is quicker to read and
              impossible to misunderstand. This is exactly what the drill will
              serve for the zone currently selected. */}
          <span className={styles.rowExample}>
            <FormattedMessage
              id="account.prefs.timezone.example"
              defaultMessage="Here that looks like: {sample}"
              values={{ sample: <b>{regionSample(timeZone)}</b> }}
            />
          </span>
        </div>
        <select
          className={styles.prefSelect}
          value={timeZone}
          onChange={(ev) =>
            updateSettings(settings.set(accountProps.timeZone, ev.target.value))
          }
        >
          {allTimeZones().map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.weekStart"
              defaultMessage="Week starts on"
            />
          </span>
        </div>
        <Segmented
          value={weekStart === "mon" || weekStart === "sun" ? weekStart : ""}
          onChange={(id) =>
            updateSettings(settings.set(accountProps.weekStart, id))
          }
          options={[
            {
              // The default, and right for most people without their knowing:
              // Monday across Europe and Australia, Sunday in the US and
              // Japan, Saturday in much of the Middle East.
              id: "",
              label: (
                <FormattedMessage
                  id="account.prefs.weekStart.auto"
                  defaultMessage="Automatic"
                />
              ),
            },
            {
              id: "mon",
              label: (
                <FormattedMessage
                  id="account.prefs.weekStart.mon"
                  defaultMessage="Mon"
                />
              ),
            },
            {
              id: "sun",
              label: (
                <FormattedMessage
                  id="account.prefs.weekStart.sun"
                  defaultMessage="Sun"
                />
              ),
            },
          ]}
        />
      </div>

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.speedUnit"
              defaultMessage="Typing speed shown as"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.speedUnit.sub"
              defaultMessage="Words or characters per minute, everywhere across your account."
            />
          </span>
        </div>
        <Segmented
          value={
            speedUnit === SpeedUnit.CPM.id ? SpeedUnit.CPM.id : SpeedUnit.WPM.id
          }
          onChange={(id) =>
            updateSettings(
              settings.set(uiProps.speedUnit, SpeedUnit.ALL.get(id)),
            )
          }
          options={[
            { id: SpeedUnit.WPM.id, label: "WPM" },
            { id: SpeedUnit.CPM.id, label: "CPM" },
          ]}
        />
      </div>
    </div>
  );
}

function NotificationsCard(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const reminders = settings.get(accountProps.emailReminders);
  const news = settings.get(accountProps.emailProductNews);
  const frequency = settings.get(accountProps.reminderFrequency);
  const level = settings.get(accountProps.newsLevel);

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="account.prefs.notifications"
          defaultMessage="Email & notifications"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.reminders"
              defaultMessage="Practice reminders"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.reminders.sub"
              defaultMessage="A nudge when you haven’t practised in a while."
            />
          </span>
        </div>
        <Toggle
          on={reminders}
          onChange={(v) =>
            updateSettings(settings.set(accountProps.emailReminders, v))
          }
        />
      </div>

      {reminders && (
        <div className={styles.subRow}>
          <span className={styles.subLabel}>
            <FormattedMessage
              id="account.prefs.reminders.frequency"
              defaultMessage="At most"
            />
          </span>
          <Segmented
            value={
              frequency === "few-days" || frequency === "monthly"
                ? frequency
                : "weekly"
            }
            onChange={(id) =>
              updateSettings(settings.set(accountProps.reminderFrequency, id))
            }
            options={[
              {
                id: "few-days",
                label: (
                  <FormattedMessage
                    id="account.prefs.reminders.freq.days"
                    defaultMessage="Every few days"
                  />
                ),
              },
              {
                id: "weekly",
                label: (
                  <FormattedMessage
                    id="account.prefs.reminders.freq.weekly"
                    defaultMessage="Weekly"
                  />
                ),
              },
              {
                id: "monthly",
                label: (
                  <FormattedMessage
                    id="account.prefs.reminders.freq.monthly"
                    defaultMessage="Monthly"
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.news"
              defaultMessage="Product news"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.news.sub"
              defaultMessage="Occasional updates about new KeyLearn features."
            />
          </span>
        </div>
        <Toggle
          on={news}
          onChange={(v) =>
            updateSettings(settings.set(accountProps.emailProductNews, v))
          }
        />
      </div>

      {news && (
        <div className={styles.subRow}>
          <span className={styles.subLabel}>
            <FormattedMessage
              id="account.prefs.news.level"
              defaultMessage="Send me"
            />
          </span>
          <Segmented
            value={level === "all" ? "all" : "major"}
            onChange={(id) =>
              updateSettings(settings.set(accountProps.newsLevel, id))
            }
            options={[
              {
                id: "major",
                label: (
                  <FormattedMessage
                    id="account.prefs.news.level.major"
                    defaultMessage="Major updates only"
                  />
                ),
              },
              {
                id: "all",
                label: (
                  <FormattedMessage
                    id="account.prefs.news.level.all"
                    defaultMessage="Everything"
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.security"
              defaultMessage="Security alerts"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.security.sub"
              defaultMessage="New sign-ins and account changes. Always on."
            />
          </span>
        </div>
        <Toggle on={true} disabled={true} onChange={() => {}} />
      </div>
    </div>
  );
}

function AppearanceCard(): ReactNode {
  const { color, switchColor } = useTheme();

  return (
    <>
      {/* Light and dark is a device setting; the colour belongs to a learner.
          Two different scopes, so two cards rather than one with a rule
          through it. */}
      <div className={styles.prefCard}>
        <div className={styles.prefSect}>
          <FormattedMessage
            id="account.prefs.appearance"
            defaultMessage="Display"
          />
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>
              <FormattedMessage
                id="account.prefs.displayMode"
                defaultMessage="Mode"
              />
            </span>
          </div>
          <Segmented
            value={
              THEME_IDS.includes(color as ThemeId) ? (color as ThemeId) : "auto"
            }
            onChange={switchColor}
            options={THEME_OPTIONS}
          />
        </div>
      </div>

      <div className={styles.prefCard}>
        <div className={styles.prefSect}>
          <FormattedMessage
            id="account.prefs.themeSect"
            defaultMessage="Theme"
          />
        </div>

        <ThemePicker />
      </div>
    </>
  );
}

function PrivacyCard(): ReactNode {
  const { formatStamp } = useIntlDates();
  const { settings, updateSettings } = useSettings();
  const { user, publicUser, profiles } = usePageData();

  const [exporting, setExporting] = useState(false);

  /**
   * Everything this account holds, not just what the account page knows.
   *
   * The first version exported the account record, the profile list and the
   * settings — and called itself "Export my data" while leaving out the
   * practice history, which is the only part anybody actually means by that.
   * A file that looks complete and is not is worse than no button at all.
   *
   * The history lives per learner in this browser's own database, so it is
   * gathered a learner at a time; the certificates come from the server,
   * because that is where they are issued.
   */
  const exportData = async () => {
    setExporting(true);
    const list = profiles ?? [];
    const learners = await Promise.all(
      list.map(async (profile) => {
        let results: unknown[] = [];
        try {
          const storage = await openResultStorage({
            type: "private",
            userId: publicUser.id ?? null,
            kids: profile.kind === "kid",
            namespace: `profile-${profile.id}`,
          });
          results = (await storage.load()).map((r) => ({
            at: new Date(r.timeStamp).toISOString(),
            layout: String(r.layout),
            textType: String(r.textType),
            length: r.length,
            timeMs: r.time,
            errors: r.errors,
            // Characters a minute, as stored. Named so nobody reads it as
            // words and quietly divides by five twice.
            charsPerMinute: Math.round(r.speed * 10) / 10,
            accuracy: Math.round(r.accuracy * 1000) / 1000,
          }));
        } catch {
          // A learner whose local database will not open exports with an
          // empty history rather than failing the whole download.
          results = [];
        }
        return { profile, lessons: results };
      }),
    );

    const certificates = await myCertificates().catch(() => []);
    const data = {
      exportedAt: new Date().toISOString(),
      account: {
        name: publicUser.name,
        email: user?.email ?? null,
        premium: isPremiumUser(publicUser),
      },
      learners,
      certificates,
      settings: settings.toJSON(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    downloadBlob(
      blob,
      exportFilename(
        "account",
        publicUser.name,
        "json",
        formatStamp(Date.now()),
      ),
    );
    setExporting(false);
  };

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="account.prefs.privacy"
          defaultMessage="Privacy & data"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.analytics"
              defaultMessage="Anonymous usage analytics"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.analytics.sub"
              defaultMessage="Helps us improve KeyLearn. No typing content is ever sent."
            />
          </span>
        </div>
        <Toggle
          on={settings.get(accountProps.analytics)}
          onChange={(v) =>
            updateSettings(settings.set(accountProps.analytics, v))
          }
        />
      </div>

      <div className={styles.hr} />

      <div className={styles.miniRow}>
        <span>
          <FormattedMessage
            id="account.prefs.export"
            defaultMessage="Export my data"
          />
        </span>
        <button
          className={styles.subtleBtn}
          disabled={exporting}
          onClick={() => {
            void exportData();
          }}
        >
          {exporting ? (
            <FormattedMessage
              id="account.prefs.export.working"
              defaultMessage="Gathering…"
            />
          ) : (
            <FormattedMessage
              id="account.prefs.export.action"
              defaultMessage="Download"
            />
          )}
        </button>
      </div>
    </div>
  );
}
