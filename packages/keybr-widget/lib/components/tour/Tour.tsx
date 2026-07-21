import { Children, type ReactElement, type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { useHotkeys } from "../../hooks/use-hotkeys.ts";
import { LinkButton } from "../button/LinkButton.tsx";
import { StrokeIcon } from "../icon/StrokeIcon.tsx";
import { Backdrop } from "../popup/Backdrop.tsx";
import { Popup } from "../popup/Popup.tsx";
import { Spotlight } from "../popup/Spotlight.tsx";
import { Portal } from "../portal/Portal.tsx";
import { Meter } from "./Meter.tsx";
import { Slide, type SlideProps } from "./Slide.tsx";
import * as styles from "./Tour.module.less";

export type TourProps = {
  readonly children?: readonly ReactElement<SlideProps>[];
  readonly onClose?: () => void;
};

export function Tour({ children, onClose, ...props }: TourProps): ReactNode {
  const { formatMessage } = useIntl();

  const [slideIndex, setSlideIndex] = useState(0);

  const slides = Children.toArray(children) as ReactElement<SlideProps>[];
  const { length } = slides;
  if (length > 0 && slideIndex > length - 1) {
    setSlideIndex(length - 1);
  }
  if (length > 0 && slideIndex < 0) {
    setSlideIndex(0);
  }
  const currentSlide =
    slideIndex >= 0 && slideIndex < length ? slides[slideIndex] : <Slide />;

  const selectPrev = () => {
    if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
    }
  };

  const selectNext = () => {
    if (slideIndex < length - 1) {
      setSlideIndex(slideIndex + 1);
    }
  };

  const close = () => {
    onClose?.();
  };

  useHotkeys({
    ["ArrowLeft"]: selectPrev,
    ["ArrowUp"]: selectPrev,
    ["PageUp"]: selectPrev,
    ["Backspace"]: selectPrev,
    ["ArrowRight"]: selectNext,
    ["ArrowDown"]: selectNext,
    ["PageDown"]: selectNext,
    ["Space"]: selectNext,
    ["Escape"]: close,
  });

  const { anchor, position } = currentSlide.props;
  // Guard against a slide pointing at an element that isn't on the page: fall
  // back to a centred slide instead of crashing when the anchor can't be found.
  const anchorFound =
    anchor != null &&
    typeof document !== "undefined" &&
    document.querySelector(anchor) != null;
  const liveAnchor = anchorFound ? anchor : undefined;
  const first = slideIndex === 0;
  const last = slideIndex === length - 1;

  return (
    <Portal>
      <Backdrop>
        {liveAnchor ? (
          <Spotlight anchor={liveAnchor} />
        ) : (
          <div className={styles.dim} />
        )}

        <div className={styles.scope}>
          <Popup {...props} anchor={liveAnchor} position={position} offset={30}>
            <div className={styles.card} key={slideIndex}>
              <div className={styles.header}>
                <span className={styles.badge}>
                  <StrokeIcon name="keyboard" />
                </span>
                <span className={styles.kicker}>
                  {formatMessage({
                    id: "tour.kicker",
                    defaultMessage: "Quick tour",
                  })}
                </span>
                <span className={styles.counter}>
                  <b>{slideIndex + 1}</b>
                  <i>/{length}</i>
                </span>
                <LinkButton
                  className={styles.close}
                  onClick={close}
                  title={formatMessage({
                    id: "t_Close",
                    defaultMessage: "Dismiss",
                  })}
                >
                  <StrokeIcon name="close" />
                </LinkButton>
              </div>

              <div className={styles.body}>{currentSlide}</div>

              <div className={styles.footer}>
                <Meter length={slides.length} slideIndex={slideIndex} />

                <div className={styles.actions}>
                  {!first && (
                    <LinkButton className={styles.prev} onClick={selectPrev}>
                      {formatMessage({
                        id: "t_Previous",
                        defaultMessage: "Back",
                      })}
                    </LinkButton>
                  )}

                  {last ? (
                    <LinkButton className={styles.next} onClick={close}>
                      {formatMessage({
                        id: "tour.finish",
                        defaultMessage: "Start typing",
                      })}
                    </LinkButton>
                  ) : (
                    <LinkButton className={styles.next} onClick={selectNext}>
                      {formatMessage({
                        id: "t_Next",
                        defaultMessage: "Continue",
                      })}
                    </LinkButton>
                  )}
                </div>
              </div>
            </div>
          </Popup>
        </div>
      </Backdrop>
    </Portal>
  );
}
