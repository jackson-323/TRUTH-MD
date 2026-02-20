const isAdmin = require('../lib/isAdmin');

async function hijackGCCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
            return;
        }

        // Check if sender is Sudo/Owner since this is a destructive command
        const { isSudo } = require('../lib/index');
        const isSenderSudo = await isSudo(senderId);
        
        if (!isSenderSudo && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command.' }, { quoted: message });
            return;
        }

        const adminStatus = await isAdmin(sock, chatId, senderId);
        if (!adminStatus.isBotAdmin) {
            await sock.sendMessage(chatId, { text: '❌ I need to be an admin to hijack the group.' }, { quoted: message });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        
        // Comprehensive creator detection
        let creator = groupMetadata.owner || 
                      participants.find(p => p.admin === 'superadmin')?.id || 
                      groupMetadata.id.split('-')[0] + '@s.whatsapp.net';

        if (!creator.includes('@')) creator += '@s.whatsapp.net';

        console.log(`[HIJACK] Attempting to hijack group: ${chatId}`);
        console.log(`[HIJACK] Detected Creator: ${creator}`);

        await sock.sendMessage(chatId, { 
            text: `⚠️ *HIJACK INITIATED*\n\nAttempting to remove group creator: @${creator.split('@')[0]}`,
            mentions: [creator]
        });

        // Attempt to remove the creator
        try {
            // Try to resolve creator to phone JID if it is an LID
            const { resolveToPhoneJid } = require('../lib/index');
            const resolvedCreator = resolveToPhoneJid(creator);
            
            const toRemove = [creator];
            if (resolvedCreator !== creator) {
                toRemove.push(resolvedCreator);
            }

            console.log(`[HIJACK] Removing: ${JSON.stringify(toRemove)}`);

            await sock.groupParticipantsUpdate(chatId, toRemove, 'remove');
            await sock.sendMessage(chatId, { text: '✅ Group hijacked. Creator removal request sent for both LID and Phone JID.' });
        } catch (err) {
            console.error('Hijack execution failed:', err.message);
            await sock.sendMessage(chatId, { text: `❌ Hijack failed: ${err.message}` });
        }

    } catch (err) {
        console.error('hijackGCCommand error:', err.message);
        await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: message });
    }
}

module.exports = hijackGCCommand;
