import { type LessonKeys } from "@keylearn/lesson";
import { type ClassName, styleTextTruncate } from "@keylearn/widget";
import { FormattedMessage } from "react-intl";
import { Key } from "./Key.tsx";
import { KeyDetails } from "./KeyDetails.tsx";

export const CurrentKey = ({
  id,
  className,
  lessonKeys,
}: {
  id?: string;
  className?: ClassName;
  lessonKeys: LessonKeys;
}) => {
  const focusedKey = lessonKeys.findFocusedKey();
  return (
    <span id={id} className={className}>
      {focusedKey != null ? (
        <>
          <Key lessonKey={focusedKey} /> <KeyDetails lessonKey={focusedKey} />
        </>
      ) : (
        <span className={styleTextTruncate}>
          <FormattedMessage
            id="t_All_keys_are_unlocked"
            defaultMessage="Every key is unlocked."
          />
        </span>
      )}
    </span>
  );
};
