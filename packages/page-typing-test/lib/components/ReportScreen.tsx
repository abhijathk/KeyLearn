import { makeAccuracyDistribution, makeSpeedDistribution } from "@keybr/chart";
import { useIntlNumbers } from "@keybr/intl";
import { useFormatter } from "@keybr/lesson-ui";
import { Screen } from "@keybr/pages-shared";
import { formatDuration, Kbd, useHotkeys, useView } from "@keybr/widget";
import { FormattedMessage } from "react-intl";
import { type TestResult } from "../session/index.ts";
import { views } from "../views.tsx";
import { Replay } from "./Replay.tsx";
import {
  PopulationChart,
  RollingSpeedChart,
  TimeToTypeChart,
} from "./report-charts.tsx";
import * as styles from "./road.module.less";

export function ReportScreen({ result }: { result: TestResult }) {
  const { setView } = useView(views);
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { speedUnit, formatSpeed } = useFormatter();

  const handleNext = () => setView("test");

  useHotkeys({
    ["Enter"]: handleNext,
  });

  const { time, speed, length, errors, accuracy } = result.stats;

  const dSpeed = makeSpeedDistribution();
  const dAccuracy = makeAccuracyDistribution();
  const pSpeed = dSpeed.cdf(speed);
  const pAccuracy = dAccuracy.cdf(dAccuracy.scale(accuracy));

  return (
    <Screen>
      <div className={styles.col}>
        <div className={styles.heroRow}>
          <div className={styles.heroCell}>
            <div className={styles.heroLab}>
              <FormattedMessage id="t_Speed" defaultMessage="Speed" />
            </div>
            <div className={`${styles.hero} ${styles.heroAccent}`}>
              {formatSpeed(speed, { unit: false })}
              <i>{speedUnit.id}</i>
            </div>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroCell}>
            <div className={styles.heroLab}>
              <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
            </div>
            <div className={styles.hero}>
              {formatNumber(accuracy * 100, 2)}
              <i>%</i>
            </div>
          </div>
        </div>

        <div className={`${styles.whisper} ${styles.whisperCenter}`}>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="typingTest.report.characters"
                defaultMessage="Characters"
              />
            </span>
            {formatNumber(length)}
          </span>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="typingTest.report.errors"
                defaultMessage="Errors"
              />
            </span>
            {formatNumber(errors)}
          </span>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="typingTest.report.time"
                defaultMessage="Time"
              />
            </span>
            {formatDuration(time, { showMillis: true })}
          </span>
        </div>

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.compared"
            defaultMessage="Compared to everyone"
          />
        </div>
        <div className={styles.histPair}>
          <div className={styles.hist}>
            <PopulationChart
              distribution={dSpeed}
              value={speed}
              valueLabel={`you ${formatSpeed(speed, { unit: false })}`}
              loLabel="0"
              hiLabel={formatSpeed(dSpeed.length - 1)}
            />
            <div className={styles.legendRow}>
              <FormattedMessage
                id="typingTest.report.fasterThan"
                defaultMessage="faster than {percent} of all other people — the top {top}"
                values={{
                  percent: <b>{formatPercents(pSpeed)}</b>,
                  top: <b>{formatPercents(top(pSpeed))}</b>,
                }}
              />
            </div>
          </div>
          <div className={styles.hist}>
            <PopulationChart
              distribution={dAccuracy}
              value={dAccuracy.scale(accuracy)}
              valueLabel={`you ${formatNumber(accuracy * 100, 1)}%`}
              loLabel="0%"
              hiLabel="100%"
            />
            <div className={styles.legendRow}>
              <FormattedMessage
                id="typingTest.report.moreAccurateThan"
                defaultMessage="more accurate than {percent} of all other people — the top {top}"
                values={{
                  percent: <b>{formatPercents(pAccuracy)}</b>,
                  top: <b>{formatPercents(top(pAccuracy))}</b>,
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.overTheTest"
            defaultMessage="Speed over the test"
          />
        </div>
        <div className={styles.hist}>
          <RollingSpeedChart
            steps={result.steps}
            averageSpeed={speed}
            formatSpeed={(value) => formatSpeed(value, { unit: false })}
          />
          <div className={styles.legendRow}>
            <FormattedMessage
              id="typingTest.report.overTheTestLegend"
              defaultMessage="your speed as the test went on — the dashed line is your average"
            />
          </div>
        </div>

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.timePerChar"
            defaultMessage="Time per character"
          />
        </div>
        <div className={styles.hist}>
          <TimeToTypeChart steps={result.steps} />
          <div className={styles.legendRow}>
            <FormattedMessage
              id="typingTest.report.timePerCharLegend"
              defaultMessage="how long each character took — shorter bars to the left mean faster fingers"
            />
          </div>
        </div>

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.replay"
            defaultMessage="Watch the replay"
          />
        </div>
        <div className={styles.replayWrap}>
          <Replay result={result} />
        </div>

        <div className={styles.nextRow}>
          <button type="button" className={styles.nextBtn} onClick={handleNext}>
            <FormattedMessage
              id="typingTest.report.nextTest"
              defaultMessage="Next test"
            />
          </button>
        </div>
        <div className={styles.legendRow}>
          <FormattedMessage
            id="typingTest.report.pressEnter"
            defaultMessage="press {key} to start a new test"
            values={{ key: <Kbd>Enter</Kbd> }}
          />
        </div>
      </div>
    </Screen>
  );
}

function top(value: number) {
  return Math.max(0, 1 - value); // Takes care of negative zero.
}
