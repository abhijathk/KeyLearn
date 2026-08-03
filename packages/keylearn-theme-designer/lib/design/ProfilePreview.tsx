import { EffortLegend, useEffort } from "@keylearn/lesson-ui";
import { Box } from "@keylearn/widget";

export function ProfilePreview() {
  const effort = useEffort();
  return (
    <Box alignItems="center" justifyContent="center">
      <div>
        <EffortLegend effort={effort} />
      </div>
    </Box>
  );
}
