
# **Guia de configuração do DNS BIND no Linux**

## **1 \- Instalação e Configuração Inicial do Serviço**

### **1.1 \- Instalação dos Pacotes BIND**

Para instalar os pacotes, execute o seguinte comando com privilégios de superusuário:
```
sudo dnf install bind bind-utils -y
```
Verifique a versão do BIND instalada:
```
named -v
```

O resultado exibirá a versão do BIND, por exemplo: BIND 9.16.23-RH.

### **1.2 \- O Ambiente chroot (Opcional, mas Altamente Recomendado)**

Para habilitar esta funcionalidade, é necessário instalar um pacote adicional, bind-chroot.
```
sudo dnf install bind-chroot -y
```
O ambiente chroot é gerido automaticamente pelo systemd. O nome nome do serviço a ser gerenciado muda de named para named-chroot. Além disso, o sistema utiliza montagens (**mount \--bind**) para mapear os arquivos de configuração padrão (como /etc/named.conf e /var/named/) para dentro do diretório chroot. Isso oferece o melhor de dois mundos: a segurança do chroot sem a inconveniência de ter que manter cópias duplicadas dos arquivos de configuração dentro do jail. O administrador continua a editar os arquivos em seus locais padrão, como /etc/named.conf.

### **1.3 \- Gerenciamento do Serviço named com systemd**

No Rocky Linux, como em outras distribuições Linux modernas, os serviços são gerenciados pelo sistema de init systemd. O daemon do BIND, named 2, é controlado através da ferramenta de linha de comando
systemctl. 

A tabela abaixo resume os comandos essenciais do systemctl para o serviço BIND. Note que se o pacote bind-chroot foi instalado, o nome do serviço em todos os comandos deve ser substituído de named para named-chroot.

| Ação | Comando | Descrição |
| :---- | :---- | :---- |
| Iniciar Serviço | sudo systemctl start named | Inicia o serviço BIND na sessão atual. |
| Parar Serviço | sudo systemctl stop named | Para o serviço BIND imediatamente. |
| Reiniciar Serviço | sudo systemctl restart named | Para e inicia novamente o serviço. Útil após grandes alterações de configuração. |
| Recarregar Configuração | sudo systemctl reload named | Recarrega os arquivos de zona e configuração sem interromper o serviço. É o método preferido para aplicar alterações. |
| Habilitar no Boot | sudo systemctl enable named | Configura o serviço para iniciar automaticamente na inicialização do sistema. |
| Desabilitar no Boot | sudo systemctl disable named | Impede que o serviço inicie automaticamente na inicialização do sistema. |
| Verificar Estado | sudo systemctl status named | Mostra o estado atual do serviço, incluindo se está ativo, logs recentes e mensagens de erro. |
| Habilitar e Iniciar | sudo systemctl enable \--now named | Executa as ações de enable e start num único comando, sendo uma forma conveniente de ativar um novo serviço. |

A escolha de usar chroot desde o início influencia diretamente o comando de gerenciamento do serviço. Por exemplo, para habilitar e iniciar um BIND em chroot, o comando correto seria:
```
sudo systemctl enable --now named-chroot
```
Esta decisão inicial de reforçar a segurança tem um efeito cascata que deve ser mantido em mente ao longo de todo o processo de configuração e manutenção do servidor.

## **2- Protegendo o perimetro com firewalld**

Antes mesmo que qualquer consulta DNS chegue ao processo **named**, ela deve primeiro passar pelo firewall do sistema. A configuração do **firewalld** não é apenas um passo para abrir portas; é a primeira linha de defesa e deve ser configurada em alinhamento com a lógica de acesso que será definida posteriormente no próprio BIND.

### **2.1 \- Fundamentos do firewalld: Zonas e Permanência**

O firewalld é o frontend de firewall dinâmico padrão no Rocky Linux, gerenciando as regras de filtragem de pacotes do kernel. Dois conceitos são centrais para o seu funcionamento:

* **Zonas:** Uma zona é um conjunto de regras predefinidas que determinam o nível de confiança de uma rede. As interfaces de rede são atribuídas a uma zona, e o tráfego de entrada é tratado de acordo com as regras dessa zona. Zonas comuns incluem public (para redes não confiáveis), internal (para redes locais confiáveis) e trusted (que permite todo o tráfego).  
* **Permanência:** O **firewalld** distingue entre a configuração de tempo de execução (**runtime**), que é temporária e se perde na reinicialização, e a configuração permanente. Para que uma regra persista após a reinicialização, ela deve ser adicionada com o flag **\--permanent**. Após adicionar ou modificar uma regra permanente, o firewalld deve ser recarregado com o comando sudo **firewall-cmd \--reload** para que a nova configuração entre em vigor.

### **2.2. Criando Regras para o Tráfego DNS**

Existem duas abordagens principais para permitir o tráfego DNS através do firewalld.

#### **Método Padrão (Serviço Pré-definido)**

Para a maioria dos casos de uso, a maneira mais simples e recomendada é utilizar o serviço dns pré-definido. Este serviço abre automaticamente as portas 53 tanto para o protocolo TCP quanto para o UDP, que são os padrões utilizados pelo DNS. O comando deve ser executado na zona correta, que geralmente é a public para servidores com interfaces de rede públicas ou a zona à qual a sua interface de rede local está associada.
```
sudo firewall-cmd --add-service=dns --permanent
sudo firewall-cmd --reload
```
#### **Método Granular (Rich Rules)**

Para um controle de acesso mais rigoroso, especialmente em servidores que não devem ser consultados por qualquer pessoa na Internet, é preferível usar "rich rules". Estas regras permitem especificar condições mais complexas, como permitir o tráfego DNS apenas de endereços IP ou sub-redes específicas. Esta abordagem cria uma política de segurança mais robusta.

Por exemplo, para permitir consultas DNS provenientes exclusivamente da rede local 192.168.1.0/24:
```
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" service name="dns" accept'  
sudo firewall-cmd --reload
```
A configuração do firewall deve espelhar a lógica de acesso que será implementada no BIND. Se o BIND for configurado para responder apenas a clientes locais (**allow-query { localhost; 192.168.1.0/24; };**), a regra do firewalld deve refletir isso. Embora seja possível ter um firewall permissivo e um BIND restritivo, a prática de defesa em profundidade recomenda que ambas as camadas de controle sejam alinhadas e tão restritivas quanto possível, garantindo que pacotes indesejados sejam descartados o mais cedo possível, no nível do sistema operacional.

Para verificar as regras aplicadas, podem ser usados os seguintes comandos:

* Para verificar os serviços permitidos na zona padrão  
```
sudo firewall-cmd --list-services
```

* Para verificar as rich rules na zona padrão  
```
sudo firewall-cmd --list-rich-rules
```
## **3 \- Configuração Central do BIND: O Arquivo named.conf**

O coração da configuração do BIND reside no arquivo /etc/named.conf. A forma como este arquivo é configurado é ditada fundamentalmente pelo propósito do servidor DNS. Existem duas funções primárias: um **servidor autoritativo**, que detém os registros oficiais para um ou mais domínios, e um **servidor recursivo (ou de cache)**, que resolve consultas em nome de clientes locais, consultando outros servidores DNS na Internet. Um servidor pode desempenhar ambas as funções, mas as diretivas de configuração, especialmente as de segurança, mudam drasticamente com base nestes papéis.

### **3.1 \- Explicação do /etc/named.conf**

O arquivo **named.conf** utiliza uma sintaxe de declarações e blocos, como **options {}**, **logging {}** e **zone {}**. Para manter a organização, o arquivo principal geralmente utiliza a diretiva **include** para carregar arquivos de configuração adicionais. Um exemplo comum é a inclusão do **/etc/named.rfc1912.zones**, que é o local padrão em sistemas baseados em **RHEL** para definir as zonas locais (tanto de pesquisa direta quanto reversa).

### **3.2 \- Diretivas Essenciais no Bloco options**

O bloco **options {}** define os parâmetros globais para o comportamento do servidor BIND. A configuração deste bloco deve ser o primeiro passo e deve ser feita com cuidado, alinhando-a com o papel pretendido para o servidor.

* **listen-on port 53 {... };**: Especifica em quais endereços **IPv4** o **BIND** deve escutar por consultas. É uma prática de segurança crucial especificar os endereços IP do servidor aqui, em vez de usar **any**, para evitar que o **BIND** se ligue a interfaces inesperadas. Para um servidor local, isto seria o seu endereço IP na **LAN** e o endereço de **loopback (127.0.0.1)**.  
  * Exemplo: **listen-on port 53 { 127.0.0.1; 192.168.1.100; }**;  
* **listen-on-v6 port 53 {... };**: O equivalente para endereços IPv6.  
  * Exemplo: **listen-on-v6 port 53 { ::1; }**;  
* **directory "/var/named";**: Define o diretório de trabalho do BIND. Todos os caminhos de arquivo relativos para arquivos de zona serão baseados neste diretório.  
* **allow-query {... };**: Controla quais clientes (por endereço IP, sub-rede ou Access Control List \- ACL) têm permissão para fazer consultas ao servidor. Esta é uma diretiva de segurança fundamental. Para um servidor que serve apenas uma rede local, deve ser restringida a essa rede.  
  * Exemplo: **allow-query { localhost; 192.168.1.0/24; }**;

### **3.3 \- Diretivas Críticas de Segurança (Recursão e Transferências)**

A configuração da recursão é talvez o aspeto de segurança mais crítico do BIND. Um "open resolver" (resolvedor aberto) é um servidor DNS que aceita e processa consultas recursivas de qualquer cliente na Internet, tornando-se um vetor para ataques de amplificação de DNS.

* **Configuração para um Servidor Autoritativo (sem recursão):** Se o servidor existe apenas para responder por um domínio específico (ex: exemplo.com), a recursão deve ser desabilitada globalmente.  
  * **recursion no;**  
  * **allow-transfer { \<ip\_do\_servidor\_escravo\>; };**: Se existirem servidores secundários (escravos), esta diretiva deve ser usada para permitir que apenas esses servidores específicos solicitem uma cópia completa dos dados da zona (um processo chamado AXFR). Se não houver escravos, pode ser definida como  
    **{ none; }**;.  
* **Configuração para um Servidor Recursivo/Cache (para uma LAN):** Se o objetivo é que o servidor resolva nomes de domínio da Internet para os clientes da rede local, a recursão deve ser habilitada, mas estritamente controlada.  
  * **recursion yes;**  
  * **allow-recursion { localhost; 192.168.1.0/24; };**: Esta é a diretiva **crítica**. Ela garante que apenas os clientes da rede local (192.168.1.0/24) e o próprio servidor (localhost) possam fazer consultas recursivas. **Nunca** deve ser definida como **{ any; };** num servidor com um endereço IP público.  
  * **forwarders { \<ip\_dns\_provedor\_1\>; \<ip\_dns\_provedor\_2\>; };**: Opcionalmente, pode-se configurar o servidor para encaminhar todas as consultas recursivas para outros servidores DNS (como os fornecidos pelo ISP ou servidores públicos como **8.8.8.8** e **1.1.1.1**). Isso pode melhorar o desempenho e a eficiência.  
  * **forward only;**: Se a diretiva forwarders for usada, **forward only;** instrui o BIND a não tentar resolver as consultas por si mesmo se os encaminhadores não responderem.

A decisão de habilitar a recursão (**recursion yes;**) cria a necessidade imediata e inegociável de restringir quem pode usar essa recursão através de **allow-recursion**. Falhar neste ponto é um dos erros de configuração de segurança mais comuns e perigosos.

## **4 \- Zonas Autoritativas: Pesquisa Direta e Reversa**

Uma vez que a configuração global do BIND está definida, o próximo passo é criar os arquivos de dados que contêm os registros DNS para os domínios que o servidor irá gerir. Estes são conhecidos como arquivos de zona. Uma configuração completa inclui tanto uma zona de pesquisa direta (que mapeia nomes para IPs) quanto uma zona de pesquisa reversa (que mapeia IPs para nomes).

### **4.1. Declaração de uma Zona de Pesquisa Direta (Forward Lookup Zone)**

Primeiro, a zona deve ser declarada no arquivo de configuração do BIND. Como mencionado, a prática recomendada em sistemas como o Rocky Linux é adicionar esta declaração em **/etc/named.rfc1912.zones** ou num arquivo personalizado incluído no /etc/named.conf.5

A declaração de uma zona mestra (primária) para um domínio como exemplo.local teria a seguinte aparência:
```
zone "exemplo.local" IN {
    type master;
    file "exemplo.local.db";  
    allow-update { none; };  
};
```

* **type master;**: Indica que este servidor detém a cópia autoritativa e editável dos dados da zona.  
* **file "exemplo.local.db"**;: Especifica o nome do arquivo que contém os registros da zona. Este caminho é relativo ao diretório especificado na diretiva directory no bloco options (geralmente /var/named/).  
* **allow-update { none; };**: Por segurança, desabilita as atualizações dinâmicas de DNS para esta zona, o que significa que todas as alterações devem ser feitas manualmente editando o arquivo de zona.

### 

### **4.2 \- Construindo o Arquivo de Zona Direta**

O arquivo de zona é um arquivo de texto simples que contém os registros DNS. Ele deve ser criado no diretório **/var/named/** e ter as permissões corretas para que o processo **named** possa lê-lo. É comum definir a propriedade para **root:named** e as permissões para **640**. Em sistemas com base debian, o a propriedade é **root:bind**.

Abaixo está um exemplo de um arquivo de zona direta (**/var/named/exemplo.local.db**) com explicações detalhadas:
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
@       IN      A       192.168.1.10  
ns1     IN      A       192.168.1.100  
servidorweb IN  A       192.168.1.150
servidorweb IN  AAAA    2001:db8:1::150

; Registros de Troca de Correio (MX)
@       IN      MX      10 mail.exemplo.local.
mail    IN      A       192.168.1.200

; Registros de Nome Canônico (CNAME)
www     IN      CNAME   servidorweb.exemplo.local.
```

O registro **SOA** (**Start of Authority)** é o mais crítico. Ele define os parâmetros autoritativos para a zona. O campo **Serial** é de extrema importância: ele deve ser incrementado **toda vez** que o arquivo de zona for modificado. Os servidores secundários usam este número para detectar que uma nova versão da zona está disponível para transferência. Um formato comum e recomendado é

**YYYYMMDDNN**, onde **NN** é um contador de duas dígitos para as alterações feitas no mesmo dia.

A tabela a seguir resume os tipos de registros mais comuns utilizados nos arquivos de zona.

| Tipo de Registro | Nome Completo | Propósito e Exemplo de Uso |
| :---- | :---- | :---- |
| A | Address | Mapeia um nome de host para um endereço IPv4. Ex: servidor IN A 192.168.1.5 |
| AAAA | IPv6 Address | Mapeia um nome de host para um endereço IPv6. Ex: servidor IN AAAA 2001:db8::5 |
| CNAME | Canonical Name | Cria um alias (apelido) de um nome de host para outro nome de host (o nome canônico). Ex: www IN CNAME servidorweb |
| MX | Mail Exchanger | Especifica os servidores de e-mail para o domínio, com um número de prioridade (menor é mais prioritário). Ex: @ IN MX 10 mail.exemplo.local. |
| NS | Name Server | Delega uma zona a um servidor de nomes autoritativo. Ex: @ IN NS ns1.exemplo.local. |
| PTR | Pointer | Usado em zonas reversas para mapear um endereço IP de volta a um nome de host. Ex: 5 IN PTR servidor.exemplo.local. |
| SOA | Start of Authority | Declara a autoridade para a zona, contendo o servidor mestre, e-mail do administrador, serial e timers. |
| TXT | Text | Permite associar texto arbitrário a um domínio. Usado para SPF, DKIM, verificação de propriedade de domínio, etc. |

### **4.3. Declaração de uma Zona de Pesquisa Reversa (Reverse Lookup Zone)**

Uma zona de pesquisa reversa permite resolver um endereço IP para um nome de host, o que é crucial para muitos serviços de rede, como servidores de e-mail e alguns protocolos de autenticação. O nome da zona é construído de uma forma especial: os octetos do prefixo da rede IP são invertidos e o sufixo **.in-addr.arpa** é adicionado. Por exemplo, para a rede **192.168.1.0/24**, a zona reversa correspondente é [**1.168.192.in-addr.arpa**](http://1.168.192.in-addr.arpa).

A declaração desta zona no arquivo de configuração é semelhante à da zona direta:

```
zone "1.168.192.in-addr.arpa" IN {
    type master;
    file "1.168.192.db";
    allow-update { none; };
};
```

### **4.4 \- Construindo o Arquivo de Zona Reversa**

O arquivo de zona reversa também requer registros SOA e NS, mas o seu principal objetivo é conter registros PTR (Pointer). Estes registros fazem o mapeamento inverso de IP para nome. Para um determinado prefixo de rede, o registro PTR só precisa de especificar o último octeto do endereço IP.

Exemplo de arquivo de zona reversa (**/var/named/1.168.192.db**) para a rede **192.168.1.0/24**:
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
10      IN      PTR     exemplo.local.
100     IN      PTR     ns1.exemplo.local.
150     IN      PTR     servidorweb.exemplo.local.
200     IN      PTR     mail.exemplo.local.
```

Neste exemplo, o endereço IP 192.168.1.150 será resolvido para o nome de host **servidorweb.exemplo.local.**.

## **5 \- Validação, Ativação e Configuração do Cliente**

Após a criação dos arquivos de configuração e de zona, é fundamental seguir um processo metódico de validação antes de ativar o serviço. Este processo não é linear, mas sim um ciclo iterativo de "**editar \-\> validar \-\> recarregar \-\> testar**", que garante a estabilidade do serviço e facilita a depuração de erros.

### **5.1 \- Verificações Prévias: named-checkconf e named-checkzone**

Tentar iniciar ou recarregar o BIND com arquivos de configuração sintaticamente incorretos resultará em falha. Para evitar isso, o BIND fornece duas ferramentas de validação essenciais que devem ser executadas após qualquer modificação.

1. **named-checkconf**: Esta ferramenta verifica a sintaxe do arquivo principal /etc/named.conf e de todos os arquivos que ele inclui. Se a sintaxe estiver correta, o comando não produzirá nenhuma saída. Qualquer erro será reportado, indicando o arquivo e o número da linha.  
    ``` 
    sudo named-checkconf
    ```
3. **named-checkzone**: Esta ferramenta verifica a sintaxe e a integridade de um arquivo de zona individual. É necessário especificar o nome da zona e o caminho para o arquivo de zona correspondente. Um resultado bem-sucedido mostrará uma mensagem "OK" e o número de série carregado.  
* Validar a zona direta  
    ```
    sudo named-checkzone exemplo.local /var/named/[exemplo.local.db](http://exemplo.local.db)
    ```

* Validar a zona reversa
    ```  
    sudo named-checkzone 1.168.192.in-addr.arpa /var/named/1.168.192.db
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
    
Lembre-se de usar **named-chroot** se estiver a usar o ambiente **chroot**. Após a ativação, é prudente verificar os logs do sistema para garantir que não ocorreram erros durante o carregamento.
```
journalctl -u named -f --since "1 minute ago"
```

### **5.3 - Configurando Clientes Rocky Linux**

Para que os clientes na rede possam usar o novo servidor DNS, os seus resolvedores de DNS devem ser configurados para apontar para o endereço IP do servidor BIND. No Rocky Linux 9, a gestão da rede é controlada pelo NetworkManager, e a ferramenta de linha de comando nmcli é o método padrão para fazer essas alterações.

É importante **adicionar** o novo servidor DNS à lista de servidores existentes, em vez de o substituir, para não perder o acesso a nomes de domínio na Internet (a menos que o servidor BIND local também esteja configurado para recursão).2

Para adicionar o servidor DNS local (ex: 192.168.1.100) a uma conexão de rede chamada enp1s0:

* Adiciona o DNS local como primário, mantendo 8.8.8.8 como secundário  
    ```
    sudo nmcli con mod enp1s0 ipv4.dns "192.168.1.100 8.8.8.8"
    ```
* Aplica as alterações reativando a conexão  
    ```
    sudo nmcli con down enp1s0 && sudo nmcli con up enp1s0
    ```

Após a execução destes comandos, o arquivo **/etc/resolv.conf** no cliente deve ser atualizado automaticamente pelo NetworkManager para refletir a nova configuração.4

### **5.4 - Verificação com dig e nslookup**

O passo final do ciclo é testar se o servidor DNS está a responder corretamente às consultas. As ferramentas dig e nslookup são usadas para este fim.29

dig (Domain Information Groper) é geralmente preferido em ambientes Linux pela sua saída detalhada e flexibilidade.

* **Testando a Resolução Direta:** Para consultar um registro A para servidorweb.exemplo.local, especificando que a consulta deve ser enviada para o nosso servidor BIND em 192.168.1.100:  
  ```  
  dig @192.168.1.100 servidorweb.exemplo.local A
  ```
  A seção ANSWER SECTION na saída deve mostrar o endereço IP correto (192.168.1.150).  
* **Testando a Resolução Reversa:** Para realizar uma consulta de pesquisa reversa (PTR) para o IP 192.168.1.150, usa-se a opção \-x:  
  ```  
  dig @192.168.1.100 -x 192.168.1.150
  ```
  A seção ANSWER SECTION deve mostrar o nome de host correto (servidorweb.exemplo.local.).  
* **Exemplos com nslookup:** Os testes equivalentes com nslookup seriam:
  ```
  # Consulta direta  
  nslookup servidorweb.exemplo.local 192.168.1.100
  ```
  ```
  # Consulta reversa  
  nslookup 192.168.1.150 192.168.1.100
  ```
Se os testes forem bem-sucedidos, o ciclo está completo. Se falharem, o administrador deve voltar ao passo de edição, verificar os arquivos de configuração e de zona, e repetir o ciclo de validação e teste. Esta metodologia iterativa é a chave para uma gestão eficaz e segura do BIND.

## **6 - Configurações Avançadas do BIND**

Uma vez que a funcionalidade básica do servidor DNS está estabelecida e testada, é possível explorar recursos avançados para aumentar a redundância, a flexibilidade e a segurança. A implementação destes recursos, no entanto, não deve ser uma decisão impulsiva; exige um planejamento cuidadoso da arquitetura de rede, pois as suas implicações vão muito além da configuração de um único servidor.

### **6.1 - Implementando um Servidor DNS Secundário (Slave)**

**Considerações de Planejamento:** Antes de configurar um servidor secundário, é necessário garantir que existe um segundo host com conectividade de rede estável ao servidor primário (mestre). As regras de firewall em ambos os servidores devem ser ajustadas para permitir o tráfego de transferência de zona (porta 53/TCP) entre eles.

**Conceito e Benefícios:** A arquitetura mestre-escravo é o método padrão para fornecer redundância e balanceamento de carga para um serviço DNS. O servidor mestre detém a cópia editável dos arquivos de zona, enquanto um ou mais servidores escravos obtêm cópias somente leitura desses arquivos através de um processo chamado transferência de zona (AXFR/IXFR). Se o servidor mestre falhar, os escravos podem continuar a responder às consultas, garantindo a alta disponibilidade do serviço.

**Configuração no Servidor Mestre:** No servidor mestre, os blocos zone no arquivo de configuração devem ser modificados para permitir a transferência para o IP do servidor escravo.
```
zone "exemplo.local" IN {  
    type master;  
    file "exemplo.local.db";  
    allow-transfer { 192.168.1.101; }; // IP do servidor escravo  
    also-notify { 192.168.1.101; };    // Notifica o escravo sobre alterações  
};
```

**Configuração no Servidor Escravo:** No servidor escravo, o bloco zone é configurado com type slave e aponta para o endereço IP do mestre.
```
zone "exemplo.local" IN {  
    type slave;  
    file "slaves/exemplo.local.db"; // BIND irá criar este arquivo  
    masters { 192.168.1.100; };     // IP do servidor mestre  
};
```

Em sistemas com SELinux ativado (o padrão no Rocky Linux), pode ser necessário ajustar um booleano para permitir que o processo named escreva os arquivos de zona que recebe do mestre no diretório /var/named/slaves/.17
```
sudo setsebool -P named_write_master_zones on
```
### **6.2 - DNS de Horizonte Dividido (Split-Horizon) com view**

**Considerações de Planejamento:** A implementação de um DNS de horizonte dividido requer uma refatoração completa do arquivo /etc/named.conf. Todas as declarações de zona existentes devem ser movidas para dentro de blocos view. É crucial mapear claramente quais clientes pertencem a qual visão (interna ou externa) antes de iniciar a configuração.

**Caso de Uso:** Este é um cenário comum em que um servidor precisa fornecer respostas DNS diferentes dependendo da origem da consulta. Por exemplo, para servidorweb.exemplo.com, os clientes internos devem receber um endereço IP privado (ex: 192.168.1.150), enquanto os clientes externos (da Internet) devem receber um endereço IP público. Isto é conseguido com a diretiva view.

**Configuração com view:** O named.conf é estruturado com múltiplos blocos view. A diretiva match-clients é usada para especificar quais clientes se enquadram em cada visão.
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
        file "internal/exemplo.com.db";  
    };  
    // Outras zonas internas...  
};

view "external" {  
    match-clients { any; }; // Todos os outros clientes  
    recursion no; // NUNCA permitir recursão para clientes externos

    // Zona com registros para a rede externa (pública)  
    zone "exemplo.com" IN {  
        type master;  
        file "external/exemplo.com.db";  
    };  
    // Outras zonas públicas...  
};
```
Neste cenário, seriam necessários dois arquivos de zona distintos para exemplo.com, cada um com os registros apropriados para a sua respectiva visão.

### **6.3 - Introdução ao DNSSEC**

**Considerações de Planejamento:** O DNSSEC (Domain Name System Security Extensions) adiciona uma camada significativa de complexidade, envolvendo a geração e gestão de chaves criptográficas e a interação com o registrador do seu domínio para estabelecer uma cadeia de confiança. A sua implementação deve ser bem planeada e compreendida.

**Conceito:** O DNSSEC foi projetado para proteger os utilizadores de dados DNS falsificados, como os resultantes de ataques de envenenamento de cache (cache poisoning). Ele faz isso assinando digitalmente os dados da zona com chaves criptográficas. Os resolvedores que suportam DNSSEC podem então verificar estas assinaturas para garantir que os dados recebidos são autênticos e não foram adulterados em trânsito.

**Habilitando a Validação (Lado Recursivo):** Para um servidor BIND que atua como um resolvedor de cache para clientes locais, habilitar a validação DNSSEC é simples. Adicione o seguinte ao bloco options no named.conf:
```
dnssec-validation auto;
```
Com esta opção, o BIND tentará validar as respostas para domínios que estão assinados com DNSSEC.

**Assinatura de Zona (Lado Autoritativo):** Assinar a sua própria zona é um processo mais envolvido. Embora tradicionalmente exigisse o uso manual de ferramentas como dnssec-keygen e dnssec-signzone, as versões modernas do BIND suportam a assinatura em linha (inline-signing), que automatiza grande parte do processo. A configuração básica envolve adicionar o seguinte ao bloco zone:
```
zone "exemplo.com" IN {  
    type master;  
    file "exemplo.com.db";  
    inline-signing yes;  
    auto-dnssec maintain;  
    key-directory "keys/exemplo.com";  
};
```
Isto instrui o BIND a gerar automaticamente as chaves (ZSK e KSK) e a assinar a zona. O administrador ainda é responsável por carregar a parte pública da KSK (o registro DS) para o seu registrador de domínio para completar a cadeia de confiança.

## **Conclusão**

A configuração de um servidor DNS BIND no Rocky Linux é uma tarefa que, embora detalhada, é perfeitamente alcançável com uma abordagem metódica e uma compreensão clara dos seus componentes. Ao seguir este guia, o administrador de sistemas foi capaz de progredir desde a instalação inicial dos pacotes necessários, passando pela configuração segura do serviço e do firewall, até à criação e validação de zonas autoritativas de pesquisa direta e reversa. O ciclo de trabalho iterativo de "editar, validar, recarregar e testar" foi estabelecido como uma metodologia fundamental para garantir a estabilidade e a correção das configurações.

As melhores práticas de segurança foram um tema recorrente e central. A importância de isolar o serviço com um ambiente chroot, de alinhar as regras do firewalld com a lógica de acesso do BIND, e, acima de tudo, de restringir rigorosamente as consultas recursivas para evitar a criação de um resolvedor aberto, foram enfatizadas como pilares de uma implantação segura. Estes não são passos opcionais, mas sim requisitos essenciais para qualquer servidor DNS em um ambiente de produção.

Os tópicos avançados, como a replicação mestre-escravo, o DNS de horizonte dividido e o DNSSEC, abrem caminho para a construção de uma infraestrutura de DNS verdadeiramente robusta, resiliente e segura. Eles demonstram a flexibilidade do BIND para se adaptar a arquiteturas de rede complexas e a requisitos de segurança rigorosos.

Para estudos futuros, recomenda-se o aprofundamento em estratégias de monitoramento de desempenho e logging do BIND, a exploração de tecnologias de DNS mais recentes como DNS over TLS (DoT) e DNS over HTTPS (DoH) para privacidade aprimorada, e um estudo completo sobre o gerenciamento do ciclo de vida das chaves DNSSEC. Com os fundamentos sólidos estabelecidos neste guia, o administrador está bem posicionado para continuar a expandir os seus conhecimentos e a construir e manter serviços de DNS de nível empresarial.

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
