# Rich notifications — deferred

Parked on 20 August 2026, mid-build, because the dropdown had grown past
what the bell needs. Nothing here is broken; it is set aside, not
abandoned.

## What is in this folder

| File | What it is |
| --- | --- |
| `notification-designs.html` | The four candidate designs, each at real dropdown width with what it would cost to build. Open it in a browser. |
| `NotificationBell.rich.tsx` | The working implementation of option D, as it stood when it was parked. |
| `NotificationBell.rich.module.less` | Its stylesheet, including the specificity reset described below. |

The design chosen was **option D without avatars**, with the unread dot
from options B and C.

## What shipped instead

The plain list: a line of the reply, when it arrived, and a `×` to clear
it. Two things were kept from this work because they were fixes rather
than enrichment:

- **Clicking a notification opens the support section.** It used only to
  mark the thing read, which is the one thing somebody clicking a reply
  notification is not trying to do.
- **The timestamp sits under the message.** Leading with it put *when* in
  front of *what*, and wrapped "20 Aug," onto its own line at the
  dropdown's width.

## What the server already provides

The API work is done and still in place — picking this up again is a
front-end job only. `NotificationDetails` carries:

- `authorName` and `fromAssistant` — columns on `notification`, written
  when the reply is delivered. The flag is stored rather than guessed
  from the name, so the promise the thread makes (the assistant is never
  passed off as a person) holds on the bell too.
- `reference`, `subject`, `status` — read off the ticket **at list time**,
  not copied onto the notification when it was made. A conversation since
  resolved should say so on the bell; a snapshot taken at reply time would
  still say "open".

None of that needs removing. It costs one join on a list of at most
twenty rows.

## The trap, if you come back to this

The dropdown renders inside the header's control row, and that row styles
**every descendant button**:

```less
.controls {
  button, a { display: grid; inline-size: 2.3rem; … }
}
```

At (0,1,1) that outranks a plain class, so every button in the list — each
row, its actions, the clear `×` — collapses to a 39 px square and drags
the text with it. `NotificationBell.rich.module.less` ends with a
`.drop.drop` block at (0,2,1) that wins it back deterministically, rather
than depending on which stylesheet the bundler emits last.

This cost four rounds of "it still looks wrong" to find, because a
standalone harness of the component reproduces none of it. **Test inside
the running page.**
