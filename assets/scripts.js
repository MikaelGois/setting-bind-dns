document.addEventListener('DOMContentLoaded', () => {
  const workflowData = [
    {
      title: '1. Instalação',
      icon: '📦',
      description: 'Instale os pacotes BIND e as ferramentas essenciais. A abordagem varia ligeiramente entre as famílias de SO.',
      content: {
        redhat:
          `<h4 class="font-semibold text-lg mb-2">Comandos Principais (com chroot)</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md mb-2 text-sm">sudo dnf update\nsudo dnf install bind bind-utils -y</code>
<p class="text-sm mb-2">Para sistemas sem chroot, instale apenas <code>bind</code> e <code>bind-utils</code>.</p>
<h4 class="font-semibold text-lg mt-4 mb-2">Gerenciamento do Serviço</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo systemctl enable --now named</code>
<p class="text-sm mb-2">Use <code>systemctl</code> com o serviço <code>named</code> para sistemas sem chroot.</p>`,
        debian:
          `<h4 class="font-semibold text-lg mb-2">Comandos Principais</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md mb-2 text-sm">sudo apt-get update\nsudo apt-get install bind9 bind9utils dnsutils -y</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Gerenciamento do Serviço</h4>
<p class="text-sm mb-2">Em sistemas Debian, o serviço <code>named</code> tem um alias chamado de <code>bind9</code>.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo systemctl enable --now bind9</code>
<p class="text-sm mb-2">Ou:</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo systemctl enable --now named</code>`
      }
    },
    {
      title: '2. Configuração',
      icon: '⚙️',
      description: 'Edite os arquivos de configuração para definir o comportamento global e declarar suas zonas.',
      content: {
        redhat:
          `<h4 class="font-semibold text-lg mb-2">Arquivo Principal: <code>/etc/named.conf</code></h4>
<p class="text-sm mb-2">Defina as diretivas globais no bloco <code>options {}</code>. Exemplo:</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm mb-4">options {\n    listen-on port 53 { 127.0.0.1; 192.168.1.1; };\n    allow-query { localhost; 192.168.1.0/24; };\n    recursion yes;\n    allow-recursion { localhost; 192.168.1.0/24; };\n    ...\n};</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Declaração de Zona: <code>/etc/named.rfc1912.zones</code></h4>
<p class="text-sm mb-2">Você também pode criar um arquivo com outro nome (por exemplo, <code>/etc/named.exemplo.zones</code>).</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm mb-4">zone "exemplo.local" IN {\n    type master;\n    file "exemplo.local.db";\n    allow-update { none; };\n    ...\n};\n...</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Arquivo de Zona de pesquisa direta: <code>/var/named/exemplo.local.db</code></h4>
<p class="text-sm mb-2">Crie o arquivo de zona em <code>/var/named/</code> (por exemplo, <code>/var/named/exemplo.local.db</code>) e defina as permissões corretas.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm mb-4">\$TTL 86400\n@ IN SOA ns1.exemplo.local. admin.exemplo.local. (\n    2024052101 ; Serial\n    3600 ; Refresh\n    1800 ; Retry\n    604800 ; Expire\n    86400 ; Minimum TTL\n);\n\n@ IN NS ns1.exemplo.local.\nns1 IN A 192.168.1.1\n...</code>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo chown root:named /var/named/exemplo.local.db\nsudo chmod 640 /var/named/exemplo.local.db</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Arquivo de Zona de pesquisa reversa: <code>/var/named/1.168.192.in-addr.arpa.db</code></h4>
<p class="text-sm mb-2">Crie o arquivo de zona em <code>/var/named/</code> (por exemplo, <code>/var/named/1.168.192.in-addr.arpa.db</code>) e defina as permissões corretas.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm mb-4">\$TTL 86400\n@ IN SOA ns1.exemplo.local. admin.exemplo.local. (\n    2024052101 ; Serial\n    3600 ; Refresh\n    1800 ; Retry\n    604800 ; Expire\n    86400 ; Minimum TTL\n);\n\n@ IN NS ns1.exemplo.local.\n1 IN PTR ns1.exemplo.local.\n...</code>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo chown root:named /var/named/1.168.192.in-addr.arpa.db\nsudo chmod 640 /var/named/1.168.192.in-addr.arpa.db</code>`,
        debian:
          `<h4 class="font-semibold text-lg mb-2">Opções Globais: <code>/etc/bind/named.conf.options</code></h4>
<p class="text-sm mb-2">Defina as diretivas globais neste arquivo. Exemplo:</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm mb-4">options {\n    listen-on port 53 { 127.0.0.1; 192.168.1.1; };\n    allow-query { localhost; 192.168.1.0/24; };\n    recursion yes;\n    allow-recursion { localhost; 192.168.1.0/24; };\n    ...\n};</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Declaração de Zona: <code>/etc/bind/named.conf.local</code>)</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">zone "exemplo.local" {\n    type master;\n    file "/etc/bind/exemplo.local.db";\n    allow-update { none; };\n    ...\n};\n...</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Arquivo de Zona de pesquisa direta: <code>/etc/bind/exemplo.local.db</code></h4>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm mb-4">\$TTL 86400\n@ IN SOA ns1.exemplo.local. admin.exemplo.local. (\n    2024052101 ; Serial\n    3600 ; Refresh\n    1800 ; Retry\n    604800 ; Expire\n    86400 ; Minimum TTL\n);\n\n@ IN NS ns1.exemplo.local.\nns1 IN A 192.168.1.1\n...</code>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo chown root:named /etc/bind/exemplo.local.db\nsudo chmod 640 /etc/bind/exemplo.local.db</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Arquivo de Zona de pesquisa reversa: <code>/etc/bind/1.168.192.in-addr.arpa.db</code></h4>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm mb-4">\$TTL 86400\n@ IN SOA ns1.exemplo.local. admin.exemplo.local. (\n    2024052101 ; Serial\n    3600 ; Refresh\n    1800 ; Retry\n    604800 ; Expire\n    86400 ; Minimum TTL\n);\n\n@ IN NS ns1.exemplo.local.\n1 IN PTR ns1.exemplo.local.\n...</code>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo chown root:named /etc/bind/1.168.192.in-addr.arpa.db\nsudo chmod 640 /etc/bind/1.168.192.in-addr.arpa.db</code>`,
      }
    },
    {
      title: '3. Validação',
      icon: '✅',
      description: 'Sempre verifique a sintaxe dos seus arquivos de configuração e de zona antes de ativar o serviço.',
      content: {
        redhat:
          `<h4 class="font-semibold text-lg mb-2">Verificar Configuração Global</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md mb-2 text-sm">sudo named-checkconf</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Verificar Arquivo de Zona</h4>
<p class="text-sm mb-2">O caminho do arquivo de zona é relativo a <code>/var/named/</code>.\nValide a zona de pesquisa direta e reversa.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo named-checkzone exemplo.local /var/named/exemplo.local.db</code>`,
        debian:
          `<h4 class="font-semibold text-lg mb-2">Verificar Configuração Global</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md mb-2 text-sm">sudo named-checkconf</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Verificar Arquivo de Zona</h4>
<p class="text-sm mb-2">Use o caminho completo para o arquivo de zona.\nValide a zona de pesquisa direta e reversa.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">sudo named-checkzone exemplo.local /etc/bind/exemplo.local.db</code>`
      }
    },
    {
      title: '4. Ativação e Teste',
      icon: '🚀',
      description: 'Recarregue a configuração e teste a resolução de nomes com ferramentas como <code>dig</code>.',
      content: {
        redhat:
          `<h4 class="font-semibold text-lg mb-2">Aplicar Configurações</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md mb-2 text-sm">sudo systemctl reload named</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Testar com <code>dig</code></h4>
<p class="text-sm mb-2">Teste de consulta direta.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">dig @127.0.0.1 exemplo.local</code>
<p class="text-sm mb-2">Teste de consulta reversa.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">dig @127.0.0.1 -x 192.168.1.1</code>
<p class="text-sm mb-2">Teste de forwarding.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">dig @127.0.0.1 google.com</code>`,
        debian:
          `<h4 class="font-semibold text-lg mb-2">Aplicar Configurações</h4>
<code class="block bg-gray-800 text-white p-3 rounded-md mb-2 text-sm">sudo systemctl reload bind9</code>
<h4 class="font-semibold text-lg mt-4 mb-2">Testar com <code>dig</code></h4>
<p class="text-sm mb-2">Teste de consulta direta.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">dig @127.0.0.1 exemplo.local</code>
<p class="text-sm mb-2">Teste de consulta reversa.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">dig @127.0.0.1 -x 192.168.1.1</code>
<p class="text-sm mb-2">Teste de forwarding.</p>
<code class="block bg-gray-800 text-white p-3 rounded-md text-sm">dig @127.0.0.1 google.com</code>`,
      }
    }
  ];

  const recordData = {
    'A': { title: 'A (Address)', description: 'Mapeia um nome de host para um endereço IPv4. É o tipo de registro mais comum.', syntax: 'nome-do-host IN A endereco-ipv4', example: 'ns1 IN A 192.168.1.1' },
    'AAAA': { title: 'AAAA (IPv6 Address)', description: 'Mapeia um nome de host para um endereço IPv6.', syntax: 'nome-do-host IN AAAA endereco-ipv6', example: 'ns1 IN AAAA 2001:db8:1::1' },
    'CNAME': { title: 'CNAME (Canonical Name)', description: 'Cria um alias (apelido) de um nome para outro. O alias aponta para o nome canônico.', syntax: 'alias IN CNAME nome-canonico', example: 'www IN CNAME ns1.exemplo.local.' },
    'MX': { title: 'MX (Mail Exchanger)', description: 'Especifica os servidores de e-mail para o domínio, com uma prioridade numérica (menor é mais prioritário).', syntax: '@ IN MX prioridade servidor-de-email', example: '@ IN MX 10 mail.exemplo.local.' },
    'NS': { title: 'NS (Name Server)', description: 'Delega uma zona a um servidor de nomes autoritativo. Define quais servidores são responsáveis pelo domínio.', syntax: '@ IN NS nome-do-servidor-dns', example: '@ IN NS ns1.exemplo.local.' },
    'PTR': { title: 'PTR (Pointer)', description: 'Usado em zonas de pesquisa reversa para mapear um endereço IP de volta a um nome de host.', syntax: 'ultimo-octeto IN PTR nome-do-host', example: '1 IN PTR ns1.exemplo.local.' },
    'SOA': { title: 'SOA (Start of Authority)', description: 'Declara a autoridade para a zona, contendo informações críticas como o servidor mestre, o e-mail do administrador, o número de série e timers.', syntax: '@ IN SOA ...', example: '@ IN SOA ns1.exemplo.local. admin.exemplo.local. (\n    2024052101 ; Serial\n    ... )' },
    'TXT': { title: 'TXT (Text)', description: 'Permite associar texto arbitrário a um domínio. Usado para políticas de segurança como SPF e DKIM.', syntax: 'nome IN TXT "texto"', example: '@ IN TXT "v=spf1 mx -all"' },
  };

  const fullConfigData = {
    redhat: [
      {
        id: 'rh_named_conf',
        title: 'named.conf',
        code: `// /etc/named.conf
options {
  listen-on port 53 { 127.0.0.1; 192.168.1.1; };
  listen-on-v6 port 53 { ::1; };

  directory "/var/named";
  // dump-file "/var/named/data/cache_dump.db";
  // statistics-file "var/named/data/named_stats.txt";
  // memstatistics-file "/var/named/data/named_mem_stats.txt";
  // secroots-file "/var/named/data/named.secroots";
  // recursing-file "/var/named/data/named.recursing";

  allow-transfer { none; };
  allow-query { localhost; 192.168.1.0/24; };
  recursion yes;
  allow-recursion { localhost; 192.168.1.0/24; };
  forwarders { 8.8.8.8; 8.8.4.4; };
  dnssec-validation auto;
  pid-file "/run/named/named.pid";
};
logging {
  channel default_log {
    file "named.log" versions 3 size 20m;
    severity dynamic;
    print-time yes;
    print-category yes;
    print-severity yes;
  };
};
include "/etc/named.exemplo.zones";
include "/etc/named.root.key";`
      },
      {
        id: 'exemplo',
        title: 'named.exemplo.zones',
        code: `// /etc/named.exemplo.zones
zone "exemplo.local" IN {
    type master;
    file "exemplo.local.db";
    allow-update { none; };
};
zone "1.168.192.in-addr.arpa" IN {
    type master;
    file "1.168.192.db";
    allow-update { none; };
};`
      },
      {
        id: 'rh_direct',
        title: 'exemplo.local.db',
        code: `; /var/named/exemplo.local.db
$TTL 1D ; Default Time To Live
@     IN  SOA ns1.exemplo.local. admin.exemplo.local. (
          2025080101 ; Serial
          1H         ; Refresh
          15M        ; Retry
          1W         ; Expire
          1D )       ; Negative Cache TTL
@     IN  NS  ns1.exemplo.local.
ns1   IN  A   192.168.1.1`
      },
      {
        id: 'rh_reverse',
        title: '1.168.192.db',
        code: `; /var/named/1.168.192.db
$TTL 1D ; Default Time To Live
@     IN  SOA ns1.exemplo.local. admin.exemplo.local. (
          2025080101 ; Serial
          1H         ; Refresh
          15M        ; Retry
          1W         ; Expire
          1D )       ; Negative Cache TTL
@     IN  NS  ns1.exemplo.local.
1     IN  PTR ns1.exemplo.local.`
      }
    ],
    debian: [
      {
        id: 'deb_options',
        title: 'named.conf.options',
        code: `// /etc/bind/named.conf.options
options {
  listen-on port 53 { 127.0.0.1; 192.168.1.1; };
  listen-on-v6 port 53 { ::1; };

  directory "/var/cache/bind";
  // dump-file "/var/cache/bind/cache_dump.db";
  // statistics-file "/var/cache/bind/named_stats.txt";
  // memstatistics-file "/var/cache/bind/named_mem_stats.txt";
  // secroots-file "/var/cache/bind/named.secroots";
  // recursing-file "/var/cache/bind/named.recursing";

  allow-transfer { none; };
  allow-query { localhost; 192.168.1.0/24; };
  recursion yes;
  allow-recursion { localhost; 192.168.1.0/24; };
  forwarders { 8.8.8.8; 8.8.4.4; };
  dnssec-validation auto;
  pid-file "/run/named/named.pid";
};
logging {
  channel default_log {
    file "named.log" versions 3 size 20m;
    severity dynamic;
    print-time yes;
    print-category yes;
    print-severity yes;
  };
};`
      },
      {
        id: 'deb_local',
        title: 'named.conf.local',
        code: `// /etc/bind/named.conf.local
zone "exemplo.local" {
  type master;
  file "/etc/bind/exemplo.local.db";
  allow-update { none; };
};
zone "1.168.192.in-addr.arpa" {
  type master;
  file "/etc/bind/1.168.192.db";
  allow-update { none; };
};`
      },
      {
        id: 'deb_direct',
        title: 'exemplo.local.db',
        code: `; /etc/bind/exemplo.local.db
$TTL 1D ; Default Time To Live
@     IN  SOA ns1.exemplo.local. admin.exemplo.local. (
          2025080101 ; Serial
          1H         ; Refresh
          15M        ; Retry
          1W         ; Expire
          1D )       ; Negative Cache TTL
@     IN  NS  ns1.exemplo.local.
ns1   IN  A   192.168.1.1`
      },
      {
        id: 'deb_reverse',
        title: '1.168.192.db',
        code: `; /etc/bind/1.168.192.db
$TTL 1D ; Default Time To Live
@     IN  SOA ns1.exemplo.local. admin.exemplo.local. (
          2025080101 ; Serial
          1H         ; Refresh
          15M        ; Retry
          1W         ; Expire
          1D )       ; Negative Cache TTL
@     IN  NS  ns1.exemplo.local.
1     IN  PTR ns1.exemplo.local.`
      }
    ]
  };

  const workflowContainer = document.getElementById('workflow-container');
  const workflowDetails = document.getElementById('workflow-details');

  workflowData.forEach((step) => {
    const card = document.createElement('div');
    card.className = 'step-card bg-white p-6 rounded-lg shadow-md border-2 border-transparent';
    card.innerHTML = `<div class="flex items-center"><span class="text-3xl mr-4">${step.icon}</span><div><h3 class="font-bold text-xl">${step.title}</h3><p class="text-gray-600 text-sm">${step.description}</p></div></div>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      renderWorkflowDetails(step.content);
    });
    workflowContainer.appendChild(card);
  });

  function renderWorkflowDetails(content) {
    workflowDetails.innerHTML = `
                    <div class="flex border-b border-gray-200 mb-4">
                        <button data-tab="redhat" class="tab-button py-2 px-4 font-semibold text-gray-600 rounded-t-md active">Base Red Hat</button>
                        <button data-tab="debian" class="tab-button py-2 px-4 font-semibold text-gray-600 rounded-t-md">Base Debian</button>
                    </div>
                    <div>
                        <div data-tab-content="redhat" class="tab-content whitespace-pre-wrap">${content.redhat}</div>
                        <div data-tab-content="debian" class="tab-content whitespace-pre-wrap hidden">${content.debian}</div>
                    </div>
                `;

    workflowDetails.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.tab;

        workflowDetails.querySelectorAll('.tab-button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === targetTab);
        });

        workflowDetails.querySelectorAll('.tab-content').forEach(contentPanel => {
          contentPanel.classList.toggle('hidden', contentPanel.dataset.tabContent !== targetTab);
        });
      });
    });
  }

  const recordList = document.getElementById('record-list');
  const recordDetails = document.getElementById('record-details');

  Object.keys(recordData).forEach(key => {
    const li = document.createElement('li');
    li.className = 'record-item p-2 rounded-md cursor-pointer transition-colors hover:bg-gray-100';
    li.textContent = recordData[key].title;
    li.dataset.record = key;
    li.addEventListener('click', () => {
      document.querySelectorAll('.record-item').forEach(item => item.classList.remove('active'));
      li.classList.add('active');
      const data = recordData[key];
      recordDetails.innerHTML = `
                        <h3 class="font-bold text-xl mb-2">${data.title}</h3>
                        <p class="text-gray-600 mb-4">${data.description}</p>
                        <h4 class="font-semibold text-md mb-1">Sintaxe:</h4>
                        <code class="block bg-gray-100 text-gray-800 p-2 rounded-md mb-4 text-sm">${data.syntax}</code>
                        <h4 class="font-semibold text-md mb-1">Exemplo:</h4>
                        <code class="block bg-gray-800 text-white p-3 rounded-md text-sm whitespace-pre-wrap">${data.example}</code>
                    `;
    });
    recordList.appendChild(li);
  });

  const distroTabsContainer = document.querySelector('#config-example .flex.justify-center');
  const configTabsContainer = document.getElementById('config-tabs');
  const configContentContainer = document.getElementById('config-content');

  function renderConfigTabs(distro) {
    configTabsContainer.innerHTML = '';
    configContentContainer.innerHTML = '';

    fullConfigData[distro].forEach((file, index) => {
      const tabButton = document.createElement('button');
      tabButton.className = `config-tab font-semibold py-2 px-4 border-b-2 -mb-px ${index === 0 ? 'active' : 'border-transparent'}`;
      tabButton.textContent = file.title;
      tabButton.dataset.tab = file.id;
      configTabsContainer.appendChild(tabButton);

      const contentDiv = document.createElement('div');
      contentDiv.className = `config-content-panel ${index > 0 ? 'hidden' : ''}`;
      contentDiv.dataset.content = file.id;
      contentDiv.innerHTML = `
                        <button class="copy-button absolute top-2 right-2 bg-[#075985] text-white py-1 px-3 rounded-md text-sm">Copiar</button>
                        <pre class="bg-gray-800 text-white p-4 rounded-b-md rounded-tr-md overflow-x-auto"><code class="language-clike">${file.code.trim()}</code></pre>
                    `;
      configContentContainer.appendChild(contentDiv);
    });

    configTabsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('config-tab')) {
        const targetTab = e.target.dataset.tab;
        configTabsContainer.querySelectorAll('.config-tab').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        configContentContainer.querySelectorAll('.config-content-panel').forEach(panel => {
          panel.classList.toggle('hidden', panel.dataset.content !== targetTab);
        });
      }
    });
  }

  distroTabsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('distro-tab')) {
      const targetDistro = e.target.dataset.distro;
      distroTabsContainer.querySelectorAll('.distro-tab').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      renderConfigTabs(targetDistro);
    }
  });

  configContentContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-button')) {
      const codeToCopy = e.target.nextElementSibling.querySelector('code').innerText;
      const tempTextArea = document.createElement('textarea');
      tempTextArea.value = codeToCopy;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      try {
        document.execCommand('copy');
        e.target.textContent = 'Copiado!';
        setTimeout(() => { e.target.textContent = 'Copiar'; }, 2000);
      } catch (err) {
        console.error('Falha ao copiar: ', err);
      }
      document.body.removeChild(tempTextArea);
    }
  });

  renderConfigTabs('redhat');

  const tooltipTitleCallback = (tooltipItems) => {
    const item = tooltipItems[0];
    let label = item.chart.data.labels[item.dataIndex];
    return Array.isArray(label) ? label.join(' ') : label;
  };

  const sharedChartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { labels: { color: '#374151' } },
      tooltip: {
        callbacks: { title: tooltipTitleCallback },
        backgroundColor: '#111827',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 10,
        cornerRadius: 4,
      }
    }
  };

  new Chart(document.getElementById('securityLayersChart'), {
    type: 'doughnut',
    data: {
      labels: ['Firewall (firewalld)', 'BIND (named.conf)'],
      datasets: [{
        data: [50, 50],
        backgroundColor: ['#3B82F6', '#075985'],
        borderColor: '#F8F7F4',
        borderWidth: 4
      }]
    },
    options: { ...sharedChartOptions, cutout: '60%' }
  });

  new Chart(document.getElementById('securityDirectivesChart'), {
    type: 'bar',
    data: {
      labels: ['allow-recursion', 'recursion', 'allow-query', 'listen-on', 'allow-transfer'],
      datasets: [{
        label: 'Nível de Criticidade',
        data: [10, 9, 8, 7, 6],
        backgroundColor: ['#DC2626', '#F59E0B', '#075985', '#075985', '#F59E0B'],
        borderRadius: 4
      }]
    },
    options: {
      ...sharedChartOptions,
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: sharedChartOptions.plugins.tooltip },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { display: false } }
      }
    }
  });

  new Chart(document.getElementById('advancedTopicsChart'), {
    type: 'radar',
    data: {
      labels: ['Complexidade', 'Impacto na Segurança', 'Impacto na Disponibilidade'],
      datasets: [
        { label: 'Mestre/Escravo', data: [4, 3, 9], fill: true, backgroundColor: 'rgba(7, 89, 133, 0.2)', borderColor: '#075985', pointBackgroundColor: '#075985' },
        { label: 'Split-Horizon', data: [6, 7, 5], fill: true, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6', pointBackgroundColor: '#3B82F6' },
        { label: 'DNSSEC', data: [9, 10, 6], fill: true, backgroundColor: 'rgba(109, 40, 217, 0.2)', borderColor: '#6D28D9', pointBackgroundColor: '#6D28D9' }
      ]
    },
    options: {
      ...sharedChartOptions,
      scales: {
        r: {
          angleLines: { color: '#D1D5DB' },
          grid: { color: '#E5E7EB' },
          pointLabels: { font: { size: 13 }, color: '#374151' },
          ticks: { display: false, stepSize: 2 }
        }
      }
    }
  });

  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('main section');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (pageYOffset >= sectionTop - 100) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href').includes(current)) {
        link.classList.add('active');
      }
    });
  });
});