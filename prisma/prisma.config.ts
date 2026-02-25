/// <reference types="node" />
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is not set. Please check your .env file.',
  );
}

export default {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
