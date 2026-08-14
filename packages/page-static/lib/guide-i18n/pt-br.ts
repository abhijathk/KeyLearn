import { type GuideTranslation } from "../guide-content.tsx";

export const ptBr: GuideTranslation = {
  kicker: "Tudo o que você pode fazer",
  title: "Guia do Usuário",
  dateline:
    "O guia completo do KeyLearn — da primeira visita até o momento de sair",
  navLabel: "Nesta página",
  sections: [
    {
      id: "account",
      nav: "Preciso de uma conta?",
      heading: "Preciso de uma conta?",
      blocks: [
        {
          p: "Não. Você pode começar a digitar assim que chegar, e seu progresso é salvo aqui mesmo, neste dispositivo. Crie uma conta gratuita apenas se quiser que seu histórico o acompanhe em outros dispositivos, mantenha um backup ou compartilhe um link de perfil. Nada de útil fica trancado atrás do login.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Login e senhas",
      heading: "Cadastro, login e senhas",
      blocks: [
        { p: "Tudo fica no menu no canto superior direito." },
        { lab: "Criar uma conta" },
        {
          steps: [
            "Abra o menu (canto superior direito).",
            "Escolha Cadastrar.",
            "Informe um e-mail e uma senha.",
            "Confirme — pronto, você está dentro.",
          ],
        },
        { lab: "Fazer login" },
        {
          steps: [
            "Abra o menu e escolha Entrar.",
            "Informe seu e-mail e sua senha.",
          ],
        },
        { lab: "Redefinir uma senha esquecida" },
        {
          steps: [
            "Na tela de Entrar, escolha Esqueci a Senha.",
            "Informe seu endereço de e-mail.",
            "Abra o link de redefinição que enviamos a você.",
            "Escolha uma nova senha e faça login.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Perfis",
      heading: "Perfis para a família toda",
      blocks: [
        {
          p: "O KeyLearn é feito como uma casa: uma conta abriga até quatro perfis (oito com o premium), adultos e crianças em qualquer combinação. Cada perfil mantém seu *próprio* progresso separado neste dispositivo — nada nunca se mistura.",
        },
        { lab: "Adicionar um perfil" },
        {
          steps: [
            "Abra o menu e escolha Conta (ou “Configurar perfis”).",
            "Selecione Adicionar um perfil.",
            "Digite um primeiro nome.",
            "Marque como Adulto ou Criança.",
            "Escolha um avatar — um ícone simpático ou uma Foto do seu dispositivo.",
            "Para uma criança, informe o ano de nascimento (isso apenas ajusta as palavras e o ritmo à idade dela).",
            "Salve.",
          ],
        },
        { lab: "Trocar para outro aprendiz" },
        {
          steps: [
            "Abra o menu.",
            "Toque em um rosto na seção Aprendizes — o app retoma de onde a pessoa parou.",
          ],
        },
        { lab: "Editar ou remover um perfil" },
        {
          steps: [
            "Abra o menu e escolha Conta.",
            "Selecione Editar em um perfil, ou exclua-o para liberar uma vaga.",
          ],
        },
        {
          p: "Perfis de criança recebem um menu simplificado e protegido, e as ações de adulto ficam atrás de um rápido desafio de matemática do tipo “quanto é A vezes B?”, para que os pequenos não se percam nas configurações.",
        },
      ],
    },
    {
      id: "screen",
      nav: "A tela de prática",
      heading: "A tela de prática",
      blocks: [
        {
          p: "É só começar a digitar. A palavra de que você precisa flutua logo acima do teclado na tela; um cometa brilhante aponta para a próxima tecla; as teclas são coloridas por zona de dedo, para você aprender qual dedo alcança cada uma; e um par tênue de mãos em repouso mostra onde seus dedos ficam entre uma tecla e outra. Toda a habilidade se resume a um hábito: manter os olhos nas palavras, não nas mãos.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Sua jornada",
      heading: "Como as lições crescem — sua jornada",
      blocks: [
        {
          p: "O KeyLearn é *adaptativo*. Ele mede com que rapidez e precisão você acerta cada tecla e só acrescenta uma nova letra ao seu conjunto quando você consegue digitar as atuais de forma rápida e correta. Esse conjunto crescente é a sua jornada, de um punhado de letras ao alfabeto inteiro — a dificuldade sobe exatamente na velocidade em que você evolui, nunca mais rápido, para que você esteja sempre trabalhando bem no seu limite.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Estatísticas ao vivo",
      heading: "O painel ao vivo",
      blocks: [
        {
          p: "Enquanto você digita, o painel flutuante mostra sua velocidade e precisão atuais, um minigráfico das rodadas recentes, o andamento das suas metas e sua sequência de dias. Ele está ali para incentivar você, não para importunar.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Ferramentas de prática",
      heading: "Ferramentas de prática",
      blocks: [
        {
          p: "As pequenas ferramentas ao lado do texto permitem abrir um tour guiado, reiniciar a lição atual (Ctrl + Esquerda), pular para a próxima (Ctrl + Direita), mostrar ou ocultar o teclado na tela e redimensionar o texto de prática. A engrenagem abre as Configurações completas, descritas a seguir.",
        },
      ],
    },
    {
      id: "content",
      nav: "O que você digita",
      heading: "Escolhendo o que você digita",
      blocks: [
        {
          p: "Abra as Configurações e vá em Conteúdo de Prática para escolher como suas palavras são formadas:",
        },
        {
          tips: [
            "*Prática guiada* — o padrão adaptativo que amplia seu alfabeto tecla por tecla.",
            "*Curso clássico* — uma marcha fixa e ordenada pelas teclas.",
            "*Palavras frequentes* — as palavras mais comuns do seu idioma.",
            "*Texto de Livro* — digite atravessando livros de verdade embutidos no app.",
            "*Seu Próprio Texto* — cole o que quiser e pratique com isso.",
            "*Trechos de Código* — colchetes, símbolos e o ritmo do código.",
            "*Exercícios de Números* — a linha de números e o teclado numérico.",
          ],
        },
        { lab: "Mudar o que você digita" },
        {
          steps: [
            "Abra as Configurações (a engrenagem perto do texto de prática).",
            "Vá em Conteúdo de Prática.",
            "Escolha um modo — para Texto de Livro escolha um livro; para Seu Próprio Texto cole suas palavras.",
            "Feche as Configurações e continue digitando.",
          ],
        },
        {
          p: "A mesma tela define o tamanho do seu alfabeto, uma velocidade-alvo, a duração de cada lição e uma meta diária.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Prática Inteligente",
      heading: "Auxílios da Prática Inteligente",
      blocks: [
        {
          p: "Além da prática guiada, a Prática Inteligente adiciona auxílios gentis: um exercício de gargalos que caça seus pares de teclas mais lentos, repetição espaçada, revisões de desaprendizado que retomam teclas enferrujadas, confiança inteligente e recuperação de teclas. Todos vêm ativados por padrão.",
        },
        { lab: "Ativar ou desativar um auxílio" },
        {
          steps: [
            "Abra as Configurações.",
            "Vá em Prática Inteligente.",
            "Ative ou desative qualquer auxílio que quiser — ou deixe todos ligados.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Configuração do teclado",
      heading: "Configurando o seu teclado",
      blocks: [
        {
          p: "Em Configurações, Configuração do Teclado é onde você ajusta o KeyLearn ao seu teclado e ao layout que deseja aprender.",
        },
        { lab: "Mudar o layout do seu teclado" },
        {
          steps: [
            "Abra as Configurações.",
            "Vá em Configuração do Teclado.",
            "Escolha seu idioma e depois seu layout (QWERTY, Dvorak, Colemak e outros).",
            "Deixe “Simular este layout” ligado para poder praticá-lo seja qual for a configuração do seu computador.",
            "Observe a prévia ao vivo para confirmar.",
          ],
        },
        {
          p: "Na mesma tela você pode escolher o formato do teclado, colorir as teclas por zona de dedo e destacar a próxima tecla enquanto ainda está aprendendo onde tudo fica.",
        },
      ],
    },
    {
      id: "display",
      nav: "Exibição",
      heading: "Exibição e sensação",
      blocks: [
        {
          p: "As configurações de Exibição e de Entrada de Texto permitem mostrar sua velocidade em palavras ou caracteres por minuto e ajustar finamente como a digitação parece. Restaurar Padrões está sempre a um clique de distância, caso queira começar do zero.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Seu progresso",
      heading: "Seu progresso — a página de Perfil",
      blocks: [
        {
          p: "A página de Perfil é o seu registro completo: as estatísticas de Sempre e de Hoje no topo (tempo praticado, lições concluídas, sua melhor e sua velocidade e precisão típicas, e como o dia de hoje se compara); um mapa de cada letra que você desbloqueou; a história de como cada tecla individual ficou mais rápida, com um controle de suavização; o panorama geral de cada tecla ao longo do tempo; e as transições mais lentas que ainda seguram você. Você pode até correr contra a sua própria última rodada como um fantasma para sentir o progresso diretamente.",
        },
        { lab: "Abrir seu progresso" },
        {
          steps: [
            "Abra o menu.",
            "Escolha Perfil.",
            "Use a linha de filtros para focar em Letras, Dígitos, Pontuação ou Símbolos.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Seus dados",
      heading: "Cuidando dos seus dados",
      blocks: [
        { lab: "Limpar as estatísticas de um perfil" },
        {
          steps: [
            "Abra o Perfil do aprendiz que você quer zerar.",
            "Role até o controle de reinício no fim da página.",
            "Confirme “Apagar tudo” — apenas este perfil é limpo.",
          ],
        },
        { lab: "Baixar seus dados" },
        {
          steps: [
            "Abra o Perfil.",
            "Use a opção de download para salvar seu histórico como um arquivo.",
          ],
        },
        {
          p: "Faça login se quiser que seu histórico sincronize entre dispositivos e para compartilhar um link público de perfil. Não há anúncios nem rastreadores, e você pode excluir seus dados — ou toda a sua conta — quando quiser.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Modo infantil",
      heading: "Modo infantil",
      blocks: [
        {
          p: "As crianças praticam em uma trilha divertida. Cada tecla correta leva o personagem um passo mais perto de casa, e o personagem cresce de um bebezinho até um herói adulto à medida que mais letras são desbloqueadas. Uma tecla recém-aprendida dispara uma pequena comemoração, e cada sessão termina em uma aconchegante fogueira.",
        },
        { lab: "Trocar para o modo infantil" },
        {
          steps: [
            "Abra o menu.",
            "Escolha Infantil — ou selecione um perfil de criança na seção Aprendizes.",
          ],
        },
        {
          p: "Há dois mundos para escolher — Dino Run, com um dinossauro simpático, e Hero Trail, onde um cavaleiro parte em missão por uma floresta — cada um com um personagem para escolher.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Caixa de brinquedos infantil",
      heading: "A caixa de brinquedos infantil",
      blocks: [
        { lab: "Abrir a caixa de brinquedos" },
        {
          steps: [
            "Na tela infantil, toque na engrenagem no topo da área de brincar.",
          ],
        },
        {
          p: "Lá dentro você pode definir o mundo e o personagem, Letras grandes, Sons, Mãos ajudantes (o guia de dedos brilhante), o Teclado (oculto, simples ou o teclado completo de adulto), Letras na trilha (as palavras mostradas como blocos dentro do jogo), um Cronômetro de sessão, Torcidas (mensagens de incentivo) e — escondidos em Avançado — controles de Brilho, Cor e o quão animado o mundo parece. Há também um visual noturno calmo, além do visual diurno brilhante.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Crescendo",
      heading: "Crescendo junto com a sua criança",
      blocks: [
        {
          p: "O KeyLearn se ajusta discretamente à idade da criança. Os menorzinhos veem letras grandes e simpáticas, um ritmo indulgente, blocos de letras direto na trilha e a ajuda mais gentil; as crianças maiores avançam para palavras mais longas, o teclado completo e um visual mais limpo. Basta definir o ano de nascimento no perfil e o resto acontece sozinho.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Outros modos",
      heading: "Outras formas de praticar",
      blocks: [
        {
          p: "Além da sua prática diária, há um *Teste de Velocidade* — uma passagem rápida e avulsa que informa suas palavras por minuto e sua precisão, sem lição vinculada; um explorador de *Layouts* para comparar layouts de teclado e seus mapas de dedos; *Recordes* para ver como você se sai em comparação; e corridas *Multijogador* para desafiar sua velocidade contra outras pessoas em tempo real.",
        },
        { lab: "Onde encontrá-los" },
        {
          steps: [
            "Abra o menu.",
            "Escolha Teste de Velocidade, Layouts, Recordes ou Multijogador.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Se algo estiver atrapalhando",
      heading: "Se algo no app estiver atrapalhando você",
      blocks: [
        {
          p: "Existe uma página inteira para isso, e ela é definida *por aprendiz* — então os ajustes de uma pessoa nunca mudam os de ninguém mais.",
        },
        { lab: "Onde abrir" },
        {
          steps: [
            "Abra o menu e escolha Conta.",
            "Escolha Acessibilidade.",
            "Selecione o aprendiz no topo e ative quantas opções precisar.",
          ],
        },
        {
          p: "As cinco opções se *combinam*. Quem é disléxico e tem tremor precisa de duas delas, e obrigar essa pessoa a escolher só uma seria o app perguntando qual dificuldade merece ser acolhida.",
        },
        {
          tips: [
            "Com calma — nada se move, nada é contado, nada é cronometrado, e um dia perdido não quebra a sequência.",
            "Menos coisas de uma vez — a prática abre só com as palavras e o teclado.",
            "Mais fácil de ler — a fonte criada para a dislexia, mais espaço entre letras e linhas, texto mais forte.",
            "Cores distintas — cores de dedo que continuam distinguíveis no daltonismo, e erros avisados por som além do vermelho.",
            "Mãos mais firmes — alvos maiores para pressionar, nunca duas teclas ao mesmo tempo, e uma tecla que se repete sozinha não conta duas vezes.",
          ],
        },
        {
          p: "Abaixo delas, *Definir cada uma por conta própria* abre todos os interruptores individualmente — quinze deles, incluindo a velocidade da fala, legendas para tudo o que é dito em voz alta, o número do dedo em cada tecla e por quanto tempo ignorar uma tecla repetida. Um único botão devolve todos ao estado original.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Aprendendo em um teclado braille",
      blocks: [
        {
          p: "Um aprendiz cego ou com baixa visão recebe uma página completamente diferente — digitação braille de seis teclas, um currículo em células em vez de letras, e orientação falada o tempo todo. É outro jeito de aprender a digitar, não a página para pessoas videntes lida em voz alta.",
        },
        { lab: "Ativar isso para um aprendiz" },
        {
          steps: [
            "Abra o menu e escolha Conta, depois Aprendizes.",
            "Edite o aprendiz, ou adicione um novo.",
            "Ative o suporte para deficiência visual e salve.",
          ],
        },
        {
          p: "A partir daí, esse aprendiz vai direto para a página braille sempre que for a vez dele praticar. O progresso dele é contado em células em vez de letras, e ele pode conquistar um certificado nas mesmas condições que qualquer outra pessoa.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Os dois cursos",
      heading: "Prática guiada, Curso clássico e código",
      blocks: [
        {
          p: "A *Prática guiada* é o curso adaptativo: ela observa quais teclas atrasam você e monta as lições em torno delas, acrescentando uma letra só quando você consegue digitar as que já tem de forma rápida e precisa.",
        },
        {
          p: "O *Curso clássico* é o modo à moda antiga — uma escada fixa de lições em uma ordem definida, do jeito que um manual de datilografia ensinaria. Algumas pessoas simplesmente preferem saber o que vem a seguir.",
        },
        {
          p: "São cursos separados, com históricos separados, e um certificado é conquistado em um ou no outro — nunca nos dois somados, o que contaria sua primeira semana duas vezes. A página Curso na sua conta diz sobre qual deles ela está falando.",
        },
        {
          p: "O *Código-fonte* é um terceiro tipo de prática: trechos reais em uma linguagem que você escolhe, para que os colchetes, os ponto e vírgulas e a indentação recebam o treino que a prosa comum nunca dá a eles.",
        },
        { lab: "Alternar entre eles" },
        {
          steps: [
            "Na tela de prática, abra as configurações da lição.",
            "Escolha Prática guiada, Curso clássico ou Código-fonte.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certificados",
      heading: "Conquistando um certificado",
      blocks: [
        {
          p: "Um certificado diz que um aprendiz com nome e sobrenome digitou a uma velocidade e a uma precisão medidas, em um idioma específico, em uma data específica. Ele é emitido por nós — não é uma qualificação que alguma banca examinadora ou algum empregador tenha concordado em reconhecer — e é prova honesta do que alguém de fato fez.",
        },
        { lab: "Ver o quanto falta" },
        {
          steps: [
            "Abra o menu e escolha Conta.",
            "Escolha Curso.",
            "Cada aprendiz tem uma linha mostrando todas as condições, com o quanto já avançou em cada uma.",
          ],
        },
        {
          p: "As condições são coisas como todas as letras apresentadas, todas as letras confiáveis e não apenas vistas uma vez, lições suficientes, dias distintos suficientes, e uma velocidade e uma precisão sustentadas. Quando todas são cumpridas, aparece nessa linha um link para fazer a avaliação.",
        },
        {
          p: "A avaliação é curta, e é julgada nos nossos servidores, não no seu navegador. Passe nela e o certificado é emitido com um número. Qualquer pessoa a quem você der esse número pode conferi-lo na página *Conferir um certificado* — e você escolhe se o seu nome aparece para ela.",
        },
      ],
    },
    {
      id: "security",
      nav: "Mantendo sua conta segura",
      heading: "Chaves de acesso, códigos e quem andou entrando",
      blocks: [
        {
          p: "Você pode entrar com uma senha, com um provedor como o Google, com um link enviado para o seu e-mail — ou com uma *chave de acesso*, que é a que nós escolheríamos. Uma chave de acesso usa a digital, o rosto ou o PIN do próprio dispositivo; não há senha alguma para vazar, e nada do que guardamos poderia ser usado para entrar no seu lugar.",
        },
        { lab: "Adicionar uma chave de acesso" },
        {
          steps: [
            "Abra o menu e escolha Conta, depois Segurança.",
            "Escolha Adicionar chave de acesso e siga o pedido do seu dispositivo.",
          ],
        },
        {
          p: "A *verificação em duas etapas* também está ali, usando um app autenticador, com códigos de recuperação caso você perca o celular. Imprima-os e guarde em algum lugar que não seja o celular.",
        },
        {
          p: "A mesma página lista a atividade recente — logins, tentativas de login que falharam, uma chave de acesso adicionada, uma senha alterada — cada uma com a localização aproximada de onde veio, para que algo que você não fez seja fácil de perceber. Se parecer errado, *sair de todos os lugares* encerra todas as sessões, menos a que você está usando.",
        },
        {
          p: "Há também um *PIN dos pais*, que tranca as configurações da conta para que uma criança no dispositivo da família não possa mudá-las nem excluir um perfil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Deixe do seu jeito",
      heading: "Deixe do seu jeito",
      blocks: [
        { lab: "Mudar o tema" },
        {
          steps: [
            "Abra o menu e escolha Conta, depois Aparência.",
            "Escolha claro, escuro ou seguir o dispositivo.",
          ],
        },
        {
          p: "Se nenhum dos temas que já vêm prontos for o que você quer, o *criador de temas* deixa você misturar o seu — incluindo as cores de dedo com que o teclado ensina. O app mede o contraste de tudo o que você escolhe e recusa combinações que ninguém conseguiria ler.",
        },
        {
          p: "Cada aprendiz da casa pode ter a sua própria cor, para que um dispositivo compartilhado continue parecendo de quem está sentado na frente dele.",
        },
        { lab: "Mudar o idioma do site" },
        {
          steps: ["Abra o menu.", "Em Idioma do site, escolha o seu idioma."],
        },
        {
          p: "Na tela de prática você também pode redimensionar o texto e ligar ou desligar os sons quando quiser.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privacidade",
      heading: "Privacidade, em uma frase",
      blocks: [
        {
          p: "Sem anúncios e sem rastreadores. O perfil de uma criança nunca sai do seu navegador. Faça login apenas se quiser sincronização ou compartilhamento; caso contrário, tudo permanece neste dispositivo, e você é livre para apagá-lo a qualquer momento.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Sair",
      heading: "Saindo",
      blocks: [
        { lab: "Sair" },
        { steps: ["Abra o menu.", "Escolha Sair e confirme."] },
        {
          p: "Seu histórico de prática permanece seguro neste dispositivo — e na sua conta, se você criou uma — pronto para a próxima vez que você se sentar para digitar.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Dicas",
      heading: "Alguns hábitos que realmente ajudam",
      blocks: [
        {
          tips: [
            "Precisão antes de velocidade — é a digitação limpa que fixa o aprendizado.",
            "Corrija os erros com calma; não tente correr para recuperar o tempo.",
            "Descanse os dedos na linha de repouso — F e J têm pequenas saliências.",
            "Alguns minutos todos os dias valem mais do que uma hora uma vez por semana.",
          ],
        },
      ],
    },
  ],
};
