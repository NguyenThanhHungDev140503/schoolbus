import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.development
const envPath = path.join(__dirname, '../.env.development');
dotenv.config({ path: envPath });

interface TraccarUser {
  id: number;
  name: string;
  email: string;
  administrator: boolean;
  readonly: boolean;
  map?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  password?: string;
  twelveHourFormat?: boolean;
  coordinateFormat?: string;
  disabled?: boolean;
  expirationTime?: string;
  deviceLimit?: number;
  userLimit?: number;
  deviceReadonly?: boolean;
  limitCommands?: boolean;
  poiLayer?: string;
  [key: string]: unknown;
}

async function getTraccarToken(): Promise<string | null> {
  const baseUrl = process.env.TRACCAR_BASE_URL || 'https://demo.traccar.org';
  const email = process.env.TRACCAR_USERNAME || process.env.TRACCAR_EMAIL;
  const password = process.env.TRACCAR_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: Missing credentials');
    console.error(
      'Please set TRACCAR_USERNAME (or TRACCAR_EMAIL) and TRACCAR_PASSWORD in .env.development',
    );
    console.error('\nExample:');
    console.error('TRACCAR_USERNAME=your_email@example.com');
    console.error('TRACCAR_PASSWORD=your_password');
    process.exit(1);
  }

  try {
    console.log(`🔐 Authenticating with Traccar at ${baseUrl}...`);
    console.log(`📧 Email: ${email}`);

    // Step 1: Create session (POST /api/session)
    // Traccar API requires application/x-www-form-urlencoded, not JSON
    const sessionParams = new URLSearchParams();
    sessionParams.append('email', email);
    sessionParams.append('password', password);

    const sessionResponse = await axios.post<TraccarUser>(
      `${baseUrl}/api/session`,
      sessionParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true, // Important: preserve cookies
      },
    );

    console.log('✅ Session created successfully!');
    console.log(
      `👤 User: ${sessionResponse.data.name} (${sessionResponse.data.email})`,
    );

    // Step 2: Generate token (POST /api/session/token)
    // This endpoint requires authentication (cookie from session or BasicAuth)
    // Response is a plain string token, not JSON
    const tokenResponse = await axios.post<string>(
      `${baseUrl}/api/session/token`,
      '', // Empty body, optional expiration can be added
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true, // Use cookie from session
        auth: {
          username: email,
          password: password,
        },
        // Axios treats string response as text, not JSON
        responseType: 'text',
      },
    );

    const token = tokenResponse.data.trim();

    if (!token) {
      console.error('❌ Error: No token received from Traccar');
      console.error('Response:', tokenResponse.data);
      process.exit(1);
    }

    console.log(`\n📋 Token: ${token}`);

    // Ask if user wants to update .env.development
    const args = process.argv.slice(2);
    const shouldUpdate = args.includes('--update') || args.includes('-u');

    if (shouldUpdate) {
      updateEnvFile(envPath, token);
    } else {
      console.log(
        '\n💡 Tip: Add --update or -u flag to automatically update .env.development',
      );
      console.log('   Example: yarn traccar:token --update');
    }

    return token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error('❌ Error: Authentication failed');
        console.error(
          `Status: ${error.response.status} ${error.response.statusText}`,
        );
        console.error('Response:', error.response.data);
      } else if (error.request) {
        console.error('❌ Error: No response from server');
        console.error('Request:', error.request);
      } else {
        console.error('❌ Error:', error.message);
      }
    } else {
      console.error('❌ Unexpected error:', error);
    }
    process.exit(1);
  }
}

function updateEnvFile(envPath: string, token: string): void {
  try {
    let envContent = '';

    // Read existing .env.development if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Update or add TRACCAR_TOKEN
    const tokenRegex = /^TRACCAR_TOKEN=.*$/m;
    if (tokenRegex.test(envContent)) {
      envContent = envContent.replace(tokenRegex, `TRACCAR_TOKEN=${token}`);
      console.log('\n✅ Updated TRACCAR_TOKEN in .env.development');
    } else {
      // Add new line if file doesn't end with newline
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `\n# Traccar API Token (auto-generated)\nTRACCAR_TOKEN=${token}\n`;
      console.log('\n✅ Added TRACCAR_TOKEN to .env.development');
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log('📝 File updated successfully!');
  } catch (error) {
    console.error('❌ Error updating .env.development:', error);
    console.error(
      'Please manually add the token to your .env.development file:',
    );
    console.error(`TRACCAR_TOKEN=${token}`);
  }
}

// Run the script
getTraccarToken()
  .then((token) => {
    if (token) {
      console.log('\n✨ Done!');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
