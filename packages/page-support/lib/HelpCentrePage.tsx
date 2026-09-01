import { Pages } from "@keylearn/pages-shared";
import { TextField } from "@keylearn/widget";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink } from "react-router";
import * as styles from "./HelpCentrePage.module.less";
import { type HelpArticle, SupportService } from "./service.ts";

/**
 * The help centre — the same articles the support assistant answers
 * from, published for people to read themselves.
 *
 * One library, not two: staff write an article once in the desk, and it
 * both grounds the assistant's replies and appears here. An answer that
 * differs between the two would be worse than having no page at all.
 */
export function HelpCentrePage(): ReactNode {
  const { formatMessage } = useIntl();
  const [articles, setArticles] = useState<readonly HelpArticle[] | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    SupportService.listHelpArticles()
      .then((r) => {
        if (live) {
          setArticles(r);
        }
      })
      .catch(() => {
        if (live) {
          setArticles([]);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (articles == null) {
      return [];
    }
    if (q === "") {
      return articles;
    }
    // Substring over title and body — the library is small enough that
    // anything cleverer would only be harder to explain when it puts the
    // wrong article first.
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q),
    );
  }, [articles, query]);

  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        <FormattedMessage id="helpCentre.headline" defaultMessage="Help" />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="helpCentre.intro"
          defaultMessage="Answers to the things people ask us most. Can’t find it here? Send us a message and a person will read it."
        />
      </p>

      <div className={styles.search}>
        <TextField
          value={query}
          placeholder={formatMessage({
            id: "helpCentre.search",
            defaultMessage: "Search help…",
          })}
          onChange={setQuery}
        />
      </div>

      {articles == null && (
        <p className={styles.note}>
          <FormattedMessage id="helpCentre.loading" defaultMessage="Loading…" />
        </p>
      )}

      {articles != null && articles.length === 0 && (
        <p className={styles.note}>
          <FormattedMessage
            id="helpCentre.empty"
            defaultMessage="Nothing here yet. Send us a message and we’ll answer it — and add it here for whoever asks next."
          />
        </p>
      )}

      {articles != null && articles.length > 0 && matches.length === 0 && (
        <p className={styles.note}>
          <FormattedMessage
            id="helpCentre.noMatch"
            defaultMessage="Nothing matched that. Try a different word, or just ask us."
          />
        </p>
      )}

      <div className={styles.list}>
        {matches.map((a) => (
          <article className={styles.item} key={a.id}>
            <button
              type="button"
              className={styles.itemHead}
              aria-expanded={openId === a.id}
              onClick={() => setOpenId((id) => (id === a.id ? null : a.id))}
            >
              <span className={styles.itemTitle}>{a.title}</span>
              <span className={styles.chevron} aria-hidden={true}>
                {openId === a.id ? "−" : "+"}
              </span>
            </button>
            {openId === a.id && <p className={styles.itemBody}>{a.body}</p>}
          </article>
        ))}
      </div>

      <p className={styles.footer}>
        <FormattedMessage
          id="helpCentre.stillStuck"
          defaultMessage="Still stuck?"
        />{" "}
        <RouterLink to={Pages.support.path}>
          <FormattedMessage
            id="helpCentre.contact"
            defaultMessage="Send us a message"
          />
        </RouterLink>
      </p>
    </div>
  );
}
