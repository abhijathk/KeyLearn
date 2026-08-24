import { SupportService, useCaptcha } from "@keylearn/page-support";
import { Pages } from "@keylearn/pages-shared";
import { Button, TextField } from "@keylearn/widget";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./ForSchoolsPage.module.less";

/**
 * The one organisation surface a visitor can find on their own — spec §8.
 *
 * Everything else in the tier is invite-only and unreachable without a
 * token. This is the exception, and it has to exist: a coordinator who
 * has never heard of us needs somewhere to land, read, and ask.
 *
 * It is an information page with an enquiry form. Deliberately NOT a
 * second way to sign in — there is no organisation login, and adding a
 * button here would quietly invent one.
 */
export function ForSchoolsPage(): ReactNode {
  return (
    <div className={styles.paper}>
      <header>
        <h1 className={styles.nameplate}>
          <FormattedMessage
            id="forSchools.nameplate"
            defaultMessage="KeyLearn <em>for schools</em>"
            values={{
              em: (chunks) => <em className={styles.em}>{chunks}</em>,
            }}
          />
        </h1>
        <p className={styles.lede}>
          <FormattedMessage
            id="forSchools.lede"
            defaultMessage="Your school gets classes and reports. The families keep their children's accounts — that is the design, not a setting. Community and non-profit schools use the whole thing free."
          />
        </p>
      </header>

      <Promises />
      <Audiences />
      <Pricing />
      <DomainRule />
      <Enquiry />
    </div>
  );
}

/** The four things worth promising before anyone fills in a form. */
function Promises(): ReactNode {
  const promises = [
    {
      title: (
        <FormattedMessage
          id="forSchools.p1.title"
          defaultMessage="Your school gets classes; the families keep their children"
        />
      ),
      body: (
        <FormattedMessage
          id="forSchools.p1.body"
          defaultMessage="A teacher sees their class's progress because each parent said yes — one tap, on their own account. The profile stays with the family, the history stays with the family, and a parent can end it whenever they like."
        />
      ),
    },
    {
      title: (
        <FormattedMessage
          id="forSchools.p2.title"
          defaultMessage="Nobody signs up — everybody is invited"
        />
      ),
      body: (
        <FormattedMessage
          id="forSchools.p2.body"
          defaultMessage="You invite your teachers; your teachers invite their parents. Each invite is single-use and expires. There is no public door into your school's data, because there is no public door at all."
        />
      ),
    },
    {
      title: (
        <FormattedMessage
          id="forSchools.p3.title"
          defaultMessage="Children at school are children first"
        />
      ),
      body: (
        <FormattedMessage
          id="forSchools.p3.body"
          defaultMessage="No ads, no public leaderboards, no behavioural analytics — the same protections the family product applies, by default rather than by configuration. Every staff look at an individual learner is recorded, and you can read that log."
        />
      ),
    },
    {
      title: (
        <FormattedMessage
          id="forSchools.p4.title"
          defaultMessage="If the invoice is late, no child is stopped"
        />
      ),
      body: (
        <FormattedMessage
          id="forSchools.p4.body"
          defaultMessage="A lapsed licence makes the staff screens read-only. It never interrupts a lesson, never locks a learner out, and never deletes anything. Sunday afternoon is not the moment to discover a billing problem."
        />
      ),
    },
  ];
  return (
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage id="forSchools.what" defaultMessage="What it says" />
      </h2>
      <ol className={styles.rules}>
        {promises.map((promise, index) => (
          <li key={index} className={styles.rule}>
            <span className={styles.ruleNumber}>{index + 1}</span>
            <div>
              <h3 className={styles.ruleTitle}>{promise.title}</h3>
              <p className={styles.ruleBody}>{promise.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Audiences(): ReactNode {
  return (
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage id="forSchools.who" defaultMessage="Who it is for" />
      </h2>
      <div className={styles.who}>
        <div className={styles.aud}>
          <div className={styles.audHead}>
            <span className={styles.mark}>
              <svg viewBox="0 0 16 16" aria-hidden={true}>
                <path d="M2 14V6l6-4 6 4v8M6 14V9.5h4V14M2 14h12" />
              </svg>
            </span>
            <b>
              <FormattedMessage
                id="forSchools.who1.title"
                defaultMessage="Weekend and community schools"
              />
            </b>
          </div>
          <p>
            <FormattedMessage
              id="forSchools.who1.body"
              defaultMessage="Volunteer teachers, one hour of prep, a hall with uncertain Wi-Fi. Classes, term reports and printable certificates — and the parents keep their children's accounts."
            />
          </p>
        </div>
        <div className={styles.aud}>
          <div className={styles.audHead}>
            <span className={styles.mark}>
              <svg viewBox="0 0 16 16" aria-hidden={true}>
                <path d="M2.5 4.5h11a1 1 0 011 1v5a1 1 0 01-1 1h-11a1 1 0 01-1-1v-5a1 1 0 011-1zM4.5 9h7M4.5 6.8h.01M7 6.8h.01M9.5 6.8h.01M12 6.8h.01" />
              </svg>
            </span>
            <b>
              <FormattedMessage
                id="forSchools.who2.title"
                defaultMessage="Coaching centres and clubs"
              />
            </b>
          </div>
          <p>
            <FormattedMessage
              id="forSchools.who2.body"
              defaultMessage="Where the centre owns the learner places rather than the families. Batches, learner profiles with a PIN, and progress the whole teaching team can see."
            />
          </p>
        </div>
      </div>
    </section>
  );
}

function Pricing(): ReactNode {
  return (
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage
          id="forSchools.cost"
          defaultMessage="What it costs — plainly"
        />
      </h2>
      <div className={styles.price}>
        <div className={styles.pcol}>
          <p className={styles.tag}>
            <FormattedMessage
              id="forSchools.cost1.tag"
              defaultMessage="Families"
            />
          </p>
          <p className={`${styles.big} ${styles.mint}`}>
            <FormattedMessage
              id="forSchools.cost1.big"
              defaultMessage="Free, forever"
            />
          </p>
          <p>
            <FormattedMessage
              id="forSchools.cost1.body"
              defaultMessage="Every lesson, every language, every learner in the household. That does not change because schools now exist."
            />
          </p>
        </div>
        <div className={styles.pcol}>
          <p className={styles.tag}>
            <FormattedMessage
              id="forSchools.cost2.tag"
              defaultMessage="Community & non-profit"
            />
          </p>
          <p className={`${styles.big} ${styles.mint}`}>
            <FormattedMessage
              id="forSchools.cost2.big"
              defaultMessage="Also free"
            />
          </p>
          <p>
            <FormattedMessage
              id="forSchools.cost2.body"
              defaultMessage="Volunteer-taught community schools, in full — classes, reports, certificates, the lot. Approved by a person, not a form, and it never lapses into read-only."
            />
          </p>
        </div>
        <div className={styles.pcol}>
          <p className={styles.tag}>
            <FormattedMessage
              id="forSchools.cost3.tag"
              defaultMessage="Commercial"
            />
          </p>
          <p className={styles.big}>
            <FormattedMessage
              id="forSchools.cost3.big"
              defaultMessage="Licensed by seat"
            />
          </p>
          <p>
            <FormattedMessage
              id="forSchools.cost3.body"
              defaultMessage="Coaching centres and businesses selling lessons. A seat is one learner place, held while they are enrolled and released the moment they are not."
            />
          </p>
        </div>
      </div>
      <p className={styles.note}>
        <FormattedMessage
          id="forSchools.cost.note"
          defaultMessage="The line between the middle and right columns is not legal status — plenty of community schools are unincorporated, with no charity number and no domain. It is the two questions on the form below: do families pay, and are the teachers volunteers. A person reads the answers."
        />
      </p>
    </section>
  );
}

/**
 * Balakairali's rule, said in public before anyone is invited — so a
 * coordinator learns it while choosing who to invite, rather than from a
 * refusal after the fact.
 */
function DomainRule(): ReactNode {
  const rows = [
    {
      role: (
        <FormattedMessage id="forSchools.role.owner" defaultMessage="Owner" />
      ),
      what: (
        <FormattedMessage
          id="forSchools.role.owner.what"
          defaultMessage="Holds the licence, appoints admins, can see everything"
        />
      ),
      verdict: "must",
    },
    {
      role: (
        <FormattedMessage id="forSchools.role.admin" defaultMessage="Admin" />
      ),
      what: (
        <FormattedMessage
          id="forSchools.role.admin.what"
          defaultMessage="Runs the school day to day, sees every learner, appoints teachers"
        />
      ),
      verdict: "must",
    },
    {
      role: (
        <FormattedMessage
          id="forSchools.role.teacher"
          defaultMessage="Teacher"
        />
      ),
      what: (
        <FormattedMessage
          id="forSchools.role.teacher.what"
          defaultMessage="Sees their own class only, cannot appoint anyone"
        />
      ),
      verdict: "rec",
    },
    {
      role: (
        <FormattedMessage
          id="forSchools.role.guardian"
          defaultMessage="Guardian"
        />
      ),
      what: (
        <FormattedMessage
          id="forSchools.role.guardian.what"
          defaultMessage="Their own children, at home, on their own account"
        />
      ),
      verdict: "any",
    },
  ] as const;
  const label = {
    must: (
      <FormattedMessage
        id="forSchools.verdict.must"
        defaultMessage="domain required"
      />
    ),
    rec: (
      <FormattedMessage
        id="forSchools.verdict.rec"
        defaultMessage="recommended"
      />
    ),
    any: (
      <FormattedMessage
        id="forSchools.verdict.any"
        defaultMessage="any address"
      />
    ),
  };
  return (
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage
          id="forSchools.domain"
          defaultMessage="Who may hold a staff role"
        />
      </h2>
      <p className={styles.note}>
        <FormattedMessage
          id="forSchools.domain.intro"
          defaultMessage="Your school may name the email domain its staff accounts use. Then the people who can see every learner must be at the school, not merely invited by someone who was. Parents are never restricted; their addresses are their own. A school with no domain leaves it blank and nothing is restricted."
        />
      </p>
      <div className={styles.domainTable}>
        {rows.map((row, index) => (
          <div key={index} className={styles.drow}>
            <span className={styles.r}>{row.role}</span>
            <span className={styles.m}>{row.what}</span>
            <span className={`${styles.v} ${styles[row.verdict]}`}>
              {label[row.verdict]}
            </span>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        <FormattedMessage
          id="forSchools.domain.real"
          defaultMessage="Two things make this real rather than decorative: the address must be confirmed before it can hold a staff role, and the check runs when the invite is accepted — because who a link was emailed to proves nothing about who redeems it."
        />
      </p>
    </section>
  );
}

/** A label above its field — six fields need naming, not placeholders. */
function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <label className={styles.frow}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * The enquiry.
 *
 * It files an ordinary `business` ticket on the support desk rather than
 * posting somewhere new: that endpoint already carries the captcha, the
 * honeypot, the per-address rate limits and the duplicate fold. A second
 * unauthenticated door would have to re-earn all four, and would be a
 * second thing to get wrong.
 */
function Enquiry(): ReactNode {
  const { formatMessage } = useIntl();
  const captcha = useCaptcha({ eager: true });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [learners, setLearners] = useState("");
  const [pay, setPay] = useState("");
  const [teachers, setTeachers] = useState("");
  const [hoping, setHoping] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    name.trim() !== "" &&
    email.trim() !== "" &&
    school.trim() !== "" &&
    hoping.trim() !== "";

  const submit = () => {
    if (!valid || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    // The two questions that decide free-or-licensed travel in the body,
    // where the person reading the queue can weigh them. They are not a
    // rule the form applies by itself — see the pricing note.
    const message = [
      `School or centre: ${school.trim()}`,
      `Roughly how many learners: ${learners.trim() || "not said"}`,
      `Do families pay to attend: ${pay.trim() || "not said"}`,
      `Teachers volunteer or paid: ${teachers.trim() || "not said"}`,
      "",
      hoping.trim(),
    ].join("\n");
    SupportService.createTicket({
      kind: "business",
      name: name.trim(),
      email: email.trim(),
      subject: `Schools enquiry — ${school.trim()}`,
      message,
      turnstileToken: captcha.token,
      website,
    })
      .then(() => {
        setSent(true);
      })
      .catch((err: any) => {
        setError(err?.body?.error?.message ?? err?.message ?? null);
        setBusy(false);
      });
  };

  if (sent) {
    return (
      <section>
        <h2 className={styles.whisper}>
          <FormattedMessage id="forSchools.ask" defaultMessage="Ask us" />
        </h2>
        <p className={styles.sent}>
          <FormattedMessage
            id="forSchools.sent"
            defaultMessage="Thanks — that's with us. A person reads this queue, and you'll get a reply by email."
          />
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className={styles.whisper}>
        <FormattedMessage id="forSchools.ask" defaultMessage="Ask us" />
      </h2>
      <div className={styles.formwrap}>
        <div className={styles.two}>
          <Field
            label={formatMessage({
              id: "forSchools.f.name",
              defaultMessage: "Your name",
            })}
          >
            <TextField
              type="text"
              size="full"
              maxLength={64}
              value={name}
              onChange={setName}
            />
          </Field>
          <Field
            label={formatMessage({
              id: "forSchools.f.email",
              defaultMessage: "Email",
            })}
          >
            <TextField
              type="email"
              size="full"
              maxLength={128}
              autoComplete="email"
              value={email}
              onChange={setEmail}
            />
          </Field>
        </div>
        <div className={styles.two}>
          <Field
            label={formatMessage({
              id: "forSchools.f.school",
              defaultMessage: "School or centre",
            })}
          >
            <TextField
              type="text"
              size="full"
              maxLength={128}
              value={school}
              onChange={setSchool}
            />
          </Field>
          <Field
            label={formatMessage({
              id: "forSchools.f.learners",
              defaultMessage: "Roughly how many learners",
            })}
          >
            <TextField
              type="text"
              size="full"
              maxLength={64}
              value={learners}
              onChange={setLearners}
            />
          </Field>
        </div>
        {/* The two questions the pricing note points at. Free text, not a
            dropdown: "a nominal term fee that covers the hall" is the
            true answer and no set of options contains it. */}
        <div className={styles.two}>
          <Field
            label={formatMessage({
              id: "forSchools.f.pay",
              defaultMessage: "Do families pay to attend?",
            })}
          >
            <TextField
              type="text"
              size="full"
              maxLength={128}
              value={pay}
              onChange={setPay}
            />
          </Field>
          <Field
            label={formatMessage({
              id: "forSchools.f.teachers",
              defaultMessage: "Are teachers volunteers or paid?",
            })}
          >
            <TextField
              type="text"
              size="full"
              maxLength={128}
              value={teachers}
              onChange={setTeachers}
            />
          </Field>
        </div>
        <Field
          label={formatMessage({
            id: "forSchools.f.hoping",
            defaultMessage: "What you are hoping to do",
          })}
        >
          <TextField
            type="textarea"
            size="full"
            rows={5}
            maxLength={1500}
            value={hoping}
            onChange={setHoping}
          />
        </Field>

        {/* Invisible to a sighted or screen-reader visitor, present in
            the DOM for a bot that fills every field it finds. */}
        <div className={styles.hp} aria-hidden="true">
          <label>
            <FormattedMessage
              id="forSchools.f.honeypot"
              defaultMessage="Website"
            />
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(ev) => {
                setWebsite(ev.target.value);
              }}
            />
          </label>
        </div>
        {captcha.widget}
        {error != null && <p className={styles.error}>{error}</p>}
        <Button
          onClick={submit}
          disabled={!valid || busy}
          label={formatMessage({
            id: "forSchools.f.send",
            defaultMessage: "Send",
          })}
        />
        <p className={styles.formnote}>
          <FormattedMessage
            id="forSchools.f.note"
            defaultMessage="This becomes a business enquiry on the support desk — the queue a person actually reads, not an unattended inbox."
          />
        </p>
      </div>
    </section>
  );
}

ForSchoolsPage.displayName = Pages.forSchools.path;
