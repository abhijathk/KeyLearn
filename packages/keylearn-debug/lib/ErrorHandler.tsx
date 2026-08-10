import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { ErrorScreen } from "./ErrorScreen.tsx";
import { catchError, silentCatchError } from "./logger.ts";

type Props = {
  readonly children?: ReactNode;
  readonly display?: ComponentType<{ readonly report: string }>;
};

type State = {
  readonly report: string | null;
  /** True when the children themselves crashed while rendering — they
   * cannot be kept on screen behind the error card. */
  readonly renderCrash: boolean;
};

export class ErrorHandler extends Component<Props, State> {
  override state: State = {
    report: null,
    renderCrash: false,
  };

  override componentDidMount() {
    catchError.addHandler(this.setError);
    if (process.env.NODE_ENV !== "production") {
      // Dev-only: lets the crash screen be exercised from the console
      // (`window.dispatchEvent(new CustomEvent("keylearn:debug-crash"))`)
      // without having to break something real. Stripped from production.
      window.addEventListener("keylearn:debug-crash", this.debugCrash);
    }
  }

  override componentWillUnmount() {
    catchError.deleteHandler(this.setError);
    if (process.env.NODE_ENV !== "production") {
      window.removeEventListener("keylearn:debug-crash", this.debugCrash);
    }
  }

  debugCrash = () => {
    silentCatchError(new Error("Debug crash (keylearn:debug-crash)"));
  };

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ renderCrash: true });
    silentCatchError(error);
  }

  setError = (report: string) => {
    this.setState({ report });
  };

  override render() {
    const { children, display: Display = ErrorScreen } = this.props;
    const { report, renderCrash } = this.state;
    if (report != null) {
      // A healthy page stays on screen, dimmed under the floating card, so
      // the learner keeps their context. Only when the page itself crashed
      // while rendering does the card stand alone on the theme's own ground
      // — re-rendering a crashed subtree would just throw again.
      if (renderCrash) {
        return <Display report={report} />;
      }
      return (
        <>
          {children}
          <Display report={report} />
        </>
      );
    } else {
      return children;
    }
  }
}
