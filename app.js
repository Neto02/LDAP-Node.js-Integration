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

          // Método preferencial: Usando 'entry.object'
          if (entry.object && entry.object.cn) {
            cnValue = entry.object.cn;
            console.log('cnValue obtido via entry.object:', cnValue);
          }

          // Caso 'cn' seja um array ou string, adiciona ao array 'groups'
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
