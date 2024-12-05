# LDAP Node.js Integration

Este projeto demonstra como configurar um servidor LDAP usando o OpenLDAP, gerenciar entradas com o Apache Directory Studio e integrar a autenticação LDAP em uma aplicação Node.js.

---

## Introdução

Este projeto guia você através da configuração de um servidor LDAP e demonstra como integrá-lo em uma aplicação Node.js para autenticação de usuários. O LDAP (Lightweight Directory Access Protocol) é um protocolo aberto e neutro para acessar diretórios distribuídos e centralizar a autenticação.

## Pré-requisitos

- **Docker** instalado no sistema.
- **Node.js** e **npm** instalados.
- **Apache Directory Studio** para gerenciar o servidor LDAP.
- **Conhecimento básico de linha de comando e JavaScript**.

---

## Configuração do Servidor LDAP

### Instalar o Docker

Se ainda não tiver o Docker instalado, siga as instruções no site oficial:

- [Docker Desktop para Windows/Mac](https://www.docker.com/products/docker-desktop)
- [Docker Engine para Linux](https://docs.docker.com/engine/install/)

### Executar o OpenLDAP com Docker

Utilizaremos a imagem `osixia/openldap` para executar um servidor OpenLDAP em um contêiner Docker.

**Passo a passo:**

1. **Executar o contêiner OpenLDAP:**

   ```bash
   docker run --name my-openldap-container --detach \
     --publish 389:389 --publish 636:636 \
     --env LDAP_ORGANISATION="Example Corp" \
     --env LDAP_DOMAIN="example.com" \
     --env LDAP_ADMIN_PASSWORD="admin_password" \
     osixia/openldap:1.5.0
   ```

   **Parâmetros:**

   - `--name`: Nomeia o contêiner.
   - `--detach`: Executa o contêiner em segundo plano.
   - `--publish`: Mapeia as portas do contêiner para o host.
   - `--env`: Define variáveis de ambiente para configurar o LDAP.

2. **Verificar se o contêiner está em execução:**

   ```bash
   docker ps
   ```

---

## Gerenciamento do LDAP com Apache Directory Studio

### Instalar o Apache Directory Studio

Baixe e instale o Apache Directory Studio a partir do site oficial:

- [Download Apache Directory Studio](https://directory.apache.org/studio/)

### Conectar-se ao Servidor LDAP

1. **Inicie o Apache Directory Studio.**

2. **Crie uma nova conexão LDAP:**

   - Vá em **File** > **New** > **LDAP Connection**.
   - Configure:
     - **Connection Name**: `Servidor LDAP Local`.
     - **Hostname**: `localhost`.
     - **Port**: `389`.
     - **Encryption**: `No Encryption`.

3. **Autenticação:**

   - **Bind DN or user**: `cn=admin,dc=example,dc=com`.
   - **Bind password**: `admin_password`.

4. **Teste a conexão e finalize.**

### Criar Unidades Organizacionais (OUs)

1. **Criar `ou=users`:**

   - Clique com o botão direito em `dc=example,dc=com`.
   - Selecione **New** > **New Entry**.
   - Escolha **Create entry from scratch**.
   - Adicione `organizationalUnit` como classe de objeto.
   - Defina o RDN como `ou=users`.

2. **Criar `ou=groups`:**

   - Repita o processo acima, definindo o RDN como `ou=groups`.

### Criar Grupos

1. **Criar o grupo `cn=administrators`:**

   - Clique com o botão direito em `ou=groups`.
   - Selecione **New** > **New Entry**.
   - Escolha **Create entry from scratch**.
   - Adicione as classes de objeto `top` e `groupOfUniqueNames`.
   - Defina o RDN como `cn=administrators`.
   - Preencha o atributo `cn` com `administrators`.

### Criar Usuários

1. **Criar o usuário `uid=usuario_teste`:**

   - Clique com o botão direito em `ou=users`.
   - Selecione **New** > **New Entry**.
   - Escolha **Create entry from scratch**.
   - Adicione as classes de objeto `inetOrgPerson`, `organizationalPerson`, `person`, `top`.
   - Defina o RDN como `uid=usuario_teste`.
   - Preencha os atributos:
     - `cn`: `Usuario Teste`.
     - `sn`: `Teste`.
     - `uid`: `usuario_teste`.
     - `userPassword`: Defina uma senha.

### Adicionar Usuários aos Grupos

1. **Adicionar `usuario_teste` ao grupo `administrators`:**

   - Abra o grupo `cn=administrators`.
   - Edite o atributo `uniqueMember`.
   - Adicione o valor `uid=usuario_teste,ou=users,dc=example,dc=com`.

---

## Integração com Node.js

### Configurar o Ambiente Node.js

1. **Crie uma pasta para o projeto:**

   ```bash
   mkdir ldap-integration
   cd ldap-integration
   ```

2. **Inicialize o projeto:**

   ```bash
   npm init -y
   ```

3. **Instale as dependências:**

   ```bash
   npm install express body-parser ldapjs ldap-authentication ldap-escape dotenv
   ```

4. **Crie o arquivo `app.js`:**

   ```bash
   touch app.js
   ```

### Implementar a Autenticação LDAP

Edite o arquivo `app.js` com o seguinte conteúdo:

```javascript
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ldap = require('ldap-authentication');
const ldapjs = require('ldapjs');
const ldapEscape = require('ldap-escape');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/**
 * Autentica um usuário no LDAP.
 *
 * @param {string} username - O nome de usuário.
 * @param {string} password - A senha do usuário.
 * @returns {Promise<Object>} - Uma promessa que resolve para o objeto do usuário autenticado.
 */
async function authenticate(username, password) {
  const options = {
    ldapOpts: {
      url: process.env.LDAP_URL,
    },
    adminDn: process.env.LDAP_ADMIN_DN,
    adminPassword: process.env.LDAP_ADMIN_PASSWORD,
    userSearchBase: process.env.LDAP_USERS_BASE_DN,
    usernameAttribute: 'uid',
    username: ldapEscape.filter`${username}`,
    userPassword: password,
    userSearchFilter: '(uid={{username}})',
  };

  try {
    const user = await ldap.authenticate(options);
    return user;
  } catch (err) {
    console.error('Erro na autenticação:', err);
    throw err;
  }
}

/**
 * Obtém os grupos aos quais um usuário pertence no LDAP.
 *
 * @param {string} userDn - O Distinguished Name (DN) completo do usuário.
 * @returns {Promise<string[]>} - Uma promessa que resolve para uma lista de nomes de grupos.
 */
async function getUserGroups(userDn) {
  const client = ldapjs.createClient({
    url: process.env.LDAP_URL,
  });

  return new Promise((resolve, reject) => {
    // Autentica o cliente LDAP usando as credenciais de administrador
    client.bind(process.env.LDAP_ADMIN_DN, process.env.LDAP_ADMIN_PASSWORD, (err) => {
      if (err) {
        console.error('Erro ao conectar:', err);
        reject(err);
        return;
      }

      // Configura as opções de pesquisa LDAP
      const opts = {
        filter: `(uniqueMember=${userDn})`,
        scope: 'sub',
        attributes: ['cn'],
      };

      // Executa a pesquisa LDAP para encontrar os grupos do usuário
      client.search(process.env.LDAP_GROUPS_BASE_DN, opts, (err, res) => {
        if (err) {
          console.error('Erro na pesquisa LDAP:', err);
          reject(err);
          return;
        }

        const groups = [];

        res.on('searchEntry', (entry) => {
          console.log('Entrada encontrada:', entry);

          let cnValue = null;

          // Usando 'entry.object' para obter o 'cn'
          if (entry.object && entry.object.cn) {
            cnValue = entry.object.cn;
            console.log('cnValue obtido via entry.object:', cnValue);
          }

          // Adiciona o 'cn' ao array de grupos
          if (cnValue) {
            if (Array.isArray(cnValue)) {
              groups.push(...cnValue);
            } else {
              groups.push(cnValue);
            }
          } else {
            console.log('Não foi possível obter o cn da entrada:', entry.object);
          }
        });

        res.on('error', (err) => {
          console.error('Erro no evento de pesquisa:', err);
          reject(err);
        });

        res.on('end', (result) => {
          console.log('Fim da pesquisa LDAP:', result);
          client.unbind();
          resolve(groups);
        });
      });
    });
  });
}

/**
 * Endpoint de login para autenticar usuários.
 *
 * @name POST /login
 * @function
 * @memberof module:routes
 * @param {Object} req - O objeto de requisição Express.
 * @param {Object} res - O objeto de resposta Express.
 */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Autentica o usuário
    const user = await authenticate(username, password);

    // Obtém os grupos do usuário
    const groups = await getUserGroups(user.dn);

    // Verifica se o usuário é administrador
    if (groups.includes('administrators')) {
      res.json({ message: 'Autenticado como administrador', user, groups });
    } else {
      res.json({ message: 'Autenticado como usuário', user, groups });
    }
  } catch (err) {
    console.error('Erro na autenticação:', err);
    res.status(401).json({ error: 'Autenticação falhou', details: err.message });
  }
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
```

### Criar Endpoints para a Aplicação

Já incluímos o endpoint `/login` no código acima, que autentica o usuário e retorna suas informações e grupos.

### Testar a Aplicação

1. **Crie um arquivo `.env` com as variáveis de ambiente:**

   ```env
   LDAP_URL=ldap://localhost:389
   LDAP_BASE_DN=dc=example,dc=com
   LDAP_ADMIN_DN=cn=admin,dc=example,dc=com
   LDAP_ADMIN_PASSWORD=admin_password
   LDAP_USERS_BASE_DN=ou=users,dc=example,dc=com
   LDAP_GROUPS_BASE_DN=ou=groups,dc=example,dc=com
   ```

2. **Inicie o servidor:**

   ```bash
   node app.js
   ```

3. **Envie uma requisição de login:**

   ```bash
   curl -X POST http://localhost:3000/login \
     -H 'Content-Type: application/json' \
     -d '{"username": "usuario_teste", "password": "senha_teste"}'
   ```

4. **Verifique a resposta:**

   A resposta deve indicar se o usuário foi autenticado como administrador ou usuário comum, e retornar os detalhes do usuário e seus grupos.

---

## Considerações Finais

- **Segurança:**

  - Em produção, utilize conexões seguras (LDAPS).
  - Proteja suas variáveis de ambiente e não exponha informações sensíveis.

- **Logs e Monitoramento:**

  - Ajuste os níveis de log conforme necessário.
  - Monitore sua aplicação para identificar e resolver problemas rapidamente.

- **Manutenção:**

  - Mantenha suas dependências atualizadas.
  - Implemente testes para garantir a estabilidade da aplicação.

---

## Como Executar o Projeto

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/seu_usuario/ldap-nodejs-integration.git
   cd ldap-nodejs-integration
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Configure o arquivo `.env`:**

   - Edite o arquivo `.env` com as configurações do seu ambiente.

4. **Inicie o servidor LDAP com Docker:**

   - Siga as instruções na seção [Executar o OpenLDAP com Docker](#executar-o-openldap-com-docker).

5. **Inicie a aplicação Node.js:**

   ```bash
   node app.js
   ```

6. **Teste a aplicação:**

   - Use o `curl` ou ferramentas como Postman para enviar requisições ao endpoint `/login`.

---

## Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---
