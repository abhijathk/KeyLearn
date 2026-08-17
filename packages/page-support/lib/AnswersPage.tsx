import {
  type AnswerDetails,
  type AnswerRuleDetails,
} from "@keylearn/pages-shared";
import { Button, confirmStyles as dlg, TextField } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AnswersPage.module.less";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { SupportService } from "./service.ts";

export function AnswersPage(): ReactNode {
  return (
    <DeskShell active="answers">
      <Answers />
    </DeskShell>
  );
}

function solvedRate(a: {
  readonly hitCount: number;
  readonly solvedCount: number;
}): number {
  return a.hitCount === 0 ? 0 : Math.round((a.solvedCount / a.hitCount) * 100);
}

function reopenedRate(a: {
  readonly hitCount: number;
  readonly reopenedCount: number;
}): number {
  return a.hitCount === 0
    ? 0
    : Math.round((a.reopenedCount / a.hitCount) * 100);
}

function Answers(): ReactNode {
  const [answers, setAnswers] = useState<AnswerDetails[] | null>(null);
  const [rules, setRules] = useState<AnswerRuleDetails[] | null>(null);
  const [modal, setModal] = useState<"article" | "rule" | null>(null);

  const loadAnswers = () => {
    SupportService.listAllAnswers().then((rows) =>
      setAnswers([...rows].sort((a, b) => b.hitCount - a.hitCount)),
    );
  };
  const loadRules = () => {
    SupportService.listRules().then(setRules);
  };

  useEffect(loadAnswers, []);
  useEffect(loadRules, []);

  return (
    <>
      <p className={common.micro}>
        <FormattedMessage
          id="deskAnswers.articles.title"
          defaultMessage="Articles · sorted by how often they were the answer"
        />
      </p>
      <div className={styles.answers}>
        {answers == null && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.loading"
              defaultMessage="Loading…"
            />
          </p>
        )}
        {answers != null && answers.length === 0 && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.empty"
              defaultMessage="Nothing here."
            />
          </p>
        )}
        {answers?.map((a, i) => (
          <div className={styles.answer} key={a.id}>
            <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ minInlineSize: 0 }}>
              <span className={styles.answerTitle}>{a.title}</span>
              <span className={styles.answerSub}>
                {a.published ? (
                  <FormattedMessage
                    id="deskAnswers.published"
                    defaultMessage="Published · last edited {date}"
                    values={{
                      date: new Date(a.updatedAt).toLocaleDateString(),
                    }}
                  />
                ) : (
                  <FormattedMessage
                    id="deskAnswers.draft"
                    defaultMessage="Draft · last edited {date}"
                    values={{
                      date: new Date(a.updatedAt).toLocaleDateString(),
                    }}
                  />
                )}
              </span>
            </span>
            <span className={styles.hit}>
              <FormattedMessage
                id="deskAnswers.hitRate"
                defaultMessage="{hits} · solved {rate}% · reopened {reopenRate}%"
                values={{
                  hits: a.hitCount,
                  rate: solvedRate(a),
                  reopenRate: reopenedRate(a),
                }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className={common.split}>
        <div>
          <p className={common.micro}>
            <FormattedMessage
              id="deskAnswers.rules.title"
              defaultMessage="Rules — when an answer sends itself"
            />
          </p>
          <div className={styles.answers}>
            {rules == null && (
              <p className={common.note}>
                <FormattedMessage
                  id="staffDesk.loading"
                  defaultMessage="Loading…"
                />
              </p>
            )}
            {rules != null && rules.length === 0 && (
              <p className={common.note}>
                <FormattedMessage
                  id="staffDesk.empty"
                  defaultMessage="Nothing here."
                />
              </p>
            )}
            {rules?.map((r) => (
              <div
                className={clsx(
                  styles.rule,
                  r.suggestOnly && styles.ruleSuggestOnly,
                )}
                key={r.id}
              >
                <span className={styles.ruleWhen}>
                  {r.keywords
                    .split(/[\n,]/)
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className={styles.ruleArrow}>→</span>
                <span>
                  {r.answer?.title ?? `#${r.answerId}`}
                  {r.suggestOnly && (
                    <>
                      {" "}
                      <span className={common.chip}>
                        <FormattedMessage
                          id="deskAnswers.suggestOnly"
                          defaultMessage="suggest only"
                        />
                      </span>
                    </>
                  )}
                </span>
                <span className={styles.ruleHits}>
                  <FormattedMessage
                    id="deskAnswers.rule.fired"
                    defaultMessage="fired {n} · {rate}% solved · {reopenRate}% reopened"
                    values={{
                      n: r.firedCount,
                      rate:
                        r.firedCount === 0
                          ? 0
                          : Math.round((r.solvedCount / r.firedCount) * 100),
                      reopenRate:
                        r.firedCount === 0
                          ? 0
                          : Math.round((r.reopenedCount / r.firedCount) * 100),
                    }}
                  />
                </span>
              </div>
            ))}
          </div>

          <div className={common.btnRow}>
            <button
              type="button"
              className={clsx(common.btn, common.primary)}
              onClick={() => setModal("article")}
            >
              <FormattedMessage
                id="deskAnswers.newArticle"
                defaultMessage="New article"
              />
            </button>
            <button
              type="button"
              className={clsx(common.btn, common.ghost)}
              onClick={() => setModal("rule")}
              disabled={answers == null || answers.length === 0}
            >
              <FormattedMessage
                id="deskAnswers.newRule"
                defaultMessage="New rule"
              />
            </button>
          </div>
        </div>

        <div>
          <div
            className={clsx(common.card, common.cardWarn)}
            style={{ marginBlockStart: 0 }}
          >
            <p className={clsx(common.micro, common.microWarn)}>
              <FormattedMessage
                id="deskAnswers.bottomTitle"
                defaultMessage="Read the bottom of this list, not the top"
              />
            </p>
            <p className={common.note}>
              <FormattedMessage
                id="deskAnswers.bottomBody1"
                defaultMessage="An article that solves the problem rarely is not a bad article — it's a bad app behaviour. When people keep landing on the same answer without it working, the fix belongs in the app, not in a better paragraph."
              />
            </p>
            <p className={common.noteSmall}>
              <FormattedMessage
                id="deskAnswers.bottomBody2"
                defaultMessage="So low-solving rules are suggest-only. An article that doesn't solve things isn't allowed to answer on its own, and the low score stays visible instead of being tuned away."
              />
            </p>
          </div>

          <div className={common.card}>
            <p className={common.micro}>
              <FormattedMessage
                id="deskAnswers.matching.title"
                defaultMessage="Matching, honestly"
              />
            </p>
            <p className={common.note}>
              <FormattedMessage
                id="deskAnswers.matching.body"
                defaultMessage="Keyword and phrase matching over the message text — no model, nothing sent anywhere, and it runs on the server in about a millisecond. Simple matching you can read and correct beats a clever one you can't explain to somebody who got the wrong answer."
              />
            </p>
          </div>
        </div>
      </div>

      {modal === "article" && (
        <NewArticleDialog
          onClose={() => setModal(null)}
          onCreated={() => {
            loadAnswers();
            setModal(null);
          }}
        />
      )}
      {modal === "rule" && answers != null && (
        <NewRuleDialog
          answers={answers}
          onClose={() => setModal(null)}
          onCreated={() => {
            loadRules();
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function NewArticleDialog({
  onClose,
  onCreated,
}: {
  readonly onClose: () => void;
  readonly onCreated: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);

  const ready = title.trim() !== "" && body.trim() !== "";

  return (
    <div
      className={dlg.scrim}
      role="presentation"
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className={dlg.dialog} role="dialog" aria-modal={true}>
        <h2 className={dlg.title}>
          <FormattedMessage
            id="deskAnswers.newArticle"
            defaultMessage="New article"
          />
        </h2>
        <TextField
          size="full"
          type="text"
          maxLength={128}
          placeholder={formatMessage({
            id: "deskAnswers.form.title",
            defaultMessage: "Title",
          })}
          value={title}
          onChange={setTitle}
        />
        <TextField
          size="full"
          type="textarea"
          rows={6}
          maxLength={4000}
          placeholder={formatMessage({
            id: "deskAnswers.form.body",
            defaultMessage: "Body",
          })}
          value={body}
          onChange={setBody}
        />
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={published}
            onChange={(ev) => setPublished(ev.target.checked)}
          />
          <FormattedMessage
            id="deskAnswers.form.published"
            defaultMessage="Published"
          />
        </label>
        <div className={dlg.actions}>
          <button
            className={clsx(dlg.btn, dlg.cancel)}
            onClick={onClose}
            type="button"
          >
            <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
          </button>
          <Button
            label={formatMessage({
              id: "deskAnswers.form.save",
              defaultMessage: "Save",
            })}
            disabled={!ready || busy}
            onClick={() => {
              setBusy(true);
              SupportService.createAnswer({
                title: title.trim(),
                body: body.trim(),
                published,
              })
                .then(onCreated)
                .finally(() => setBusy(false));
            }}
          />
        </div>
      </div>
    </div>
  );
}

function NewRuleDialog({
  answers,
  onClose,
  onCreated,
}: {
  readonly answers: readonly AnswerDetails[];
  readonly onClose: () => void;
  readonly onCreated: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [answerId, setAnswerId] = useState<number>(answers[0]?.id ?? 0);
  const [keywords, setKeywords] = useState("");
  const [suggestOnly, setSuggestOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = keywords.trim() !== "" && answerId > 0;

  return (
    <div
      className={dlg.scrim}
      role="presentation"
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className={dlg.dialog} role="dialog" aria-modal={true}>
        <h2 className={dlg.title}>
          <FormattedMessage
            id="deskAnswers.newRule"
            defaultMessage="New rule"
          />
        </h2>
        <select
          className={styles.select}
          value={answerId}
          onChange={(ev) => setAnswerId(Number(ev.target.value))}
        >
          {answers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <TextField
          size="full"
          type="textarea"
          rows={3}
          maxLength={1000}
          placeholder={formatMessage({
            id: "deskAnswers.form.keywords",
            defaultMessage: "Keywords or phrases, one per line",
          })}
          value={keywords}
          onChange={setKeywords}
        />
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={suggestOnly}
            onChange={(ev) => setSuggestOnly(ev.target.checked)}
          />
          <FormattedMessage
            id="deskAnswers.form.suggestOnly"
            defaultMessage="Suggest only — never sends itself automatically"
          />
        </label>
        <div className={dlg.actions}>
          <button
            className={clsx(dlg.btn, dlg.cancel)}
            onClick={onClose}
            type="button"
          >
            <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
          </button>
          <Button
            label={formatMessage({
              id: "deskAnswers.form.save",
              defaultMessage: "Save",
            })}
            disabled={!ready || busy}
            onClick={() => {
              setBusy(true);
              SupportService.createRule({
                answerId,
                keywords: keywords.trim(),
                suggestOnly,
              })
                .then(onCreated)
                .finally(() => setBusy(false));
            }}
          />
        </div>
      </div>
    </div>
  );
}
