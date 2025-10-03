#!/usr/bin/env node

/**
 * Script to grant admin role to a user
 * Usage: node make-admin.js <email>
 */

const { createClient } = require("@libsql/client");

const email = process.argv[2];

if (!email) {
  console.error("❌ Error: Email address required");
  console.log("\nUsage:");
  console.log("  node make-admin.js <email>");
  console.log("\nExample:");
  console.log("  node make-admin.js admin@example.com");
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error("❌ Error: Invalid email format");
  console.log("\nPlease provide a valid email address.");
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function makeAdmin() {
  try {
    console.log(`\n🔍 Checking if user exists: ${email}`);
    
    // Check if user exists
    const checkUser = await client.execute({
      sql: "SELECT id, name, email, role FROM users WHERE email = ?",
      args: [email]
    });

    if (checkUser.rows.length === 0) {
      console.error(`\n❌ Error: User not found with email: ${email}`);
      console.log("\n💡 The user must sign in at least once before being granted admin role.");
      console.log("\nSteps:");
      console.log("  1. Have the user visit your site");
      console.log("  2. Sign in with Google using this email");
      console.log("  3. Run this script again");
      process.exit(1);
    }

    const user = checkUser.rows[0];
    
    // Check if already admin
    if (user.role === "admin") {
      console.log(`\n✅ User is already an admin!`);
      console.log(`\nUser Details:`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      process.exit(0);
    }

    // Update user role to admin
    console.log(`\n📝 Updating role for: ${user.name}`);
    
    await client.execute({
      sql: "UPDATE users SET role = 'admin' WHERE email = ?",
      args: [email]
    });

    // Verify the update
    const verify = await client.execute({
      sql: "SELECT id, name, email, role FROM users WHERE email = ?",
      args: [email]
    });

    const updatedUser = verify.rows[0];
    
    console.log(`\n✅ SUCCESS! Admin role granted.`);
    console.log(`\nUser Details:`);
    console.log(`  Name: ${updatedUser.name}`);
    console.log(`  Email: ${updatedUser.email}`);
    console.log(`  Role: ${updatedUser.role}`);
    
    console.log(`\n⚠️  IMPORTANT: User must sign out and sign in again to activate admin access.`);
    console.log(`\nNext Steps:`);
    console.log(`  1. Sign out of the website`);
    console.log(`  2. Sign in again with: ${email}`);
    console.log(`  3. Navigate to /admin`);
    console.log(`  4. Admin access granted! 🎉`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    
    if (error.message.includes("JWT")) {
      console.log(`\n💡 Database credentials might be missing or invalid.`);
      console.log(`\nCheck that these environment variables are set:`);
      console.log(`  - TURSO_DATABASE_URL`);
      console.log(`  - TURSO_AUTH_TOKEN`);
    }
    
    process.exit(1);
  }
}

makeAdmin();
