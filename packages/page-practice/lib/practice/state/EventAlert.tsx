import { Key } from "@keybr/lesson-ui";
import { Award, toast } from "@keybr/widget";
import { FormattedMessage } from "react-intl";
import { DailyGoalIcon, TrophyIcon } from "./event-icons.tsx";
import { type LessonEvent } from "./event-types.ts";

export function EventAlert({ event }: { readonly event: LessonEvent }) {
  switch (event.type) {
    case "new-letter":
      return (
        <Award icon={<Key lessonKey={event.lessonKey} size="announcement" />}>
          <FormattedMessage
            id="t_ev_New_letter_unlocked"
            defaultMessage="You unlocked a new letter!"
          />
        </Award>
      );
    case "top-speed":
      return (
        <Award icon={<TrophyIcon />}>
          <FormattedMessage id="t_ev_Top_speed" defaultMessage="New top speed!" />
        </Award>
      );
    case "top-score":
      return (
        <Award icon={<TrophyIcon />}>
          <FormattedMessage id="t_ev_Top_score" defaultMessage="New top score!" />
        </Award>
      );
    case "top-consistency":
      return (
        <Award icon={<TrophyIcon />}>
          <FormattedMessage
            id="t_ev_Top_consistency"
            defaultMessage="Smoothest run yet!"
          />
        </Award>
      );
    case "top-accuracy":
      return (
        <Award icon={<TrophyIcon />}>
          <FormattedMessage
            id="t_ev_Top_accuracy"
            defaultMessage="Best accuracy yet!"
          />
        </Award>
      );
    case "beat-last-run":
      return (
        <Award icon={<TrophyIcon />}>
          <FormattedMessage
            id="t_ev_Beat_last_run"
            defaultMessage="You beat your last run!"
          />
        </Award>
      );
    case "near-last-run":
      return (
        <Award icon={<TrophyIcon />}>
          <FormattedMessage
            id="t_ev_Near_last_run"
            defaultMessage="So close — keep going!"
          />
        </Award>
      );
    case "daily-goal":
      return (
        <Award icon={<DailyGoalIcon />}>
          <FormattedMessage
            id="t_ev_Daily_goal_reached"
            defaultMessage="You hit your daily goal!"
          />
        </Award>
      );
  }
}

export function displayEvent(event: LessonEvent): void {
  toast(<EventAlert event={event} />, {
    autoClose: 3000,
    closeOnClick: true,
    pauseOnHover: true,
  });
}
