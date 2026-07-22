import { lazy, Suspense, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "../road.module.less";

const LazyCustomLayoutDesigner = lazy(
  () => import("./LazyCustomLayoutDesigner.tsx"),
);

export function CustomLayoutDesignerToggler() {
  const [visible, setVisible] = useState(false);
  if (visible) {
    return (
      <Suspense>
        <LazyCustomLayoutDesigner />
      </Suspense>
    );
  } else {
    return (
      <div className={styles.designerRow}>
        <button
          type="button"
          className={styles.designerBtn}
          onClick={() => {
            setVisible(true);
          }}
        >
          <FormattedMessage
            id="layouts.road.designCustom"
            defaultMessage="Design a custom layout"
          />
        </button>
      </div>
    );
  }
}
