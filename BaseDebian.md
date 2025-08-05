# **Guia de configuração do DNS BIND em Sistemas Baseados em Debian**

Este guia detalha o processo de instalação e configuração de um servidor DNS BIND 9 em distribuições como **Debian** e **Ubuntu**. Foi utilizado o **Ubuntu 24.04** como base, mas as instruções são aplicáveis a outras distribuições baseadas em **Debian**.

## **1 - Instalação e Configuração Inicial do Serviço**

### **1.1 - Instalação dos Pacotes BIND**

Para instalar os pacotes, execute o seguinte comando:
```bash
sudo apt install bind9 bind9utils -y
```

Verifique a versão do BIND instalada:
```bash
named -v
```

O resultado exibirá a versão do BIND, por exemplo: BIND 9.16.23-RH.

### **1.2 - O Ambiente `chroot` (Opcional, mas Altamente Recomendado)**

O `chroot` "aprisiona" o BIND num diretório para maior segurança.

Ao contrário de sistemas RHEL, o BIND no Debian/Ubuntu não vem com um pacote `chroot` que automatiza tudo, ou seja, não é necessário instalar nada. A configuração é totalmente manual, mas oferece o mesmo nível de segurança.

**Importante**: Ao usar `chroot` em sistemas baseados em  Debian/Ubuntu, não há sincronização automática de arquivos. Você é responsável por manter os arquivos dentro do ambiente `chroot` atualizados. Ferramentas como `cp` ou `rsync` são necessárias.

#### **1.2.1 - Ativar o `chroot` no BIND**
Edite o arquivo de configuração do serviço BIND para especificar o diretório `chroot`.
```bash
sudo vi /etc/default/named
```

Encontre a linha `OPTIONS` e adicione a flag `-t` para apontar para o diretório `chroot` (o padrão é `/var/lib/bind`).
```bash
OPTIONS="-u bind -t /var/lib/bind"
```

#### **1.2.2 - Criar a Estrutura de Diretórios e Copiar Arquivos**
O BIND precisa acessar a vários diretórios e arquivos do sistema. Precisamos de recriar esta estrutura dentro do `chroot`.
* Parar o BIND antes de fazer as alterações
  ```bash
  sudo systemctl stop named
  ```

* Criar a estrutura de diretórios base
  ```bash
  sudo mkdir -p /var/lib/bind/etc
  sudo mkdir -p /var/lib/bind/dev
  sudo mkdir -p /var/lib/bind/var/cache/bind
  sudo mkdir -p /var/lib/bind/var/lib/bind
  sudo mkdir -p /var/lib/bind/var/run/named
  ```

* Criar os dispositivos nulos e aleatórios essenciais
  ```bash
  sudo mknod /var/lib/bind/dev/null c 1 3
  sudo mknod /var/lib/bind/dev/random c 1 8
  sudo chmod 666 /var/lib/bind/dev/*
  ```

* Mover a configuração existente para dentro do chroot
  ```bash
  sudo mv /etc/bind /var/lib/bind/etc/
  ```
* Recriar o link simbólico para compatibilidade
  ```bash
  sudo ln -s /var/lib/bind/etc/bind /etc/bind
  ```
* Ajustar as permissões
  ```bash
  sudo chown -R bind:bind /var/lib/bind/var/*
  sudo chown -R bind:bind /var/lib/bind/etc/bind
  ```

#### **1.2.3 - Ajustar o Perfil do AppArmor**
O AppArmor é um sistema de segurança, e pode acabar bloqueando o BIND de acessar os seus novos caminhos. Precisamos de lhe dizer para permitir a operação no modo `chroot`.
* Adicione o diretório `chroot` ao arquivo de abstração do AppArmor
  ```bash
  echo '  /var/lib/bind/** rwk,' | sudo tee -a /etc/apparmor.d/local/usr.sbin.named
  ```

* Recarregue o perfil do AppArmor
  ```bash
  sudo systemctl reload apparmor
  ```

#### **1.2.4 - Automatizando a Sincronização com `rsync`**
Como não há sincronização automática, usar `rsync` é a forma mais eficiente de garantir que as suas alterações de configuração sejam copiadas para o ambiente `chroot`. O `rsync` é inteligente e só copia os arquivos que foram alterados.

* Instale o `rsync` se ainda não estiver instalado:
  ```bash
  sudo apt install rsync -y
  ```

* Crie um script simples para automatizar este processo.:
  ```bash
  sudo vi /usr/local/bin/sync-bind-chroot.sh
  ```

* Adicione o seguinte conteúdo ao script:
  ```bash
  #!/bin/bash
  # Script para sincronizar a configuração do BIND para o ambiente chroot.

  echo "Sincronizando /etc/bind/ para /var/lib/bind/etc/bind/..."

  rsync -av --delete /etc/bind/ /var/lib/bind/etc/bind/

  echo "Sincronização concluída."
  echo "Recarregando o serviço BIND para aplicar as alterações..."
  echo "sudo systemctl reload named"
  ```

  * `-a`: Modo "archive", que preserva permissões, proprietários e outras propriedades dos arquivos.
  * `-v`: Modo "verbose", que mostra os arquivos que estão a ser copiados.
  * `--delete`: Apaga arquivos no destino que não existem mais na origem, mantendo os diretórios perfeitamente sincronizados.

* Torne o script executável:
  ```bash
  sudo chmod +x /usr/local/bin/sync-bind-chroot.sh
  ```

Agora, sempre que você fizer uma alteração nos seus arquivos de configuração em `/etc/bind/`, basta executar `sudo sync-bind-chroot.sh` para garantir que o ambiente `chroot` está atualizado antes de recarregar o `bind9`.

#### **1.2.5 - (Avançado) Automatização Completa com `incron`**
Executar o script manualmente é bom, mas podemos automatizar completamente a sincronização usando o `incron`, um daemon que executa comandos com base em eventos do sistema de arquivos. O `incron` funciona de forma semelhante ao `cron`, mas em vez de agendar tarefas com base em intervalos de tempo fixos, ele reage a alterações em arquivos e diretórios.

* Instale o incron:
  ```bash
  sudo apt install incron -y
  ```

* Permita que o utilizador `root` use o incron:
  Por segurança, o `incron` só permite os utilizadores listados em `incron.allow`.
  ```bash
  echo "root" | sudo tee /etc/incron.allow
  ```

* Crie uma Tabela de Eventos para o `root`:
  Abra o editor de tabelas do `incron` para o utilizador `root`.
  ```bash
  sudo incrontab -e
  ```

* Adicione a Regra de Monitorização:
  Adicione a seguinte linha ao arquivo que abriu. Esta linha diz ao `incron` para monitorizar o diretório `/etc/bind` e executar o nosso script sempre que um arquivo for modificado, criado ou apagado:
  ```
  /etc/bind/ IN_MODIFY,IN_CREATE,IN_DELETE,IN_MOVE /usr/local/bin/sync-bind-chroot.sh
  ```

  * `/etc/bind/`: O diretório a ser vigiado.

  * `IN_MODIFY,IN_CREATE,...`: Os eventos que disparam a ação (modificação, criação, etc.).

  * `/usr/local/bin/sync-bind-chroot.sh`: O comando a ser executado.

  Salve e feche o arquivo. O `incron` começará a monitorizar o diretório imediatamente. A partir de agora, qualquer alteração que você salvar nos seus arquivos de configuração do BIND irá disparar automaticamente o script `rsync`, mantendo o seu ambiente `chroot` sempre sincronizado.

### **1.3 - Gerenciamento do Serviço com `systemd`**

No Ubuntu, como em outras distribuições Linux modernas, os serviços são gerenciados pelo sistema de `init systemd`. O daemon do BIND, `named`, é controlado através da ferramenta de linha de comando `systemctl`.

A tabela abaixo resume os comandos essenciais do systemctl para o serviço BIND.

| Ação | Comando |
| :---- | :---- |
| Iniciar Serviço | `sudo systemctl start named` |
| Parar Serviço | `sudo systemctl stop named` |
| Reiniciar Serviço | `sudo systemctl restart named` |
| Recarregar Configuração | `sudo systemctl reload named` |
| Habilitar no Boot | `sudo systemctl enable named` |
| Desabilitar no Boot | `sudo systemctl disable named` |
| Verificar Estado | `sudo systemctl status named` |
| Habilitar e Iniciar | `sudo systemctl enable --now named` |

## **2 - Protegendo o Perímetro com `iptables` ou `ufw`**

### **2.1 - Usando `ufw` (Uncomplicated Firewall)**

O `ufw` (Uncomplicated Firewall) é uma ferramenta de configuração de firewall que facilita a gestão de regras de firewall no Ubuntu.

Para instalar e habilitar o `ufw`, execute os seguintes comandos:
```bash
sudo apt install ufw -y
sudo ufw enable
```

#### **2.1.1 - Método Padrão com `ufw` (Recomendado)**
Este método utiliza o perfil de aplicação do BIND para abrir as portas necessárias.
```bash
sudo ufw allow bind9
sudo ufw reload
```

### **2.1.2 - Método Granular com `ufw`**
Permite restringir o acesso a redes específicas, o que é mais seguro. O exemplo abaixo permite consultas da rede `192.168.1.0/24` para a porta `53`.
```bash
sudo ufw allow from 192.168.1.0/24 to any port 53
sudo ufw reload
```

### **2.2 - Usando `iptables`**

Para administradores que preferem um controle direto ou que trabalham em sistemas onde o ufw não está instalado, é possível configurar o firewall usando a ferramenta `iptables`, que é a base do Netfilter no kernel do Linux.

**Importante**: As regras do iptables são voláteis e perdem-se na reinicialização. Para as tornar permanentes, é necessário o pacote `iptables-persistent`.

Para instalar o `iptables` (caso não esteja instalado) e o `iptables-persistent`, execute:
```bash
sudo apt-get update
sudo apt-get install iptables iptables-persistent -y
```

Durante a instalação, ser-lhe-á perguntado se deseja salvar as regras IPv4 e IPv6 atuais. Pode escolher "Sim" para ambas.

Para adiconar as regras para DNS, execute os seguintes comandos para permitir o tráfego de entrada na porta 53 para os protocolos UDP e TCP.
```bash
sudo iptables -A INPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 53 -j ACCEPT
```

Depois de adicionar as regras, execute o seguinte comando para as salvar e garantir que são carregadas na próxima inicialização.
```bash
sudo netfilter-persistent save
```

As suas regras de iptables para o BIND estão agora configuradas e são permanentes.

## **3 - Configuração Básica do BIND: O Arquivo `named.conf.options`**

O coração da configuração do BIND reside no arquivo `/etc/bind/named.conf.options`. A forma como este arquivo é configurado é ditada fundamentalmente pelo propósito do servidor DNS. Existem duas funções primárias: um **servidor autoritativo**, que detém os registros oficiais para um ou mais domínios, e um **servidor recursivo (ou de cache)**, que resolve consultas em nome de clientes locais, consultando outros servidores DNS na Internet. Um servidor pode desempenhar ambas as funções, mas as diretivas de configuração, especialmente as de segurança, mudam drasticamente com base nestes papéis.

### **3.1 - Explicação do `/etc/bind/named.conf.options`**

Diferente dos sistemas baseados em RHEL que as configurações são realizadas no arquivo principal (`/etc/named.conf`), e o arquivo principal utiliza geralmente a diretiva `include` para carregar arquivos de configuração adicionais como as zonas direta e reversa, no Debian/Ubuntu o arquivo `named.conf` contem apenas as diretivas `include` dos arquivos `/etc/bind/named.conf.options` (onde são declarados o bloco `options {}` e `logging {}`), o arquivo `/etc/bind/named.conf.local` (onde são declaradas as zonas) e o arquivo `/etc/bind/named.conf.default-zones` (onde são declaradas as zonas padrão).

Aqui nesse subtopico, vamos focar no arquivo `/etc/bind/named.conf.options`, que é onde você define as opções globais do BIND.

### **3.2 - Diretivas Essenciais no Bloco options**

* **`listen-on port 53 {... };`**: Especifica em quais endereços **IPv4** o **BIND** deve escutar por consultas. É uma prática de segurança crucial especificar os endereços IP do servidor aqui, em vez de usar **any**, para evitar que o **BIND** se ligue a interfaces inesperadas. Para um servidor local, isto seria o seu endereço IP na **LAN** e o endereço de **loopback (127.0.0.1)**.  
  * Exemplo: **`listen-on port 53 { 127.0.0.1; 192.168.1.10; }`**;  
* **`listen-on-v6 port 53 {... };`**: O equivalente para endereços IPv6.  
  * Exemplo: **`listen-on-v6 port 53 { ::1; }`**;  
* **`directory "/var/cache/bind";`**: Define o diretório de trabalho do BIND. Todos os caminhos de arquivo relativos para arquivos de zona serão baseados neste diretório.  
* **`allow-query {... };`**: Controla quais clientes (por endereço IP, sub-rede ou Access Control List - ACL) têm permissão para fazer consultas ao servidor. Esta é uma diretiva de segurança fundamental. Para um servidor que serve apenas uma rede local, deve ser restringida a essa rede.  
  * Exemplo: **`allow-query { localhost; 192.168.1.0/24; }`**;

### **3.3 - Diretivas Críticas de Segurança (Recursão e Transferências)**

A configuração da recursão é talvez o aspeto de segurança mais crítico do BIND. Um "open resolver" (resolvedor aberto) é um servidor DNS que aceita e processa consultas recursivas de qualquer cliente na Internet, tornando-se um vetor para ataques de amplificação de DNS.

* **Configuração para um Servidor Autoritativo (sem recursão):** Se o servidor existe apenas para responder por um domínio específico (ex: exemplo.com), a recursão deve ser desabilitada globalmente.
  * **`recursion no;`**: Controla se o servidor deve realizar consultas recursivas. Para um servidor autoritativo, isso deve ser desabilitado.

  * **`allow-transfer { ... };`**: Se existirem servidores secundários (escravos), esta diretiva deve ser usada para permitir que apenas esses servidores específicos solicitem uma cópia completa dos dados da zona (um processo chamado AXFR). Se não houver escravos, pode ser definida como **`{ none; }`**.

* **Configuração para um Servidor Recursivo/Cache (para uma LAN):** Se o objetivo é que o servidor resolva nomes de domínio da Internet para os clientes da rede local, a recursão deve ser habilitada, mas estritamente controlada.
  * **`recursion yes;`**: Controla se o servidor deve realizar consultas recursivas. Para um servidor recursivo, isso deve ser habilitado.
  * **`allow-recursion { ... };`**: Esta é a diretiva **crítica**. Ela garante que apenas os clientes da rede local (192.168.1.0/24) e o próprio servidor (localhost) possam fazer consultas recursivas. **Nunca** deve ser definida como **`{ any; };`** num servidor com um endereço IP público.
      * Exemplo: **`allow-recursion { localhost; 192.168.1.0/24; };`**

  * **`forwarders { ... };`**: Se o servidor for configurado para realizar consultas recursivas, esta diretiva especifica quais servidores DNS devem ser usados como encaminhadores. É uma prática comum usar servidores públicos como os do Google (8.8.8.8, 8.8.4.4) ou Cloudflare (1.1.1.1).
  * Exemplo: **`forwarders { 8.8.8.8; 8.8.4.4; };`**
  * **`forward only;`**: Se a diretiva `forwarders` for usada, esta opção instrui o BIND a não tentar resolver as consultas por si mesmo se os encaminhadores não responderem.

A decisão de habilitar a recursão (**`recursion yes;`**) cria a necessidade imediata e inegociável de restringir quem pode usar essa recursão através de **`allow-recursion`**. Falhar neste ponto é um dos erros de configuração de segurança mais comuns e perigosos.

### **3.4 - Diretivas do Bloco `logging`**:

O bloco `logging {}` é opcional, mas altamente recomendado para monitorar a atividade do servidor DNS. Ele permite que o administrador configure onde e como os logs do BIND serão gravados.

* **`channel default_log { ... };`**: Define um canal de log padrão. O exemplo abaixo grava logs no arquivo `/var/cache/bind/default.log` com nível de severidade `info`.

  ```conf
  channel default_log {
      file "default.log" versions 3 size 20M;
      severity info;
      print-time yes;
      print-category yes;
      print-severity yes;
  };
  ```
  * **`file "...";`**: Especifica o caminho do arquivo de log. Você pode informar o caminho completo ou um caminho relativo ao diretório definido na diretiva `directory` no bloco `options {}`. Além disso, é possível definir o número máximo de versões do arquivo de log a serem mantidas e o tamanho máximo de cada arquivo de log.
  * **`severity info;`**: Define o nível de severidade dos logs. Os níveis comuns incluem `debug`, `info`, `notice`, `warn`, `error`, `critical`, e `alert`.
  * **`print-time yes;`**: Adiciona um carimbo de data/hora a cada entrada de log, o que é útil para rastrear eventos.
  * **`print-category yes;`**: Inclui a categoria do log (como `queries`, `security`, etc.) em cada entrada, facilitando a filtragem e análise.
  * **`print-severity yes;`**: Inclui o nível de severidade em cada entrada de log, permitindo uma análise mais fácil dos problemas.

## **4 - Zonas Autoritativas: Pesquisa Direta e Reversa**

Uma vez que a configuração global do BIND está definida, o próximo passo é criar os arquivos de dados que contêm os registros DNS para os domínios que o servidor irá gerir. Estes são conhecidos como arquivos de zona. Uma configuração completa inclui tanto uma zona de pesquisa direta (que mapeia nomes para IPs) quanto uma zona de pesquisa reversa (que mapeia IPs para nomes).

### **4.1 - Declaração de uma Zona de Pesquisa Direta (Forward Lookup Zone)**

As zonas de pesquisa direta e reversa são declaradas no arquivo `/etc/bind/named.conf.local`. Este arquivo é incluído pelo BIND através da diretiva `include` no arquivo `named.conf` e é onde você define as zonas que o servidor irá gerir.

A declaração de uma zona mestra (primária) para um domínio como exemplo.local teria a seguinte aparência:
```
zone "exemplo.local" {
  type master;
  file "/etc/bind/exemplo.local.db";
  allow-update { none; };
};
```

* **`type master;`**: Indica que este servidor detém a cópia autoritativa e editável dos dados da zona.  
* **`file "/etc/bind/exemplo.local.db";`**: Especifica o nome do arquivo que contém os registros da zona. Este caminho é relativo ao diretório especificado na diretiva `directory` no bloco `options`. Também é possível usar caminhos absolutos, como é o caso aqui.
* **`allow-update { none; };`**: Por segurança, desabilita as atualizações dinâmicas de DNS para esta zona, o que significa que todas as alterações devem ser feitas manualmente editando o arquivo de zona.

### **4.2 - Construindo o Arquivo de Zona Direta**

O arquivo de zona é um arquivo de texto simples que contém os registros DNS. Ele deve ser criado no diretório **`/etc/bind/`** e ter as permissões corretas para que o processo **`named`** possa lê-lo. É comum definir a propriedade para **`root:bind`** e as permissões para **`640`**. Caso os arquivos sejam criados em uma pasta diferente, por exemplo, **`/etc/bind/zones/`**, é necessário ajustar o caminho no arquivo de declaração de zona do BIND e garantir que o processo **`named`** tenha acesso a essa pasta adicionando as a propriedade da pasta para **`root:bind`** e as permissões da pasta para **`740`**.

Abaixo está um exemplo de um arquivo de zona direta (**`/etc/bind/exemplo.local.db`**) com explicações detalhadas:
```
$TTL 1D  
@       IN      SOA     ns1.exemplo.local. admin.exemplo.local. (  
                        2024052101      ; Serial (Formato YYYYMMDDNN)
                        1H              ; Refresh
                        15M             ; Retry
                        1W              ; Expire
                        1D )            ; Negative Cache TTL

; Registros de Servidor de Nomes (NS)
@       IN      NS      ns1.exemplo.local.

; Registros de Endereço (A e AAAA) 
ns1     IN      A       192.168.1.10  
servidorweb IN  A       192.168.1.15
servidorweb IN  AAAA    2001:db8:1::15

; Registros de Troca de Correio (MX)
@       IN      MX      10 mail.exemplo.local.
mail    IN      A       192.168.1.20

; Registros de Nome Canônico (CNAME)
www     IN      CNAME   servidorweb.exemplo.local.
```

O registro **SOA** (**`Start of Authority`**) é o mais crítico. Ele define os parâmetros autoritativos para a zona. O campo **`Serial`** é de extrema importância: ele deve ser incrementado **toda vez** que o arquivo de zona for modificado. Os servidores secundários usam este número para detectar que uma nova versão da zona está disponível para transferência. Um formato comum e recomendado é **`YYYYMMDDNN`**, onde **`NN`** é um contador de duas dígitos para as alterações feitas no mesmo dia.

A tabela a seguir resume os tipos de registros mais comuns utilizados nos arquivos de zona.

| Tipo de Registro | Nome Completo | Propósito e Exemplo de Uso |
| :---- | :---- | :---- |
| `A` | `Address` | Mapeia um nome de host para um endereço IPv4. Ex: `servidor IN A 192.168.1.5` |
| `AAAA` | `IPv6 Address` | Mapeia um nome de host para um endereço IPv6. Ex: `servidor IN AAAA 2001:db8::5` |
| `CNAME` | `Canonical Name` | Cria um alias (apelido) de um nome de host para outro nome de host (o nome canônico). Ex: `www IN CNAME servidorweb` |
| `MX` | `Mail Exchanger` | Especifica os servidores de e-mail para o domínio, com um número de prioridade (menor é mais prioritário). Ex: `@ IN MX 10 mail.exemplo.local.` |
| `NS` | `Name Server` | Delega uma zona a um servidor de nomes autoritativo. Ex: `@ IN NS ns1.exemplo.local.` |
| `PTR` | `Pointer` | Usado em zonas reversas para mapear um endereço IP de volta a um nome de host. Ex: `5 IN PTR servidor.exemplo.local.` |
| `SOA` | `Start of Authority` | Declara a autoridade para a zona, contendo o servidor mestre, e-mail do administrador, serial e timers. |
| `TXT` | `Text` | Permite associar texto arbitrário a um domínio. Usado para SPF, DKIM, verificação de propriedade de domínio, etc. |

A tabela a seguir resume os tipos de timers mais comuns utilizados no registro SOA.

| Timer | Descrição |
| :---- | :---- |
| `Serial` | O número da versão deste arquivo de zona. Servidores de nomes secundários somente atualizam suas cópias da zona se o número de série no servidor primário for maior. Formato comum: **`YYYYMMDDNN`** onde **`NN`** é um contador de duas dígitos para as alterações feitas no mesmo dia. |
| `Refresh` | O tempo que os servidores secundários devem aguardar antes de verificar no servidor primário se a zona foi atualizada. |
| `Retry` | O tempo após o qual um servidor secundário tenta consultar novamente o servidor primário após uma tentativa com falha. |
| `Expire` | O tempo após o qual um servidor secundário para de consultar o servidor primário, se todas as tentativas anteriores falharam. |
| `Negative Cache TTL (Minimum)` | A `RFC 2308` alterou o significado deste campo para o tempo de cache negativo. Resolvedores compatíveis o utilizam para determinar por quanto tempo os erros de nome `NXDOMAIN` devem ser armazenados em cache. |
| `$TTL` | O tempo de vida padrão para todos os registros na zona, a menos que especificado de outra forma. |

### **4.3 - Declaração de uma Zona de Pesquisa Reversa (Reverse Lookup Zone)**

Uma zona de pesquisa reversa permite resolver um endereço IP para um nome de host, o que é crucial para muitos serviços de rede, como servidores de e-mail e alguns protocolos de autenticação. O nome da zona é construído de uma forma especial: os octetos do prefixo da rede IP são invertidos e o sufixo **`.in-addr.arpa`** é adicionado. Por exemplo, para a rede **`192.168.1.0/24`**, a zona reversa correspondente é **`1.168.192.in-addr.arpa`**.

A declaração desta zona no arquivo de configuração é semelhante à da zona direta:
```
zone "1.168.192.in-addr.arpa" IN {
    type master;
    file "1.168.192.db";
    allow-update { none; };
};
```

### **4.4 - Construindo o Arquivo de Zona Reversa**

O arquivo de zona reversa também requer registros `SOA` e `NS`, mas o seu principal objetivo é conter registros `PTR` (Pointer). Estes registros fazem o mapeamento inverso de IP para nome. Para um determinado prefixo de rede, o registro `PTR` só precisa de especificar o último octeto do endereço IP. Caso os arquivos sejam criados em uma pasta diferente, por exemplo, **`/etc/bind/zones/`**, é necessário ajustar o caminho no arquivo de declaração de zona do BIND e garantir que o processo **`named`** tenha acesso a essa pasta adicionando as a propriedade da pasta para **`root:bind`** e as permissões da pasta para **`740`**.

Exemplo de arquivo de zona reversa (**`/var/named/1.168.192.in-addr.arpa.db`**) para a rede **`192.168.1.0/24`**:
```
$TTL 1D
@       IN      SOA     ns1.exemplo.local. admin.exemplo.local. (
                        2024052101      ; Serial
                        1H              ; Refresh
                        15M             ; Retry  
                        1W              ; Expire
                        1D )            ; Negative Cache TTL

; Servidores de Nomes
@       IN      NS      ns1.exemplo.local.

; Registros de Ponteiro (PTR)
10     IN      PTR     ns1.exemplo.local.
15     IN      PTR     servidorweb.exemplo.local.
20     IN      PTR     mail.exemplo.local.
```

Neste exemplo, o endereço IP `192.168.1.10` será resolvido para o nome de host **`exemplo.local.`**.

## **5 - Validação, Ativação e Configuração do Cliente**

Após a criação dos arquivos de configuração e de zona, é fundamental seguir um processo metódico de validação antes de ativar o serviço. Este processo não é linear, mas sim um ciclo iterativo de "**editar &#8594; validar &#8594; recarregar &#8594; testar**", que garante a estabilidade do serviço e facilita a depuração de erros.

### **5.1 - Verificações Prévias: `named-checkconf` e `named-checkzone`**

Tentar iniciar ou recarregar o BIND com arquivos de configuração ***sintaticamente*** incorretos resultará em falha. Para evitar isso, o BIND fornece duas ferramentas de validação essenciais que devem ser executadas após qualquer modificação.

* **`named-checkconf`**: Esta ferramenta verifica a sintaxe do arquivo principal `/etc/named.conf` e de todos os arquivos que ele inclui. Se a sintaxe estiver correta, o comando não produzirá nenhuma saída. Qualquer erro será reportado, indicando o arquivo e o número da linha.  
  ``` 
  sudo named-checkconf
  ```

* **`named-checkzone`**: Esta ferramenta verifica a sintaxe e a integridade de um arquivo de zona individual. É necessário especificar o nome da zona e o caminho para o arquivo de zona correspondente. Um resultado bem-sucedido mostrará uma mensagem "OK" e o número de série carregado.  
    * Validar a zona direta  
        ```
        sudo named-checkzone exemplo.local /etc/bind/exemplo.local.db
        ```

    * Validar a zona reversa
        ```  
        sudo named-checkzone 1.168.192.in-addr.arpa /etc/bind/1.168.192.in-addr.arpa.db
        ```

A execução bem-sucedida destes dois comandos fornece um alto grau de confiança de que o BIND será capaz de carregar a nova configuração sem problemas.

### **5.2 - Ativando o Servidor BIND**

Com a configuração validada, o serviço pode ser ativado. Se esta for a primeira vez, o serviço deve ser iniciado e habilitado. Se for uma atualização de uma configuração existente, um reload é suficiente e preferível a um restart, pois não interrompe o serviço.

* Para aplicar alterações a um serviço em execução  
  ```
  sudo systemctl reload named
  ```

* Para iniciar e habilitar o serviço pela primeira vez  
  ```
  sudo systemctl enable --now named
  ```

Após a ativação, é prudente verificar os logs do sistema para garantir que não ocorreram erros durante o carregamento.
```
journalctl -u named -f --since "1 minute ago"
```

### **5.3 - Verificação com `dig` e `nslookup`**

O passo final do ciclo é testar se o servidor DNS está a responder corretamente às consultas. As ferramentas `dig` e `nslookup` são usadas para este fim.

`dig` (Domain Information Groper) é geralmente preferido em ambientes Linux pela sua saída detalhada e flexibilidade.

* **Testando a Resolução Direta:** Para consultar um registro `A` para `servidorweb.exemplo.local`, especificando que a consulta deve ser enviada para o nosso servidor BIND em `192.168.1.10`:
  ```bash
  dig @192.168.1.10 servidorweb.exemplo.local A
  ```

  A seção `ANSWER SECTION` na saída deve mostrar o endereço IP correto (`192.168.1.15`).

* **Testando a Resolução Reversa:** Para realizar uma consulta de pesquisa reversa (`PTR`) para o IP `192.168.1.15`, usa-se a opção `-x`:  
  ```bash
  dig @192.168.1.10 -x 192.168.1.15
  ```

  A seção `ANSWER SECTION` deve mostrar o nome de host correto (`servidorweb.exemplo.local.`).

* **Exemplos com `nslookup`:** Os testes equivalentes com `nslookup` seriam:
  * Consulta direta  
    ```bash
    nslookup servidorweb.exemplo.local 192.168.1.10
    ```

  * Consulta reversa  
    ```bash
    nslookup 192.168.1.15 192.168.1.10
    ```

Se os testes forem bem-sucedidos, o ciclo está completo. Se falharem, o administrador deve voltar ao passo de edição, verificar os arquivos de configuração e de zona, e repetir o ciclo de validação e teste. Esta metodologia iterativa é a chave para uma gestão eficaz e segura do BIND.

É interesssante verificar as requisições DNS recebidas pelo servidor. Isso pode ser feito com o comando:
```bash
sudo tcpdump -i enp0s3 -n 'port 53 and host IP_DO_SERVIDOR_DNS'
```

### **5.4 - Configurando Clientes Ubuntu**

Para que os clientes na rede possam usar o novo servidor DNS, os seus resolvedores de DNS devem ser configurados para apontar para o endereço IP do servidor BIND. No Ubuntu, isso é feito editando o arquivo de configuração do netplan `/etc/netplan/SEU_ARQUIVO.yaml` e o arquivo `/etc/resolv.conf`.

É importante **adicionar** o novo servidor DNS à lista de servidores existentes, em vez de o substituir, para não perder o acesso a nomes de domínio na Internet (a menos que o servidor BIND local também esteja configurado para recursão).

Acesse o arquivos de configuração do netplan:
```bash
sudo nano /etc/netplan/SEU_ARQUIVO.yaml
```

Faças as modificações conforme exemplificado a baixo:

* Antes:
  ```yaml
  network:
    version: 2
    ethernets:
      enp0s3:
        dhcp4: no
        addresses:
          - 192.168.1.20/24
        nameservers:
          addresses:
            - 8.8.8.8
        routes:
          - to: default
            via: 192.168.1.1
  ```

* Depois:
  ```yaml
  network:
    version: 2
    ethernets:
      enp0s3:
        dhcp4: no
        addresses:
          - 192.168.1.20/24
        nameservers:
          addresses:
            - 192.168.1.10
            - 8.8.8.8
        routes:
          - to: default
            via: 192.168.1.1
  ```

Após salvar as alterações, aplique-as com o comando:
```bash
sudo netplan try
```

Esse comando testa as novas configurações. Se tudo estiver correto, você pode aplicar permanentemente com apenas clicando `Enter` quando solicitado, ou usando:
```bash
sudo netplan apply
```

Depois, é necessários modificar o arquivo `/etc/resolv.conf` para garantir que o servidor DNS local seja usado como o primeiro resolvedor. Este arquivo é frequentemente gerado automaticamente pelo netplan, mas pode ser editado manualmente para garantir que as alterações sejam persistentes.
```bash
sudo nano /etc/resolv.conf
```

Adicione a linha com o endereço do servidor DNS para inclui-lo:
```
nameserver 192.168.1.10
```

Salve o arquivo e saia do editor. Depois de fazer essas alterações, é recomendável reiniciar o serviço de resolução de nomes para garantir que as novas configurações sejam aplicadas corretamente:
```bash
sudo systemctl restart systemd-resolved
```

## **6 - Configurações Avançadas do BIND**

Uma vez que a funcionalidade básica do servidor DNS está estabelecida e testada, é possível explorar recursos avançados para aumentar a redundância, a flexibilidade e a segurança. A implementação destes recursos, no entanto, não deve ser uma decisão impulsiva; exige um planejamento cuidadoso da arquitetura de rede, pois as suas implicações vão muito além da configuração de um único servidor.

### **6.1 - Implementando um Servidor DNS Secundário (Slave)**

**Considerações de Planejamento:** Antes de configurar um servidor secundário, é necessário garantir que existe um segundo host com conectividade de rede estável ao servidor primário (mestre). As regras de firewall em ambos os servidores devem ser ajustadas para permitir o tráfego de transferência de zona (porta 53/TCP) entre eles.

**Conceito e Benefícios:** A arquitetura mestre-escravo é o método padrão para fornecer redundância e balanceamento de carga para um serviço DNS. O servidor mestre detém a cópia editável dos arquivos de zona, enquanto um ou mais servidores escravos obtêm cópias somente leitura desses arquivos através de um processo chamado transferência de zona (AXFR/IXFR). Se o servidor mestre falhar, os escravos podem continuar a responder às consultas, garantindo a alta disponibilidade do serviço.

**Configuração no Servidor Mestre:** No servidor mestre, os blocos zone no arquivo de configuração devem ser modificados para permitir a transferência para o IP do servidor escravo.
```
zone "exemplo.local" IN {  
    type master;  
    file "/etc/bind/exemplo.local.db";  
    allow-transfer { 192.168.1.11; }; // IP do servidor escravo  
    also-notify { 192.168.1.11; };    // Notifica o escravo sobre alterações  
};
```
**Configuração no Servidor Escravo:** No servidor escravo, o bloco zone é configurado com type slave e aponta para o endereço IP do mestre.
```
zone "exemplo.local" IN {  
    type slave;  
    file "/etc/bind/slaves/exemplo.local.db";
    masters { 192.168.1.10; };     // IP do servidor mestre  
};
```

Em sistemas com AppArmor ativado (o padrão do Ubuntu), serviço de segurança semelhante ao SELinux, pode ser necessário ajustar o arquivo de configuração do serviço para permitir que o processo `named` possa acessar os seus novos caminhos, como por exemplo `/etc/bind/slaves/`.
```bash
echo '  /etc/bind/slaves/** rwk,' | sudo tee -a /etc/apparmor.d/local/usr.sbin.named
```

Recarregue o perfil do AppArmor
```bash
sudo systemctl reload apparmor
```

### **6.2 - DNS de Horizonte Dividido (Split-Horizon) com view**

**Considerações de Planejamento:** A implementação de um DNS de horizonte dividido requer uma refatoração completa do arquivo de declaração de zonas (`/etc/bind/named.conf.local`). Todas as declarações de zona existentes devem ser movidas para dentro de blocos `view`. É crucial mapear claramente quais clientes pertencem a qual visão (interna ou externa) antes de iniciar a configuração.

**Caso de Uso:** Este é um cenário comum em que um servidor precisa fornecer respostas DNS diferentes dependendo da origem da consulta. Por exemplo, para `servidorweb.exemplo.com`, os clientes internos devem receber um endereço IP privado (ex: `192.168.1.15`), enquanto os clientes externos (da Internet) devem receber um endereço IP público. Isto é conseguido com a diretiva `view`.

**Configuração com view:** O `/etc/bind/named.conf.local` é estruturado com múltiplos blocos `view`. A diretiva `match-clients` é usada para especificar quais clientes se enquadram em cada visão.
```
// Definir uma ACL para clientes internos  
acl "internos" {  
    127.0.0.1;  
    192.168.1.0/24;  
};

view "internal" {
    match-clients { internos; };
    recursion yes; // Permitir recursão para clientes internos

    // Zona com registros para a rede interna
    zone "exemplo.com" IN {
        type master;
        file "/etc/bind/internal/exemplo.com.db";
    };
    // Outras zonas internas...
};

view "external" {
    match-clients { any; }; // Todos os outros clientes
    recursion no; // NUNCA permitir recursão para clientes externos

    // Zona com registros para a rede externa (pública)
    zone "exemplo.com" IN {
        type master;
        file "/etc/bind/external/exemplo.com.db";
    };
    // Outras zonas públicas...
};
```

Neste cenário, seriam necessários dois arquivos de zona distintos para `exemplo.com`, cada um com os registros apropriados para a sua respectiva visão.

### **6.3 - Introdução ao DNSSEC**

**Considerações de Planejamento:** O DNSSEC (Domain Name System Security Extensions) adiciona uma camada significativa de complexidade, envolvendo a geração e gestão de chaves criptográficas e a interação com o registrador do seu domínio para estabelecer uma cadeia de confiança. A sua implementação deve ser bem planeada e compreendida.

**Conceito:** O DNSSEC foi projetado para proteger os utilizadores de dados DNS falsificados, como os resultantes de ataques de envenenamento de cache (cache poisoning). Ele faz isso assinando digitalmente os dados da zona com chaves criptográficas. Os resolvedores que suportam DNSSEC podem então verificar estas assinaturas para garantir que os dados recebidos são autênticos e não foram adulterados em trânsito.

**Habilitando a Validação (Lado Recursivo):** Para um servidor BIND que atua como um resolvedor de cache para clientes locais, habilitar a validação DNSSEC é simples. Adicione o seguinte ao bloco options no `named.conf.options`:
```
dnssec-validation auto;
```

Com esta opção, o BIND tentará validar as respostas para domínios que estão assinados com DNSSEC. Se desejar tornar a validação mais rigorosa, pode usar `dnssec-validation yes;`, mas isso requer que o BIND tenha acesso às chaves de confiança raiz (`root trust anchors`).

**Assinatura de Zona (Lado Autoritativo):** Assinar a sua própria zona é um processo mais avançado. Embora tradicionalmente exigisse o uso manual de ferramentas como `dnssec-keygen` e `dnssec-signzone`, as versões modernas do BIND suportam a assinatura em linha (`inline-signing`), que automatiza grande parte do processo. A configuração básica envolve adicionar o seguinte ao bloco zone:
```
zone "exemplo.com" IN {  
    type master;
    file "/etc/bind/exemplo.com.db";
    inline-signing yes;
    auto-dnssec maintain;
    key-directory "/etc/bind/keys/exemplo.com";
};
```

Isto instrui o BIND a gerar automaticamente as chaves (`ZSK` e `KSK`) e a assinar a zona. O administrador ainda é responsável por carregar a parte pública da `KSK` (o registro DS) para o seu registrador de domínio para completar a cadeia de confiança.

## **Conclusão**

A configuração de um servidor DNS BIND no Ubuntu é uma tarefa que, embora detalhada, é perfeitamente alcançável com uma abordagem metódica e uma compreensão clara dos seus componentes. Ao seguir este guia, o administrador de sistemas foi capaz de progredir desde a instalação inicial dos pacotes necessários, passando pela configuração segura do serviço e do firewall, até à criação e validação de zonas autoritativas de pesquisa direta e reversa. O ciclo de trabalho iterativo de "editar, validar, recarregar e testar" foi estabelecido como uma metodologia fundamental para garantir a estabilidade e a correção das configurações.

As melhores práticas de segurança foram um tema recorrente e central. A importância de isolar o serviço com um ambiente chroot, de alinhar as regras do firewalld com a lógica de acesso do BIND, e, acima de tudo, de restringir rigorosamente as consultas recursivas para evitar a criação de um resolvedor aberto, foram enfatizadas como pilares de uma implantação segura. Estes não são passos opcionais, mas sim requisitos essenciais para qualquer servidor DNS em um ambiente de produção.

Os tópicos avançados, como a replicação mestre-escravo (`master-slave replication`), o DNS de horizonte dividido (`split-horizon DNS`) e o DNSSEC, abrem caminho para a construção de uma infraestrutura de DNS verdadeiramente robusta, resiliente e segura. Eles demonstram a flexibilidade do BIND para se adaptar a arquiteturas de rede complexas e a requisitos de segurança rigorosos.

Para estudos futuros, recomenda-se o aprofundamento em estratégias de monitoramento de desempenho e ***logging*** do BIND, a exploração de tecnologias de DNS mais recentes como `DNS over TLS (DoT)` e `DNS over HTTPS (DoH)` para privacidade aprimorada, e um estudo completo sobre o gerenciamento do ciclo de vida das chaves DNSSEC. Com os fundamentos sólidos estabelecidos neste guia, o administrador está bem posicionado para continuar a expandir os seus conhecimentos e a construir e manter serviços de DNS de nível empresarial.

O conteudo utilizou das mesmas referências do artigo [BaseRedHat.md](BaseRHEL.md) e foi adaptado para o Debian/Ubuntu, com as devidas alterações de caminhos e comandos específicos para o sistema operacional.

#### **Referências**

1. [docs.rockylinux.org](http://docs.rockylinux.org)  
2. [forums.rockylinux.org/](http://forums.rockylinux.org/)  
3. [docs.redhat.com](http://docs.redhat.com)  
4. [www.ibm.com](http://www.ibm.com)  
5. [reintech.io](http://reintech.io)  
6. [www.digitalocean.com](http://www.digitalocean.com)  
7. [www.linuxbabe.com](http://www.linuxbabe.com)  
8. [centlinux.com/](http://centlinux.com/)  
9. [wiki.archlinux.org](http://wiki.archlinux.org)