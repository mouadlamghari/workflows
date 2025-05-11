const admin = require('firebase-admin');
const fs = require('fs-extra');
const path = require('path');
const loadServiceAccount = require('./service-account-loader');

// Parse command line arguments
const args = process.argv.slice(2);
const projectIdArg = args.find(arg => arg.startsWith('--project='));
const serviceAccountArg = args.find(arg => arg.startsWith('--service-account='));

// Extract values
const projectId = projectIdArg ? projectIdArg.split('=')[1] : process.env.FIREBASE_PROJECT_ID;
const serviceAccountPath = serviceAccountArg ? serviceAccountArg.split('=')[1] : null;

if (!projectId) {
  console.error('Error: Project ID is required. Use --project=YOUR_PROJECT_ID or set FIREBASE_PROJECT_ID in .env file');
  process.exit(1);
}

async function deleteAllUsers() {
  try {
    console.log(`Starting to delete all users from Firebase project: ${projectId}`);
    
    // Try to use service account from environment variables first
    try {
      console.log('Attempting to use service account from environment variables...');
      const serviceAccount = loadServiceAccount();
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      
    } catch (envError) {
      console.log('Could not use service account from environment variables:', envError.message);
      
      // Fall back to service account file if provided
      if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        console.log(`Using service account from file: ${serviceAccountPath}`);
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId
        });
      } else {
        console.error('Error: No valid service account available. Please provide a service account file or set environment variables.');
        process.exit(1);
      }
    }
    
    // Delete users using Admin SDK
    await deleteUsersWithAdminSDK();
    console.log('User deletion process completed');
    
  } catch (error) {
    console.error('Error in deleteAllUsers:', error);
    process.exit(1);
  }
}

// Function to delete users using Admin SDK
async function deleteUsersWithAdminSDK(nextPageToken) {
  try {
    // List users (up to 1000 at a time)
    const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
    
    // Extract UIDs
    const uids = listUsersResult.users.map(userRecord => userRecord.uid);
    
    if (uids.length === 0) {
      console.log('No users found to delete');
      return;
    }
    
    console.log(`Found ${uids.length} users to delete in this batch`);
    
    // Delete users in this batch
    try {
      const deleteResult = await admin.auth().deleteUsers(uids);
      console.log(`Successfully deleted ${deleteResult.successCount} users`);
      if (deleteResult.failureCount > 0) {
        console.log(`Failed to delete ${deleteResult.failureCount} users`);
        deleteResult.errors.forEach((err) => {
          console.error(`Error deleting user ${err.index}: ${err.error.message}`);
        });
      }
    } catch (error) {
      console.error('Error deleting users batch:', error);
    }
    
    // Process next page if available
    if (listUsersResult.pageToken) {
      console.log('Processing next batch of users...');
      await deleteUsersWithAdminSDK(listUsersResult.pageToken);
    } else {
      console.log('All user batches processed');
    }
  } catch (error) {
    console.error('Error listing users:', error);
  }
}

// Execute the function
deleteAllUsers();