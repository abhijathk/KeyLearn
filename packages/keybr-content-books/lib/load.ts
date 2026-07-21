import { Book, type Content } from "@keybr/content";

export async function loadContent(book: Book): Promise<Content> {
  switch (book) {
    case Book.EN_WIZARD_OZ:
      return (
        await import(
          /* webpackChunkName: "book-en-wizard-oz" */
          "./data/en-wizard-oz.json",
          { with: { type: "json" } }
        )
      ).default as any;
    case Book.EN_TREASURE_ISLAND:
      return (
        await import(
          /* webpackChunkName: "book-en-treasure-island" */
          "./data/en-treasure-island.json",
          { with: { type: "json" } }
        )
      ).default as any;
    case Book.EN_HOUND_BASKERVILLES:
      return (
        await import(
          /* webpackChunkName: "book-en-hound-baskervilles" */
          "./data/en-hound-baskervilles.json",
          { with: { type: "json" } }
        )
      ).default as any;
    case Book.EN_TIME_MACHINE:
      return (
        await import(
          /* webpackChunkName: "book-en-time-machine" */
          "./data/en-time-machine.json",
          { with: { type: "json" } }
        )
      ).default as any;
    case Book.EN_ANNE_GREEN_GABLES:
      return (
        await import(
          /* webpackChunkName: "book-en-anne-green-gables" */
          "./data/en-anne-green-gables.json",
          { with: { type: "json" } }
        )
      ).default as any;
    default:
      throw new Error();
  }
}
