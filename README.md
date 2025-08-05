<h1 align="center">Entendendo e Configurando o BIND</h1>

Este repositório contém guias detalhados para a configuração do BIND 9 (Berkeley Internet Name Domain), um dos servidores DNS mais utilizados no mundo. O objetivo é fornecer um ponto de partida claro tanto para administradores iniciantes quanto para aqueles que precisam de uma referência rápida.

Além disso, você pode encontrar instruções sobre como configurar o BIND de forma simples e direta, baseadas nas explicações e configurações deste repositório no site [Bind no Linux](https://mikaelgois.github.io/setting-bind-dns/).

<h2 align="center">O que é DNS?</h2>

O Sistema de Nomes de Domínio (DNS) é frequentemente chamado de "lista telefônica da internet". A sua função principal é traduzir nomes de domínio legíveis por humanos (como `www.google.com`) em endereços IP numéricos (como `142.251.131.100`) que os computadores usam para se comunicar entre si.

<h2 align="center">Conceitos Fundamentais do BIND</h2>
Antes de mergulhar na configuração, é crucial entender alguns conceitos básicos:

* **Zonas**: Uma zona é uma porção do espaço de nomes de domínio que um servidor DNS gerencia. Por exemplo, um servidor pode ser o "mestre" da zona `exemplo.com`.

    * **Zona de Pesquisa Direta (Forward Lookup Zone)**: Traduz nomes para endereços IP (ex: `servidor.exemplo.com` &#8594; `192.168.1.15`).

    * **Zona de Pesquisa Reversa (Reverse Lookup Zone)**: Traduz endereços IP de volta para nomes (ex: `192.168.1.15` &#8594; `servidor.exemplo.com`).

* **Registos (Records)**: São as entradas dentro de um arquivo de zona que contêm a informação. Os tipos mais comuns são:

    * `SOA`: (Start of Authority) Define as propriedades globais da zona.

    * `A`: Mapeia um nome de host para um endereço IPv4.

    * `AAAA`: Mapeia um nome de host para um endereço IPv6.

    * `CNAME`: (Canonical Name) Cria um alias (apelido) de um nome para outro.

    * `MX`: (Mail Exchanger) Aponta para os servidores de e-mail do domínio.

    * `NS`: (Name Server) Indica quais servidores são autoritativos para a zona.

    * `PTR`: (Pointer) Usado na zona reversa para mapear um IP a um nome.

* **Resolução Recursiva**: É o processo que um servidor DNS realiza para encontrar a resposta para uma consulta sobre um domínio que ele não conhece. Ele "pergunta" a outros servidores na internet, começando pelos servidores raiz, até encontrar a resposta.

* **Encaminhadores (Forwarders)**: Em vez de fazer a resolução recursiva sozinho, um servidor BIND pode ser configurado para simplesmente "encaminhar" todas as consultas externas para outro servidor DNS (como o do Google `8.8.8.8`), que fará o trabalho pesado.

<h2 align="center">Guias de Avançados por Sistema Operacional</h2>
<p align="center">A estrutura de arquivos e os nomes dos pacotes do BIND variam entre as famílias de distribuições Linux. Escolha o guia que corresponde ao seu sistema:</p>

<h3 align="center">
    <a href="BaseRHEL.md">
        <img src="https://images.icon-icons.com/2108/PNG/512/redhat_icon_130844.png" alt="RHEL Logo" width="14"> 
        Sistemas base RHEL
    </a> 
    | 
    <a href="BaseDebian.md">
        Sistemas base Debian
        <img src="https://images.icon-icons.com/2108/PNG/512/debian_icon_130964.png" alt="Debian Logo" width="14">
    </a>
</h3>

---

