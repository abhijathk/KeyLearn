import { Language } from "@keylearn/keyboard";
import AR from "@keylearn/phonetic-model/assets/model-ar.data";
import BE from "@keylearn/phonetic-model/assets/model-be.data";
import BN from "@keylearn/phonetic-model/assets/model-bn.data";
import BR from "@keylearn/phonetic-model/assets/model-br.data";
import CS from "@keylearn/phonetic-model/assets/model-cs.data";
import DA from "@keylearn/phonetic-model/assets/model-da.data";
import DE from "@keylearn/phonetic-model/assets/model-de.data";
import EL from "@keylearn/phonetic-model/assets/model-el.data";
import EN from "@keylearn/phonetic-model/assets/model-en.data";
import EN_GB from "@keylearn/phonetic-model/assets/model-en-GB.data";
import ES from "@keylearn/phonetic-model/assets/model-es.data";
import ET from "@keylearn/phonetic-model/assets/model-et.data";
import FA from "@keylearn/phonetic-model/assets/model-fa.data";
import FI from "@keylearn/phonetic-model/assets/model-fi.data";
import FR from "@keylearn/phonetic-model/assets/model-fr.data";
import GU from "@keylearn/phonetic-model/assets/model-gu.data";
import HE from "@keylearn/phonetic-model/assets/model-he.data";
import HI from "@keylearn/phonetic-model/assets/model-hi.data";
import HR from "@keylearn/phonetic-model/assets/model-hr.data";
import HU from "@keylearn/phonetic-model/assets/model-hu.data";
import IT from "@keylearn/phonetic-model/assets/model-it.data";
import JA from "@keylearn/phonetic-model/assets/model-ja.data";
import KN from "@keylearn/phonetic-model/assets/model-kn.data";
import LT from "@keylearn/phonetic-model/assets/model-lt.data";
import LV from "@keylearn/phonetic-model/assets/model-lv.data";
import ML from "@keylearn/phonetic-model/assets/model-ml.data";
import NB from "@keylearn/phonetic-model/assets/model-nb.data";
import NL from "@keylearn/phonetic-model/assets/model-nl.data";
import PL from "@keylearn/phonetic-model/assets/model-pl.data";
import PT from "@keylearn/phonetic-model/assets/model-pt.data";
import RO from "@keylearn/phonetic-model/assets/model-ro.data";
import RU from "@keylearn/phonetic-model/assets/model-ru.data";
import SL from "@keylearn/phonetic-model/assets/model-sl.data";
import SV from "@keylearn/phonetic-model/assets/model-sv.data";
import TA from "@keylearn/phonetic-model/assets/model-ta.data";
import TE from "@keylearn/phonetic-model/assets/model-te.data";
import TH from "@keylearn/phonetic-model/assets/model-th.data";
import TR from "@keylearn/phonetic-model/assets/model-tr.data";
import UK from "@keylearn/phonetic-model/assets/model-uk.data";
import UR from "@keylearn/phonetic-model/assets/model-ur.data";
import VI from "@keylearn/phonetic-model/assets/model-vi.data";

export function modelAssetPath(language: Language): string {
  switch (language) {
    case Language.AR:
      return AR;
    case Language.BE:
      return BE;
    case Language.BR:
      return BR;
    case Language.CS:
      return CS;
    case Language.DA:
      return DA;
    case Language.DE:
      return DE;
    case Language.EL:
      return EL;
    case Language.EN:
      return EN;
    case Language.EN_GB:
      return EN_GB;
    case Language.ES:
      return ES;
    case Language.ET:
      return ET;
    case Language.FA:
      return FA;
    case Language.FI:
      return FI;
    case Language.FR:
      return FR;
    case Language.HE:
      return HE;
    case Language.HI:
      return HI;
    case Language.HR:
      return HR;
    case Language.HU:
      return HU;
    case Language.IT:
      return IT;
    case Language.JA:
      return JA;
    case Language.LT:
      return LT;
    case Language.LV:
      return LV;
    case Language.ML:
      return ML;
    case Language.NB:
      return NB;
    case Language.NL:
      return NL;
    case Language.PL:
      return PL;
    case Language.PT:
      return PT;
    case Language.RO:
      return RO;
    case Language.RU:
      return RU;
    case Language.SL:
      return SL;
    case Language.SV:
      return SV;
    case Language.TH:
      return TH;
    case Language.TR:
      return TR;
    case Language.UK:
      return UK;
    case Language.VI:
      return VI;
    case Language.BN:
      return BN;
    case Language.GU:
      return GU;
    case Language.KN:
      return KN;
    case Language.TA:
      return TA;
    case Language.TE:
      return TE;
    case Language.UR:
      return UR;
    default:
      throw new Error();
  }
}
