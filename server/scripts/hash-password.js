// Usage: npm run hash-password   (asks for the password, prints ADMIN_PASSWORD_HASH)
import readline from 'node:readline';
import { hashPassword } from '../src/security.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('New admin password (min 10 characters): ', (pw) => {
  rl.close();
  if (!pw || pw.length < 10) { console.error('Too short.'); process.exit(1); }
  console.log('\nPut this line into .env:\n\nADMIN_PASSWORD_HASH=' + hashPassword(pw) + '\n');
});
