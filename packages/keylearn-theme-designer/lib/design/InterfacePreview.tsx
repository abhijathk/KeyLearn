import { useIntlNumbers } from "@keylearn/intl";
import { useFormatter } from "@keylearn/lesson-ui";
import { NameValue, Para, Value } from "@keylearn/widget";

export function InterfacePreview() {
  const { formatInteger, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  return (
    <>
      <Para align="center">
        <NameValue name="Speed" value={formatSpeed(500)} />
        <NameValue name="Accuracy" value={formatPercents(0.9999)} />
        <NameValue name="Score" value={formatInteger(9999)} />
      </Para>
      <Para align="center">
        <NameValue
          name="Increased value"
          value={<Value value={formatSpeed(50)} delta={+10} />}
        />
        <NameValue
          name="Decreased value"
          value={<Value value={formatSpeed(50)} delta={-10} />}
        />
      </Para>
    </>
  );
}
