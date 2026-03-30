import pool from './src/config/db.js';

// Função para limpar acentos e gerar o username
const generateUsername = (fullName, cpf) => {
    // Pega o primeiro nome, tira os acentos e joga para minúsculo
    const firstName = fullName.split(' ')[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    // Pega os últimos 2 dígitos do CPF
    const finalDigits = String(cpf).replace(/\D/g, '').slice(-2);
    
    return `${firstName}${finalDigits}`;
};

const runMigration = async () => {
    try {
        console.log("🔍 Buscando utilizadores sem username...");
        
        // Pega todo mundo que ainda não tem username
        const [users] = await pool.query("SELECT cpf, nome FROM gym_users WHERE username IS NULL");

        if (users.length === 0) {
            console.log("✅ Todos os utilizadores já possuem username! Nenhuma ação necessária.");
            process.exit(0);
        }

        console.log(`⏳ Atualizando ${users.length} contas. Isso deve ser rápido...`);

        let successCount = 0;

        for (const user of users) {
            const newUsername = generateUsername(user.nome, user.cpf);
            
            try {
                // Tenta salvar o novo username
                await pool.query("UPDATE gym_users SET username = ? WHERE cpf = ?", [newUsername, user.cpf]);
                console.log(`✔️ Sucesso: ${user.nome} agora é @${newUsername}`);
                successCount++;
            } catch (err) {
                // Se der erro (ex: duas pessoas com mesmo nome e mesmos dígitos no CPF)
                console.error(`❌ Erro ao atualizar ${user.nome} para @${newUsername}:`, err.message);
                
                // Plano B: adiciona 3 números aleatórios para garantir que seja único
                const randomBackup = Math.floor(Math.random() * 900) + 100;
                const backupUsername = `${newUsername}${randomBackup}`;
                
                await pool.query("UPDATE gym_users SET username = ? WHERE cpf = ?", [backupUsername, user.cpf]);
                console.log(`⚠️ Resolvido com Plano B: ${user.nome} agora é @${backupUsername}`);
                successCount++;
            }
        }

        console.log(`🚀 Migração concluída! ${successCount} contas foram atualizadas com sucesso!`);
    } catch (err) {
        console.error("💀 Erro fatal ao conectar com o banco:", err);
    } finally {
        process.exit(0); // Encerra o script
    }
};

runMigration();