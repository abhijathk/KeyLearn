import {
  allLocales,
  defaultLocale,
  useIntlDates,
  useIntlDisplayNames,
} from "@keybr/intl";
import {
  downloadBlob,
  exportFilename,
  isPremiumUser,
  Pages,
  usePageData,
} from "@keybr/pages-shared";
import { SpeedUnit, uiProps } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { useTheme } from "@keybr/themes";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./AccountPage.module.less";
import { Segmented, Toggle } from "./controls.tsx";
import { accountProps, allTimeZones, deviceTimeZone } from "./prefs.ts";

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
      <AppearanceCard />
      <PrivacyCard />
    </div>
  );
}

function LanguageRegionCard(): ReactNode {
  const { locale } = usePageData();
  const { formatLocalLanguageName } = useIntlDisplayNames();
  const { settings, updateSettings } = useSettings();
  const timeZone = settings.get(accountProps.timeZone) || deviceTimeZone();
  const weekStart = settings.get(accountProps.weekStart);

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
              defaultMessage="Sets when your day rolls over for streaks and goals."
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
  const { settings, updateSettings } = useSettings();
  const speedUnit = settings.get(uiProps.speedUnit).id;

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="account.prefs.appearance"
          defaultMessage="Appearance"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage id="account.prefs.theme" defaultMessage="Theme" />
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

function PrivacyCard(): ReactNode {
  const { formatStamp } = useIntlDates();
  const { settings, updateSettings } = useSettings();
  const { user, publicUser, profiles } = usePageData();

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      account: {
        name: publicUser.name,
        email: user?.email ?? null,
        premium: isPremiumUser(publicUser),
      },
      profiles: profiles ?? [],
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
        <button className={styles.subtleBtn} onClick={exportData}>
          <FormattedMessage
            id="account.prefs.export.action"
            defaultMessage="Download"
          />
        </button>
      </div>
    </div>
  );
}
