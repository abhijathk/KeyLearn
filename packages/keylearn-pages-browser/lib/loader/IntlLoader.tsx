import { catchError } from "@keylearn/debug";
import { loadIntl } from "@keylearn/intl";
import { LoadingProgress, usePageData } from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useState } from "react";
import { type IntlShape, RawIntlProvider } from "react-intl";

export function IntlLoader({
  children,
  fallback = <LoadingProgress />,
}: {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}) {
  const result = useIntlLoader();
  if (result == null) {
    return fallback;
  } else {
    return <RawIntlProvider value={result}>{children}</RawIntlProvider>;
  }
}

export function useIntlLoader(): IntlShape | null {
  const { locale } = usePageData();
  const [intl, setIntl] = useState<IntlShape | null>(null);

  useEffect(() => {
    let didCancel = false;

    loadIntl(locale)
      .then((intl) => {
        if (!didCancel) {
          setIntl(intl);
        }
      })
      .catch(catchError);

    return () => {
      didCancel = true;
    };
  }, [locale]);

  return intl;
}
