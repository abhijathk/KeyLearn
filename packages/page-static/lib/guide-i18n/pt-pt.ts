import { type GuideTranslation } from "../guide-content.tsx";

export const ptPt: GuideTranslation = {
  kicker: "Tudo o que podes fazer",
  title: "Guia do Utilizador",
  dateline:
    "O guia completo do KeyLearn — da primeira visita até terminares a sessão",
  navLabel: "Nesta página",
  sections: [
    {
      id: "account",
      nav: "Preciso de uma conta?",
      heading: "Preciso de uma conta?",
      blocks: [
        {
          p: "Não. Podes começar a escrever assim que chegas, e o teu progresso fica guardado aqui mesmo, neste dispositivo. Cria uma conta gratuita apenas se quiseres que o teu histórico te acompanhe noutros dispositivos, se quiseres manter uma cópia de segurança ou partilhar uma ligação para o teu perfil. Nada de útil fica fechado atrás do início de sessão.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Iniciar sessão e palavras-passe",
      heading: "Registo, início de sessão e palavras-passe",
      blocks: [
        { p: "Está tudo no menu no canto superior direito." },
        { lab: "Criar uma conta" },
        {
          steps: [
            "Abre o menu (canto superior direito).",
            "Escolhe Registar.",
            "Introduz um e-mail e uma palavra-passe.",
            "Confirma — e já está.",
          ],
        },
        { lab: "Iniciar sessão" },
        {
          steps: [
            "Abre o menu e escolhe Iniciar Sessão.",
            "Introduz o teu e-mail e a tua palavra-passe.",
          ],
        },
        { lab: "Repor uma palavra-passe esquecida" },
        {
          steps: [
            "No ecrã de início de sessão, escolhe Esqueci-me da palavra-passe.",
            "Introduz o teu endereço de e-mail.",
            "Abre a ligação de reposição que te enviamos.",
            "Escolhe uma nova palavra-passe e inicia sessão.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Perfis",
      heading: "Perfis para toda a casa",
      blocks: [
        {
          p: "O KeyLearn foi feito como um lar: uma conta contém até quatro perfis (oito com o premium), adultos e crianças em qualquer combinação. Cada perfil guarda o *seu próprio* progresso, separado dos outros, neste dispositivo — nada é alguma vez misturado.",
        },
        { lab: "Adicionar um perfil" },
        {
          steps: [
            "Abre o menu e escolhe Conta (ou “Configurar perfis”).",
            "Seleciona Adicionar um perfil.",
            "Escreve um nome próprio.",
            "Marca-o como Adulto ou Criança.",
            "Escolhe um avatar — um ícone simpático ou uma Fotografia do teu dispositivo.",
            "No caso de uma criança, indica o ano de nascimento (serve apenas para ajustar as palavras e o ritmo à idade dela).",
            "Guarda.",
          ],
        },
        { lab: "Mudar para outro aluno" },
        {
          steps: [
            "Abre o menu.",
            "Toca numa cara em Alunos — a aplicação retoma onde essa pessoa ficou.",
          ],
        },
        { lab: "Editar ou remover um perfil" },
        {
          steps: [
            "Abre o menu e escolhe Conta.",
            "Seleciona Editar num perfil, ou elimina-o para libertar um lugar.",
          ],
        },
        {
          p: "Os perfis de criança têm um menu simplificado e protegido, e as ações de adulto ficam atrás de uma pergunta rápida de matemática, “quanto é A vezes B?”, para que os mais pequenos não se percam pelas definições.",
        },
      ],
    },
    {
      id: "screen",
      nav: "O ecrã de prática",
      heading: "O ecrã de prática",
      blocks: [
        {
          p: "É só começar a escrever. A palavra de que precisas flutua mesmo por cima do teclado no ecrã; um cometa brilhante aponta para a próxima tecla; as teclas estão coloridas por zona de dedo, para aprenderes que dedo chega a cada sítio; e um par ténue de mãos em repouso mostra onde os teus dedos vivem entre os toques. Toda esta competência é um só hábito: mantém os olhos nas palavras, não nas mãos.",
        },
      ],
    },
    {
      id: "journey",
      nav: "O teu percurso",
      heading: "Como as lições crescem — o teu percurso",
      blocks: [
        {
          p: "O KeyLearn é *adaptativo*. Mede a rapidez e a limpeza com que acertas em cada tecla e só acrescenta uma letra nova ao teu conjunto quando já escreves as atuais depressa e sem erros. Esse conjunto, que vai crescendo, é o teu percurso, de um punhado de letras até ao alfabeto inteiro — a dificuldade sobe exatamente à mesma velocidade a que tu sobes, nunca mais depressa, por isso estás sempre a trabalhar no teu limite.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Estatísticas em direto",
      heading: "O painel em direto",
      blocks: [
        {
          p: "Enquanto escreves, o painel flutuante mostra a tua velocidade e a tua precisão atuais, um pequeno gráfico das últimas voltas, o avanço dos teus objetivos e a tua sequência de dias. Está ali para te encorajar, não para te chatear.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Ferramentas de prática",
      heading: "Ferramentas de prática",
      blocks: [
        {
          p: "As pequenas ferramentas ao lado do texto permitem-te abrir uma visita guiada, reiniciar a lição atual (Ctrl + Esquerda), passar à seguinte (Ctrl + Direita), mostrar ou esconder o teclado no ecrã e mudar o tamanho do texto de prática. A roda dentada abre as Definições completas, descritas a seguir.",
        },
      ],
    },
    {
      id: "content",
      nav: "O que escreves",
      heading: "Escolher o que escreves",
      blocks: [
        {
          p: "Abre as Definições e vai a Conteúdo de Prática para escolheres como são feitas as tuas palavras:",
        },
        {
          tips: [
            "*Prática guiada* — a opção adaptativa por omissão, que faz crescer o teu alfabeto tecla a tecla.",
            "*Curso clássico* — uma marcha fixa e ordenada pelas teclas.",
            "*Palavras frequentes* — as palavras mais comuns da tua língua.",
            "*Texto de Livros* — escreve ao longo de livros a sério, incluídos na aplicação.",
            "*O Teu Próprio Texto* — cola o que quiseres e pratica com isso.",
            "*Excertos de Código* — parênteses, símbolos e o ritmo do código.",
            "*Exercícios de Números* — a linha dos números e o teclado numérico.",
          ],
        },
        { lab: "Mudar o que escreves" },
        {
          steps: [
            "Abre as Definições (a roda dentada junto ao texto de prática).",
            "Vai a Conteúdo de Prática.",
            "Escolhe um modo — para Texto de Livros escolhe um livro, para O Teu Próprio Texto cola as tuas palavras.",
            "Fecha as Definições e continua a escrever.",
          ],
        },
        {
          p: "O mesmo ecrã define o tamanho do teu alfabeto, uma velocidade alvo, a duração de cada lição e um objetivo diário.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Prática Inteligente",
      heading: "Os ajudantes da Prática Inteligente",
      blocks: [
        {
          p: "Além da prática guiada, a Prática Inteligente acrescenta ajudantes discretos: um exercício que caça os teus pares de teclas mais lentos, repetição espaçada, revisões que voltam às teclas enferrujadas antes que se percam, confiança inteligente e recuperação de teclas. Estão todos ligados por omissão.",
        },
        { lab: "Ligar ou desligar um ajudante" },
        {
          steps: [
            "Abre as Definições.",
            "Vai a Prática Inteligente.",
            "Liga ou desliga o ajudante que quiseres — ou deixa-os todos ligados.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Configuração do teclado",
      heading: "Configurar o teu teclado",
      blocks: [
        {
          p: "Em Definições, a Configuração do Teclado é onde fazes o KeyLearn corresponder ao teu teclado e ao esquema que queres aprender.",
        },
        { lab: "Mudar o esquema do teclado" },
        {
          steps: [
            "Abre as Definições.",
            "Vai a Configuração do Teclado.",
            "Escolhe a tua língua e depois o teu esquema (QWERTY, Dvorak, Colemak e mais).",
            "Deixa “Simular este esquema” ligado, para poderes praticá-lo seja qual for a configuração do teu computador.",
            "Confirma na pré-visualização em direto.",
          ],
        },
        {
          p: "No mesmo ecrã podes escolher a forma do teclado, colorir as teclas por zona de dedo e destacar a tecla seguinte enquanto ainda estás a aprender onde fica cada coisa.",
        },
      ],
    },
    {
      id: "display",
      nav: "Apresentação",
      heading: "Apresentação e sensação",
      blocks: [
        {
          p: "As definições de Apresentação e de Introdução de Texto deixam-te mostrar a tua velocidade em palavras ou em caracteres por minuto e afinar ao pormenor a sensação de escrever. Repor Predefinições está sempre a um clique, se quiseres recomeçar do zero.",
        },
      ],
    },
    {
      id: "progress",
      nav: "O teu progresso",
      heading: "O teu progresso — a página de Perfil",
      blocks: [
        {
          p: "A página de Perfil é o teu registo completo: as estatísticas de Sempre e de Hoje no topo (tempo praticado, lições feitas, a tua melhor velocidade e precisão e as habituais, e como está a correr o dia de hoje em comparação); um mapa de todas as letras que desbloqueaste; a história de como cada tecla foi ficando mais rápida, com um cursor de suavização; o panorama de todas as teclas ao longo do tempo; e as transições mais lentas que ainda te seguram. Podes até correr contra a tua última volta, como um fantasma, para sentires o progresso diretamente.",
        },
        { lab: "Abrir o teu progresso" },
        {
          steps: [
            "Abre o menu.",
            "Escolhe Perfil.",
            "Usa a linha de filtros para te concentrares em Letras, Dígitos, Pontuação ou Símbolos.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Os teus dados",
      heading: "Cuidar dos teus dados",
      blocks: [
        { lab: "Limpar as estatísticas de um perfil" },
        {
          steps: [
            "Abre o Perfil do aluno que queres reiniciar.",
            "Desce até ao controlo de reposição no fundo da página.",
            "Confirma “Apagar tudo” — só este perfil é limpo.",
          ],
        },
        { lab: "Descarregar os teus dados" },
        {
          steps: [
            "Abre o Perfil.",
            "Usa a opção de descarregar para guardares o teu histórico num ficheiro.",
          ],
        },
        {
          p: "Inicia sessão se quiseres que o teu histórico sincronize entre dispositivos e para partilhares uma ligação pública para o teu perfil. Não há publicidade nem rastreadores, e podes apagar os teus dados — ou a conta inteira — quando quiseres.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Modo criança",
      heading: "Modo criança",
      blocks: [
        {
          p: "As crianças praticam num trilho divertido. Cada tecla certa faz a personagem dar mais um passo em direção a casa, e a personagem cresce de bebé pequenino a herói adulto à medida que mais letras vão sendo desbloqueadas. Uma tecla acabada de aprender desencadeia uma pequena festa, e cada sessão termina junto a uma fogueira acolhedora.",
        },
        { lab: "Mudar para o modo criança" },
        {
          steps: [
            "Abre o menu.",
            "Escolhe Crianças — ou escolhe um perfil de criança em Alunos.",
          ],
        },
        {
          p: "Há dois mundos à escolha — o Dino Run, com um dinossauro simpático, e o Hero Trail, onde um cavaleiro parte à aventura por uma floresta — cada um com uma personagem para escolher.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Caixa de brinquedos",
      heading: "A caixa de brinquedos das crianças",
      blocks: [
        { lab: "Abrir a caixa de brinquedos" },
        {
          steps: [
            "No ecrã das crianças, toca na roda dentada no topo da área de jogo.",
          ],
        },
        {
          p: "Lá dentro podes definir o mundo e a personagem, as Letras grandes, os Sons, as Mãos ajudantes (o guia luminoso dos dedos), o Teclado (escondido, simples ou o teclado completo dos adultos), as Letras no trilho (as palavras mostradas em blocos dentro do próprio jogo), um Cronómetro de sessão, os Aplausos (pequenas mensagens de incentivo) e — arrumados em Avançado — cursores para o Brilho, a Cor e o quanto o mundo é animado. Há também um aspeto de noite, calmo, além do aspeto claro de dia.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Crescer",
      heading: "Crescer com a criança",
      blocks: [
        {
          p: "O KeyLearn ajusta-se sozinho, discretamente, à idade da criança. Os mais pequenos veem letras grandes e simpáticas, um ritmo tolerante, blocos de letras mesmo no trilho e a ajuda mais suave; as crianças mais velhas passam a palavras mais longas, ao teclado completo e a um visual mais limpo. Basta indicar o ano de nascimento no perfil e o resto acontece sozinho.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Outros modos",
      heading: "Outras formas de praticar",
      blocks: [
        {
          p: "Além da tua prática diária há um *Teste de Velocidade* — um texto rápido e avulso, que indica as tuas palavras por minuto e a tua precisão, sem lição nenhuma associada; um explorador de *Esquemas*, para comparares esquemas de teclado e os respetivos mapas de dedos; os *Recordes*, para veres como te sais; e corridas *Multijogador*, para medires a tua velocidade com outras pessoas em tempo real.",
        },
        { lab: "Onde encontrá-los" },
        {
          steps: [
            "Abre o menu.",
            "Escolhe Teste de Velocidade, Esquemas, Recordes ou Multijogador.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Se alguma coisa estiver a atrapalhar",
      heading: "Se alguma coisa na aplicação te estiver a atrapalhar",
      blocks: [
        {
          p: "Há uma página inteira para isto, e é definida *por aluno* — por isso os ajustes de uma pessoa nunca mudam os de outra.",
        },
        { lab: "Como abrir" },
        {
          steps: [
            "Abre o menu e escolhe Conta.",
            "Escolhe Acessibilidade.",
            "Escolhe o aluno no topo e depois liga tantas definições quantas precisares.",
          ],
        },
        {
          p: "As cinco definições *combinam-se*. Alguém com dislexia e tremor precisa de duas delas, e obrigar a escolher só uma seria a aplicação a perguntar qual das dificuldades quer acomodar.",
        },
        {
          tips: [
            "Calma — nada se mexe, nada é contado, nada é cronometrado, e falhar um dia não parte a sequência.",
            "Menos coisas ao mesmo tempo — a prática abre apenas com as palavras e o teclado.",
            "Mais fácil de ler — o tipo de letra feito para a dislexia, mais espaço entre letras e linhas, texto mais forte.",
            "Cores distintas — cores de dedos que continuam a distinguir-se com daltonismo, e erros assinalados também em som, não só a vermelho.",
            "Mãos mais firmes — coisas maiores para carregar, nunca duas teclas ao mesmo tempo, e uma tecla que se repete não conta duas vezes.",
          ],
        },
        {
          p: "Por baixo delas, *Definir cada uma à minha maneira* abre todos os interruptores um a um — quinze ao todo, incluindo a velocidade da fala, legendas para tudo o que é dito em voz alta, o número do dedo em cada tecla e durante quanto tempo ignorar uma tecla repetida. Um botão põe tudo isso de novo como estava.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Aprender num teclado braille",
      blocks: [
        {
          p: "Um aluno cego ou com baixa visão tem uma página completamente diferente — escrita braille com seis teclas, um percurso feito de células em vez de letras, e orientação falada do princípio ao fim. É outra maneira de aprender a escrever, não a página das pessoas com visão lida em voz alta.",
        },
        { lab: "Ativar para um aluno" },
        {
          steps: [
            "Abre o menu e escolhe Conta e depois Alunos.",
            "Edita o aluno, ou acrescenta um novo.",
            "Liga o apoio à visão e guarda.",
          ],
        },
        {
          p: "Esse aluno passa a ir diretamente para a página braille sempre que for ele a praticar. O progresso é contado em células em vez de letras, e pode ganhar um certificado nas mesmas condições que qualquer outra pessoa.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Os dois cursos",
      heading: "Prática guiada, Curso clássico e código",
      blocks: [
        {
          p: "A *Prática guiada* é o curso adaptativo: repara em que teclas te atrasam e constrói as lições à volta delas, acrescentando uma letra só depois de escreveres as que já tens depressa e sem erros.",
        },
        {
          p: "O *Curso clássico* é o do antigamente — uma escada fixa de lições numa ordem definida, tal como um manual de dactilografia ensinaria. Há quem simplesmente prefira saber o que vem a seguir.",
        },
        {
          p: "São cursos separados, com históricos separados, e o certificado ganha-se num ou no outro — nunca nos dois somados, o que contaria a tua primeira semana duas vezes. A página Curso, na tua conta, diz sobre qual deles está a informar.",
        },
        {
          p: "O *Ofício do código* é um terceiro tipo de prática: excertos reais numa linguagem à tua escolha, para que os parênteses, os pontos e vírgulas e a indentação tenham o treino que a prosa normal nunca lhes dá.",
        },
        { lab: "Alternar entre eles" },
        {
          steps: [
            "No ecrã de prática, abre as definições da lição.",
            "Escolhe Prática guiada, Curso clássico ou Ofício do código.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certificados",
      heading: "Ganhar um certificado",
      blocks: [
        {
          p: "Um certificado diz que um aluno com determinado nome escreveu a uma velocidade e a uma precisão medidas, numa determinada língua, numa determinada data. É emitido por nós — não é uma qualificação que algum júri de exames ou empregador tenha aceitado reconhecer — e é prova honesta daquilo que alguém realmente fez.",
        },
        { lab: "Ver quanto falta" },
        {
          steps: [
            "Abre o menu e escolhe Conta.",
            "Escolhe Curso.",
            "Cada aluno tem uma linha que mostra todas as condições e o quanto já avançou em cada uma.",
          ],
        },
        {
          p: "As condições são coisas como ter todas as letras introduzidas, todas as letras fiáveis e não apenas vistas uma vez, lições suficientes, dias diferentes suficientes, e uma velocidade e uma precisão mantidas. Quando estão todas cumpridas, aparece nessa linha uma ligação para fazer a avaliação.",
        },
        {
          p: "A avaliação é curta e é corrigida nos nossos servidores, não no teu navegador. Se a passares, o certificado é emitido com um número. Quem receber esse número pode verificá-lo na página *Verificar um certificado* — e és tu que decides se o teu nome lhe é mostrado.",
        },
      ],
    },
    {
      id: "security",
      nav: "Manter a conta segura",
      heading: "Chaves de acesso, códigos e quem tem iniciado sessão",
      blocks: [
        {
          p: "Podes iniciar sessão com uma palavra-passe, com um fornecedor como a Google, com uma ligação enviada para o teu e-mail — ou com uma *chave de acesso*, que é a que nós escolheríamos. Uma chave de acesso usa a impressão digital, o rosto ou o PIN do teu próprio dispositivo; não há palavra-passe nenhuma que possa fugir, e nada do que guardamos poderia servir para entrar como se fosse tu.",
        },
        { lab: "Adicionar uma chave de acesso" },
        {
          steps: [
            "Abre o menu e escolhe Conta e depois Segurança.",
            "Escolhe Adicionar uma chave de acesso e segue as indicações do teu dispositivo.",
          ],
        },
        {
          p: "A *verificação em duas etapas* também existe, com uma aplicação de autenticação e códigos de recuperação para o caso de perderes o telemóvel. Imprime-os e guarda-os num sítio que não seja o telemóvel.",
        },
        {
          p: "A mesma página lista a atividade recente — inícios de sessão, tentativas falhadas, uma chave de acesso adicionada, uma palavra-passe alterada — cada uma com a localização aproximada de onde veio, para que seja fácil dar por alguma coisa que não foste tu. Se parecer mal, *terminar sessão em todo o lado* fecha todas as sessões menos aquela que estás a usar.",
        },
        {
          p: "Há também um *PIN de adulto*, que tranca as definições da conta para que uma criança no dispositivo da família não as possa mudar nem apagar um perfil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Faz dela tua",
      heading: "Faz dela tua",
      blocks: [
        { lab: "Mudar o tema" },
        {
          steps: [
            "Abre o menu e escolhe Conta e depois Aspeto.",
            "Escolhe claro, escuro ou seguir o dispositivo.",
          ],
        },
        {
          p: "Se nenhum dos temas incluídos for o que queres, o *criador de temas* deixa-te misturar o teu — incluindo as cores dos dedos com que o teclado ensina. A aplicação mede o contraste do que escolheres e recusa combinações que ninguém conseguiria ler.",
        },
        {
          p: "Cada aluno da casa pode ter a sua própria cor, para que um dispositivo partilhado continue a parecer de quem está sentado à frente dele.",
        },
        { lab: "Mudar a língua do site" },
        {
          steps: ["Abre o menu.", "Em Língua do site, escolhe a tua língua."],
        },
        {
          p: "No ecrã de prática também podes mudar o tamanho do texto e ligar ou desligar os sons quando te apetecer.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privacidade",
      heading: "Privacidade, numa frase",
      blocks: [
        {
          p: "Sem publicidade e sem rastreadores. O perfil de uma criança nunca sai do teu navegador. Inicia sessão só se quiseres sincronizar ou partilhar; de resto fica tudo neste dispositivo, e podes apagá-lo quando quiseres.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Terminar sessão",
      heading: "Terminar sessão",
      blocks: [
        { lab: "Sair" },
        { steps: ["Abre o menu.", "Escolhe Terminar sessão e confirma."] },
        {
          p: "O teu histórico de prática fica guardado em segurança neste dispositivo — e na tua conta, se criaste uma — pronto para a próxima vez que te sentares a escrever.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Dicas",
      heading: "Alguns hábitos que ajudam mesmo",
      blocks: [
        {
          tips: [
            "Precisão antes de velocidade — é a escrita limpa que fica.",
            "Corrige os erros com calma; não corras para recuperar.",
            "Descansa os dedos na linha de repouso — o F e o J têm pequenos relevos.",
            "Uns minutos todos os dias valem mais do que uma hora uma vez por semana.",
          ],
        },
      ],
    },
  ],
};
