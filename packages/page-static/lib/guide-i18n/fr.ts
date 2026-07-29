import { type GuideTranslation } from "../guide-content.tsx";

export const fr: GuideTranslation = {
  kicker: "Tout ce que vous pouvez faire",
  title: "Guide de l’utilisateur",
  dateline:
    "Le guide complet de KeyLearn — de votre première visite jusqu’à la déconnexion",
  navLabel: "Sur cette page",
  sections: [
    {
      id: "account",
      nav: "Ai-je besoin d’un compte ?",
      heading: "Ai-je besoin d’un compte ?",
      blocks: [
        {
          p: "Non. Vous pouvez commencer à taper dès votre arrivée, et votre progression est enregistrée ici même, sur cet appareil. Créez un compte gratuit uniquement si vous voulez que votre historique vous suive sur d’autres appareils, conserver une sauvegarde ou partager un lien de profil. Rien d’utile n’est réservé à ceux qui se connectent.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Connexion et mots de passe",
      heading: "Inscription, connexion et mots de passe",
      blocks: [
        { p: "Tout se trouve dans le menu en haut à droite." },
        { lab: "Créer un compte" },
        {
          steps: [
            "Ouvrez le menu (en haut à droite).",
            "Choisissez S’inscrire.",
            "Saisissez une adresse e-mail et un mot de passe.",
            "Confirmez — vous voilà connecté.",
          ],
        },
        { lab: "Se connecter" },
        {
          steps: [
            "Ouvrez le menu et choisissez Se connecter.",
            "Saisissez votre adresse e-mail et votre mot de passe.",
          ],
        },
        { lab: "Réinitialiser un mot de passe oublié" },
        {
          steps: [
            "Sur l’écran de connexion, choisissez Mot de passe oublié.",
            "Saisissez votre adresse e-mail.",
            "Ouvrez le lien de réinitialisation que nous vous envoyons.",
            "Choisissez un nouveau mot de passe et connectez-vous.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profils",
      heading: "Des profils pour tout le foyer",
      blocks: [
        {
          p: "KeyLearn est conçu comme un foyer : un compte contient jusqu’à quatre profils (huit avec la version premium), grands et petits dans n’importe quelle combinaison. Chaque profil conserve sa *propre* progression distincte sur cet appareil — rien n’est jamais mélangé.",
        },
        { lab: "Ajouter un profil" },
        {
          steps: [
            "Ouvrez le menu et choisissez Compte (ou « Configurer les profils »).",
            "Sélectionnez Ajouter un profil.",
            "Saisissez un prénom.",
            "Indiquez s’il s’agit d’un Adulte ou d’un Enfant.",
            "Choisissez un avatar — une jolie icône, ou une Photo de votre appareil.",
            "Pour un enfant, ajoutez une année de naissance (cela sert uniquement à adapter les mots et le rythme à son âge).",
            "Enregistrez.",
          ],
        },
        { lab: "Passer à un autre apprenant" },
        {
          steps: [
            "Ouvrez le menu.",
            "Touchez un visage sous Apprenants — l’application reprend là où il s’était arrêté.",
          ],
        },
        { lab: "Modifier ou supprimer un profil" },
        {
          steps: [
            "Ouvrez le menu et choisissez Compte.",
            "Sélectionnez Modifier sur un profil, ou supprimez-le pour libérer une place.",
          ],
        },
        {
          p: "Les profils enfant disposent d’un menu simplifié et verrouillé, et les actions réservées aux adultes sont protégées par une petite question de calcul « combien font A fois B ? », afin que les plus jeunes ne s’égarent pas dans les réglages.",
        },
      ],
    },
    {
      id: "screen",
      nav: "L’écran de pratique",
      heading: "L’écran de pratique",
      blocks: [
        {
          p: "Commencez simplement à taper. Le mot dont vous avez besoin flotte juste au-dessus du clavier à l’écran ; une comète lumineuse pointe la toute prochaine touche ; les touches sont teintées par zone de doigt pour vous apprendre quel doigt atteint quelle touche ; et une paire de mains au repos, à peine visible, montre où vos doigts se posent entre deux frappes. Toute la compétence tient en une habitude : gardez les yeux sur les mots, pas sur vos mains.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Votre parcours",
      heading: "Comment les leçons évoluent — votre parcours",
      blocks: [
        {
          p: "KeyLearn est *adaptatif*. Il mesure la rapidité et la propreté avec lesquelles vous frappez chaque touche et n’ajoute une nouvelle lettre à votre jeu que lorsque vous savez taper les lettres actuelles à la fois vite et sans faute. Ce jeu qui s’étoffe, c’est votre parcours, d’une poignée de lettres à tout l’alphabet — la difficulté monte exactement au rythme où vous progressez, jamais plus vite, si bien que vous travaillez toujours juste à la limite de vos capacités.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statistiques en direct",
      heading: "L’affichage en direct",
      blocks: [
        {
          p: "Pendant que vous tapez, le panneau flottant montre votre vitesse et votre précision actuelles, une petite courbe de vos dernières séries, la progression de vos objectifs et votre série de jours. Il est là pour vous encourager, pas pour vous harceler.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Outils de pratique",
      heading: "Outils de pratique",
      blocks: [
        {
          p: "Les petits outils à côté du texte vous permettent d’ouvrir une visite guidée, de recommencer la leçon en cours (Ctrl + Gauche), de passer à la suivante (Ctrl + Droite), d’afficher ou de masquer le clavier à l’écran, et de redimensionner le texte de pratique. L’engrenage ouvre les Réglages complets, décrits ci-après.",
        },
      ],
    },
    {
      id: "content",
      nav: "Ce que vous tapez",
      heading: "Choisir ce que vous tapez",
      blocks: [
        {
          p: "Ouvrez les Réglages et allez dans Contenu de pratique pour choisir comment vos mots sont composés :",
        },
        {
          tips: [
            "*Pratique guidée* — le mode adaptatif par défaut, qui enrichit votre alphabet touche par touche.",
            "*Cours classique* — une progression fixe et ordonnée à travers les touches.",
            "*Mots fréquents* — les mots les plus courants de votre langue.",
            "*Texte de livre* — tapez au fil de vrais livres intégrés à l’application.",
            "*Votre propre texte* — collez ce que vous voulez et entraînez-vous dessus.",
            "*Extraits de code* — parenthèses, symboles et le rythme du code.",
            "*Exercices de chiffres* — la rangée des chiffres et le pavé numérique.",
          ],
        },
        { lab: "Changer ce que vous tapez" },
        {
          steps: [
            "Ouvrez les Réglages (l’engrenage près du texte de pratique).",
            "Allez dans Contenu de pratique.",
            "Choisissez un mode — pour Texte de livre choisissez un livre, pour Votre propre texte collez vos mots.",
            "Fermez les Réglages et continuez à taper.",
          ],
        },
        {
          p: "Le même écran définit la taille de votre alphabet, une vitesse cible, la durée de chaque leçon et un objectif quotidien.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Pratique intelligente",
      heading: "Les aides de la Pratique intelligente",
      blocks: [
        {
          p: "En plus de la pratique guidée, la Pratique intelligente ajoute de douces aides : un exercice ciblé qui traque vos paires de touches les plus lentes, la répétition espacée, des rappels contre l’oubli qui reviennent sur les touches rouillées, la confiance intelligente et la récupération de touches. Elles sont toutes activées par défaut.",
        },
        { lab: "Activer ou désactiver une aide" },
        {
          steps: [
            "Ouvrez les Réglages.",
            "Allez dans Pratique intelligente.",
            "Activez ou désactivez l’aide de votre choix — ou laissez-les toutes actives.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Configuration du clavier",
      heading: "Configurer votre clavier",
      blocks: [
        {
          p: "Réglages, Configuration du clavier est l’endroit où vous accordez KeyLearn à votre clavier et à la disposition que vous voulez apprendre.",
        },
        { lab: "Changer votre disposition de clavier" },
        {
          steps: [
            "Ouvrez les Réglages.",
            "Allez dans Configuration du clavier.",
            "Choisissez votre langue, puis votre disposition (QWERTY, Dvorak, Colemak et bien d’autres).",
            "Laissez « Simuler cette disposition » activé pour pouvoir vous entraîner dessus quel que soit le réglage de votre ordinateur.",
            "Observez l’aperçu en direct pour vérifier.",
          ],
        },
        {
          p: "Sur le même écran, vous pouvez choisir la forme du clavier, colorer les touches par zone de doigt et mettre en lumière la prochaine touche tant que vous apprenez encore où tout se trouve.",
        },
      ],
    },
    {
      id: "display",
      nav: "Affichage",
      heading: "Affichage et ressenti",
      blocks: [
        {
          p: "Les réglages Affichage et Saisie de texte vous permettent d’afficher votre vitesse en mots ou en caractères par minute et d’ajuster finement le ressenti de la frappe. Restaurer les valeurs par défaut est toujours à portée de clic si vous voulez repartir de zéro.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Votre progression",
      heading: "Votre progression — la page Profil",
      blocks: [
        {
          p: "La page Profil est votre relevé complet : les statistiques À vie et Aujourd’hui en haut (temps de pratique, leçons terminées, votre meilleure vitesse et votre vitesse habituelle ainsi que votre précision, et la comparaison avec aujourd’hui) ; une carte de chaque lettre que vous avez débloquée ; l’histoire de l’accélération de chaque touche, avec un curseur de lissage ; la vue d’ensemble de toutes les touches au fil du temps ; et les transitions les plus lentes qui vous freinent encore. Vous pouvez même faire la course contre votre propre dernière série sous forme de fantôme pour ressentir directement vos progrès.",
        },
        { lab: "Ouvrir votre progression" },
        {
          steps: [
            "Ouvrez le menu.",
            "Choisissez Profil.",
            "Utilisez la rangée de filtres pour vous concentrer sur les Lettres, les Chiffres, la Ponctuation ou les Symboles.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Vos données",
      heading: "Prendre soin de vos données",
      blocks: [
        { lab: "Effacer les statistiques d’un profil" },
        {
          steps: [
            "Ouvrez Profil pour l’apprenant que vous voulez réinitialiser.",
            "Faites défiler jusqu’à la commande de réinitialisation en bas de la page.",
            "Confirmez « Tout effacer » — seul ce profil est effacé.",
          ],
        },
        { lab: "Télécharger vos données" },
        {
          steps: [
            "Ouvrez Profil.",
            "Utilisez l’option de téléchargement pour enregistrer votre historique dans un fichier.",
          ],
        },
        {
          p: "Connectez-vous si vous voulez que votre historique se synchronise sur tous vos appareils et pour partager un lien de profil public. Il n’y a ni publicités ni traqueurs, et vous pouvez supprimer vos données — ou tout votre compte — quand vous le souhaitez.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Mode enfant",
      heading: "Mode enfant",
      blocks: [
        {
          p: "Les enfants s’entraînent sur un sentier ludique. Chaque bonne touche fait avancer leur personnage d’un pas vers la maison, et le personnage grandit d’un tout petit bébé jusqu’à un héros adulte à mesure que d’autres lettres se débloquent. Une touche fraîchement apprise déclenche une petite célébration, et chaque séance se termine autour d’un feu de camp douillet.",
        },
        { lab: "Passer en mode enfant" },
        {
          steps: [
            "Ouvrez le menu.",
            "Choisissez Enfants — ou sélectionnez un profil enfant sous Apprenants.",
          ],
        },
        {
          p: "Il y a deux mondes au choix — Dino Run, avec un gentil dinosaure, et Hero Trail, où un chevalier part en quête à travers une forêt — chacun avec un personnage à choisir.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Coffre à jouets",
      heading: "Le coffre à jouets des enfants",
      blocks: [
        { lab: "Ouvrir le coffre à jouets" },
        {
          steps: [
            "Sur l’écran enfant, touchez l’engrenage en haut de l’aire de jeu.",
          ],
        },
        {
          p: "À l’intérieur, vous pouvez régler le monde et le personnage, les Grandes lettres, les Sons, les Mains aides (le guide de doigt lumineux), le Clavier (masqué, simplifié, ou le clavier complet des adultes), les Lettres sur le sentier (les mots affichés sous forme de blocs directement dans le jeu), une Minuterie de séance, les Encouragements (de petits messages motivants) et — rangés sous Avancé — des curseurs pour la Luminosité, la Couleur et le degré d’animation du monde. Il y a aussi une ambiance nuit apaisante en plus de l’ambiance jour lumineuse.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Grandir",
      heading: "Grandir avec votre enfant",
      blocks: [
        {
          p: "KeyLearn s’adapte discrètement à l’âge de l’enfant. Les plus jeunes voient de grandes lettres accueillantes, un rythme indulgent, des blocs de lettres directement sur le sentier et l’aide la plus douce ; les enfants plus grands passent à des mots plus longs, au clavier complet et à un look plus épuré. Il suffit d’indiquer l’année de naissance sur le profil et le reste suit tout seul.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Autres modes",
      heading: "D’autres façons de s’entraîner",
      blocks: [
        {
          p: "Au-delà de votre pratique quotidienne, il y a un *Test de vitesse* — un court passage ponctuel qui indique vos mots par minute et votre précision, sans leçon rattachée ; un explorateur de *Dispositions* pour comparer les dispositions de clavier et leurs cartes de doigts ; les *Meilleurs scores* pour voir où vous vous situez ; et des courses *Multijoueur* pour mesurer votre vitesse à celle des autres en temps réel.",
        },
        { lab: "Les trouver" },
        {
          steps: [
            "Ouvrez le menu.",
            "Choisissez Test de vitesse, Dispositions, Meilleurs scores ou Multijoueur.",
          ],
        },
      ],
    },
    {
      id: "yours",
      nav: "Personnalisez",
      heading: "Personnalisez",
      blocks: [
        { lab: "Changer le thème" },
        {
          steps: [
            "Ouvrez le menu.",
            "Utilisez l’interrupteur de thème — un thème clair, sombre ou le look KeyLearn.",
          ],
        },
        { lab: "Changer la langue du site" },
        {
          steps: [
            "Ouvrez le menu.",
            "Sous Langue du site, choisissez votre langue.",
          ],
        },
        {
          p: "Sur l’écran de pratique, vous pouvez aussi redimensionner le texte et activer ou désactiver les sons quand bon vous semble.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Confidentialité",
      heading: "La confidentialité, en une phrase",
      blocks: [
        {
          p: "Ni publicités, ni traqueurs. Le profil d’un enfant ne quitte jamais votre navigateur. Connectez-vous uniquement si vous voulez la synchronisation ou le partage ; sinon tout reste sur cet appareil, et vous êtes libre de le supprimer à tout moment.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Déconnexion",
      heading: "Se déconnecter",
      blocks: [
        { lab: "Se déconnecter" },
        {
          steps: [
            "Ouvrez le menu.",
            "Choisissez Se déconnecter et confirmez.",
          ],
        },
        {
          p: "Votre historique de pratique reste bien à l’abri sur cet appareil — et sur votre compte, si vous en avez créé un — prêt pour la prochaine fois où vous vous installerez pour taper.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Conseils",
      heading: "Quelques habitudes qui aident vraiment",
      blocks: [
        {
          tips: [
            "La précision avant la vitesse — c’est une frappe propre qui s’ancre.",
            "Corrigez les erreurs calmement ; ne vous précipitez pas pour rattraper le temps perdu.",
            "Posez vos doigts sur la rangée de repos — F et J ont de petits reliefs.",
            "Quelques minutes chaque jour valent mieux qu’une heure une fois par semaine.",
          ],
        },
      ],
    },
  ],
};
