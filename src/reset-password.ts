const fs = require('fs-extra');
const crypto = require('crypto');
const { FirebaseScrypt } = require('firebase-scrypt');
// Parse command line arguments
const args = process.argv.slice(2);
const passwordArg = args.find(arg => arg.startsWith('--password='));
const inputFileArg = args.find(arg => arg.startsWith('--input='));
const outputFileArg = args.find(arg => arg.startsWith('--output='));
const hashKeyArg = args.find(arg => arg.startsWith('--hash-key='));

// Extract values or use defaults
const newPassword = passwordArg ? passwordArg.split('=')[1] : '12345678';
const inputFile = inputFileArg ? inputFileArg.split('=')[1] : 'users.json';
const outputFile = outputFileArg ? outputFileArg.split('=')[1] : 'users-changed.json';
const hashKey = hashKeyArg ? hashKeyArg.split('=')[1] : process.env.HASH_KEY || 'default-hash-key';

// Function to hash password with HMAC_SHA256 (to match Firebase import)
function hashPassword(password, salt, key) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(password + salt);
  return hmac.digest('base64');
}

const firebaseParameters = {
  memCost: 14, // Replace with your actual mem_cost
  rounds: 8, // Replace with your actual rounds
  saltSeparator: 'Bw==', // Replace with your base64_salt_separator
  signerKey:
    'rxyES8jOV+v9sElb5fsmWG8BMIDt0xrqBjukkQaY+A+hlvjFZIF0smIPQW1kqy83q5eGPv3/jFpc6sXl4rgTTQ==',
    algorithm: 'SCRYPT', // Replace with your hash_algorithm
  // Replace with your base64_signer_key
};
 
const scrypt = new FirebaseScrypt(firebaseParameters);
// Function to update users with new hashed passwords
async function updateUsersWithHashedPasswords() {
    try {
      const salt = crypto.randomBytes(16).toString('base64');
              // Hash the new password using Firebase's scrypt
      const hashedPassword = await scrypt.hash(newPassword, salt);
    // Load existing users from input file
    const usersData = await fs.readJson(inputFile);
    const data = usersData.users;
    
    
    const updatedUsers = data.map((user) => {
      return {
        ...user,
        passwordHash: hashedPassword,
        salt: salt,
      };
    });

    console.log(updatedUsers);
 
    // Save the updated users back to output file
    await fs.writeJson(
      outputFile,
      { users: updatedUsers },
      { spaces: 2 },
    );
 
    console.log(`✅ All passwords updated to "${newPassword}" with the same hash and saved in ${outputFile}.`);
    console.log(`Note: When importing to Firebase, use --hash-algo=HMAC_SHA256 --hash-key="${hashKey}"`);
  } catch (error) {
    console.error('❌ Error updating passwords:', error);
    process.exit(1);
  }
}
 
// Execute the function
updateUsersWithHashedPasswords();