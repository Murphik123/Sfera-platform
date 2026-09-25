const { QdrantClient } = require('@qdrant/js-client-rest');
const { setGlobalDispatcher, ProxyAgent } = require('undici');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const localEnv = path.resolve(process.cwd(), '.env');
const parentEnv = path.resolve(process.cwd(), '../.env');

if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
} else {
  dotenv.config();
}

const PROXY_URL = process.env.PROXY_URL || 'http://192.168.31.98:65171';

if (process.env.NODE_ENV !== 'production') {
  setGlobalDispatcher(new ProxyAgent(PROXY_URL));
}

const qdrantUrl = process.env.QDRANT_URL || 'https://1846f899-b5af-47c7-80d4-af9221242693.eu-central-1-0.aws.cloud.qdrant.io';
const apiKey = process.env.QDRANT_API_KEY || process.env.QDRANT_KEY;

const qdrantClient = new QdrantClient({
  url: qdrantUrl,
  apiKey: apiKey,
  port: 443,
  checkCompatibility: false,
});

module.exports = { qdrantClient };
