import { Language } from "@keylearn/keyboard";
import { Enum, type EnumItem } from "@keylearn/lang";
import coverAnneGreenGables from "../../assets/cover-en-anne-green-gables.svg";
import coverHoundBaskervilles from "../../assets/cover-en-hound-baskervilles.svg";
import coverTimeMachine from "../../assets/cover-en-time-machine.svg";
import coverTreasureIsland from "../../assets/cover-en-treasure-island.svg";
import coverWizardOz from "../../assets/cover-en-wizard-oz.svg";

export class Book implements EnumItem {
  static readonly EN_WIZARD_OZ = new Book(
    /* id= */ "en-wizard-oz",
    /* language= */ Language.EN,
    /* title= */ "The Wonderful Wizard of Oz",
    /* author= */ "L. Frank Baum",
    /* coverImage= */ coverWizardOz,
  );
  static readonly EN_TREASURE_ISLAND = new Book(
    /* id= */ "en-treasure-island",
    /* language= */ Language.EN,
    /* title= */ "Treasure Island",
    /* author= */ "Robert Louis Stevenson",
    /* coverImage= */ coverTreasureIsland,
  );
  static readonly EN_HOUND_BASKERVILLES = new Book(
    /* id= */ "en-hound-baskervilles",
    /* language= */ Language.EN,
    /* title= */ "The Hound of the Baskervilles",
    /* author= */ "Arthur Conan Doyle",
    /* coverImage= */ coverHoundBaskervilles,
  );
  static readonly EN_TIME_MACHINE = new Book(
    /* id= */ "en-time-machine",
    /* language= */ Language.EN,
    /* title= */ "The Time Machine",
    /* author= */ "H. G. Wells",
    /* coverImage= */ coverTimeMachine,
  );
  static readonly EN_ANNE_GREEN_GABLES = new Book(
    /* id= */ "en-anne-green-gables",
    /* language= */ Language.EN,
    /* title= */ "Anne of Green Gables",
    /* author= */ "L. M. Montgomery",
    /* coverImage= */ coverAnneGreenGables,
  );

  static readonly ALL = new Enum<Book>(
    Book.EN_WIZARD_OZ,
    Book.EN_TREASURE_ISLAND,
    Book.EN_HOUND_BASKERVILLES,
    Book.EN_TIME_MACHINE,
    Book.EN_ANNE_GREEN_GABLES,
  );

  private constructor(
    readonly id: string,
    readonly language: Language,
    readonly title: string,
    readonly author: string,
    readonly coverImage: string,
  ) {
    Object.freeze(this);
  }

  toString() {
    return this.id;
  }

  toJSON() {
    return this.id;
  }
}
