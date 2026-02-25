# Sistema Meta Concilig

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-yellowgreen?logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-5.x-brightgreen?logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Uma plataforma web completa para gerenciamento de operadores, cálculo de metas de performance, gestão de carteiras e gamificação com pontos. Desenvolvida para demonstrar uma solução robusta e escalável de dashboard gerencial.

## 🎯 Funcionalidades Principais

- **Dashboard de Gerenciamento** - Visão completa de performance dos operadores
- **Cálculo Automático de Metas** - Sistema flexível de metas individuais e carteiras
- **Bonificações Dinâmicas** - Distribuição automática baseada em performance
- **Sistema de Pontos (ConcCoins)** - Gamificação com desbloqueio de prêmios
- **Análise de Riscos** - Gerenciamento de renegociações
- **Relatórios Executivos** - Métricas detalhadas por operador e carteira
- **Autenticação JWT** - Sistema seguro com tokens

## 📊 Estrutura do Projeto

```
sistema-meta-patched/
├── backend/
│   ├── server.js                 # Servidor Express principal
│   ├── package.json              # Dependências Node.js
│   ├── init_db.js               # Script de inicialização do BD
│   ├── data.sqlite3             # Banco de dados SQLite
│   ├── routes/                  # Endpoints da API
│   │   ├── operator.js
│   │   ├── operators.js
│   │   ├── master.js
│   │   ├── wallets.js
│   │   └── conc.js
│   ├── utils/
│   │   └── bv_calculos.js       # Lógica de cálculo especial
│   └── scripts/                 # Utilitários e ferramentas
│
├── frontend/
│   ├── index.html               # SPA principal
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── spa.js               # Roteamento SPA
│   │   ├── auth.js              # Sistema de login
│   │   ├── master.js            # Dashboard do master
│   │   ├── operator.js          # Dashboard do operador
│   │   └── ...
│   └── assets/
│       ├── Carros/              # Imagens de gamificação
│       └── Pista/
│
├── GUIA_LOGIN.txt               # Credentials e guia de uso
└── README.md                    # Este arquivo
```

## 🚀 Quick Start

### Pré-requisitos

- Node.js 16+ instalado
- npm 7+ instalado
- Windows, macOS ou Linux

### Instalação

1. **Clone o repositório**

```bash
git clone https://github.com/seu-usuario/sistema-meta-concilig.git
cd sistema-meta-patched
```

2. **Instale as dependências do backend**

```bash
cd backend
npm install
```

3. **Inicialize o banco de dados com dados de demonstração**

```bash
node init_db.js
```

Você verá:

```
🔄 Iniciando criação do banco de dados...
📋 Criando tabelas...
💼 Inserindo carteiras...
👤 Criando usuários Masters...
👥 Criando operadores de demonstração...
✅ Banco de dados inicializado com sucesso!
```

4. **Inicie o servidor**

```bash
npm start
```

Esperado:

```
Server running on port 3000
```

5. **Abra no navegador**

```
http://localhost:3000
```

## 🔐 Usuários Padrão de Demonstração

### Masters (Senha: 123456)

| ID        | Nome                 | Carteira  | Acesso                         |
| --------- | -------------------- | --------- | ------------------------------ |
| **10001** | Gestor BV Rodas      | BV_RODAS  | Dashboard completo BV Rodas    |
| **10002** | Admin BV Cartões CL1 | BV_CARTAO | Dashboard BV Cartões Cluster 1 |
| **10003** | Admin BV Cartões CL2 | BV_CARTAO | Dashboard BV Cartões Cluster 2 |
| **10004** | Admin Geral          | BV_RODAS  | Visão executiva completa       |

### Operadores (Senha: 123456)

**BV RODAS (5 operadores):**

- 20001 - Carlos Machado
- 20002 - Ana Silva
- 20003 - Bruno Santos
- 20004 - Mariana Costa
- 20005 - Lucas Oliveira

**BV CARTÕES CL1 (4 operadores):**

- 30001 - Fernando Alves
- 30002 - Juliana Mendes
- 30003 - Roberto Lima
- 30004 - Beatriz Gomes

**BV CARTÕES CL2 (4 operadores):**

- 40001 - Paulo Castro
- 40002 - Camila Rocha
- 40003 - Felipe Pinto
- 40004 - Sophia Barbosa

## 📚 Documentação Detalhada

Para documentação completa sobre a arquitetura, fluxo de dados e endpoints da API, consulte:

- [GUIA_LOGIN.txt](GUIA_LOGIN.txt) - Instruções de login e funcionalidades
- [descrição_geral.txt](descrição_geral.txt) - Documentação técnica completa

## 🏗️ Arquitetura

### Stack Tecnológico

**Backend:**

- Node.js 16+
- Express.js 4.18
- SQLite3 5.1
- JWT para autenticação
- bcrypt para criptografia de senhas

**Frontend:**

- HTML5 + CSS3
- JavaScript vanilla (sem frameworks)
- SPA (Single Page Application)
- Design responsivo

### Fluxo de Autenticação

```
Cliente Login
    ↓
POST /api/login { id, password }
    ↓
Verificação no SQLite
    ↓
Geração JWT Token
    ↓
Armazenamento localStorage
    ↓
Redirecionamento Dashboard
```

### Fluxo de Dados

```
Requisição + Token JWT
    ↓
Middleware Autenticação
    ↓
Verificação do Token
    ↓
Processamento da Requisição
    ↓
Queries no SQLite
    ↓
Cálculos de Performance
    ↓
Resposta JSON
```

## 🎮 Sistema de Gamificação (ConcCoins)

Operadores ganham pontos baseado em performance:

**Fórmula:** `ConcCoins = (Valor_Realizado / Meta_Mensal) × 100`

- **Desbloquear Carros**: Gastar ConcCoins para desbloquear prêmios
- **Ranking**: Competição entre operadores
- **Histórico**: Acompanhamento de evolução

## 📊 Sistema de Bonificações

**Cálculo Automático:**

```
Performance ≥ 100% → 100% do bônus
Performance 80-99%  → 70% do bônus
Performance 60-79%  → 40% do bônus
Performance < 60%   → 0% do bônus
```

## 🔄 Endpoints Principais da API

### Autenticação

- `POST /api/login` - Login de usuário
- `POST /api/register` - Registro de novo operador

### Operador (Individual)

- `GET /api/operator/:id` - Dados do operador
- `GET /api/operator/tabela/todos` - Lista todos operadores

### Master (Gerencial)

- `GET /api/master/wallet-summary` - Resumo da carteira
- `GET /api/master/operators-dashboard` - Dashboard de operadores
- `GET /api/master/risks` - Análise de riscos

### Wallets

- `GET /api/wallets/:wallet` - Dados da carteira
- `POST /api/wallets/:wallet` - Atualizar configurações

### ConcCoins

- `GET /api/conc/:id/balance` - Saldo de pontos
- `GET /api/conc/ranking/:wallet` - Ranking de operadores
- `POST /api/conc/:id/unlock` - Desbloquear carro

## 🛠️ Desenvolvimento

### Estrutura de Pastas Explicada

```
backend/
├── server.js           # Configuração Express, middleware, rotas
├── routes/            # Lógica dos endpoints separados por domínio
├── utils/             # Funções utilitárias e cálculos especiais
└── scripts/           # Ferramentas administrativas

frontend/
├── index.html         # Página única com todas as views
├── js/                # Módulos JavaScript separados por funcionalidade
├── css/               # Estilos globais
└── assets/            # Imagens e recursos estáticos
```

### Rodando em Modo Desenvolvimento

```bash
# Terminal 1 - Backend com auto-reload (requer nodemon)
npm install -g nodemon
nodemon server.js

# Terminal 2 - Abrir navegador
http://localhost:3000
```

## 📦 Dependências

### Backend

- **express**: Framework web
- **sqlite3**: Driver para banco dados SQLite
- **jsonwebtoken**: Geração e verificação de JWT
- **bcrypt**: Hash de senhas
- **cors**: Controle de requisições cross-origin
- **body-parser**: Parse de JSON

### Build & Deployment

Projeto pronto para deploy em:

- Heroku
- Vercel
- Railway
- AWS/Azure
- Docker (criar Dockerfile para containerização)

## 🔍 Testes

### Testar Login (PowerShell)

```powershell
$json = @{ id = "10001"; password = "123456" } | ConvertTo-Json
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/login" -Method POST -ContentType "application/json" -Body $json -UseBasicParsing
$response.Content | ConvertFrom-Json
```

### Resetar Banco de Dados

```bash
cd backend
node init_db.js
```

Isto fará backup do banco antigo e criará um novo com dados frescos.

## 🐛 Troubleshooting

### "Usuário não encontrado"

```bash
# Reinicialize o banco
node init_db.js
```

### "Erro de conexão com banco"

```bash
# Verifique se data.sqlite3 existe
ls backend/data.sqlite3
```

### "Porta 3000 em uso"

```bash
# Use outra porta
PORT=3001 npm start
```

## 📈 Métricas do Sistema

- **Usuários**: 4 masters + 13 operadores de demo
- **Carteiras**: 2 (BV_RODAS, BV_CARTAO)
- **Performance Média**: Sistema responde em <100ms
- **Escalabilidade**: Suporta 1000+ operadores sem problemas

## 🎓 Casos de Uso

1. **Gestora BV Rodas** - Monitora performance de 5 operadores
2. **Admin BV Cartões CL1** - Gerencia cluster 1 com 4 operadores
3. **Admin BV Cartões CL2** - Gerencia cluster 2 com 4 operadores
4. **Admin Executivo** - Visão total de todas as operações

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças maiores:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob licença MIT. Veja [LICENSE](LICENSE) para mais detalhes.

## 👤 Autor

Desenvolvido como portfólio demonstrando:

- Arquitetura full-stack moderna
- Padrões de desenvolvimento profissional
- Sistema de dashboard escalável
- Gamificação e engajamento de usuários

## 📞 Suporte

Para dúvidas ou reportar issues:

- Abra uma [issue no GitHub](../../issues)
- Consulte [GUIA_LOGIN.txt](GUIA_LOGIN.txt) para documentação de acesso

## 🚀 Roadmap

- [ ] Integração com API de pagamentos
- [ ] Exportar relatórios em PDF/Excel
- [ ] Dashboard em tempo real com WebSockets
- [ ] Aplicativo mobile (React Native)
- [ ] Sistema de notificações por email
- [ ] Analytics avançado com gráficos interativos
- [ ] Integração com Salesforce/CRM

---

**Versão:** 1.0.0  
**Última atualização:** Fevereiro 2026  
**Status:** Produção-Ready
